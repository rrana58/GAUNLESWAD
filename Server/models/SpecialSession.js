const mongoose = require("mongoose");

/**
 * SpecialSession — Admin-configurable time-based offer windows
 *
 * Admin defines:
 *   - name: free-form label (e.g. "Khaja Time", "Late Night Special")
 *   - startHour / endHour: NPT hours (0–23). endHour < startHour means crosses midnight.
 *   - activeDate: "YYYY-MM-DD" NPT date the session is valid for
 *   - items: array of MenuItem ObjectIds included in this session
 *   - discountPercent: 1–50
 *
 * Up to 2 active sessions can run simultaneously (e.g. one day, one night).
 * Cache TTL: 60s — customers see changes within 1 minute.
 */
const specialSessionSchema = new mongoose.Schema(
  {
    // Free-form name — no longer locked to khaja/combo
    name: {
      type: String,
      required: [true, "Session name is required"],
      trim: true,
      maxlength: 80,
    },
    // Label shown to customers e.g. "Khaja Time Deals 🔥"
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
      maxlength: 80,
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    // NPT hour (0-23) when this session starts
    startHour: {
      type: Number,
      required: [true, "Start hour is required"],
      min: 0,
      max: 23,
    },
    // NPT hour (0-23) when this session ends (exclusive)
    // If endHour <= startHour, session crosses midnight
    endHour: {
      type: Number,
      required: [true, "End hour is required"],
      min: 0,
      max: 23,
    },
    // Discount %: 1–50
    discountPercent: {
      type: Number,
      required: true,
      min: [1, "Minimum 1%"],
      max: [50, "Maximum 50%"],
    },
    // Menu items included in this session
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        required: true,
      },
    ],
    // Nepal calendar date "YYYY-MM-DD" — session is valid on this date only
    // Admin can set future dates for advance scheduling
    activeDate: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

specialSessionSchema.index({ isActive: 1, activeDate: 1 });

module.exports = mongoose.model("SpecialSession", specialSessionSchema);