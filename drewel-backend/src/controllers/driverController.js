import bcrypt from "bcrypt";
import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import Ride from "../models/Ride.js";
import DriverLogs from "../models/Driverlogs.js";
import Admin from "../models/Admin.js";
import { sendResponse } from "../helpers/responseHelper.js";
import { buildPublicAssetUrl } from "../utils/publicAssets.js";
import { transitionDriverRequest } from "../services/driverRequestTransitionService.js";
import { PROFILE_PROPOSAL_FIELDS } from "../utils/adminRequestDetails.js";
import {
  AVAILABLE_DRIVER_FIELDS,
  buildDubaiDiscoveryAggregation,
  buildAvailableDriverFilter,
  buildFreshDubaiMarketplaceAvailabilityFilter,
  buildFreshMarketplaceAvailabilityFilter,
  parseDriverDiscoveryQuery,
  toAvailableDriverDto,
} from "../utils/availableDrivers.js";
import {
  buildDriverLocationUpdate,
  DUBAI_SERVICE_AREA,
  isTunisiaTestActorAllowed,
  serviceAreaForCoordinates,
  validateCoordinates,
} from "../utils/dubaiLocation.js";
import { io } from "../socket/index.js";
import {
  grantWelcomeBonusInSession,
  runPointsTransaction,
} from "../services/pointsWalletService.js";
import {
  buildActiveDriverPresenceFilter,
  endDriverPresence,
  establishDriverPresence,
  heartbeatDriverPresence,
  forceEndDriverPresence,
  toDriverPresenceEvent,
} from "../services/driverPresenceService.js";

export {
  AVAILABLE_DRIVER_FIELDS,
  buildAvailableDriverFilter,
} from "../utils/availableDrivers.js";

const DRIVER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed",
};

export const canDriverSetOnlineStatus = (driver, requestedOnline) =>
  requestedOnline !== true ||
  (driver?.status === DRIVER_STATUS.COMPLETED &&
    driver?.isApproved === true &&
    driver?.isRestricted !== true &&
    driver?.isDeleted !== true);

const splitFullName = (fullName = "") => {
  const trimmed = String(fullName).trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
};

const syncLegacyFields = (driver) => {
  const first = String(driver.firstName ?? "").trim();
  const last = String(driver.lastName ?? "").trim();
  driver.fullName = [first, last].filter(Boolean).join(" ").trim();
  driver.isApproved =
    driver.status === DRIVER_STATUS.APPROVED ||
    driver.status === DRIVER_STATUS.COMPLETED;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return undefined;
};

const getFileUrl = (req, file) =>
  buildPublicAssetUrl(req, "/api/users/get-image/", file?.filename);

export const buildProfileProposalSnapshot = (
  driver,
  body = {},
  fileValues = {},
) => {
  const snapshot = { driverId: driver?._id };
  for (const field of PROFILE_PROPOSAL_FIELDS) {
    if (driver?.[field] !== undefined) snapshot[field] = driver[field];
  }
  for (const [field, value] of Object.entries(body)) {
    if (PROFILE_PROPOSAL_FIELDS.includes(field) && value !== undefined) {
      snapshot[field] = value;
    }
  }
  for (const [field, value] of Object.entries(fileValues)) {
    if (PROFILE_PROPOSAL_FIELDS.includes(field) && value) {
      snapshot[field] = value;
    }
  }
  return snapshot;
};

const isAdminUser = async (userId) => {
  if (!userId) return false;
  const admin = await Admin.findById(userId);
  return !!admin && admin.role === "admin";
};

const canAccessDriver = async (req, driverId) => {
  if (!req.user?._id || !driverId) return false;
  if (String(req.user._id) === String(driverId)) return true;
  return isAdminUser(req.user._id);
};

const applyStatusTransition = (driver, status, rejectionReason = "") => {
  driver.status = status;
  if (status === DRIVER_STATUS.APPROVED) {
    driver.approvedAt = new Date();
    driver.rejectionReason = "";
  } else if (status === DRIVER_STATUS.REJECTED) {
    driver.rejectionReason = String(rejectionReason || "").trim();
  } else if (status === DRIVER_STATUS.PENDING) {
    driver.rejectionReason = "";
    driver.approvedAt = null;
  } else if (status === DRIVER_STATUS.COMPLETED) {
    if (!driver.approvedAt) {
      driver.approvedAt = new Date();
    }
    if (!driver.completedAt) {
      driver.completedAt = new Date();
    }
    driver.rejectionReason = "";
  }
  syncLegacyFields(driver);
};

const hasRequiredProfileDocs = (driver) => {
  return Boolean(
    (driver.licenseCarUrl || driver.carLicenseFrontUrl) &&
      (driver.licenseDriverUrl || driver.drivingLicenseFrontUrl) &&
      driver.profileImageUrl &&
      (driver.idDocumentUrl || driver.idProofFrontUrl) &&
      driver.passportCopyUrl
  );
};

