import dotenv from 'dotenv'
import twilio from 'twilio';
// Load environment variables from .env file
dotenv.config();

export const sendOtpUsingTwilio = async (to, otp) => {
    try {
        const accountSid = process.env.TWILIOSID;
        const authToken = process.env.TWILIOTOKEN;
        const from = process.env.TWILIO_FROM_NUMBER;
        if (!accountSid || !authToken || !from) {
            return {
                success: false,
                message: 'SMS OTP service is not configured.',
            };
        }

        const client = twilio(accountSid, authToken);
        const message = await client.messages.create({
            body: `Your Dreewel OTP code is: ${otp}`,
            from,
            to: to
        });
        return { success: true, message: 'OTP sent successfully.' };
    } catch (error) {
        console.error('SMS OTP delivery failed:', error.code || error.message);

        // Handle specific Twilio error codes
        if (error.code === 21265) {
            return { success: false, message: 'Invalid phone number. Please enter a valid number.' };
        }

        // General error response
        return { success: false, message: 'Failed to send OTP. Please try again later.' };
    }
};

