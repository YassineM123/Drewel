import User from "../models/User.js";
import validator from "validator";
import { sendMail } from "../utils/sendMails.js";
import Driver from "../models/Driver.js";
import jwt from "jsonwebtoken";
import OTP from "../models/otp.js";
import { sendOTPwhatsapp } from "../utils/whatsapp.js";
import generateOtp from "../helpers/generateOtp.js";
import { sendOtpUsingTwilio } from "../utils/sendOtp.js";
import { sanitizeAuthSubject } from "../utils/authResponse.js";

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
const findAuthSubjectByType = async (type, phoneCandidates) => {
  if (type === "user") {
    return User.findOne({ phone: { $in: phoneCandidates } });
  }

  if (type === "driver") {
    return Driver.findOne({ phone: { $in: phoneCandidates } });
  }

  return null;
};
const provisionAuthSubject = async ({
  type,
  normalizedPhone,
  normalizedCountryCode,
  phoneCandidates,
}) => {
  let subject = await findAuthSubjectByType(type, phoneCandidates);

  if (subject) {
    if (normalizedCountryCode) {
      subject.countryCode = normalizedCountryCode;
      await subject.save();
    }
    return subject;
  }

  if (type === "user") {
    return User.create({
      phone: normalizedPhone,
      countryCode: normalizedCountryCode,
    });
  }

  if (type === "driver") {
    return Driver.create({
      phone: normalizedPhone,
      countryCode: normalizedCountryCode,
      status: "pending",
      basicRequestSubmittedAt: null,
    });
  }

  return null;
};

export const forgotPassword = async (req, res) => {
  try {
    const { email: identifier } = req.body || {};
    if (!identifier) {
      return res.status(400).send({
        success: false,
        message: "Please provide an email or phone number",
      });
    }

    const normalizedIdentifier = String(identifier).trim();
    const isEmail = validator.isEmail(normalizedIdentifier);
    const phone = isEmail ? null : normalizePhoneDigits(normalizedIdentifier);
    const user = await User.findOne(
      isEmail ? { email: normalizedIdentifier.toLowerCase() } : { phone }
    );
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "No user found with provided email or mobile number",
      });
    }

    const otp = generateOtp(6);
    user.otpCode = otp;
    await user.save();

    if (isEmail) {
      const result = await sendMail(
        normalizedIdentifier.toLowerCase(),
        "OTP to reset password",
        `Your otp to reset your password is : ${otp}`,
        ""
      );
      if (!result.success) {
        return res.status(502).send({ success: false, message: "Unable to send OTP" });
      }
    } else {
      const result = await sendOtpUsingTwilio(`${user.countryCode || ""}${phone}`, otp);
      if (!result.success) {
        return res.status(502).send({ success: false, message: "Unable to send OTP" });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Your OTP has been sent",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .send({ success: false, message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword)
      return res.status(200).send({
        message: "please provide new password and confirm password ",
      });

    if (newPassword !== confirmPassword)
      return res.status(200).send({
        success: false,
        message: "new password and confirm password must be same",
      });

    let phone = null;
    if (!validator.isEmail(email)) {
      phone = email;
      if (!email && !phone) {
        return res.status(200).send({
          success: false,
          message: "Please provide email or phone number ",
        });
      }
    }
    let user = await User.findOne({ $or: [{ email, phone }] });

    if (!user) user = await adminModel.findOne({ $or: [{ email, phone }] });

    if (!user)
      return res.status(200).send({
        success: false,
        message: `user not found with provided email or mobile number`,
      });

    user.password = await hashPassword(newPassword);

    user.otpCode = null;
    user.isVerified = false;
    await user.save();

    return res.status(200).send({
      success: true,
      message: `${user.fullName} your password reset successfully `,
    });
  } catch (error) {
    console.log("error: ", error);
    return res.status(500).send(internalServerError(error));
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, type, countryCode } = req.body || {};
    const phoneCandidates = getPhoneCandidates(phone, countryCode);
    const normalizedPhone = getPhoneWithoutCountryCode(phone, countryCode);
    if (!otp || !normalizedPhone) {
      return res.status(200).send({
        message: "please enter otp ,type and phone number",
      });
    }

    if (type !== "user" && type !== "driver") {
      return res.status(400).send({
        success: false,
        message: "Please provide valid user type (either user or driver)",
      });
    }
    let user = null;
    if (type == "user") {
      user = await User.findOne({
        phone: { $in: phoneCandidates },
        otpCode: otp,
      });
    } else if (type == "driver") {
      user = await Driver.findOne({
        phone: { $in: phoneCandidates },
        otpCode: otp,
      });
    }

    if (!user)
      return res.status(200).send({
        success: false,
        message: "Invalid OTP",
      });

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    user.otpCode = null;
    await user.save();

    return res.status(200).send({
      success: true,
      message: `OTP is verified`,
      token,
      user: sanitizeAuthSubject(user),
    });
  } catch (error) {
    console.log("error: ", error);
    return res
      .status(500)
      .send({ success: false, message: "Internal server error" });
  }
};