const normalizeDriverStatus = (driver) => {
  if (driver.isApproved) {
    // Request 1 approval is independent from the document/profile request.
    // Never infer legacy "completed" merely because profile documents exist.
    if (![DRIVER_STATUS.APPROVED, DRIVER_STATUS.COMPLETED].includes(driver.status)) {
      driver.status = DRIVER_STATUS.APPROVED;
    }
    syncLegacyFields(driver);
    return;
  }

  if (driver.status === DRIVER_STATUS.APPROVED || driver.status === DRIVER_STATUS.COMPLETED) {
    syncLegacyFields(driver);
    return;
  }

  if (driver.status === DRIVER_STATUS.REJECTED || driver.status === DRIVER_STATUS.PENDING) {
    syncLegacyFields(driver);
    return;
  }

  driver.status = DRIVER_STATUS.PENDING;
  syncLegacyFields(driver);
};

const setDriverFiles = (driver, req, files = {}) => {
  const licenseCarFile = files.license_car?.[0] || files.carLicenseFront?.[0];
  const licenseDriverFile =
    files.license_driver?.[0] || files.drivingLicenseFront?.[0];
  const profileImageFile = files.profile_image?.[0] || files.profileImage?.[0];
  const idDocumentFile = files.id_document?.[0] || files.idProofFront?.[0];
  const passportCopyFile = files.passport_copy?.[0] || files.passportCopy?.[0];

  if (licenseCarFile) {
    const url = getFileUrl(req, licenseCarFile);
    driver.licenseCarUrl = url;
    driver.carLicenseFrontUrl = url;
  }
  if (licenseDriverFile) {
    const url = getFileUrl(req, licenseDriverFile);
    driver.licenseDriverUrl = url;
    driver.drivingLicenseFrontUrl = url;
  }
  if (profileImageFile) {
    driver.profileImageUrl = getFileUrl(req, profileImageFile);
  }
  if (idDocumentFile) {
    const url = getFileUrl(req, idDocumentFile);
    driver.idDocumentUrl = url;
    driver.idProofFrontUrl = url;
  }
  if (passportCopyFile) {
    driver.passportCopyUrl = getFileUrl(req, passportCopyFile);
  }
};

const ensureProfilePayload = (driver, files, body) => {
  const vehicleType = String(
    body?.vehicle_type || body?.vehicleType || driver?.vehicleType || ""
  ).trim();
  const city = String(body?.city || driver?.city || "").trim();

  if (!vehicleType) return "vehicle_type is required";
  if (!city) return "city is required";

  return "";
};

export const createDriverRequest = async (req, res) => {
  try {
    const { first_name, last_name, whatsapp_number } = req.body || {};
    if (!first_name || !last_name || !whatsapp_number) {
      return res.status(400).send({
        success: false,
        message: "first_name, last_name and whatsapp_number are required",
      });
    }

    const driver = await Driver.findById(req.user?._id);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found. Please login again.",
      });
    }

    if (driver.status === DRIVER_STATUS.COMPLETED) {
      return res.status(400).send({
        success: false,
        message: "Driver profile is already completed",
      });
    }

    driver.firstName = String(first_name).trim();
    driver.lastName = String(last_name).trim();
    driver.whatsappNumber = String(whatsapp_number).trim();
    driver.basicRequestSubmittedAt = new Date();
    applyStatusTransition(driver, DRIVER_STATUS.PENDING);

    await driver.save();

    return res.status(200).send({
      success: true,
      message: "Driver verification request submitted successfully",
      driver,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to submit driver request",
      error: error.message,
    });
  }
};

export const getDriverVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send({
        success: false,
        message: "Driver id is required",
      });
    }

    const hasAccess = await canAccessDriver(req, id);
    if (!hasAccess) {
      return res.status(403).send({
        success: false,
        message: "You are not authorized to view this driver status",
      });
    }

    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found",
      });
    }

    normalizeDriverStatus(driver);
    await driver.save();

    return res.status(200).send({
      success: true,
      message: "Driver status fetched successfully",
      status: driver.status,
      rejection_reason: driver.rejectionReason ?? "",
      isProfileUnlocked: driver.status === DRIVER_STATUS.APPROVED,
      profile_request_status: driver.profileRequestStatus || "not_submitted",
      profileRequestStatus: driver.profileRequestStatus || "not_submitted",
      profile_rejection_reason: driver.profileRejectionReason || "",
      profileRejectionReason: driver.profileRejectionReason || "",
      profile_submitted_at: driver.profileSubmittedAt || null,
      profileSubmittedAt: driver.profileSubmittedAt || null,
      profile_approved_at: driver.profileApprovedAt || null,
      profileApprovedAt: driver.profileApprovedAt || null,
      isFullyApproved:
        driver.status === DRIVER_STATUS.COMPLETED &&
        driver.profileRequestStatus === DRIVER_STATUS.APPROVED,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to fetch driver status",
      error: error.message,
    });
  }
};

