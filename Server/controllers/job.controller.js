const Job = require("../models/Job");
const JobApplication = require("../models/JobApplication");
const { sendSuccess, sendPaginated } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// ─── Public ───────────────────────────────────────────────────────────────────

exports.getActiveJobs = catchAsync(async (req, res) => {
  const jobs = await Job.find({ isActive: true })
    .select("title description location employmentType createdAt")
    .sort({ createdAt: -1 })
    .lean();
  sendSuccess(res, { jobs });
});

exports.applyToJob = catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job || !job.isActive) throw new AppError("This job posting is no longer available.", 404);

  const { name, phone, message } = req.body;

  const application = await JobApplication.create({
    job: job._id,
    jobTitle: job.title,
    applicant: req.user?._id,
    name,
    phone,
    message,
  });

  sendSuccess(res, { application }, "Application submitted — we'll reach out if it's a fit.", 201);
});

// ─── Admin — Jobs ─────────────────────────────────────────────────────────────

exports.listJobs = catchAsync(async (req, res) => {
  const jobs = await Job.find().populate("createdBy", "name phone").sort({ createdAt: -1 });

  // Attach a lightweight application count per job for the admin list view
  const counts = await JobApplication.aggregate([
    { $group: { _id: "$job", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  const jobsWithCounts = jobs.map((j) => ({
    ...j.toObject(),
    applicationCount: countMap.get(j._id.toString()) || 0,
  }));

  sendSuccess(res, { jobs: jobsWithCounts });
});

exports.createJob = catchAsync(async (req, res) => {
  const { title, description, location, employmentType } = req.body;
  const job = await Job.create({
    title, description, location, employmentType,
    createdBy: req.user._id,
  });

  try {
    const User = require("../models/User");
    const { sendMulticastPush } = require("../services/fcm.service");
    // Get all active users with FCM tokens
    const users = await User.find({ isActive: true, fcmTokens: { $exists: true, $not: { $size: 0 } } });
    const allTokens = users.flatMap(u => u.fcmTokens);
    if (allTokens.length > 0) {
      await sendMulticastPush(allTokens, "We are hiring! 🚀", `New job opening: ${job.title}. Tap to apply and join our team!`, { type: "career", jobId: String(job._id) });
    }
  } catch (error) {
    require("../utils/logger").logger.error(`[Job Push] Failed to send job notification: ${error.message}`);
  }

  sendSuccess(res, { job }, "Job created successfully", 201);
});

exports.updateJob = catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw new AppError("Job not found", 404);

  const { title, description, location, employmentType, isActive } = req.body;
  if (title !== undefined) job.title = title;
  if (description !== undefined) job.description = description;
  if (location !== undefined) job.location = location;
  if (employmentType !== undefined) job.employmentType = employmentType;
  if (isActive !== undefined) job.isActive = isActive;

  await job.save();
  sendSuccess(res, { job }, "Job updated");
});

exports.deleteJob = catchAsync(async (req, res) => {
  const job = await Job.findByIdAndDelete(req.params.id);
  if (!job) throw new AppError("Job not found", 404);
  sendSuccess(res, {}, "Job deleted");
});

// ─── Admin — Applications ──────────────────────────────────────────────────────

exports.listApplications = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, jobId, status } = req.query;
  const filter = {};
  if (jobId) filter.job = jobId;
  if (status) filter.status = status;

  const total = await JobApplication.countDocuments(filter);
  const applications = await JobApplication.find(filter)
    .populate("job", "title")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  sendPaginated(res, { applications }, total, page, limit);
});

exports.updateApplicationStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const application = await JobApplication.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );
  if (!application) throw new AppError("Application not found", 404);
  sendSuccess(res, { application }, "Application updated");
});
