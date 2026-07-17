import JWT from "jsonwebtoken";
import validator from "validator";
import Users from "../models/User.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

export const requireSignIn = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const [bearer, token] = authorizationHeader.split(" ");

    if (bearer !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid token format",
      });
    }

    const decoded = JWT.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    let errorMessage = "Please provide a valid token";
    if (error.name === "TokenExpiredError") {
      errorMessage = "Token expired";
    } else if (error.name === "JsonWebTokenError") {
      errorMessage = "Invalid token";
    }

    return res.status(401).json({
      success: false,
      message: errorMessage,
    });
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await Admin.findById(userId).select("role").lean();
    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not an admin",
      });
    }

    return next();
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .send({ success: false, message: "Internal server error", error });
  }
};

export const isVerified = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    let phone = null;

    if (email && !validator.isEmail(email)) {
      phone = email;
    }

    if (!email && !phone) {
      return res.status(400).send({
        success: false,
        message: "please provide either email or mobile number",
      });
    }

    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "No user found with this email",
      });
    }

    if (!user.isVerified) {
      return res.status(403).send({
        success: false,
        message: "Please verify otp first",
      });
    }

    return next();
  } catch (error) {
    console.log("error: ", error);
    return res.status(500).send({ success: false, message: "Server error" });
  }
};

export const isEmailAndPhoneVarified = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    let phone = null;

    if (email && !validator.isEmail(email)) {
      phone = email;
    }

    if (!email && !phone) {
      return res.status(400).send({
        success: false,
        message: "please provide either email or mobile number",
      });
    }

    let user = await User.findOne({ $or: [{ email }, { phone }] }).select(
      "-profileImage"
    );
    if (!user) {
      user = await Admin.findOne({ $or: [{ email }, { phone }] }).select(
        "-profileImage"
      );
    }
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "No user found with this email",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).send({
        success: false,
        message: "Please verify your email first",
      });
    }
    if (!user.isPhoneVerified) {
      return res.status(403).send({
        success: false,
        message: "Please verify your phone number first",
      });
    }
    return next();
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const isActive = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const user = await Users.findOne({ email });

    if (!user?.isActive) {
      return res.status(403).send({
        success: false,
        message: "Your account is not active",
        token: "",
        user,
      });
    }
    return next();
  } catch (error) {
    console.log("error: ", error);
    return res.status(500).send({
      success: false,
      message: "Server error",
    });
  }
};
