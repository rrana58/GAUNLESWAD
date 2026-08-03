const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    // Not required — an audit write must never fail just because a caller
    // forgot to pass a details string. Losing the write entirely defeats
    // the purpose of an audit trail.
    details: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    ip: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Admin activity feed is read sorted by recency, and often filtered by
// actor or action type — index all three access patterns.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);