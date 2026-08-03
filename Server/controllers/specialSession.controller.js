const SpecialSession = require("../models/SpecialSession");
const MenuItem = require("../models/MenuItem");
const { getRedis } = require("../config/redis");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { getNepaliComponents, getTodayNP } = require("../utils/nepaliTime");

const CACHE_KEY = "special:active";
const CACHE_TTL = 60; // seconds

async function bustCache() {
  await getRedis().del(CACHE_KEY).catch(() => {});
}

async function validateMenuItems(ids) {
  if (!Array.isArray(ids) || ids.length === 0)
    throw new AppError("At least one item is required", 400);
  if (ids.length > 30) throw new AppError("Maximum 30 items per session", 400);
  const count = await MenuItem.countDocuments({ _id: { $in: ids }, isAvailable: true });
  if (count !== ids.length)
    throw new AppError("One or more items are invalid or unavailable", 400);
}

/**
 * Check if a session is currently active based on NPT hour.
 * Handles midnight-crossing sessions (e.g. startHour=22, endHour=4).
 */
function isSessionActiveNow(session) {
  const { hour } = getNepaliComponents();
  const { startHour, endHour } = session;
  if (endHour > startHour) {
    // Normal range e.g. 12–16
    return hour >= startHour && hour < endHour;
  } else {
    // Crosses midnight e.g. 22–4
    return hour >= startHour || hour < endHour;
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

exports.createSession = catchAsync(async (req, res) => {
  const { name, displayName, tagline, discountPercent, items, startHour, endHour, activeDate } = req.body;
  await validateMenuItems(items);

  const date = activeDate || getTodayNP();

  // Deactivate any existing session with the same name/date to avoid duplicates on re-creation
  await SpecialSession.updateMany(
    { name, activeDate: date, isActive: true },
    { isActive: false }
  );

  const session = await SpecialSession.create({
    name, displayName, tagline, discountPercent,
    items, startHour, endHour,
    activeDate: date,
    isActive: true,
    createdBy: req.user._id,
  });

  await bustCache();
  const populated = await session.populate("items", "name image basePrice");

  try {
    const User = require("../models/User");
    const { sendMulticastPush } = require("../services/fcm.service");
    const users = await User.find({ isActive: true, fcmTokens: { $exists: true, $not: { $size: 0 } } });
    const allTokens = users.flatMap(u => u.fcmTokens);
    if (allTokens.length > 0) {
      await sendMulticastPush(
        allTokens, 
        `Flash Sale: ${session.displayName} ⚡`, 
        `Get ${session.discountPercent}% off on selected items! Tap to view the menu.`, 
        { type: "special_session", sessionId: String(session._id) }
      );
    }
  } catch (error) {
    require("../utils/logger").logger.error(`[Special Session Push] Failed to send notification: ${error.message}`);
  }

  sendSuccess(res, { session: populated }, "Special session created", 201);
});

exports.updateSession = catchAsync(async (req, res) => {
  const session = await SpecialSession.findById(req.params.id);
  if (!session) throw new AppError("Session not found", 404);
  if (!session.isActive) throw new AppError("Cannot edit an inactive session", 400);

  const { name, displayName, tagline, discountPercent, items, startHour, endHour, activeDate } = req.body;
  if (items !== undefined) await validateMenuItems(items);
  if (name !== undefined) session.name = name;
  if (displayName !== undefined) session.displayName = displayName;
  if (tagline !== undefined) session.tagline = tagline;
  if (discountPercent !== undefined) session.discountPercent = discountPercent;
  if (items !== undefined) session.items = items;
  if (startHour !== undefined) session.startHour = startHour;
  if (endHour !== undefined) session.endHour = endHour;
  if (activeDate !== undefined) session.activeDate = activeDate;

  await session.save();
  await bustCache();
  const populated = await session.populate("items", "name image basePrice");
  sendSuccess(res, { session: populated }, "Session updated");
});

exports.deactivateSession = catchAsync(async (req, res) => {
  const session = await SpecialSession.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!session) throw new AppError("Session not found", 404);
  await bustCache();
  sendSuccess(res, {}, "Session deactivated — normal pricing resumed");
});

exports.listSessions = catchAsync(async (req, res) => {
  const date = req.query.date || getTodayNP();
  const sessions = await SpecialSession.find({ activeDate: date })
    .populate("items", "name image basePrice")
    .populate("createdBy", "name phone")
    .sort({ startHour: 1 });
  sendSuccess(res, { sessions, date });
});

exports.getAvailableItems = catchAsync(async (req, res) => {
  const items = await MenuItem.find({ isAvailable: true })
    .populate("category", "name")
    .select("name image basePrice variants category isFeatured tags")
    .sort({ sortOrder: 1 })
    .lean();
  sendSuccess(res, { items });
});

// ─── Customer ─────────────────────────────────────────────────────────────────

exports.getActiveSession = catchAsync(async (req, res) => {
  const redis = getRedis();

  const cached = await redis.get(CACHE_KEY).catch(() => null);
  if (cached) return sendSuccess(res, { sessions: JSON.parse(cached) });

  const today = getTodayNP();

  // Fetch all active sessions for today
  const todaySessions = await SpecialSession.find({ activeDate: today, isActive: true })
    .populate("items", "name image basePrice variants addons isVeg isSpicy tags preparationTime avgRating isAvailable")
    .lean();

  // Filter to only sessions whose time window is currently active
  const activeSessions = todaySessions.filter(isSessionActiveNow);

  // Compute discounted prices server-side for each active session
  const sessionsWithPrices = activeSessions.map((session) => {
    const multiplier = 1 - session.discountPercent / 100;
    return {
      ...session,
      items: session.items.map((item) => {
        const original = item.basePrice;
        const discounted = Math.round(original * multiplier);
        return {
          ...item,
          originalPrice: original,
          discountedPrice: discounted,
          saving: original - discounted,
          variants: (item.variants || []).map((v) => ({
            ...v,
            originalPrice: v.price,
            price: Math.round(v.price * multiplier),
          })),
        };
      }),
    };
  });

  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(sessionsWithPrices)).catch(() => {});
  sendSuccess(res, { sessions: sessionsWithPrices });
});