const axios = require("axios");
const crypto = require("crypto");
const logger = require("../utils/logger");

const ESEWA_BASE = process.env.ESEWA_BASE_URL || "https://uat.esewa.com.np";
const MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || "EPAYTEST";
const SECRET_KEY = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q";

/**
 * Generate HMAC-SHA256 signature for eSewa
 */
const generateSignature = (message) => {
  return crypto.createHmac("sha256", SECRET_KEY).update(message).digest("base64");
};

/**
 * Get eSewa payment form data (POST form submission from frontend)
 * Returns the data the frontend needs to submit to eSewa
 */
const getEsewaPaymentData = ({ orderId, amount }) => {
  const transactionUuid = `${orderId}-${Date.now()}`;
  const signatureMessage = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${MERCHANT_CODE}`;
  const signature = generateSignature(signatureMessage);

  return {
    amount,
    tax_amount: 0,
    total_amount: amount,
    transaction_uuid: transactionUuid,
    product_code: MERCHANT_CODE,
    product_service_charge: 0,
    product_delivery_charge: 0,
    success_url: `${process.env.WEB_URL}/payment/esewa/success`,
    failure_url: `${process.env.WEB_URL}/payment/esewa/failure`,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature,
    esewaUrl: `${ESEWA_BASE}/api/epay/main/v2/form`,
  };
};

/**
 * Verify eSewa payment after redirect
 * eSewa sends encoded data as query param on success_url
 */
const verifyEsewaPayment = async (encodedData) => {
  try {
    // Decode base64 response
    const decoded = JSON.parse(Buffer.from(encodedData, "base64").toString("utf-8"));

    // Verify signature
    const signatureMessage = `transaction_code=${decoded.transaction_code},status=${decoded.status},total_amount=${decoded.total_amount},transaction_uuid=${decoded.transaction_uuid},product_code=${decoded.product_code},signed_field_names=${decoded.signed_field_names}`;
    const expectedSignature = generateSignature(signatureMessage);

    if (decoded.signature !== expectedSignature) {
      logger.warn("eSewa signature mismatch");
      return { success: false, error: "Invalid payment signature" };
    }

    if (decoded.status !== "COMPLETE") {
      return { success: false, error: `Payment status: ${decoded.status}` };
    }

    // Verify with eSewa API
    const { data } = await axios.get(
      `${ESEWA_BASE}/api/epay/transaction/status/?product_code=${MERCHANT_CODE}&transaction_uuid=${decoded.transaction_uuid}&total_amount=${decoded.total_amount}`
    );

    if (data.status !== "COMPLETE") {
      return { success: false, error: "Payment not verified by eSewa" };
    }

    logger.info(`eSewa payment verified: txn=${decoded.transaction_code}`);
    return {
      success: true,
      transactionId: decoded.transaction_code,
      transactionUuid: decoded.transaction_uuid,
      amount: decoded.total_amount,
      raw: decoded,
    };
  } catch (error) {
    logger.error(`eSewa verify error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = { getEsewaPaymentData, verifyEsewaPayment };

// ─── Refund ───────────────────────────────────────────────────────────────────
// eSewa Refund: https://developer.esewa.com.np/#/refund
const refundEsewaPayment = async ({ transactionId, amount }) => {
  const ESEWA_BASE = process.env.NODE_ENV === "production"
    ? "https://esewa.com.np"
    : "https://rc-epay.esewa.com.np";

  try {
    const axios = require("axios");
    const res = await axios.post(
      `${ESEWA_BASE}/api/epay/transaction/status/`,
      {
        product_code:   process.env.ESEWA_MERCHANT_CODE,
        transaction_uuid: transactionId,
        total_amount:   amount,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );
    // eSewa returns status "REFUNDED" on success
    const success = res.data?.status === "REFUNDED" || res.data?.status === "COMPLETE";
    return { success, raw: res.data };
  } catch (err) {
    const error = err.response?.data?.message || err.message;
    return { success: false, error };
  }
};

module.exports = { ...module.exports, refundEsewaPayment };