export const completeDriverProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).send({
        success: false,
        message: "Driver id is required",
      });
    }

    if (String(req.user?._id) !== String(id)) {
      return res.status(403).send({
        success: false,
        message: "You are not authorized to complete this profile",
      });
    }

    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found",
      });
    }

    normalizeDriverStatus(driver);
    if (driver.status !== DRIVER_STATUS.APPROVED) {
      return res.status(403).send({
        success: false,
        message: "Profile completion is allowed only after admin approval",
      });
    }

    const payloadError = ensureProfilePayload(driver, req.files || {}, req.body || {});
    if (payloadError) {
      return res.status(400).send({
        success: false,
        message: payloadError,
      });
    }

    const body = req.body || {};

    const transitionedDriver = await transitionDriverRequest({
      requestId: driver._id,
      newStatus: "pending",
      requestStage: "profile",
      actor: {
        _id: req.user._id,
        fullName: driver.fullName,
        email: driver.email,
        actorType: "driver",
      },
      mutateDriver: async (currentDriver) => {
        if (body.first_name) currentDriver.firstName = String(body.first_name).trim();
        if (body.last_name) currentDriver.lastName = String(body.last_name).trim();
        currentDriver.address = String(body.address || "").trim();
        currentDriver.contractNumber = String(body.contract_number || "").trim();
        currentDriver.licenseCompany = String(body.license_company || "").trim();
        currentDriver.city = String(body.city || currentDriver.city || "").trim();
        currentDriver.vehicleType = String(
          body.vehicle_type || body.vehicleType || currentDriver.vehicleType || ""
        ).trim();
        setDriverFiles(currentDriver, req, req.files || {});
        currentDriver.fullName = [currentDriver.firstName, currentDriver.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
      },
    });

    return res.status(200).send({
      success: true,
      message: "Driver profile submitted for approval successfully",
      driver: transitionedDriver,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).send({
      success: false,
      message: statusCode === 500 ? "Failed to complete profile" : error.message,
      ...(error?.code ? { code: error.code } : {}),
    });
  }
};

export const addPersonalDetails = async (req, res) => {
  const {
    fullName,
    firstName,
    lastName,
    whatsappNumber,
  } = req.body || {};

  try {
    const driver = await Driver.findById(req.user?._id);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Please login again",
      });
    }

    const split = splitFullName(fullName || "");
    driver.firstName = String(firstName || split.firstName).trim();
    driver.lastName = String(lastName || split.lastName).trim();
    if (whatsappNumber) {
      driver.whatsappNumber = String(whatsappNumber).trim();
    }
    if (!driver.basicRequestSubmittedAt) {
      driver.basicRequestSubmittedAt = new Date();
    }

    applyStatusTransition(driver, DRIVER_STATUS.PENDING);
    await driver.save();

    return res.status(200).send({
      success: true,
      message: "Driver request submitted successfully",
      driver,
    });
  } catch (error) {
    return sendResponse(
      res,
      500,
      false,
      "Failed to update details",
      error.message
    );
  }
};

