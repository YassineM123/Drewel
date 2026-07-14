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
import generateOtp from "../helpers/generateOtp.js";
import { sendOtpUsingTwilio } from "../utils/sendOtp.js";
import { serveUploadedFile } from "../utils/fileServing.js";
import { buildPublicAssetUrl } from "../utils/publicAssets.js";
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
      } else {
        user.otpCode = otpCode;
        user.countryCode = normalizedCountryCode;
        if (!user.status) {
          user.status = user.isApproved ? "approved" : "pending";
        }
        await user.save();
      }
    }

    // await sendOtpUsingTwilio(
    //   `${countryCode}${phone}`,
    //   otpCode
    // )
    // .then((response) => {
    //   if (!response.success) {
    //     return res.status(500).json({
    //       success: false,
    //       message: response.message,
    //     });
    //   }
    // });

    return res.status(200).json({
      success: true,
      message: `Your OTP has been sent on registered number ${otpCode}`,
      // token,
      user,
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
    const users = await User.find();

    return res
      .status(200)
      .send({ success: true, message: "List of users fetched", users });
  } catch (error) {
    sendResponse(res, 500, false, "Failed to fetch users", error.message);
  }
};

// Update User
export const updateUser = async (req, res) => {
  try {
    const { fullName, email, dob, phone } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) {
      return sendResponse(res, 404, false, "User not found");
    }

    if (fullName) user.fullName = fullName;
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return sendResponse(res, 200, false, "Email already registered");
      }
      user.email = email;
    }
    if (dob) user.dob = dob;
    if (phone) user.phone = phone;

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

    const rootDir = path.join(__dirname, "../../public");
    await serveUploadedFile({
      res,
      fileName,
      localPaths: [
        path.join(rootDir, "user-images", path.basename(fileName)),
        path.join(rootDir, "driver-documents", path.basename(fileName)),
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).send({
      success: true,
      message: "User details fetched successfully",
      user,
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
    const totalUsers = await User.countDocuments();
    const totalDrivers = await Driver.countDocuments();
    const onlineDrivers = await Driver.countDocuments({ isOnline: true });
    const restrictedDrivers = await User.countDocuments({ isRestricted: true });

    return res.status(200).send({
      success: true,
      message: "Dashboard data fetched",
      dashBoardData: {
        totalUsers,
        totalDrivers,
        onlineDrivers,
        restrictedDrivers,
      },
    });
  } catch (error) {
    console.log("error ==> ", error);
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
