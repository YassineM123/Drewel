import axios from "axios";

const graphClient = axios.create({
    baseURL: "https://graph.facebook.com",
    timeout: 15000,
});

let cachedConfigCheck = null;
let cachedConfigCheckAt = 0;
const CONFIG_CHECK_TTL_MS = 5 * 60 * 1000;

const getWhatsAppApiMessage = (errorData) => {
    const graphError = errorData?.error;

    if (
        graphError?.code === 100 &&
        graphError?.error_subcode === 33
    ) {
        return "Invalid WhatsApp configuration: WHATSAPP_PHONE_NUMBER_ID must be the numeric WhatsApp Business Phone Number ID that belongs to this access token. The configured ID cannot send messages.";
    }

    return graphError?.message || "Failed to send OTP via WhatsApp";
};

const readWhatsAppConfig = () => {
    const API_VERSION = (process.env.WHATSAPP_API_VERSION || 'v19.0').trim();
    const WHATSAPP_BUSINESS_PHONE_NUMBER_ID = (
        process.env.WHATSAPP_PHONE_NUMBER_ID ||
        process.env.PHONE_NUMBER_ID ||
        ''
    ).trim();
    const ACCESS_TOKEN = (
        process.env.WHATSAPP_ACCESS_TOKEN ||
        process.env.WHATSAPP_TOKEN ||
        ''
    ).trim();
    const MOCK_OTP = String(process.env.WHATSAPP_MOCK_OTP || '').toLowerCase() === 'true';
    const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || 'login_otp_verification';
    const TEMPLATE_LANGUAGE_CODE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';

    return {
        API_VERSION,
        WHATSAPP_BUSINESS_PHONE_NUMBER_ID,
        ACCESS_TOKEN,
        MOCK_OTP,
        TEMPLATE_NAME,
        TEMPLATE_LANGUAGE_CODE,
    };
};

const validateStaticWhatsAppConfig = ({
    API_VERSION,
    WHATSAPP_BUSINESS_PHONE_NUMBER_ID,
    ACCESS_TOKEN,
}) => {
    const missingCredentials = [];

    if (!WHATSAPP_BUSINESS_PHONE_NUMBER_ID) {
        missingCredentials.push("WHATSAPP_PHONE_NUMBER_ID");
    }
    if (!ACCESS_TOKEN) {
        missingCredentials.push("WHATSAPP_ACCESS_TOKEN");
    }

    if (missingCredentials.length > 0) {
        return {
            success: false,
            code: "WHATSAPP_CONFIG_MISSING_CREDENTIALS",
            statusCode: 503,
            message: `WhatsApp credentials are not configured. Missing: ${missingCredentials.join(", ")}.`,
        };
    }

    if (!/^v\d+\.\d+$/.test(API_VERSION)) {
        return {
            success: false,
            code: "WHATSAPP_CONFIG_INVALID_API_VERSION",
            statusCode: 503,
            message: "Invalid WhatsApp API version. Use a Graph API version such as v19.0, v20.0, or v21.0.",
        };
    }

    if (!/^\d+$/.test(WHATSAPP_BUSINESS_PHONE_NUMBER_ID)) {
        return {
            success: false,
            code: "WHATSAPP_CONFIG_INVALID_PHONE_NUMBER_ID",
            statusCode: 503,
            message: "Invalid WHATSAPP_PHONE_NUMBER_ID. Use the numeric Meta WhatsApp Business Phone Number ID, not a phone number, page ID, app ID, WABA ID, or a value with '+'.",
        };
    }

    if (!/^EA[A-Za-z0-9_-]+/.test(ACCESS_TOKEN)) {
        return {
            success: false,
            code: "WHATSAPP_CONFIG_INVALID_ACCESS_TOKEN",
            statusCode: 503,
            message: "Invalid WHATSAPP_ACCESS_TOKEN format. Use the complete Meta access token on one .env line.",
        };
    }

    return { success: true };
};