export const updatePersonalDetails = async (req, res) => {
  try {
    const { id } = req.body || {};
    const requesterIsAdmin = await isAdminUser(req.user?._id);
    const targetDriverId = requesterIsAdmin ? id : req.user?._id;

    if (!targetDriverId) {
      return res.status(400).send({
        success: false,
        message: "Driver ID is required",
      });
    }

    if (
      !requesterIsAdmin &&
      id &&
      String(id) !== String(req.user?._id)
    ) {
      return res.status(403).send({
        success: false,
        message: "You can only update your own driver profile",
      });
    }

    const driver = await Driver.findById(targetDriverId);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found",
      });
    }

    normalizeDriverStatus(driver);
    if (
      !requesterIsAdmin &&
      ![DRIVER_STATUS.APPROVED, DRIVER_STATUS.COMPLETED].includes(driver.status)
    ) {
      return res.status(403).send({
        success: false,
        message:
          driver.status === DRIVER_STATUS.REJECTED
            ? "Request 1 was rejected. Ask an administrator to reopen it before updating your profile."
            : "Request 1 must be approved by an administrator before you can submit profile documents.",
        code: "BASIC_REQUEST_NOT_APPROVED",
      });
    }

    const files = req.files || {};
    const logData = {};
    let responseDriver = driver;

    const allowedFields = [
      "fullName",
      "phone",
      "address",
      "email",
      "countryCode",
      "lat",
      "long",
      "city",
      "vehicleType",
      "whatsappNumber",
      "firstName",
      "lastName",
      "contractNumber",
      "licenseCompany",
    ];

    const fileMapping = {
      licenseCompany: "licenseCompanyUrl",
      carLicenseFront: "carLicenseFrontUrl",
      carLicenseBack: "carLicenseBackUrl",
      drivingLicenseFront: "drivingLicenseFrontUrl",
      drivingLicenseBack: "drivingLicenseBackUrl",
      idProofFront: "idProofFrontUrl",
      idProofBack: "idProofBackUrl",
      passportCopy: "passportCopyUrl",
      profileImage: "profileImageUrl",
    };

    if (requesterIsAdmin) {
      Object.keys(req.body || {}).forEach((key) => {
        if (allowedFields.includes(key) && req.body[key] !== undefined) {
          driver[key] = req.body[key];
        }
      });
      Object.entries(fileMapping).forEach(([field, dbField]) => {
        if (files[field]?.[0]) {
          driver[dbField] = getFileUrl(req, files[field][0]);
        }
      });
      syncLegacyFields(driver);
      await driver.save();
    } else {
      Object.keys(req.body || {}).forEach((key) => {
        if (allowedFields.includes(key) && req.body[key] !== undefined) {
          logData[key] = req.body[key];
        }
      });

      Object.entries(fileMapping).forEach(([field, dbField]) => {
        if (files[field]?.[0]) {
          logData[dbField] = getFileUrl(req, files[field][0]);
        }
      });

      responseDriver = await transitionDriverRequest({
        requestId: driver._id,
        newStatus: "pending",
        requestStage: "profile",
        allowProfilePendingRefresh: true,
        actor: {
          _id: req.user._id,
          fullName: driver.fullName,
          email: driver.email,
          actorType: "driver",
        },
        reason: "Driver profile documents updated",
        mutateDriver: async (currentDriver, { session, oldStatus }) => {
          // A driver may amend Request 2 while it is waiting for review. Merge
          // over the existing pending proposal so an unchanged pending file or
          // field is never reverted to the older approved value.
          const existingProposal =
            oldStatus === DRIVER_STATUS.PENDING
              ? await DriverLogs.findOne({
                  driverId: currentDriver._id,
                }).session(session)
              : null;
          const proposalBase = existingProposal || currentDriver;
          const proposalSnapshot = buildProfileProposalSnapshot(
            proposalBase,
            logData,
          );
          proposalSnapshot.driverId = currentDriver._id;
          proposalSnapshot.isApproved = false;

          const driverLog = await DriverLogs.findOneAndUpdate(
            { driverId: currentDriver._id },
            { $set: proposalSnapshot },
            { new: true, upsert: true, setDefaultsOnInsert: true, session }
          );
          currentDriver.driverLogs = driverLog._id;
          currentDriver.isUpdate = true;
        },
      });
    }

    return res.status(200).send({
      success: true,
      message: "Personal details updated successfully",
      driver: responseDriver,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).send({
      success: false,
      message: statusCode === 500 ? "Failed to update details" : error.message,
      ...(error?.code ? { code: error.code } : {}),
    });
  }
};

export const updateDriverDetails = async (req, res) => {
  try {
    const driverId = req.params.driverId;
    if (!driverId) {
      return res.status(400).send({ success: false, message: "Driver ID is required" });
    }

    const requesterIsAdmin = await isAdminUser(req.user?._id);
    if (!requesterIsAdmin && String(req.user?._id) !== String(driverId)) {
      return res.status(403).send({
        success: false,
        message: "You can only update your own driver profile",
      });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(400).send({
        success: false,
        message: "No driver found with the provided ID",
      });
    }

    const selfFields = [
      "firstName", "lastName", "fullName", "address", "city", "vehicleType",
      "whatsappNumber", "email", "phone", "countryCode", "lat", "long",
    ];
    const adminFields = [
      ...selfFields, "contractNumber", "licenseCompany",
      "rejectionReason",
    ];
    const allowedFields = requesterIsAdmin ? adminFields : selfFields;
    Object.keys(req.body || {}).forEach((key) => {
      if (allowedFields.includes(key) && req.body[key] !== undefined) {
        driver[key] = req.body[key];
      }
    });

    syncLegacyFields(driver);

    await driver.save();
    return res.status(200).send({
      success: true,
      message: "Driver details updated successfully",
      driver,
    });
  } catch (error) {
    return sendResponse(
      res,
      500,
      false,
      "Failed to update driver details",
      error.message
    );
  }
};

