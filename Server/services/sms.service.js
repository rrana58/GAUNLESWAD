const axios = require("axios");
const logger = require("../utils/logger");

// FIX: HTTPS — original http:// sends your API token unencrypted over the network
const SPARROW_BASE_URL = "https://api.sparrowsms.com/v2/sms";

const sendSMS = async (to, message) => {
  try {
    const response = await axios.get(SPARROW_BASE_URL, {
      params: {
        token: process.env.SPARROW_SMS_TOKEN,
        from: process.env.SPARROW_SMS_FROM || "GharkoSwad",
        to,
        text: message,
      },
      timeout: 10000,
    });

    if (response.data?.response_code === 200) {
      logger.info(`SMS sent to ${to}`);
      return { success: true };
    }

    logger.warn(`Sparrow SMS failed for ${to}: ${JSON.stringify(response.data)}`);
    return { success: false, error: response.data };
  } catch (error) {
    logger.error(`Sparrow SMS error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

const sendOTP = async (phone, otp) => {
  const message = `Your Gharko Swad verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
  return sendSMS(phone, message);
};

const sendOrderStatusSMS = async (phone, orderNumber, status) => {
  const statusMessages = {
    confirmed: `Your order ${orderNumber} has been confirmed! We're getting your food ready.`,
    preparing: `Your order ${orderNumber} is being prepared in the kitchen.`,
    ready: `Your order ${orderNumber} is ready and on its way!`,
    out_for_delivery: `Your order ${orderNumber} is out for delivery. Expect it soon!`,
    delivered: `Your order ${orderNumber} has been delivered. Enjoy your meal!`,
    cancelled: `Your order ${orderNumber} has been cancelled. Contact us for assistance.`,
  };

  const message = statusMessages[status] || `Your order ${orderNumber} status: ${status}`;
  return sendSMS(phone, message);
};

module.exports = { sendSMS, sendOTP, sendOrderStatusSMS };
