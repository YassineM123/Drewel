import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendResponse } from "../helpers/responseHelper.js";
import { checkRequiredFields } from "../helpers/requiredFields.js";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import Driver from "../models/Driver.js";
import Admin from "../models/Admin.js";
import Ride, { ACTIVE_RIDE_STATUSES } from "../models/Ride.js";
import TripOffer from "../models/TripOffer.js";
import DriverPointsWallet from "../models/DriverPointsWallet.js";
import PointPurchaseRequest from "../models/PointPurchaseRequest.js";
import RideMessage from "../models/RideMessage.js";
import PointsSettings from "../models/PointsSettings.js";
import SavedPlace from "../models/SavedPlace.js";
import SupportReport from "../models/SupportReport.js";
import UserPreference from "../models/UserPreference.js";
import generateOtp from "../helpers/generateOtp.js";
import { sendOtpUsingTwilio } from "../utils/sendOtp.js";
import { serveUploadedFile } from "../utils/fileServing.js";
import { buildPublicAssetUrl } from "../utils/publicAssets.js";
import { sanitizeAuthSubject } from "../utils/authResponse.js";
import { grantWelcomeBonus } from "../services/pointsWalletService.js";
import { buildActiveDriverPresenceFilter } from "../services/driverPresenceService.js";
import { buildFreshAdminMarketplaceAvailabilityFilter } from "../utils/availableDrivers.js";
import validator from "validator";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const normalizePhoneDigits = (value = "") => String(value).replace(/\D/g, "");
const normalizeCountryCode = (value = "") => {
  const digits = normalizePhoneDigits(value);
  return digits ? `+${digits}` : "";
};
const getPhoneWithoutCountryCode = (value = "", countryCode = "") => {
  const digits = normalizePhoneDigits(value);
  const normalizedCountryCode = normalizePhoneDigits(countryCode);

  if (
    normalizedCountryCode &&
    digits.startsWith(normalizedCountryCode) &&
    digits.length > normalizedCountryCode.length
  ) {
    return digits.slice(normalizedCountryCode.length);
  }

  return digits;
};
const getPhoneCandidates = (value = "", countryCode = "") => {
  const localDigits = getPhoneWithoutCountryCode(value, countryCode);
  if (!localDigits) return [];

  const normalizedCountryCode = normalizePhoneDigits(countryCode);
  const withoutLeadingZeros = localDigits.replace(/^0+/, "");
  const candidates = [localDigits, withoutLeadingZeros];

  if (normalizedCountryCode) {
    candidates.push(
      `${normalizedCountryCode}${localDigits}`,
      `${normalizedCountryCode}${withoutLeadingZeros}`
    );
  }

  return [...new Set(candidates.filter(Boolean))];
};

const isAdminUser = async (userId) => {
  if (!userId) return false;
  const admin = await Admin.findById(userId);
  return !!admin && admin.role === "admin";
};

const PRIVATE_DRIVER_DOCUMENT_FIELDS = [
  "licenseCompanyUrl",
  "licenseCarUrl",
  "licenseDriverUrl",
  "idDocumentUrl",
  "carLicenseFrontUrl",
  "carLicenseBackUrl",
  "drivingLicenseFrontUrl",
  "drivingLicenseBackUrl",
  "idProofFrontUrl",
  "idProofBackUrl",
  "passportCopyUrl",
];

const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveAuthToken = (req) => {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) return match[1].trim();
  return String(req.query.token || "").trim() || null;
};

const findPrivateDocumentOwnerId = async (fileName) => {
  const pattern = new RegExp(`${escapeRegExp(fileName)}$`);
  const driver = await Driver.findOne({
    $or: PRIVATE_DRIVER_DOCUMENT_FIELDS.map((field) => ({
      [field]: { $regex: pattern },
    })),
  })
    .select("_id")
    .lean();
  return driver?._id ? String(driver._id) : null;
};

