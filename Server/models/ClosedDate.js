const mongoose = require("mongoose");

/**
 * ClosedDate — Specific dates when the kitchen is closed
 * (festivals, holidays, staff days off, etc.)
 *
 * Admin creates these in advance. On a closed date:
 *   - Order placement is blocked with a clear message
 *   - Customers are notified X days before via FCM push + SMS
 *
 * notificationSentAt: tracks whether the advance warning was already sent
 * notifyDaysBefore: how many days in advance to send the warning (default: 1)
 */
const closedDateSchema = new mongoose.Schema(
  {
    // Date in Nepal timezone "YYYY-MM-DD"
    date: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"],
    },
    // Human-readable reason shown to customers
    reason: {
      type: String,
      required: [true, "Reason is required"],
      trim: true,
      maxlength: 200,
    },
    // Optional extra note for internal use (not shown to customers)
    adminNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // How many days in advance to send the warning notification
    notifyDaysBefore: {
      type: Number,
      default: 1,
      min: 0,
      max: 7,
    },
    // Timestamp when the advance notification was sent — null means not yet sent
    notificationSentAt: {
      type: Date,
      default: null,
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

// Unique active date (can't have two active closed dates for the same day)
closedDateSchema.index({ date: 1, isActive: 1 }, { unique: false });
closedDateSchema.index({ date: 1 });

module.exports = mongoose.model("ClosedDate", closedDateSchema);