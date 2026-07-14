import Admin from "../models/Admin.js";
import Driver from "../models/Driver.js";
import DriverLogs from "../models/Driverlogs.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';

const deriveLegacyStatus = (driver) => {
  const hasDocs =
    Boolean(driver.licenseCarUrl || driver.carLicenseFrontUrl) &&
    Boolean(driver.licenseDriverUrl || driver.drivingLicenseFrontUrl) &&
    Boolean(driver.profileImageUrl) &&
    Boolean(driver.idDocumentUrl || driver.idProofFrontUrl) &&
    Boolean(driver.passportCopyUrl);
  if (driver.isApproved && (driver.status === "completed" || hasDocs)) {
    return "completed";
  }
  if (driver.isApproved) return "approved";
  if (driver.status) return driver.status;
  return "pending";
};

const DRIVER_DETAIL_FALLBACK_FIELDS = [
  "address",
  "city",
  "vehicleType",
  "whatsappNumber",
  "licenseCompanyUrl",
  "carLicenseFrontUrl",
  "carLicenseBackUrl",
  "drivingLicenseFrontUrl",
  "drivingLicenseBackUrl",
  "idProofFrontUrl",
  "idProofBackUrl",
  "passportCopyUrl",
  "profileImageUrl",
];

const applyDriverLogFallbacks = (driver, driverLog) => {
  if (!driverLog) return driver;

  for (const field of DRIVER_DETAIL_FALLBACK_FIELDS) {
    if (!driver[field] && driverLog[field]) driver[field] = driverLog[field];
  }

  // Keep the mobile snake_case contract and the legacy camelCase contract
  // readable through one admin response.
  if (!driver.licenseCarUrl) driver.licenseCarUrl = driver.carLicenseFrontUrl || "";
  if (!driver.licenseDriverUrl) {
    driver.licenseDriverUrl = driver.drivingLicenseFrontUrl || "";
  }
  if (!driver.idDocumentUrl) driver.idDocumentUrl = driver.idProofFrontUrl || "";
  driver.driverLogs = driverLog;
  return driver;
};
export const registerAdmin = async (req, res) => {
  try {
    const { fullName, email, password } = req.body || {};

    if (!fullName || !email || !password) {
      return res
        .status(200)
        .send({ success: false, message: "Please provide all fields" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingAdmin = await Admin.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      return res
        .status(200)
        .send({ success: false, message: "This email already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({
      fullName,
      email: normalizedEmail,
      password: hashedPassword,
      // Only an authenticated admin can reach this controller. Never trust a
      // caller-provided role when creating another privileged account.
      role: "admin",
    });
    await newAdmin.save();
    return res
      .status(200)
      .send({ success: true, message: "New admin is registered" });
  } catch (error̥) {
    console.log("error̥ ==> ", error̥);
    return res
      .status(500)
      .send({ success: false, message: "Error while registering admin" });
  }
};

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. Check if admin exists
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingAdmin = await Admin.findOne({ email: normalizedEmail }).select(
      "+password"
    );
    if (!existingAdmin) {
      return res.status(401).json({
        success: false,
        message: "Admin not found",
      });
    }

    // 3. Compare passwords
    const isMatch = await bcrypt.compare(password, existingAdmin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (existingAdmin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "This account does not have administrator access",
      });
    }

    // 4. Generate JWT token
    const token = jwt.sign(
      { _id: existingAdmin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "8h" }
    );

    const admin = existingAdmin.toObject();
    delete admin.password;

    // 5. Send success response
    return res.status(200).json({
      success: true,
      message: "Admin logged in successfully",
      token,
      admin,
    });
  } catch (error) {
    console.log("Login error ==> ", error);
    return res.status(500).json({
      success: false,
      message: "Error while login",
    });
  }
};

export const getOnlineDrivers = async (_req, res) => {
  try {
    const drivers = await Driver.find({
      isOnline: true,
      isApproved: true,
      isRestricted: false,
    })
      .select(
        "firstName lastName fullName phone whatsappNumber isOnline isApproved status"
      )
      .sort({ updatedAt: -1, _id: 1 })
      .lean();

    const normalized = drivers.map((driver) => ({
      ...driver,
      fullName:
        driver.fullName ||
        [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim(),
      status: deriveLegacyStatus(driver),
    }));

    return res.status(200).json({
      success: true,
      message: "Online driver list fetched successfully",
      drivers: normalized,
    });
  } catch (error) {
    console.error("Failed to fetch online drivers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch online drivers",
    });
  }
};

export const getDriversForReview = async (req, res) => {
  try {
    const { status } = req.query || {};
    const filter = {};
    if (status && ["pending", "approved", "rejected", "completed"].includes(status)) {
      filter.status = status;
    }

    const drivers = await Driver.find(filter).sort({ basicRequestSubmittedAt: -1, createdAt: -1 });
    const normalized = drivers.map((driver) => {
      const data = driver.toObject();
      data.status = deriveLegacyStatus(data);
      return data;
    });
    return res.status(200).json({
      success: true,
      message: "Driver list fetched successfully",
      drivers: normalized,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch drivers",
      error: error.message,
    });
  }
};

export const getDriverReviewDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await Driver.findById(id).populate("driverLogs");
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }
    const data = driver.toObject();
    // Older update flows created DriverLogs by driverId without assigning the
    // optional Driver.driverLogs reference, so populate alone misses them.
    const driverLog =
      data.driverLogs || (await DriverLogs.findOne({ driverId: driver._id }).lean());
    applyDriverLogFallbacks(data, driverLog);
    data.status = deriveLegacyStatus(data);
    return res.status(200).json({
      success: true,
      message: "Driver details fetched successfully",
      driver: data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch driver details",
      error: error.message,
    });
  }
};

export const updateDriverReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body || {};
    if (!["pending", "approved", "rejected", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    driver.status = status;
    if (status === "approved") {
      driver.approvedAt = new Date();
      driver.isApproved = true;
      driver.rejectionReason = "";
    } else if (status === "rejected") {
      driver.isApproved = false;
      driver.rejectionReason = String(rejection_reason || "").trim();
    } else if (status === "pending") {
      driver.isApproved = false;
      driver.approvedAt = null;
      driver.rejectionReason = "";
      if (!driver.basicRequestSubmittedAt) {
        driver.basicRequestSubmittedAt = new Date();
      }
    } else if (status === "completed") {
      driver.isApproved = true;
      if (!driver.approvedAt) driver.approvedAt = new Date();
      if (!driver.completedAt) driver.completedAt = new Date();
      driver.rejectionReason = "";
    }

    driver.fullName = [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim();
    await driver.save();

    return res.status(200).json({
      success: true,
      message: "Driver status updated successfully",
      driver,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update driver status",
      error: error.message,
    });
  }
};
