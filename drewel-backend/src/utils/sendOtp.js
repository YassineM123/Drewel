import dotenv from 'dotenv'
import twilio from 'twilio';
// Load environment variables from .env file
dotenv.config();

const accountSid = process.env.TWILIOSID;
const authToken = process.env.TWILIOTOKEN;

// if (!accountSid || !authToken) {
//     throw new Error('Twilio account SID and Auth Token must be defined in environment variables');
// }


// const client = twilio(accountSid, authToken);


export const sendOtpUsingTwilio = async (to, otp) => {
    try {
        const message = await client.messages.create({
            body: `Your OTP code for Rmmbr.me  is: ${otp}`,
            from: '+17622282453',
            to: to
        });
        console.log(`OTP sent successfully.`, message.sid);
        return { success: true, message: 'OTP sent successfully.' };
    } catch (error) {
        console.log('error: ', error);

        // Handle specific Twilio error codes
        if (error.code === 21265) {
            return { success: false, message: 'Invalid phone number. Please enter a valid number.' };
        }

        // General error response
        return { success: false, message: 'Failed to send OTP. Please try again later.' };
    }
};