export const verifyWhatsAppConfiguration = async ({ force = false } = {}) => {
    const config = readWhatsAppConfig();
    const staticValidation = validateStaticWhatsAppConfig(config);

    if (!staticValidation.success) {
        return staticValidation;
    }

    const now = Date.now();
    if (
        !force &&
        cachedConfigCheck?.success &&
        now - cachedConfigCheckAt < CONFIG_CHECK_TTL_MS
    ) {
        return cachedConfigCheck;
    }

    try {
        const response = await graphClient.get(
            `/${config.API_VERSION}/${config.WHATSAPP_BUSINESS_PHONE_NUMBER_ID}`,
            {
                params: {
                    fields: "id,display_phone_number,verified_name",
                },
                headers: {
                    Authorization: `Bearer ${config.ACCESS_TOKEN}`,
                },
            }
        );

        cachedConfigCheck = {
            success: true,
            phoneNumber: response.data,
        };
        cachedConfigCheckAt = now;
        return cachedConfigCheck;
    } catch (error) {
        const graphError = error.response?.data?.error;
        const message = graphError?.message || error.message || "Unknown WhatsApp configuration error";

        if (
            graphError?.code === 100 &&
            /nonexisting field|does not exist|cannot be loaded/i.test(message)
        ) {
            return {
                success: false,
                code: "WHATSAPP_CONFIG_INVALID_PHONE_NUMBER_ID",
                statusCode: 503,
                message: "Invalid WhatsApp configuration: WHATSAPP_PHONE_NUMBER_ID is numeric, but it is not a WhatsApp Business Phone Number ID accessible by this token. Copy the Phone number ID from Meta WhatsApp > API Setup for the same app/token.",
                error: {
                    code: graphError.code,
                    type: graphError.type,
                    fbtrace_id: graphError.fbtrace_id,
                },
            };
        }

        if (graphError?.code === 190) {
            return {
                success: false,
                code: "WHATSAPP_CONFIG_INVALID_ACCESS_TOKEN",
                statusCode: 503,
                message: "Invalid WhatsApp configuration: WHATSAPP_ACCESS_TOKEN is invalid, expired, incomplete, or was copied incorrectly.",
                error: {
                    code: graphError.code,
                    type: graphError.type,
                    fbtrace_id: graphError.fbtrace_id,
                },
            };
        }

        return {
            success: false,
            code: "WHATSAPP_CONFIG_GRAPH_ERROR",
            statusCode: 503,
            message: `Invalid WhatsApp configuration: ${message}`,
            error: {
                code: graphError?.code,
                type: graphError?.type,
                error_subcode: graphError?.error_subcode,
                fbtrace_id: graphError?.fbtrace_id,
            },
        };
    }
};

export const sendOTPwhatsapp = async (phone, otp) => {
    const config = readWhatsAppConfig();
    const {
        API_VERSION,
        WHATSAPP_BUSINESS_PHONE_NUMBER_ID,
        ACCESS_TOKEN,
        MOCK_OTP,
        TEMPLATE_NAME,
        TEMPLATE_LANGUAGE_CODE,
    } = config;

    const CUSTOMER_PHONE_NUMBER = String(phone || '').replace(/\D/g, '');
    const ONE_TIME_PASSWORD = String(otp || '');

    if (!CUSTOMER_PHONE_NUMBER || !ONE_TIME_PASSWORD) {
        return {
            success: false,
            code: "WHATSAPP_INPUT_REQUIRED",
            statusCode: 400,
            message: "Phone number and OTP are required",
        };
    }

    if (!/^\d{8,15}$/.test(CUSTOMER_PHONE_NUMBER)) {
        return {
            success: false,
            code: "WHATSAPP_INVALID_RECIPIENT_PHONE",
            statusCode: 400,
            message: "Invalid recipient phone number. Send WhatsApp numbers in international digits only, for example 216XXXXXXXX for Tunisia.",
        };
    }

    if (MOCK_OTP) {
        console.log(`[MOCK WHATSAPP OTP] Phone: ${CUSTOMER_PHONE_NUMBER}, OTP: ${ONE_TIME_PASSWORD}`);
        return {
            success: true,
            message: "MOCK OTP sent successfully (check console)",
            data: { mocked: true, otp: ONE_TIME_PASSWORD }
        };
    }

    const staticConfigCheck = validateStaticWhatsAppConfig(config);
    if (!staticConfigCheck.success) {
        return staticConfigCheck;
    }

    const SHOULD_VERIFY_CONFIG_BEFORE_SEND = String(
        process.env.WHATSAPP_VERIFY_CONFIG_BEFORE_SEND || ''
    ).toLowerCase() === 'true';

    if (SHOULD_VERIFY_CONFIG_BEFORE_SEND) {
        const configCheck = await verifyWhatsAppConfiguration();
        if (!configCheck.success) {
            return configCheck;
        }
    }

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: CUSTOMER_PHONE_NUMBER,
        type: "template",
        template: {
            name: TEMPLATE_NAME,
            language: {
                code: TEMPLATE_LANGUAGE_CODE
            },
            components: [
                {
                    type: "body",
                    parameters: [
                        {
                            type: "text",
                            text: ONE_TIME_PASSWORD
                        }
                    ]
                },
                {
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [
                        {
                            type: "text",
                            text: ONE_TIME_PASSWORD
                        }
                    ]
                }
            ]
        }
    };

    try {
        const response = await graphClient.post(
            `/${API_VERSION}/${WHATSAPP_BUSINESS_PHONE_NUMBER_ID}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Message sent successfully:', response.data);
        return {
            success: true,
            message: "OTP sent successfully",
            data: response.data
        };

    } catch (error) {
        if (error.response) {
            const graphError = error.response.data?.error;
            console.error('WhatsApp API Error:', {
                message: graphError?.message || error.message,
                type: graphError?.type,
                code: graphError?.code,
                error_subcode: graphError?.error_subcode,
                fbtrace_id: graphError?.fbtrace_id,
            });
            return {
                success: false,
                code: "WHATSAPP_SEND_INVALID_PHONE_NUMBER_ID",
                statusCode: 503,
                message: getWhatsAppApiMessage(error.response.data),
                error: error.response.data
            };
        } else {
            console.error('Request Error:', error.message);
            return {
                success: false,
                code: "WHATSAPP_SEND_REQUEST_FAILED",
                statusCode: 502,
                message: error.message || "Failed to send OTP via WhatsApp",
                error: error.message
            };
        }
    }
};
