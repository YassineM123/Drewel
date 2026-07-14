import bcrypt from "bcrypt";
import Driver from "../models/Driver.js";
import DriverLogs from "../models/Driverlogs.js";
import Admin from "../models/Admin.js";
import { sendResponse } from "../helpers/responseHelper.js";
import { buildPublicAssetUrl } from "../utils/publicAssets.js";

const DRIVER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed",
};

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
  const hasDocs = hasRequiredProfileDocs(driver);

  if (driver.isApproved) {
    driver.status =
      driver.status === DRIVER_STATUS.COMPLETED || hasDocs
        ? DRIVER_STATUS.COMPLETED
        : DRIVER_STATUS.APPROVED;
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

  const approved = Boolean(driver.isApproved);
  if (approved && hasDocs) {
    driver.status = DRIVER_STATUS.COMPLETED;
  } else if (approved) {
    driver.status = DRIVER_STATUS.APPROVED;
  } else {
    driver.status = DRIVER_STATUS.PENDING;
  }
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
    if (body.first_name) driver.firstName = String(body.first_name).trim();
    if (body.last_name) driver.lastName = String(body.last_name).trim();

    driver.address = String(body.address || "").trim();
    driver.contractNumber = String(body.contract_number || "").trim();
    driver.licenseCompany = String(body.license_company || "").trim();
    driver.city = String(body.city || driver.city || "").trim();
    driver.vehicleType = String(
      body.vehicle_type || body.vehicleType || driver.vehicleType || ""
    ).trim();

    setDriverFiles(driver, req, req.files || {});
    applyStatusTransition(driver, DRIVER_STATUS.COMPLETED);
    driver.completedAt = new Date();

    await driver.save();

    return res.status(200).send({
      success: true,
      message: "Driver profile completed successfully",
      driver,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to complete profile",
      error: error.message,
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
    const { id, isAdmin } = req.body || {};
    if (!id) {
      return res.status(400).send({
        success: false,
        message: "Driver ID is required",
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
    if (!isAdmin && driver.status !== DRIVER_STATUS.APPROVED) {
      return res.status(403).send({
        success: false,
        message: "Profile update is locked until admin approval",
      });
    }

    const files = req.files || {};
    const logData = {};

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

    if (isAdmin) {
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

      await DriverLogs.findOneAndUpdate(
        { driverId: driver._id },
        { $set: logData },
        { new: true, upsert: true }
      );
      driver.isUpdate = true;
      await driver.save();
    }

    return res.status(200).send({
      success: true,
      message: "Personal details updated successfully",
      driver,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Failed to update details",
      error: error.message,
    });
  }
};

export const updateDriverDetails = async (req, res) => {
  try {
    const { id } = req.body || {};
    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(400).send({
        success: false,
        message: "No driver found with the provided ID",
      });
    }

    Object.keys(req.body || {}).forEach((key) => {
      if (req.body[key] !== undefined && key !== "id") {
        driver[key] = req.body[key];
      }
    });

    if (req.body?.status && Object.values(DRIVER_STATUS).includes(req.body.status)) {
      applyStatusTransition(driver, req.body.status, req.body.rejectionReason);
    } else {
      syncLegacyFields(driver);
    }

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

export const updateDriverUpdated = async (req, res) => {
  try {
    const { id } = req.body || {};
    const driver = await Driver.findById(id);
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

    const drivers = await Driver.find(filter).sort({ createdAt: -1 });
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

    const driver = await Driver.findById(req.user._id);
    if (!driver) {
      return res.status(404).send({
        success: false,
        message: "Driver not found",
      });
    }

    normalizeDriverStatus(driver);
    if (driver.status !== DRIVER_STATUS.COMPLETED) {
      return res.status(403).send({
        success: false,
        message: "Only completed drivers can go online",
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
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    normalizeDriverStatus(driver);
    if (driver.isApproved) {
      applyStatusTransition(driver, DRIVER_STATUS.PENDING);
    } else {
      applyStatusTransition(driver, DRIVER_STATUS.APPROVED);
    }
    await driver.save();

    return res.status(200).json({
      success: true,
      message: `Driver approval status toggled to ${driver.isApproved}`,
      driver,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
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

    const driver = await Driver.findByIdAndDelete(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Driver deleted successfully",
      driver,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};
