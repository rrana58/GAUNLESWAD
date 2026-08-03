const axios = require("axios");
const logger = require("../utils/logger");

const KHALTI_BASE = process.env.KHALTI_BASE_URL || "https://dev.khalti.com/api/v2";

const khaltiClient = axios.create({
  baseURL: KHALTI_BASE,
  headers: {
    Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

/**
 * Initiate a Khalti payment
 * Returns a pidx and payment_url to redirect the customer
 */
const initiateKhaltiPayment = async ({ orderId, orderNumber, amount, customerName, customerPhone, customerEmail, returnUrl }) => {
  try {
    const payload = {
      return_url: returnUrl,
      website_url: process.env.WEB_URL || "http://localhost:3000",
      amount: amount * 100, // Khalti uses paisa (1 Rs = 100 paisa)
      purchase_order_id: orderId,
      purchase_order_name: `Gharko Swad - ${orderNumber}`,
      customer_info: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
    };

    const { data } = await khaltiClient.post("/epayment/initiate/", payload);

    logger.info(`Khalti payment initiated for order ${orderNumber}: pidx=${data.pidx}`);
    return { success: true, pidx: data.pidx, paymentUrl: data.payment_url };
  } catch (error) {
    const errMsg = error.response?.data?.detail || error.message;
    logger.error(`Khalti initiate failed: ${errMsg}`);
    return { success: false, error: errMsg };
  }
};

/**
 * Verify a Khalti payment after redirect
 */
const verifyKhaltiPayment = async (pidx) => {
  try {
    const { data } = await khaltiClient.post("/epayment/lookup/", { pidx });

    logger.info(`Khalti verify for pidx=${pidx}: status=${data.status}`);

    return {
      success: true,
      status: data.status, // "Completed", "Pending", "Initiated", etc.
      transactionId: data.transaction_id,
      amount: data.total_amount / 100, // Convert paisa back to rupees
      raw: data,
    };
  } catch (error) {
    const errMsg = error.response?.data?.detail || error.message;
    logger.error(`Khalti verify failed: ${errMsg}`);
    return { success: false, error: errMsg };
  }
};

module.exports = { initiateKhaltiPayment, verifyKhaltiPayment };

// ─── Refund ───────────────────────────────────────────────────────────────────
// Khalti Refund API: POST https://khalti.com/api/v2/payment/refund/
const refundKhaltiPayment = async ({ pidx, amount }) => {
  const KHALTI_BASE = process.env.NODE_ENV === "production"
    ? "https://khalti.com"
    : "https://dev.khalti.com";

  try {
    const axios = require("axios");
    const res = await axios.post(
      `${KHALTI_BASE}/api/v2/payment/refund/`,
      { pidx },
      {
        headers: {
          Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
    return { success: true, raw: res.data };
  } catch (err) {
    const error = err.response?.data?.detail || err.message;
    return { success: false, error };
  }
};

module.exports = { ...module.exports, refundKhaltiPayment };
