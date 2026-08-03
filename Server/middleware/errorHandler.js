const { logger, securityLogger } = require("../utils/logger");

// ─── Transform known error types ─────────────────────────────────────────────
const transformError = (err) => {
  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    return { message: "Invalid ID format.", statusCode: 400 };
  }
  // Mongoose duplicate key
 if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const value = err.keyValue?.[field];
    const friendly = {
      phone: "Phone number",
      email: "Email address",
      slug: "Meal plan name",
      name: "Name",
      code: "Coupon code",
    };
    const fieldLabel = friendly[field] || "This value";
    const message = field === "slug" || field === "name"
      ? `A meal plan with the name "${value?.replace(/-/g, " ")}" already exists. Please use a different name.`
      : `${fieldLabel} is already registered.`;
    return { message, statusCode: 409 };
  }
  
  // Mongoose validation
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message).join(". ");
    return { message: messages, statusCode: 400 };
  }
  // JWT errors
  if (err.name === "JsonWebTokenError") return { message: "Invalid token.", statusCode: 401 };
  if (err.name === "TokenExpiredError") return { message: "Session expired. Please log in again.", statusCode: 401 };
  // Multer file size
  if (err.code === "LIMIT_FILE_SIZE") return { message: "File too large. Maximum 5MB allowed.", statusCode: 400 };
  if (err.code === "LIMIT_UNEXPECTED_FILE") return { message: "Unexpected file field.", statusCode: 400 };

  return null;
};

// ─── Global error handler ─────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  const transformed = transformError(err);

  const statusCode = transformed?.statusCode || err.statusCode || 500;
  const isOperational = err.isOperational || !!transformed;

  // Generic message for unexpected errors in production — NEVER leak internals
  let message;
  if (isOperational) {
    message = transformed?.message || err.message;
  } else {
    message = process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again later."
      : err.message;
  }

  // Log with appropriate severity
  if (statusCode >= 500) {
    logger.error(`[${req.requestId}] ${req.method} ${req.originalUrl} — ${err.message}`, {
      statusCode,
      stack: err.stack,
      // Don't log req.body in prod (may contain PII)
      ...(process.env.NODE_ENV !== "production" && { body: req.body }),
    });
  } else if (statusCode === 401 || statusCode === 403) {
    securityLogger.warn(`[${req.requestId}] Auth error ${statusCode}: ${message} — IP: ${req.ip}`);
  }

  const response = { success: false, message };

  // Only expose stack in development
  if (process.env.NODE_ENV === "development" && !isOperational) {
    response.stack = err.stack;
    response.error = err.name;
  }

  // Request ID always included — helps correlate logs
  if (req.requestId) response.requestId = req.requestId;

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
