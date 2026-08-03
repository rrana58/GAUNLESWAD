const mongoose = require("mongoose");

/**
 * Announcement — Simple admin-authored notices shown to all customers
 * (e.g. "New branch opening in Pokhara", "Server will be down for maintenance").
 * Deliberately text-only (title + body) — no images/links, keeping it a fast
 * thing for admin to post and for customers to skim.
 */
const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 100,
    },
    body: {
      type: String,
      required: [true, "Body is required"],
      trim: true,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Optional expiry — once past, no longer shown to customers even if isActive
    expiresAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

announcementSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);