export const getAvailableDrivers = async (req, res) => {
  try {
    const options = parseDriverDiscoveryQuery(req.query);
    if (options.lat === null || options.long === null) {
      return res.status(400).send({
        success: false,
        code: "LOCATION_REQUIRED",
        message: "lat and long are required for driver discovery",
      });
    }
    validateCoordinates(options.lat, options.long);
    const serviceArea = serviceAreaForCoordinates(options.lat, options.long, 0, {
      actorId: req.user?._id,
      actorType: "user",
    });
    if (!serviceArea) {
      return res.status(422).send({
        success: false,
        code: "OUTSIDE_SERVICE_AREA",
        message: "Find Now is not available at this location",
      });
    }
    const candidates = await Driver.aggregate(
      buildDubaiDiscoveryAggregation(req.query, options, new Date(), serviceArea)
    );
    const drivers = candidates.map((driver) => toAvailableDriverDto(driver, options));

    return res.status(200).send({
      success: true,
      message: "Available drivers fetched successfully",
      drivers,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).send({
      success: false,
      code: error.code || "DRIVER_DISCOVERY_FAILED",
      message: error.statusCode ? error.message : "Failed to fetch available drivers",
    });
  }
};

export const getDriverAvailability = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DRIVER_ID",
        message: "Invalid driver id",
      });
    }
    const now = new Date();
    const uaeAvailability = buildFreshMarketplaceAvailabilityFilter(
      {}, now, DUBAI_SERVICE_AREA
    );
    const availabilityFilter = isTunisiaTestActorAllowed(req.user?._id, "user")
      ? {
          $or: [
            uaeAvailability,
            buildFreshMarketplaceAvailabilityFilter({}, now, "tunisia-test"),
          ],
        }
      : uaeAvailability;
    const driver = await Driver.findOne({
      _id: req.params.id,
      ...availabilityFilter,
    }).select(AVAILABLE_DRIVER_FIELDS).lean();
    if (!driver) {
      return res.status(409).json({
        success: false,
        code: "DRIVER_NOT_AVAILABLE",
        message: "Driver is not available",
      });
    }
    return res.json({ success: true, driver: toAvailableDriverDto(driver) });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: "DRIVER_AVAILABILITY_FAILED",
      message: "Failed to verify driver availability",
    });
  }
};

export const updateDriverUpdated = async (req, res) => {
  try {
    const { id } = req.body || {};
    const targetId = id || req.user?._id;
    const hasAccess = await canAccessDriver(req, targetId);
    if (!hasAccess) {
      return res.status(403).send({
        success: false,
        message: "You can only update your own driver status",
      });
    }
    const driver = await Driver.findById(targetId);
    if (!driver) {
      return res.status(400).send({
        success: false,
        message: "No driver found with the provided ID",
      });
    }
    driver.isUpdate = false;
    await driver.save();
    return res.status(200).send({
      success: true,
      message: "Driver update status set to false",
      driver,
    });
  } catch (error) {
    return sendResponse(
      res,
      500,
      false,
      "Failed to update driver status",
      error.message
    );
  }
};