const isKnownPublicAvatar = async (fileName) => {
  const pattern = new RegExp(`${escapeRegExp(fileName)}$`);
  const byUser = await User.exists({ profilePicture: { $regex: pattern } });
  if (byUser) return true;
  const byDriver = await Driver.exists({ profileImageUrl: { $regex: pattern } });
  return Boolean(byDriver);
};

// Register User
export const registerUser = async (req, res) => {
  const { fullName, email, dob, password, phone } = req.body || {};
  try {
    const { isValid, missingFields } = checkRequiredFields(
      ["fullName", "email", "dob", "password"],
      req.body || {}
    );
    if (!isValid) {
      return sendResponse(
        res,
        200,
        false,
        `${missingFields.join(", ")} is required`
      );
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendResponse(res, 200, false, "Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      fullName,
      email,
      dob,
      password: hashedPassword,
      phone,
    });

    await user.save();
    sendResponse(res, 201, true, "User registered successfully", user);
  } catch (error) {
    console.log("error: ", error);
    sendResponse(res, 500, false, "Registration failed", error.message);
  }
};

export const loginUser = async (req, res) => {
  const { phone, countryCode, type } = req.body || {};
  const normalizedPhone = getPhoneWithoutCountryCode(phone, countryCode);
  const phoneCandidates = getPhoneCandidates(phone, countryCode);
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (!normalizedPhone || !normalizedCountryCode || !type) {
    return sendResponse(
      res,
      400,
      false,
      "countryCode, phone, and type are required"
    );
  }

  try {
    if (type !== "user" && type !== "driver") {
      return res.status(400).send({
        success: false,
        message: "Please provide valid user type (either user or driver)",
      });
    }
    let user = null;
    let driverAccountCreated = false;
    const otpCode = generateOtp(4);
    if (type === "user") {
      user = await User.findOne({ phone: { $in: phoneCandidates } });
      if (!user) {
        user = await User.create({
          phone: normalizedPhone,
          countryCode: normalizedCountryCode,
          otpCode,
        });
      } else {
        user.otpCode = otpCode;
        user.countryCode = normalizedCountryCode;
        await user.save();
      }
    } else if (type === "driver") {
      user = await Driver.findOne({ phone: { $in: phoneCandidates } });
      if (!user) {
        user = await Driver.create({
          phone: normalizedPhone,
          countryCode: normalizedCountryCode,
          otpCode,
          status: "pending",
          basicRequestSubmittedAt: null,
        });
        driverAccountCreated = true;
      } else {
        user.otpCode = otpCode;
        user.countryCode = normalizedCountryCode;
        if (!user.status) {
          user.status = user.isApproved ? "approved" : "pending";
        }
        await user.save();
      }
      await grantWelcomeBonus(user, {
        source: driverAccountCreated
          ? "driver_account_created"
          : "driver_account_sign_in",
      });
    }

    const delivery = await sendOtpUsingTwilio(
      `${normalizedCountryCode}${normalizedPhone}`,
      otpCode
    );
    if (!delivery.success) {
      return res.status(502).json({
        success: false,
        message: delivery.message || "Unable to send OTP",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Your OTP has been sent on the registered number",
      user: sanitizeAuthSubject(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return sendResponse(res, 500, false, "Login failed", error.message);
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body || {};

  if (!email || !newPassword) {
    return sendResponse(res, 200, false, "Email and new password are required");
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    sendResponse(res, 200, true, "Password reset successfully", user);
  } catch (error) {
    sendResponse(res, 500, false, "Password reset failed", error.message);
  }
};

// Get User by ID
export const getUser = async (req, res) => {
  try {
    const id = req.user._id;
    if (!id || mongoose.Types.ObjectId.isValid(id) === false) {
      return sendResponse(res, 200, false, "Please provide a valid user ID");
    }

    const user = await User.findById(id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }
    return res.status(200).send({
      success: true,
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    sendResponse(res, 500, false, "Failed to fetch user", error.message);
  }
};

// Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const {
      search = "",
      status = "all",
      page = 1,
      limit = 20,
      sort = "updatedAt",
      dir = "desc",
    } = req.query || {};
    const filter = {};
    if (status === "restricted") filter.isRestricted = true;
    if (status === "active") filter.isRestricted = { $ne: true };
    const term = String(search || "").trim();
    if (term) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { fullName: regex },
        { phone: regex },
        { email: regex },
      ];
    }
    const pageNumber = Math.max(1, Math.trunc(Number(page) || 1));
    const limitNumber = Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20)));
    const allowedSort = new Set(["updatedAt", "createdAt", "fullName", "phone"]);
    if (!allowedSort.has(String(sort))) {
      return res.status(400).json({
        success: false,
        code: "INVALID_USER_SORT",
        message: "Invalid user sort field",
      });
    }
    const sortDir = String(dir).toLowerCase() === "asc" ? 1 : -1;
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sort]: sortDir, _id: sortDir })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      User.countDocuments(filter),
    ]);
    const userIds = users.map((user) => user._id);
    const [rideCounts, activeRides, messageCounts] = await Promise.all([
      Ride.aggregate([
        { $match: { passengerId: { $in: userIds } } },
        { $group: {
          _id: "$passengerId",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $in: ["$status", ["cancelled", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"]] }, 1, 0] } },
          disputed: { $sum: { $cond: [{ $eq: ["$status", "disputed"] }, 1, 0] } },
        } },
      ]),
      Ride.find({ passengerId: { $in: userIds }, status: { $in: ACTIVE_RIDE_STATUSES } })
        .select("_id passengerId reference status vehicleType requestedAt updatedAt")
        .sort({ updatedAt: -1 })
        .lean(),
      RideMessage.aggregate([
        { $match: { senderId: { $in: userIds } } },
        { $group: { _id: "$senderId", total: { $sum: 1 } } },
      ]),
    ]);
    const rideCountsByUser = new Map(rideCounts.map((item) => [String(item._id), item]));
    const activeRideByUser = new Map(activeRides.map((ride) => [String(ride.passengerId), ride]));
    const messageCountsByUser = new Map(messageCounts.map((item) => [String(item._id), item]));
    const enriched = users.map((user) => {
      const userId = String(user._id);
      const rideSummary = rideCountsByUser.get(userId) || {};
      const activeRide = activeRideByUser.get(userId) || null;
      const messageSummary = messageCountsByUser.get(userId) || {};
      return {
        ...user,
        rideSummary: {
          total: Number(rideSummary.total || 0),
          completed: Number(rideSummary.completed || 0),
          cancelled: Number(rideSummary.cancelled || 0),
          disputed: Number(rideSummary.disputed || 0),
          activeRide: activeRide ? {
            id: String(activeRide._id),
            reference: activeRide.reference,
            status: activeRide.status,
            vehicleType: activeRide.vehicleType || "",
            updatedAt: activeRide.updatedAt,
          } : null,
        },
        supportSummary: {
          messagesSent: Number(messageSummary.total || 0),
        },
        lastActivityAt: activeRide?.updatedAt || user.updatedAt,
      };
    });

    return res
      .status(200)
      .send({
        success: true,
        message: "List of users fetched",
        users: enriched,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitNumber)),
        },
      });
  } catch (error) {
    sendResponse(res, 500, false, "Failed to fetch users", error.message);
  }
};

