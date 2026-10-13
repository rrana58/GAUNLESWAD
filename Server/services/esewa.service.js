const axios = require("axios");
const crypto = require("crypto");
const logger = require("../utils/logger");

const ESEWA_BASE = process.env.ESEWA_BASE_URL || "https://uat.esewa.com.np";
const MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE;
const SECRET_KEY = process.env.ESEWA_SECRET_KEY;

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
    // Decode base64 response from eSewa.
    const decoded = JSON.parse(
      Buffer.from(encodedData, "base64").toString("utf-8")
    );

    const expectedSignedFields =
      "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names";

    // Validate required gateway fields before signature verification.
    if (
      !decoded.transaction_code ||
      !decoded.status ||
      decoded.total_amount === undefined ||
      !decoded.transaction_uuid ||
      !decoded.product_code ||
      !decoded.signed_field_names ||
      !decoded.signature
    ) {
      logger.warn("eSewa response missing required verification fields.");
      return {
        success: false,
        error: "Invalid eSewa payment response.",
      };
    }

    // Ensure the response belongs to this merchant.
    if (decoded.product_code !== MERCHANT_CODE) {
      logger.warn(
        `eSewa product code mismatch: expected=${MERCHANT_CODE}, received=${decoded.product_code}`
      );
      return {
        success: false,
        error: "Invalid eSewa merchant code.",
      };
    }

    // Validate the signed field list before constructing the signature.
    if (decoded.signed_field_names !== expectedSignedFields) {
      logger.warn(
        `eSewa signed fields mismatch: ${decoded.signed_field_names}`
      );
      return {
        success: false,
        error: "Invalid eSewa signed fields.",
      };
    }

    // Verify the cryptographic signature.
    const signatureMessage =
      `transaction_code=${decoded.transaction_code},` +
      `status=${decoded.status},` +
      `total_amount=${decoded.total_amount},` +
      `transaction_uuid=${decoded.transaction_uuid},` +
      `product_code=${decoded.product_code},` +
      `signed_field_names=${decoded.signed_field_names}`;

    const expectedSignature = generateSignature(signatureMessage);

    if (decoded.signature !== expectedSignature) {
      logger.warn("eSewa signature mismatch.");
      return {
        success: false,
        error: "Invalid payment signature",
      };
    }

    // Only COMPLETE payments may be accepted.
    if (decoded.status !== "COMPLETE") {
      return {
        success: false,
        error: `Payment status: ${decoded.status}`,
      };
    }

    // Verify the transaction directly with eSewa.
    const { data } = await axios.get(
      `${ESEWA_BASE}/api/epay/transaction/status/?product_code=${encodeURIComponent(
        MERCHANT_CODE
      )}&transaction_uuid=${encodeURIComponent(
        decoded.transaction_uuid
      )}&total_amount=${encodeURIComponent(decoded.total_amount)}`
    );

    if (
      data.status !== "COMPLETE" ||
      data.product_code !== MERCHANT_CODE ||
      data.transaction_uuid !== decoded.transaction_uuid
    ) {
      logger.warn(
        `eSewa transaction verification failed: status=${data.status}, product_code=${data.product_code}, transaction_uuid=${data.transaction_uuid}`
      );
      return {
        success: false,
        error: "Payment not verified by eSewa",
      };
    }

    if (!data.ref_id) {
      logger.warn("eSewa transaction verification missing ref_id.");
      return {
        success: false,
        error: "Invalid eSewa transaction reference.",
      };
    }

    logger.info(
      `eSewa payment verified: refId=${data.ref_id}, uuid=${data.transaction_uuid}`
    );

    return {
      success: true,
      transactionId: data.ref_id,
      transactionUuid: data.transaction_uuid,
      amount: data.total_amount,
      raw: {
        callback: decoded,
        verification: data,
      },
    };
  } catch (error) {
    logger.error(`eSewa verify error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = { getEsewaPaymentData, verifyEsewaPayment };

// â”€â”€â”€ Refund â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// eSewa Refund API: POST /api/merchant/v2/refund/
// Docs: https://developer.esewa.com.np/#/refund
const refundEsewaPayment = async ({ transactionId, amount }) => {
  const ESEWA_REFUND_BASE = process.env.NODE_ENV === "production"
    ? "https://esewa.com.np"
    : "https://rc-epay.esewa.com.np";

  // Signature for refund: same HMAC-SHA256 scheme
  const signatureMessage = `transaction_uuid=${transactionId},product_code=${MERCHANT_CODE},total_amount=${amount}`;
  const refundSignature = generateSignature(signatureMessage);

  try {
    const axios = require("axios");
    const res = await axios.post(
      `${ESEWA_REFUND_BASE}/api/merchant/v2/refund/`,
      {
        product_code:      MERCHANT_CODE,
        transaction_uuid:  transactionId,
        total_amount:      amount,
        signed_field_names: "transaction_uuid,product_code,total_amount",
        signature:         refundSignature,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );
    // eSewa returns status "REFUNDED" on success
    const success = res.data?.status === "REFUNDED";
    return { success, raw: res.data };
  } catch (err) {
    const error = err.response?.data?.message || err.message;
    return { success: false, error };
  }
};

module.exports = { ...module.exports, refundEsewaPayment };
