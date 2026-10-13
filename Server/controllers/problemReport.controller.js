const ProblemReport = require("../models/ProblemReport");
const { sendSuccess } = require("../utils/response");
const { AppError } = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

exports.createReport = catchAsync(async (req, res) => {
  const { problemType, order, description } = req.body;

  const report = await ProblemReport.create({
    customer: req.user._id,
    problemType,
    order: order || undefined,
    description,
  });

  sendSuccess(res, { report }, "Problem reported successfully", 201);
});

exports.getMyReports = catchAsync(async (req, res) => {
  const reports = await ProblemReport.find({
    customer: req.user._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, { reports });
});

exports.listReports = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};

  if (status) filter.status = status;

  const total = await ProblemReport.countDocuments(filter);

  const reports = await ProblemReport.find(filter)
    .populate("customer", "name phone email")
    .populate("order", "orderNumber")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  sendSuccess(res, {
    reports,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

exports.updateReportStatus = catchAsync(async (req, res) => {
  const { status } = req.body;

  const report = await ProblemReport.findById(req.params.id);

  if (!report) {
    throw new AppError("Problem report not found", 404);
  }

  report.status = status;
  await report.save();

  sendSuccess(res, { report }, "Problem report status updated");
});