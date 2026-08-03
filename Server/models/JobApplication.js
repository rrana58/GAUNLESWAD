const mongoose = require("mongoose");

/**
 * JobApplication — Submitted by a customer against a Job posting.
 * Kept intentionally lightweight: name, phone, message — no file upload.
 */
const jobApplicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    // Snapshot of the job title at time of application — survives the
    // parent Job later being edited or deactivated.
    jobTitle: {
      type: String,
      required: true,
    },
    // Set when the applicant is a logged-in customer; null for guests.
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 80,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["new", "reviewed", "contacted", "rejected"],
      default: "new",
    },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ job: 1, createdAt: -1 });
jobApplicationSchema.index({ status: 1 });

module.exports = mongoose.model("JobApplication", jobApplicationSchema);
