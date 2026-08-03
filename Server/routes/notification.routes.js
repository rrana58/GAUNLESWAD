const router = require("express").Router();
const Notification = require("../models/Notification");
const { protect, restrictTo } = require("../middleware/auth");
const { validateObjectId } = require("../middleware/sanitize");
const { sendSuccess } = require("../utils/response");
const catchAsync = require("../utils/catchAsync");

router.use(protect);

router.get("/", catchAsync(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort("-createdAt")
    .limit(30);
  sendSuccess(res, { notifications });
}));

router.patch("/read-all", catchAsync(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  sendSuccess(res, {}, "All notifications marked as read");
}));

// FIX: validate id format before hitting the DB — prevents CastError on invalid ObjectId
router.patch("/:id/read", validateObjectId("id"), catchAsync(async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true });
  sendSuccess(res, {}, "Notification marked as read");
}));

// Admin broadcast endpoint
router.post("/broadcast", restrictTo("admin"), catchAsync(async (req, res) => {
  const { title, body, data } = req.body;
  if (!title || !body) throw new AppError("Title and body are required", 400);

  const User = require("../models/User");
  const { sendMulticastPush } = require("../services/fcm.service");

  // Get all active users with FCM tokens
  const users = await User.find({ isActive: true, fcmTokens: { $exists: true, $not: { $size: 0 } } });
  
  // Extract all tokens into a flat array
  const allTokens = users.flatMap(u => u.fcmTokens);

  if (allTokens.length > 0) {
    // sendMulticastPush processes arrays of tokens natively up to 500 per batch.
    // We pass it to the service to handle
    await sendMulticastPush(allTokens, title, body, { type: "broadcast", ...data });
  }

  sendSuccess(res, { tokensTargeted: allTokens.length }, "Broadcast sent successfully");
}));

module.exports = router;
