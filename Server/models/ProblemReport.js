const mongoose = require("mongoose");

const problemReportSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    problemType: {
      type: String,
      enum: ["order", "payment", "delivery", "food_menu", "technical", "other"],
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open",
    },
  },
  { timestamps: true }
);

problemReportSchema.index({ customer: 1, createdAt: -1 });
problemReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ProblemReport", problemReportSchema);