export const addDriverDetails = async (req, res) => {
  try {
    const body = req.body || {};
    const files = req.files || {};
    const phone = String(body.phone || "").replace(/\D/g, "");
    const email = String(body.email || "").trim().toLowerCase();

    if (!phone || phone.length < 6) {
      return res.status(400).send({
        success: false,
        message: "A valid driver phone number is required",
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).send({
        success: false,
        message: "A valid driver email is required",
      });
    }

    const duplicateFilters = [{ phone }];
    if (email) duplicateFilters.push({ email });
    const existingDriver = await Driver.findOne({ $or: duplicateFilters }).select("phone email").lean();
    if (existingDriver) {
      return res.status(409).send({
        success: false,
        message:
          existingDriver.phone === phone
            ? "A driver with this phone number already exists"
            : "A driver with this email already exists",
      });
    }

    const hashedPassword = body.password
      ? await bcrypt.hash(body.password, 10)
      : "";

    const split = splitFullName(body.fullName);

    const driverData = {
      firstName: String(body.firstName || split.firstName || "").trim(),
      lastName: String(body.lastName || split.lastName || "").trim(),
      fullName: String(body.fullName || "").trim(),
      address: typeof body.address === "string" ? body.address.trim() : "",
      city: String(body.city ?? "").trim(),
      vehicleType: String(body.vehicleType ?? "").trim(),
      vehicleModel: String(body.vehicleModel ?? "").trim(),
      registration: String(body.registration ?? "").trim(),
      whatsappNumber: body.whatsappNumber ? String(body.whatsappNumber).trim() : phone,
      lat: Number(body.lat) || 0,
      long: Number(body.long) || 0,
      phone,
      countryCode: body.countryCode || "+1",
      email,
      password: hashedPassword,
      contractNumber: typeof body.contractNumber === "string" ? body.contractNumber.trim() : "",
      licenseCompany: typeof body.licenseCompany === "string" ? body.licenseCompany.trim() : "",
      basicRequestSubmittedAt: new Date(),
      approvedAt: new Date(),
      completedAt: new Date(),
      status: DRIVER_STATUS.COMPLETED,
      isApproved: true,
      profileRequestStatus: DRIVER_STATUS.APPROVED,
      profileSubmittedAt: new Date(),
      profileApprovedAt: new Date(),
      profileApprovedBy: req.admin?._id || req.user?._id,
      approvedBy: req.admin?._id || req.user?._id,
    };

    const fileFieldMap = {
      licenseCompany: "licenseCompanyUrl",
      carLicenseFront: "carLicenseFrontUrl",
      carLicenseBack: "carLicenseBackUrl",
      drivingLicenseFront: "drivingLicenseFrontUrl",
      drivingLicenseBack: "drivingLicenseBackUrl",
      idProofFront: "idProofFrontUrl",
      idProofBack: "idProofBackUrl",
      passportCopy: "passportCopyUrl",
      profileImage: "profileImageUrl",
      license_car: "licenseCarUrl",
      license_driver: "licenseDriverUrl",
      id_document: "idDocumentUrl",
    };

    for (const field in files) {
      if (fileFieldMap[field] && files[field]?.[0]) {
        driverData[fileFieldMap[field]] = getFileUrl(req, files[field][0]);
      }
    }

    if (!driverData.licenseCarUrl && driverData.carLicenseFrontUrl) {
      driverData.licenseCarUrl = driverData.carLicenseFrontUrl;
    }
    if (!driverData.licenseDriverUrl && driverData.drivingLicenseFrontUrl) {
      driverData.licenseDriverUrl = driverData.drivingLicenseFrontUrl;
    }
    if (!driverData.idDocumentUrl && driverData.idProofFrontUrl) {
      driverData.idDocumentUrl = driverData.idProofFrontUrl;
    }

    const newDriver = await runPointsTransaction(async (session) => {
      const [createdDriver] = await Driver.create([driverData], { session });
      syncLegacyFields(createdDriver);
      await createdDriver.save({ session });
      await grantWelcomeBonusInSession(createdDriver, session, {
        source: "admin_created_verified_driver",
      });
      return createdDriver;
    });

    return res.status(200).send({
      success: true,
      message: "Driver added successfully",
      driver: newDriver,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).send({
        success: false,
        message: "A driver with this phone number or email already exists",
      });
    }
    return res.status(500).send({
      success: false,
      message: "Failed to add driver details",
      error: error.message,
    });
  }
};

export const getDriverDetails = async (req, res) => {
  try {
    const id = req.params.id;
    const hasAccess = await canAccessDriver(req, id);
    if (!hasAccess) {
      return res.status(403).send({
        success: false,
        message: "You are not authorized to view this driver",
      });
    }
    const driver = await Driver.findById(id).populate("driverLogs");
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found",
      });
    }

    normalizeDriverStatus(driver);
    await driver.save();

    return res.status(200).send({
      success: true,
      message: "Driver details fetched successfully",
      driver,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to fetch driver details",
      error: error.message,
    });
  }
};

export const getAllDrivers = async (req, res) => {
  try {
    const { city, vehicleType, isRestricted, isApproved, status } = req.query;
    const filter = {};

    if (city) {
      filter.city = { $regex: new RegExp(`^${city}$`, "i") };
    }
    if (vehicleType) {
      filter.vehicleType = { $regex: new RegExp(`^${vehicleType}$`, "i") };
    }

    const restrictedBool = toBoolean(isRestricted);
    if (restrictedBool !== undefined) filter.isRestricted = restrictedBool;

    const approvedBool = toBoolean(isApproved);
    if (approvedBool !== undefined) filter.isApproved = approvedBool;

    if (status && Object.values(DRIVER_STATUS).includes(String(status))) {
      filter.status = String(status);
    }

    const drivers = await Driver.find(filter).select("-otpCode -password").sort({ createdAt: -1 });
    return res.status(200).send({
      success: true,
      message: "Drivers fetched successfully",
      drivers,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to fetch drivers",
      error: error.message,
    });
  }
};

