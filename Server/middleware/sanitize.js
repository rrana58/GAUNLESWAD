const xss = require("xss");

// ─── Deep sanitize all string values in an object ────────────────────────────
const sanitizeValue = (val) => {
  if (typeof val === "string") return xss(val.trim());
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val && typeof val === "object" && !(val instanceof Buffer)) {
    const clean = {};
    for (const key of Object.keys(val)) {
      clean[key] = sanitizeValue(val[key]);
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
