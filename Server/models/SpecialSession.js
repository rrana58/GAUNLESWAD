const mongoose = require("mongoose");

/**
 * SpecialSession â€” Admin-configurable time-based offer windows
 *
 * Admin defines:
 *   - name: free-form label (e.g. "Khaja Time", "Late Night Special")
 *   - startHour / endHour: NPT hours (0â€“23). endHour < startHour means crosses midnight.
 *   - activeDate: "YYYY-MM-DD" NPT date the session is valid for
 *   - items: array of MenuItem ObjectIds included in this session
 *   - discountPercent: 1â€“50
 *
 * Up to 2 active sessions can run simultaneously (e.g. one day, one night).
 * Cache TTL: 60s â€” customers see changes within 1 minute.
 */
const specialSessionSchema = new mongoose.Schema(
  {
    // Free-form name â€” no longer locked to khaja/combo
    name: {
      type: String,
      required: [true, "Session name is required"],
      trim: true,
      maxlength: 80,
    },
    // Label shown to customers e.g. "Khaja Time Deals ðŸ”¥"
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
    // Discount %: 1â€“50
    discountPercent: {
      type: Number,
      required: true,
      min: [1, "Minimum 1%"],
      max: [50, "Maximum 50%"],
    },
    // Menu items and optional variant selections included in this session
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
          required: true,
        },

        // true = discount applies to every available variant
        allVariants: {
          type: Boolean,
          default: true,
        },

        // Used when allVariants is false.
        // Empty for items without variants.
        variants: [
          {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
          },
        ],
      },
    ],
    // Nepal calendar date "YYYY-MM-DD" â€” session is valid on this date only
    // Admin can set future dates for advance scheduling
    activeDate: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Guards against sending the start/end notification more than once for
    // the same session â€” the check cron runs every few minutes, but each
    // notification should only fire once.
    startNotifiedAt: { type: Date, default: null },
    endNotifiedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

specialSessionSchema.index({ isActive: 1, activeDate: 1 });

module.exports = mongoose.model("SpecialSession", specialSessionSchema);
