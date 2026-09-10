const xss = require("xss");

// Fields that must NEVER be XSS-encoded — encoding changes their value and
// breaks bcrypt comparison or token validation (e.g. a password containing
// `<` gets stored as `&lt;` and can never match again).
const SKIP_XSS_KEYS = new Set([
  "password", "newPassword", "currentPassword",
  "otp", "fcmToken", "refreshToken", "totpChallengeToken",
  "token", "pidx", "data",
]);

// ─── Deep sanitize all string values in an object ────────────────────────────
const sanitizeValue = (val, key) => {
  if (typeof val === "string") {
    // Never XSS-encode sensitive fields — they are validated separately
    if (key && SKIP_XSS_KEYS.has(key)) return val;
    return xss(val.trim());
  }
  if (Array.isArray(val)) return val.map((v) => sanitizeValue(v));
  if (val && typeof val === "object" && !(val instanceof Buffer)) {
    const clean = {};
    for (const k of Object.keys(val)) {
      clean[k] = sanitizeValue(val[k], k);
    }
    return clean;
  }
  return val;
};

// ─── Sanitize req.body and req.query ─────────────────────────────────────────
const sanitizeInput = (req, res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  // Don't sanitize params — they're validated by mongoose ObjectId checks
  next();
};

// ─── Validate MongoDB ObjectId params ────────────────────────────────────────
const mongoose = require("mongoose");

const validateObjectId = (...paramNames) => (req, res, next) => {
  for (const param of paramNames) {
    const val = req.params[param];
    if (val && !mongoose.Types.ObjectId.isValid(val)) {
      return res.status(400).json({ success: false, message: `Invalid ${param}` });
    }
  }
  next();
};

// ─── Strip unknown fields from req.body ──────────────────────────────────────
// Prevents mass-assignment attacks (e.g. user sending role: "admin")
const allowFields = (...allowed) => (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    const filtered = {};
    for (const key of allowed) {
      if (key in req.body) filtered[key] = req.body[key];
    }
    req.body = filtered;
  }
  next();
};

module.exports = { sanitizeInput, validateObjectId, allowFields };
