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

  if (req.user?._id) {
    const existingApplication = await JobApplication.findOne({
      job: job._id,
      applicant: req.user._id,
    });

    if (existingApplication) {
      throw new AppError("You have already applied for this job.", 409);
    }
  }

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

exports.getMyApplications = catchAsync(async (req, res) => {
  const applications = await JobApplication.find({
    applicant: req.user._id,
  })
    .select("job jobTitle status createdAt")
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, { applications });
});
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
    const Notification = require("../models/Notification");
    const { sendMulticastPush } = require("../services/fcm.service");
    const { emitCustomerNotification } = require("../config/socket");

    const users = await User.find(
      { isActive: true, role: "customer" },
      { fcmTokens: 1 }
    );

    const notifications = await Notification.insertMany(
      users.map((user) => ({
        user: user._id,
        title: "We are hiring!",
        body: `New job opening: ${job.title}. Tap to view and apply!`,
        type: "system",
        data: {
          type: "career_job",
          jobId: String(job._id),
        },
        sentVia: ["in_app"],
      })),
      { ordered: false }
    );

    for (const notification of notifications) {
      emitCustomerNotification(notification.user, notification);
    }

    const allTokens = users
      .flatMap((user) => user.fcmTokens || [])
      .filter(Boolean);

    if (allTokens.length > 0) {
      await sendMulticastPush(
        allTokens,
        "We are hiring!",
        `New job opening: ${job.title}. Tap to view and apply!`,
        { type: "career_job", jobId: String(job._id) }
      );
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
  const application = await JobApplication.findById(req.params.id);
  if (!application) throw new AppError("Application not found", 404);

  const previousStatus = application.status
  console.log("[JOB STATUS DEBUG]", { applicationId: String(application._id), applicant: application.applicant ? String(application.applicant) : null, previousStatus, newStatus: status });;
  application.status = status;
  await application.save();

  if (previousStatus !== status && application.applicant) {
    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");
      const { emitCustomerNotification } = require("../config/socket");

      const applicant = await User.findById(application.applicant).select("fcmTokens");

      const statusLabels = {
        new: "Application Submitted",
        reviewed: "Application Reviewed",
        contacted: "We've Contacted You",
        rejected: "Position Filled",
      };

      const notification = await Notification.create({
        user: application.applicant,
        title: "Application Status Updated",
        body: `Your application for ${application.jobTitle} is now ${statusLabels[status] || status}.`,
        type: "system",
        data: {
          type: "career_application_status",
          applicationId: String(application._id),
          jobId: String(application.job),
        },
        sentVia: ["in_app"],
      });

      emitCustomerNotification(application.applicant, notification);

      if (applicant?.fcmTokens?.length) {
        try {
          const { sendMulticastPush } = require("../services/fcm.service");
          await sendMulticastPush(
            applicant.fcmTokens.filter(Boolean),
            "Application Status Updated",
            notification.body,
            {
              type: "career_application_status",
              applicationId: String(application._id),
              jobId: String(application.job),
            }
          );
        } catch (error) {
          require("../utils/logger").logger.error(
            `[Job Application Push] Failed to send status notification: ${error.message}`
          );
        }
      }
    } catch (error) {
      require("../utils/logger").logger.error(
        `[Job Application Notification] Failed: ${error.message}`
      );
    }
  }

  sendSuccess(res, { application }, "Application updated");
});
