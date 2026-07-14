import mongoose from "mongoose";
import { loadEnv } from "../src/utils/loadEnv.js";
import connectDB from "../src/connection.js";
import User from "../src/models/User.js";
import Driver from "../src/models/Driver.js";
import OTP from "../src/models/otp.js";
import {
  sendOTPwhatsapp,
  verifyWhatsAppConfiguration,
} from "../src/utils/whatsapp.js";

loadEnv();

const args = process.argv.slice(2);
const phoneArg = args.find((arg) => !arg.startsWith("--"));
const typeArg = args.find((arg) => arg === "user" || arg === "driver");
const countryCodeArg = args
  .find((arg) => arg.startsWith("--countryCode="))
  ?.split("=")[1];
const shouldSend = args.includes("--send");
const otpArg = args
  .find((arg) => arg.startsWith("--otp="))
  ?.split("=")[1];

const digitsOnly = (value = "") => String(value).replace(/\D/g, "");
const normalizeCountryCode = (value = "") => {
  const digits = digitsOnly(value);
  return digits ? `+${digits}` : "";
};
const getPhoneCandidates = (phone = "", countryCode = "") => {
  const digits = digitsOnly(phone);
  const countryDigits = digitsOnly(countryCode);
  const withoutCountry =
    countryDigits &&
    digits.startsWith(countryDigits) &&
    digits.length > countryDigits.length
      ? digits.slice(countryDigits.length)
      : digits;
  const withoutLeadingZeros = withoutCountry.replace(/^0+/, "");
  const candidates = [digits, withoutCountry, withoutLeadingZeros];

  if (countryDigits) {
    candidates.push(
      `${countryDigits}${withoutCountry}`,
      `${countryDigits}${withoutLeadingZeros}`
    );
  }

  return [...new Set(candidates.filter(Boolean))];
};
const redact = (value = "") => {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 8) return "***";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
};

if (!phoneArg) {
  console.error(
    "Usage: node scripts/diagnose-whatsapp-otp.js 51727209 [user|driver] [--countryCode=216] [--send] [--otp=123456]"
  );
  process.exit(1);
}

const countryCode = normalizeCountryCode(countryCodeArg || process.env.DEFAULT_COUNTRY_CODE || "216");
const candidates = getPhoneCandidates(phoneArg, countryCode);
const query = { phone: { $in: candidates } };
const typeQuery = typeArg ? { ...query, type: typeArg } : query;

console.log("WhatsApp OTP diagnostic");
console.log(
  JSON.stringify(
    {
      phoneInput: phoneArg,
      countryCode,
      candidates,
      type: typeArg || "any",
      whatsappPhoneNumberId: redact(process.env.WHATSAPP_PHONE_NUMBER_ID),
      apiVersion: process.env.WHATSAPP_API_VERSION || "v19.0",
      mockOtp: String(process.env.WHATSAPP_MOCK_OTP || "").toLowerCase() === "true",
    },
    null,
    2
  )
);

const configCheck = await verifyWhatsAppConfiguration({ force: true });
console.log("WhatsApp config:");
console.log(
  JSON.stringify(
    configCheck.success
      ? {
          success: true,
          phoneNumber: configCheck.phoneNumber,
        }
      : {
          success: false,
          code: configCheck.code,
          statusCode: configCheck.statusCode,
          message: configCheck.message,
          error: configCheck.error,
        },
    null,
    2
  )
);

try {
  await connectDB();

  const [users, drivers, otps] = await Promise.all([
    User.find(query)
      .select("phone countryCode isVerified isRestricted createdAt updatedAt")
      .lean(),
    Driver.find(query)
      .select("phone countryCode whatsappNumber isVerified isApproved status isRestricted createdAt updatedAt")
      .lean(),
    OTP.find(typeQuery)
      .select("phone countryCode type otpCode expiresAt createdAt updatedAt")
      .lean(),
  ]);

  console.log("Database matches:");
  console.log(
    JSON.stringify(
      {
        users,
        drivers,
        otps,
      },
      null,
      2
    )
  );

  if (shouldSend) {
    if (!configCheck.success) {
      console.error("Skipping send because WhatsApp config is invalid.");
      process.exitCode = 1;
    } else {
      const otp = otpArg || String(Math.floor(100000 + Math.random() * 900000));
      const to = `${digitsOnly(countryCode)}${candidates.find((candidate) => candidate.length <= 10) || digitsOnly(phoneArg)}`;
      const response = await sendOTPwhatsapp(to, otp);
      console.log("Send result:");
      console.log(JSON.stringify(response, null, 2));
      if (!response.success) process.exitCode = 1;
    }
  }
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}
