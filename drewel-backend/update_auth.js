import fs from 'fs';
import path from 'path';

const filePath = 'c:\\Users\\anoth\\Desktop\\drewel-wp-changes\\drewel-backend\\src\\controllers\\authController.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the entire sendOTPusingWhatsapp function
const startTag = 'export const sendOTPusingWhatsapp = async (req, res) => {';
const endTag = '};'; // This might be tricky if there are other functions

// Using regex to find the function block
const regex = /export const sendOTPusingWhatsapp = async \(req, res\) => \{[\s\S]*?\n\};/m;

const newFunction = `export const sendOTPusingWhatsapp = async (req, res) => {
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

    const phoneWithCountryCode = \`\${normalizedCountryCode.replace(
      /\\D/g,
      ""
    )}\${normalizedPhone}\`;

    // Send OTP first
    const response = await sendOTPwhatsapp(phoneWithCountryCode, otp);
    const finalOtp = response.data?.otp || otp;

    if (!response.success) {
      return res.status(400).send({
        success: false,
        message: response.message || "Failed to send OTP via WhatsApp",
      });
    }

    // Save or update OTP only if WhatsApp sent successfully
    const existingOtp = await OTP.findOne({ phone: { $in: phoneCandidates } });

    if (existingOtp) {
      existingOtp.phone = normalizedPhone;
      existingOtp.otpCode = finalOtp;
      existingOtp.countryCode = normalizedCountryCode;
      existingOtp.expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Reset expiry
      await existingOtp.save();
      console.log(\`[AUTH] Updated existing WhatsApp OTP for \${normalizedPhone}\`);
    } else {
      await OTP.create({
        phone: normalizedPhone,
        otpCode: finalOtp,
        countryCode: normalizedCountryCode,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
      console.log(\`[AUTH] Created new WhatsApp OTP for \${normalizedPhone}\`);
    }

    await provisionAuthSubject({
      type,
      normalizedPhone,
      normalizedCountryCode,
      phoneCandidates,
    });

    return res.status(200).send({
      success: true,
      message: response.data?.mocked 
        ? \`OTP sent successfully via WhatsApp (Mock: \${finalOtp})\` 
        : "OTP sent successfully via WhatsApp",
    });

  } catch (error) {
    console.error("Error sending OTP:", error.response?.data || error.message);
    return res
      .status(500)
      .send({ success: false, message: error.response?.data || error.message || "Internal server error" });
  }
};`;

if (regex.test(content)) {
    content = content.replace(regex, newFunction);
    fs.writeFileSync(filePath, content);
    console.log('Successfully updated authController.js');
} else {
    console.log('Could not find the function block with regex');
    // Fallback search
    console.log('Content snippet:', content.substring(content.indexOf(startTag), content.indexOf(startTag) + 100));
}
