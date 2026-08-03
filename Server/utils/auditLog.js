// Loaded defensively so a missing/renamed model file can never crash server
// boot — recordActivity() becomes a silent no-op if the model isn't available.
let AuditLog;
try {
  AuditLog = require("../models/AuditLog");
} catch {
  AuditLog = null;
  console.warn("[auditLog] AuditLog model not found — audit logging disabled.");
}

const recordActivity = async (req, action, details) => {
  if (!AuditLog) return;
  try {
    await AuditLog.create({
      user: req.user._id,
      action,
      details,
      ip: req.ip,
    });
  } catch (err) {
    // Audit failures must never fail the primary request.
    console.error("Audit Log Error:", err);
  }
};

module.exports = { recordActivity };