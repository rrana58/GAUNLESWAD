const mongoose = require("mongoose");

const riderLocationSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    accuracy: {
      type: Number,
      min: 0,
      default: null,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
      default: null,
    },
    speed: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

riderLocationSchema.index({ updatedAt: 1 });

module.exports = mongoose.model("RiderLocation", riderLocationSchema);