export const updateOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    if (typeof isOnline !== "boolean") {
      return res.status(400).send({
        success: false,
        message: "isOnline must be a boolean value",
      });
    }

    // Query the raw legacy shape before Mongoose applies schema defaults to
    // fields that did not exist in pre-workflow driver records.
    const isLegacyApprovedDriver = Boolean(
      await Driver.exists({
        _id: req.user._id,
        isApproved: true,
        isRestricted: false,
        isDeleted: { $ne: true },
        status: null,
        profileRequestStatus: null,
      })
    );

    const driver = await Driver.findById(req.user._id);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found",
      });
    }

    if (isLegacyApprovedDriver) {
      // Migrate this driver lazily so saving the online flag cannot persist a
      // schema default of "pending" and make the account undiscoverable again.
      driver.status = DRIVER_STATUS.COMPLETED;
      driver.profileRequestStatus = DRIVER_STATUS.APPROVED;
      driver.completedAt ||= driver.approvedAt || driver.createdAt || new Date();
    } else {
      normalizeDriverStatus(driver);
    }
    if (!canDriverSetOnlineStatus(driver, isOnline)) {
      return res.status(403).send({
        success: false,
        message: "Only completed, active drivers can go online",
      });
    }

    const locationFields = ["lat", "long", "accuracyM", "recordedAt"];
    const hasLocationPayload = locationFields.some(
      (field) => req.body?.[field] !== undefined
    );
    let locationUpdate = null;
    if (isOnline && hasLocationPayload) {
      locationUpdate = buildDriverLocationUpdate(req.body || {}, new Date(), {
        actorId: req.user?._id,
      });
      if (!locationUpdate.currentServiceArea) {
        return res.status(422).send({
          success: false,
          code: "OUTSIDE_SERVICE_AREA",
          message: "Drivers can only go online with a fresh GPS fix inside an enabled service area",
        });
      }
    }

    const activeRide = driver.activeRideId || await Ride.exists({
      driverId: driver._id,
      status: {
        $in: [
          "accepted",
          "driver_arriving",
          "confirmed",
          "driver_on_the_way",
          "driver_arrived",
          "pickup_confirmed",
          "in_progress",
          "disputed",
        ],
      },
    });

    if (!isOnline) {
      const hasSuppliedSessionId =
        Object.hasOwn(req.body || {}, "sessionId") ||
        Object.hasOwn(req.body || {}, "presenceSessionId");
      const suppliedSessionId = Object.hasOwn(req.body || {}, "sessionId")
        ? req.body.sessionId
        : req.body?.presenceSessionId;
      const ended = await endDriverPresence({
        driverId: driver._id,
        sessionId: suppliedSessionId,
      });
      if (hasSuppliedSessionId && !ended) {
        return res.status(409).send({
          success: false,
          code: "PRESENCE_SESSION_STALE",
          message: "This presence session has been replaced or is no longer online",
        });
      }

      let offlineDriver = ended?.driver;
      if (!offlineDriver) {
        if (locationUpdate) Object.assign(driver, locationUpdate);
        driver.isOnline = false;
        driver.availabilityStatus = activeRide ? "Busy" : "Offline";
        driver.presenceStatus = "Offline";
        driver.presenceLeaseExpiresAt = new Date();
        driver.presenceLastHeartbeatAt = new Date();
        driver.presenceSessionId = null;
        driver.presenceVersion = Number(driver.presenceVersion || 0) + 1;
        await driver.save();
        offlineDriver = driver;
      }

      io.emit("driver:availability", {
        driverId: String(offlineDriver._id),
        status: offlineDriver.availabilityStatus,
        isAvailable: false,
        updatedAt: offlineDriver.updatedAt,
      });
      io.emit("driver:presence", toDriverPresenceEvent(offlineDriver, "OFFLINE_REQUEST"));
      return res.status(200).send({
        success: true,
        message: "Driver status updated to offline",
        driver: offlineDriver,
        presence: ended?.presence || {
          status: "Offline",
          leaseExpiresAt: offlineDriver.presenceLeaseExpiresAt,
          lastHeartbeatAt: offlineDriver.presenceLastHeartbeatAt,
          version: offlineDriver.presenceVersion,
        },
      });
    }

    if (activeRide) {
      if (locationUpdate) Object.assign(driver, locationUpdate);
      driver.isOnline = true;
      driver.availabilityStatus = "Busy";
      await driver.save();
      const established = await establishDriverPresence(driver._id);
      io.emit("driver:availability", {
        driverId: String(driver._id),
        status: "Busy",
        isAvailable: false,
        updatedAt: driver.updatedAt,
      });
      io.emit("driver:presence", toDriverPresenceEvent(established.driver, "ONLINE_REQUEST"));
      return res.status(200).send({
        success: true,
        code: "DRIVER_BUSY",
        message: "Connectivity updated; the driver remains busy with an active ride",
        driver: established.driver,
        presence: established.presence,
      });
    }

    if (locationUpdate) Object.assign(driver, locationUpdate);
    driver.isOnline = true;
    driver.availabilityStatus = "Online";
    await driver.save();
    const established = await establishDriverPresence(driver._id);
    io.emit("driver:availability", {
      driverId: String(driver._id),
      status: "Online",
      isAvailable: true,
      updatedAt: driver.updatedAt,
    });
    io.emit("driver:presence", toDriverPresenceEvent(established.driver, "ONLINE_REQUEST"));

    return res.status(200).send({
      success: true,
      ...(
        isOnline && !locationUpdate
          ? {
              code: "LOCATION_PENDING",
              message: "Online mode enabled; waiting for a fresh GPS fix before map discovery",
            }
          : { message: `Driver status updated to ${isOnline ? "online" : "offline"}` }
      ),
      driver: established.driver,
      presence: established.presence,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).send({
      success: false,
      code: error.code || "DRIVER_STATUS_UPDATE_FAILED",
      message: error.statusCode ? error.message : "Failed to update driver status",
    });
  }
};

