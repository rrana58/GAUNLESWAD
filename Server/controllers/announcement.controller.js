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

// Every announcement automatically notifies customers — in-app (bell) for
// everyone, plus push for whoever has a device registered. Previously this
// only happened if admin separately checked a "send push" box on the
// broadcast feature; now it's just part of posting an announcement, so
// nothing gets missed.
exports.createAnnouncement = catchAsync(async (req, res) => {
  const { title, body, expiresAt } = req.body;
  const announcement = await Announcement.create({
    title,
    body,
    expiresAt: expiresAt || undefined,
    createdBy: req.user._id,
  });

  notifyCustomersOfAnnouncement(title, body, announcement._id);

  sendSuccess(res, { announcement }, "Announcement posted", 201);
});

async function notifyCustomersOfAnnouncement(title, body, announcementId) {
  try {
    const User = require("../models/User");
    const Notification = require("../models/Notification");
    const { sendMulticastPush } = require("../services/fcm.service");

    const users = await User.find(
      { isActive: true, role: "customer" },
      { fcmTokens: 1 }
    );
    if (!users.length) return;

    await Notification.insertMany(
      users.map((u) => ({
        user: u._id, title, body, type: "promo",
        data: { announcementId: announcementId.toString() },
        sentVia: ["in_app"],
      })),
      { ordered: false }
    );

    const allTokens = users.flatMap((u) => u.fcmTokens || []).filter(Boolean);
    for (let i = 0; i < allTokens.length; i += 500) {
      await sendMulticastPush(allTokens.slice(i, i + 500), title, body, {
        type: "announcement", announcementId: announcementId.toString(),
      }).catch(() => {});
    }
  } catch (err) {
    require("../utils/logger").logger.error(`Announcement notify failed: ${err.message}`);
  }
}

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