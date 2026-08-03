const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["order_update", "promo", "system"],
      default: "order_update",
    },
    data: mongoose.Schema.Types.Mixed, // Extra payload (orderId, etc.)
    isRead: { type: Boolean, default: false },
    sentVia: [{ type: String, enum: ["fcm", "sms", "in_app"] }],
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
