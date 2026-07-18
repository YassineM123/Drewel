import bcrypt from "bcrypt";
import Driver from "../models/Driver.js";
import DriverLogs from "../models/Driverlogs.js";
import Admin from "../models/Admin.js";
import { sendResponse } from "../helpers/responseHelper.js";
import { buildPublicAssetUrl } from "../utils/publicAssets.js";
import { transitionDriverRequest } from "../services/driverRequestTransitionService.js";
import {
  AVAILABLE_DRIVER_FIELDS,
  buildAvailableDriverFilter,
} from "../utils/availableDrivers.js";

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
  const requiredStrings = ["address", "contract_number", "license_company"];
  for (const key of requiredStrings) {
    if (!String(body?.[key] ?? "").trim()) {
      return `${key} is required`;
    }
  }

  const hasLicenseCar = Boolean(files.license_car?.[0] || driver.licenseCarUrl);
  const hasLicenseDriver = Boolean(
    files.license_driver?.[0] || driver.licenseDriverUrl
  );
  const hasProfileImage = Boolean(
    files.profile_image?.[0] || driver.profileImageUrl
  );
  const hasIdDocument = Boolean(files.id_document?.[0] || driver.idDocumentUrl);
  const hasPassportCopy = Boolean(
    files.passport_copy?.[0] || driver.passportCopyUrl
  );

  if (!hasLicenseCar) return "license_car is required";
  if (!hasLicenseDriver) return "license_driver is required";
  if (!hasProfileImage) return "profile_image is required";
  if (!hasIdDocument) return "id_document is required";
  if (!hasPassportCopy) return "passport_copy is required";

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
        message: "Profile update is locked until admin approval",
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
        actor: {
          _id: req.user._id,
          fullName: driver.fullName,
          email: driver.email,
          actorType: "driver",
        },
        reason: "Driver profile documents updated",
        mutateDriver: async (currentDriver, { session }) => {
          const driverLog = await DriverLogs.findOneAndUpdate(
            { driverId: currentDriver._id },
            { $set: logData },
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
      ...selfFields, "contractNumber", "licenseCompany", "isRestricted",
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
    const drivers = await Driver.find(buildAvailableDriverFilter(req.query))
      .select(AVAILABLE_DRIVER_FIELDS)
      .sort({ updatedAt: -1, _id: 1 })
      .lean();

    return res.status(200).send({
      success: true,
      message: "Available drivers fetched successfully",
      drivers,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to fetch available drivers",
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

    const hashedPassword = body.password
      ? await bcrypt.hash(body.password, 10)
      : "";

    const split = splitFullName(body.fullName);

    const driverData = {
      firstName: String(body.firstName || split.firstName || "").trim(),
      lastName: String(body.lastName || split.lastName || "").trim(),
      fullName: String(body.fullName || "").trim(),
      address: body.address ?? "",
      city: body.city ?? "",
      vehicleType: body.vehicleType ?? "",
      whatsappNumber: body.whatsappNumber ?? "",
      lat: body.lat ?? 0,
      long: body.long ?? 0,
      phone: body.phone,
      countryCode: body.countryCode || "+1",
      email: body.email ?? "",
      password: hashedPassword,
      contractNumber: body.contractNumber ?? "",
      licenseCompany: body.licenseCompany ?? "",
      basicRequestSubmittedAt: new Date(),
      approvedAt: new Date(),
      completedAt: new Date(),
      status: DRIVER_STATUS.COMPLETED,
      isApproved: true,
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

    const newDriver = await Driver.create(driverData);
    syncLegacyFields(newDriver);
    await newDriver.save();

    return res.status(200).send({
      success: true,
      message: "Driver added successfully",
      driver: newDriver,
    });
  } catch (error) {
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

    driver.isOnline = isOnline;
    await driver.save();

    return res.status(200).send({
      success: true,
      message: `Driver status updated to ${isOnline ? "online" : "offline"}`,
      driver,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to update driver status",
      error: error.message,
    });
  }
};

export const updateDriverLocation = async (req, res) => {
  try {
    const { lat, long } = req.body;
    if (typeof lat !== "number" || typeof long !== "number") {
      return res.status(400).send({
        success: false,
        message: "lat and long must be numbers",
      });
    }

    const driver = await Driver.findById(req.user._id);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found",
      });
    }
    driver.lat = lat;
    driver.long = long;
    await driver.save();

    return res.status(200).send({
      success: true,
      message: "Driver location updated successfully",
      driver,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to update driver location",
      error: error.message,
    });
  }
};

export const getAllOnlineDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({
      isOnline: true,
      isApproved: true,
      isRestricted: false,
    })
      .select("firstName lastName fullName phone whatsappNumber isOnline isApproved status")
      .sort({ updatedAt: -1, _id: 1 })
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

    return res.status(200).json({
      success: true,
      message: `Driver restriction status toggled to ${driver.isRestricted}`,
      driver,
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

    return res.status(200).json({
      success: true,
      message: "Driver account deactivated successfully; request history was preserved",
      driver,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
