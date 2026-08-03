const mongoose = require("mongoose");

const menuOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Menu name is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  minPax: {
    type: Number,
    default: 4,
    min: 1,
  },
  vegDetails: {
    items: { type: [String], default: [] },
    price: { type: Number, default: 0 },
  },
  nonVegDetails: {
    items: { type: [String], default: [] },
    price: { type: Number, default: 0 },
  },
});

const celebrationPackageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Package name is required"],
      trim: true,
      maxlength: 80,
    },
    celebrationType: {
      type: String,
      required: [true, "Celebration type is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    menus: [menuOptionSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    image: {
      url: String,
      publicId: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

celebrationPackageSchema.index({ isActive: 1 });
celebrationPackageSchema.index({ celebrationType: 1 });

module.exports = mongoose.model("CelebrationPackage", celebrationPackageSchema);