// Update User
export const updateUser = async (req, res) => {
  try {
    const { fullName, email, dob, phone, countryCode } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (fullName !== undefined) {
      const normalizedName = String(fullName).trim().replace(/\s+/g, " ");
      if (normalizedName.length < 2 || normalizedName.length > 120) {
        return sendResponse(res, 400, false, "Please provide a valid full name");
      }
      user.fullName = normalizedName;
    }
    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!validator.isEmail(normalizedEmail)) {
        return sendResponse(res, 400, false, "Please provide a valid email");
      }
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return sendResponse(res, 409, false, "Email already registered");
      }
      user.email = normalizedEmail;
    }
    if (dob) user.dob = dob;
    if (phone) {
      const normalizedPhone = getPhoneWithoutCountryCode(phone, countryCode || user.countryCode);
      if (!normalizedPhone || normalizedPhone.length < 6 || normalizedPhone.length > 15) {
        return sendResponse(res, 400, false, "Please provide a valid phone number");
      }
      const phoneCandidates = getPhoneCandidates(phone, countryCode || user.countryCode);
      const existingUser = await User.findOne({ phone: { $in: phoneCandidates } });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return sendResponse(res, 409, false, "Phone already registered");
      }
      user.phone = normalizedPhone;
      if (countryCode) user.countryCode = normalizeCountryCode(countryCode);
    }

    await user.save();
    sendResponse(res, 200, true, "User updated successfully", user);
  } catch (error) {
    sendResponse(res, 500, false, "Failed to update user", error.message);
  }
};

