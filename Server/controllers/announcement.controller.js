const Announcement = require("../models/Announcement");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// ─── Public ───────────────────────────────────────────────────────────────────

// Active, non-expired announcements — newest first
exports.getActiveAnnouncements = catchAsync(async (req, res) => {
  const announcements = await Announcement.find({
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: new Date() } }],
  })
    .select("title body createdAt")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  sendSuccess(res, { announcements });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

exports.listAnnouncements = catchAsync(async (req, res) => {
  const announcements = await Announcement.find()
    .populate("createdBy", "name phone")
    .sort({ createdAt: -1 });
  sendSuccess(res, { announcements });
});

exports.createAnnouncement = catchAsync(async (req, res) => {
  const { title, body, expiresAt } = req.body;
  const announcement = await Announcement.create({
    title,
    body,
    expiresAt: expiresAt || undefined,
    createdBy: req.user._id,
  });
  sendSuccess(res, { announcement }, "Announcement posted", 201);
});

exports.updateAnnouncement = catchAsync(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw new AppError("Announcement not found", 404);

  const { title, body, isActive, expiresAt } = req.body;
  if (title !== undefined) announcement.title = title;
  if (body !== undefined) announcement.body = body;
  if (isActive !== undefined) announcement.isActive = isActive;
  if (expiresAt !== undefined) announcement.expiresAt = expiresAt || undefined;

  await announcement.save();
  sendSuccess(res, { announcement }, "Announcement updated");
});

exports.deleteAnnouncement = catchAsync(async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw new AppError("Announcement not found", 404);
  sendSuccess(res, {}, "Announcement deleted");
});
