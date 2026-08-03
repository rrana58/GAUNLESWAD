const mongoose = require("mongoose");

/**
 * Job — Admin-posted job/career openings, browsable by customers in-app.
 */
const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: 2000,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "Waling, Gandaki",
    },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "internship", "contract"],
      default: "full-time",
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

jobSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model("Job", jobSchema);
