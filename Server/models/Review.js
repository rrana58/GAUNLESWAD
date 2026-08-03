const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Reviews can be for individual items
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
    },
    foodRating: { type: Number, min: 1, max: 5, required: true },
    deliveryRating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: 500 },
    images: [String], // Cloudinary URLs
    isPublished: { type: Boolean, default: true },
    adminReply: String,
  },
  { timestamps: true }
);

reviewSchema.index({ menuItem: 1, isPublished: 1 });

module.exports = mongoose.model("Review", reviewSchema);