export const heartbeatPresence = async (req, res) => {
  try {
    const result = await heartbeatDriverPresence({
      driverId: req.user?._id,
      sessionId: req.body?.sessionId,
    });
    if (!result) {
      return res.status(409).send({
        success: false,
        code: "PRESENCE_SESSION_STALE",
        message: "Presence session expired or was replaced; go online again",
      });
    }
    return res.status(200).send({
      success: true,
      message: "Presence heartbeat accepted",
      presence: result.presence,
    });
  } catch {
    return res.status(500).send({
      success: false,
      code: "PRESENCE_HEARTBEAT_FAILED",
      message: "Failed to refresh driver presence",
    });
  }
};

export const updateDriverLocation = async (req, res) => {
  try {
    const locationUpdate = buildDriverLocationUpdate(req.body || {}, new Date(), {
      actorId: req.user?._id,
    });

    const driver = await Driver.findById(req.user._id);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found",
      });
    }
    Object.assign(driver, locationUpdate);
    await driver.save();

    return res.status(200).send({
      success: true,
      message: "Driver location updated successfully",
      location: {
        lat: driver.lat,
        long: driver.long,
        heading: driver.heading,
        speed: driver.speed,
        accuracyM: driver.locationAccuracyM,
        updatedAt: driver.locationUpdatedAt,
        serviceArea: driver.currentServiceArea,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).send({
      success: false,
      code: error.code || "DRIVER_LOCATION_UPDATE_FAILED",
      message: error.statusCode ? error.message : "Failed to update driver location",
    });
  }
};

export const getAllOnlineDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find(buildActiveDriverPresenceFilter())
      .select("firstName lastName fullName phone whatsappNumber isOnline isApproved status presenceStatus presenceLeaseExpiresAt presenceLastHeartbeatAt presenceVersion")
      .sort({ presenceLastHeartbeatAt: -1, _id: 1 })
      .lean();

    const normalized = drivers.map((driver) => ({
      ...driver,
      fullName:
        driver.fullName ||
        [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim(),
      // The query itself guarantees approval. Preserve completed where present
      // and repair stale legacy `pending` values in the compatibility response.
      status:
        driver.status === DRIVER_STATUS.COMPLETED
          ? DRIVER_STATUS.COMPLETED
          : DRIVER_STATUS.APPROVED,
    }));

    return res
      .status(200)
      .send({ success: true, message: "Online driver list fetched", drivers: normalized });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Error while getting drivers",
      error: error.message,
    });
  }
};

export const toggleDriverApproval = async (req, res) => {
  try {
    const { driverId } = req.params;
    const current = await Driver.findById(driverId).select("status isApproved").lean();
    if (!current) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const currentStatus = current.status || (current.isApproved ? "approved" : "pending");
    const newStatus = [DRIVER_STATUS.APPROVED, DRIVER_STATUS.COMPLETED].includes(currentStatus)
      ? DRIVER_STATUS.PENDING
      : DRIVER_STATUS.APPROVED;
    const driver = await transitionDriverRequest({
      requestId: driverId,
      newStatus,
      actor: {
        _id: req.admin?._id || req.user?._id,
        fullName: req.admin?.fullName || "",
        email: req.admin?.email || "",
        actorType: "admin",
      },
      reason: "Legacy approval toggle",
    });

    return res.status(200).json({
      success: true,
      message: `Driver approval status toggled to ${driver.isApproved}`,
      driver,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Server error",
    });
  }
};

export const toggleDriverRestriction = async (req, res) => {
  try {
    const { driverId } = req.params;
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    driver.isRestricted = !driver.isRestricted;
    await driver.save();
    let presenceDriver = null;
    if (driver.isRestricted) {
      presenceDriver = await forceEndDriverPresence({
        driverId: driver._id,
        reason: "DRIVER_RESTRICTED",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Driver restriction status toggled to ${driver.isRestricted}`,
      driver: presenceDriver || driver,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver id is required",
      });
    }

    const canDelete = await canAccessDriver(req, driverId);
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this driver",
      });
    }

    const driver = await Driver.findByIdAndUpdate(
      driverId,
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.user?._id,
          isOnline: false,
          availabilityStatus: "Offline",
          isRestricted: true,
        },
      },
      { new: true, runValidators: true }
    );
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    const offlineDriver = await forceEndDriverPresence({
      driverId: driver._id,
      reason: "DRIVER_DELETED",
    });

    return res.status(200).json({
      success: true,
      message: "Driver account deactivated successfully; request history was preserved",
      driver: offlineDriver || driver,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
