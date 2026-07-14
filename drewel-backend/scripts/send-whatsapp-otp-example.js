import { loadEnv } from "../src/utils/loadEnv.js";
import {
  sendOTPwhatsapp,
  verifyWhatsAppConfiguration,
} from "../src/utils/whatsapp.js";

loadEnv();

const to = String(process.argv[2] || "").replace(/\D/g, "");
const otp = process.argv[3] || String(Math.floor(100000 + Math.random() * 900000));

if (!/^\d{8,15}$/.test(to)) {
  throw new Error("Usage: node scripts/send-whatsapp-otp-example.js 216XXXXXXXX [123456]");
}

const mockOtp = String(process.env.WHATSAPP_MOCK_OTP || "").toLowerCase() === "true";
if (!mockOtp) {
  const configCheck = await verifyWhatsAppConfiguration({ force: true });
  if (!configCheck.success) {
    console.error(JSON.stringify(configCheck, null, 2));
    process.exit(1);
  }
}

const response = await sendOTPwhatsapp(to, otp);
if (!response.success) {
  console.error(JSON.stringify(response, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(response, null, 2));
}