export const sendOTPusingWhatsapp = async (req, res) => {
  try {
    const { phone, countryCode, type } = req.body || {};
    const normalizedPhone = getPhoneWithoutCountryCode(phone, countryCode);
    const phoneCandidates = getPhoneCandidates(phone, countryCode);
    const normalizedCountryCode = normalizeCountryCode(countryCode);

    if (!normalizedPhone || !normalizedCountryCode) {
      return res.status(200).send({
        success: false,
        message: "Please provide phone number and country code",
      });
    }
    if (type !== "user" && type !== "driver") {
      return res.status(400).send({
        success: false,
        message: "Please provide valid user type (either user or driver)",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const phoneWithCountryCode = `${normalizedCountryCode.replace(
      /\D/g,
      ""
    )}${normalizedPhone}`;

    // Send OTP first
    const response = await sendOTPwhatsapp(phoneWithCountryCode, otp);
    const finalOtp = response.data?.otp || otp;

    if (!response.success) {
      return res.status(response.statusCode || 400).send({
        success: false,
        code: response.code,
        message: response.message || "Failed to send OTP via WhatsApp",
      });
    }

    // Save or update OTP only if WhatsApp sent successfully.
    const existingOtp = await OTP.findOneAndUpdate(
      { phone: { $in: phoneCandidates }, type },
      {
        $set: {
          phone: normalizedPhone,
          otpCode: String(finalOtp),
          type,
          countryCode: normalizedCountryCode,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      },
      { new: true }
    );

    if (existingOtp) {
      console.log(`[AUTH] Updated existing WhatsApp OTP for ${normalizedPhone}`);
    } else {
      await OTP.create({
        phone: normalizedPhone,
        otpCode: String(finalOtp),
        type,
        countryCode: normalizedCountryCode,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
      console.log(`[AUTH] Created new WhatsApp OTP for ${normalizedPhone}`);
    }

    await provisionAuthSubject({
      type,
      normalizedPhone,
      normalizedCountryCode,
      phoneCandidates,
    });

    return res.status(200).send({
      success: true,
      message: response.data?.mocked && process.env.NODE_ENV !== "production"
        ? `OTP sent successfully via WhatsApp (Mock: ${finalOtp})` 
        : "OTP sent successfully via WhatsApp",
    });

  } catch (error) {
    console.error("Error sending OTP:", error.response?.data || error.message);
    return res
      .status(500)
      .send({ success: false, message: error.response?.data || error.message || "Internal server error" });
  }
};


export const verifyOTPWhatsapp = async (req, res) => {
  try {
    const { phone, otp, type, countryCode } = req.body || {};
    const normalizedPhone = getPhoneWithoutCountryCode(phone, countryCode);
    const phoneCandidates = getPhoneCandidates(phone, countryCode);

    if (!otp || !normalizedPhone) {
      return res.status(200).send({
        message: "please enter otp ,type and phone number",
      });
    }
    if (type !== "user" && type !== "driver") {
      return res.status(400).send({
        success: false,
        message: "Please provide valid user type (either user or driver)",
      });
    }

    const now = new Date();
    const existingOtp = await OTP.findOneAndDelete({
      phone: { $in: phoneCandidates },
      type,
      otpCode: String(otp),
      expiresAt: { $gt: now },
    });

    if (!existingOtp) {
      const staleOtp = await OTP.findOne({
        phone: { $in: phoneCandidates },
        type,
      });

      if (staleOtp?.expiresAt && staleOtp.expiresAt <= now) {
        await OTP.deleteOne({ _id: staleOtp._id });
        return res.status(200).send({
          success: false,
          message: "OTP has expired",
        });
      }

      return res.status(200).send({
        success: false,
        message: "Invalid OTP",
      });
    }

    const otpCountryCode = countryCode || existingOtp.countryCode;
    const otpPhoneCandidates = getPhoneCandidates(phone, otpCountryCode);
    const canonicalPhone = getPhoneWithoutCountryCode(phone, otpCountryCode);
    let user = await findAuthSubjectByType(type, otpPhoneCandidates);

    if (!user) {
      user = await provisionAuthSubject({
        type,
        normalizedPhone: canonicalPhone || existingOtp.phone,
        normalizedCountryCode: normalizeCountryCode(otpCountryCode),
        phoneCandidates: otpPhoneCandidates,
      });
    }

    if (!user) {
      return res.status(200).send({
        success: false,
        message: "User not found",
      });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    return res.status(200).send({
      success: true,
      message: "OTP verified successfully",
      token,
      user: sanitizeAuthSubject(user),
    });

  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};