// Delete User
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || mongoose.Types.ObjectId.isValid(id) === false) {
      return sendResponse(res, 400, false, "Invalid user id");
    }

    const requesterId = req.user?._id;
    const canDeleteSelf = requesterId && String(requesterId) === String(id);
    const canDeleteAsAdmin = await isAdminUser(requesterId);

    if (!canDeleteSelf && !canDeleteAsAdmin) {
      return sendResponse(
        res,
        403,
        false,
        "You are not authorized to delete this user"
      );
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return sendResponse(res, 404, false, "User not found");
    }
    sendResponse(res, 200, true, "User deleted successfully");
  } catch (error) {
    sendResponse(res, 500, false, "Failed to delete user", error.message);
  }
};

export const updateProfilePicture = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(200).send({
        success: false,
        message: "Please upload a file",
      });
    }

    const profilePicture = buildPublicAssetUrl(
      req,
      "/api/users/get-image/",
      file.filename
    );

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }
    user.profilePicture = profilePicture;
    await user.save();
    return res.status(200).send({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture,
    });
  } catch (error) {
    console.log("error: ", error);
    return res.status(500).send({
      success: false,
      message: "Failed to update profile picture",
      error: error.message,
    });
  }
};

export const getProfileImage = async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!fileName) return res.status(400).send("File name is required");
    const safeName = path.basename(fileName);
    const rootDir = path.join(__dirname, "../../public");

    const privateDocumentOwnerId = await findPrivateDocumentOwnerId(safeName);
    if (privateDocumentOwnerId) {
      // Private driver document (ID, license, passport): require the owner
      // or an admin. The app passes the JWT via a query token because image
      // widgets cannot attach Authorization headers.
      let requesterId = null;
      let requesterIsAdmin = false;
      const token = resolveAuthToken(req);
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          requesterId = decoded?._id ? String(decoded._id) : null;
          requesterIsAdmin = requesterId ? await isAdminUser(requesterId) : false;
        } catch (error) {
          // Invalid or expired token: treat as anonymous.
        }
      }
      const isOwner = requesterId !== null && requesterId === privateDocumentOwnerId;
      if (!isOwner && !requesterIsAdmin) {
        return res
          .status(403)
          .send("You are not authorized to view this file");
      }
    } else {
      // Public profile pictures (avatars) stay viewable so ride counterparts
      // can see each other. Unknown filenames are not served.
      if (!(await isKnownPublicAvatar(safeName))) {
        return res.status(404).send("File not found");
      }
    }

    await serveUploadedFile({
      res,
      fileName: safeName,
      localPaths: [
        path.join(rootDir, "user-images", safeName),
        path.join(rootDir, "driver-documents", safeName),
      ],
      s3Prefixes: ["user-images", "driver-documents"],
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).send("Internal Server Error");
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId || mongoose.Types.ObjectId.isValid(userId) === false) {
      return res.status(400).send({
        success: false,
        message: "Please provide a valid user ID",
      });
    }

    const requesterId = req.user?._id;
    const requesterIsAdmin = await isAdminUser(requesterId);
    if (String(requesterId) !== String(userId) && !requesterIsAdmin) {
      return res.status(403).send({
        success: false,
        message: "You are not authorized to view this user",
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    const [
      savedPlaces,
      preferences,
      recentRides,
      recentMessages,
      supportReports,
      rideSummary,
    ] = await Promise.all([
      SavedPlace.find({ userId })
        .sort({ type: 1, updatedAt: -1 })
        .lean(),
      UserPreference.findOne({ userId, actorRole: "passenger" }).lean(),
      Ride.find({ passengerId: userId })
        .select("_id reference status vehicleType pickup destination agreedPrice requestedAt startedAt endedAt updatedAt driverId")
        .populate("driverId", "fullName firstName lastName phone vehicleType")
        .sort({ updatedAt: -1, _id: -1 })
        .limit(10)
        .lean(),
      RideMessage.find({ senderId: userId })
        .select("_id rideId message text status createdAt updatedAt")
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .lean(),
      SupportReport.find({ userId, actorRole: "passenger" })
        .select("_id rideId category description status createdAt updatedAt")
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .lean(),
      Ride.aggregate([
        { $match: { passengerId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: "$passengerId",
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $in: ["$status", ["cancelled", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"]] }, 1, 0] } },
            disputed: { $sum: { $cond: [{ $eq: ["$status", "disputed"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const summary = rideSummary[0] || {};

    return res.status(200).send({
      success: true,
      message: "User details fetched successfully",
      user: {
        ...user,
        savedPlaces: savedPlaces.map((place) => ({
          id: String(place._id),
          type: place.type,
          name: place.name,
          address: place.address,
          lat: place.lat,
          long: place.long,
          category: place.category || "",
          updatedAt: place.updatedAt,
        })),
        preferences: preferences
          ? {
              language: preferences.language || "en",
              notifications: preferences.notifications || {},
              updatedAt: preferences.updatedAt,
            }
          : null,
        rideSummary: {
          total: Number(summary.total || 0),
          completed: Number(summary.completed || 0),
          cancelled: Number(summary.cancelled || 0),
          disputed: Number(summary.disputed || 0),
        },
        recentRides,
        recentMessages,
        recentCalls,
        supportReports,
      },
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(500).send({
      success: false,
      message: "Failed to fetch user details",
      error: error.message,
    });
  }
};

export const dashBoardData = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const settings = await PointsSettings.getEffective();
    const lowBalanceThreshold = settings.lowBalanceThreshold;
    const activeRideFilter = { status: { $in: ACTIVE_RIDE_STATUSES } };
    const cancelledTodayFilter = {
      status: { $in: ["cancelled", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin"] },
      $or: [
        { endedAt: { $gte: startOfToday } },
        { "cancellation.timestamp": { $gte: startOfToday } },
        { updatedAt: { $gte: startOfToday } },
      ],
    };

    const [
      totalUsers,
      totalDrivers,
      onlineDrivers,
      discoverableDrivers,
      restrictedUsers,
      restrictedDrivers,
      pendingApproval1,
      pendingApproval2,
      activeReservations,
      pendingTripOffers,
      completedToday,
      cancelledToday,
      openDisputes,
      stuckRides,
      lowBalanceDrivers,
      pendingPointPurchaseRequests,
      unreadRideMessages,
      openSupportReports,
      recentReservations,
    ] =
      await Promise.all([
        User.countDocuments(),
        Driver.countDocuments(),
        Driver.countDocuments(buildActiveDriverPresenceFilter()),
        Driver.countDocuments(buildFreshAdminMarketplaceAvailabilityFilter({}, now)),
        User.countDocuments({ isRestricted: true }),
        Driver.countDocuments({ isRestricted: true }),
        Driver.countDocuments({ status: "pending" }),
        Driver.countDocuments({ profileRequestStatus: "pending" }),
        Ride.countDocuments(activeRideFilter),
        TripOffer.countDocuments({ status: "pending", expiresAt: { $gt: now } }),
        Ride.countDocuments({ status: "completed", endedAt: { $gte: startOfToday } }),
        Ride.countDocuments(cancelledTodayFilter),
        Ride.countDocuments({ status: "disputed" }),
        Ride.countDocuments({
          status: { $in: ACTIVE_RIDE_STATUSES },
          updatedAt: { $lt: new Date(now.getTime() - 60 * 60 * 1000) },
        }),
        DriverPointsWallet.countDocuments({
          $expr: {
            $lt: [
              { $add: ["$availableBonusPoints", "$availablePurchasedPoints"] },
              lowBalanceThreshold,
            ],
          },
        }),
        PointPurchaseRequest.countDocuments({ status: { $in: ["pending", "contacted", "payment_pending", "payment_verified"] } }),
        RideMessage.countDocuments({ status: { $ne: "read" } }),
        SupportReport.countDocuments({ status: { $in: ["open", "reviewing"] } }),
        Ride.find({})
          .sort({ updatedAt: -1, _id: -1 })
          .limit(6)
          .select("reference status vehicleType pickup destination updatedAt requestedAt endedAt passengerId driverId")
          .populate("passengerId", "fullName name phone")
          .populate("driverId", "fullName firstName lastName phone vehicleType")
          .lean(),
      ]);

    const health = {
      api: "operational",
      database: mongoose.connection.readyState === 1 ? "operational" : "unavailable",
      socketIo: global.io ? "operational" : "unavailable",
      notifications: process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? "configured"
        : "not_configured",
      storage: process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET
        ? "configured"
        : "not_configured",
      generatedAt: now.toISOString(),
    };

    return res.status(200).send({
      success: true,
      message: "Dashboard data fetched",
      dashBoardData: {
        totalUsers,
        totalDrivers,
        onlineDrivers,
        discoverableDrivers,
        restrictedUsers,
        restrictedDrivers,
        pendingApproval1,
        pendingApproval2,
        activeReservations,
        pendingTripOffers,
        completedToday,
        cancelledToday,
        openDisputes,
        stuckRides,
        lowBalanceDrivers,
        pendingPointPurchaseRequests,
        unreadRideMessages,
        openSupportReports,
        lowBalanceThreshold,
        health,
        recentReservations: recentReservations.map((ride) => ({
          id: String(ride._id),
          reference: ride.reference,
          status: ride.status,
          vehicleType: ride.vehicleType || "",
          passengerName: ride.passengerId?.fullName || ride.passengerId?.name || "",
          driverName:
            ride.driverId?.fullName ||
            [ride.driverId?.firstName, ride.driverId?.lastName].filter(Boolean).join(" "),
          pickup: ride.pickup?.address || "",
          destination: ride.destination?.address || "",
          updatedAt: ride.updatedAt,
          requestedAt: ride.requestedAt,
          endedAt: ride.endedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Dashboard data error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
    });
  }
};

export const toggleRestrictionOnUser = async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).send({
        success: false,
        message: "Please provide valid user id",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Toggle the isRestricted field
    user.isRestricted = !user.isRestricted;
    await user.save();

    return res.status(200).send({
      success: true,
      message: `User has been ${
        user.isRestricted ? "restricted" : "unrestricted"
      } successfully.`,
      user,
    });
  } catch (error) {
    console.log("error ==> ", error);
    return res.status({
      success: false,
      message: "Error while restricting user",
      error: error.message,
    });
  }
};

export const getRestrictedUsers = async (req, res) => {
  try {
    const restrictedUsers = await User.find({ isRestricted: true });

    return res.status(200).send({
      success: true,
      message: "List of restricted users fetched.",
      users: restrictedUsers,
    });
  } catch (error) {
    console.log("error ==> ", error);
    return res.status(500).send({
      success: false,
      message: "Error while getting restricted users",
    });
  }
};
