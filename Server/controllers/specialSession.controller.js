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

async function validateMenuItems(items) {
  if (!Array.isArray(items) || items.length === 0)
    throw new AppError("At least one item is required", 400);

  if (items.length > 30)
    throw new AppError("Maximum 30 items per session", 400);

  const menuItemIds = items.map((entry) => entry?.menuItem);

  const uniqueIds = new Set(menuItemIds.map((id) => String(id)));
  if (uniqueIds.size !== items.length)
    throw new AppError("Duplicate menu items are not allowed in the same session", 400);

  const menuItems = await MenuItem.find({
    _id: { $in: menuItemIds },
    isAvailable: true,
  }).select("variants");

  if (menuItems.length !== items.length)
    throw new AppError("One or more items are invalid or unavailable", 400);

  const menuMap = new Map(menuItems.map((item) => [String(item._id), item]));

  for (const entry of items) {
    if (!entry?.menuItem)
      throw new AppError("Each session item must include a menuItem", 400);

    const menuItem = menuMap.get(String(entry.menuItem));
    if (!menuItem)
      throw new AppError("One or more items are invalid or unavailable", 400);

    const hasVariants =
      Array.isArray(menuItem.variants) && menuItem.variants.length > 0;

    const allVariants = entry.allVariants !== false;
    const selectedVariants = Array.isArray(entry.variants)
      ? entry.variants
      : [];

    if (!hasVariants) {
      if (selectedVariants.length > 0)
        throw new AppError(
          `Item ${menuItem._id} does not have variants`,
          400
        );
      continue;
    }

    if (!allVariants && selectedVariants.length === 0)
      throw new AppError(
        `Select All Variants or at least one variant for ${menuItem._id}`,
        400
      );

    if (allVariants && selectedVariants.length > 0)
      throw new AppError(
        "Do not send specific variants when All Variants is selected",
        400
      );

    if (!allVariants) {
      const availableVariantIds = new Set(
        menuItem.variants
          .filter((variant) => variant.isAvailable)
          .map((variant) => String(variant._id))
      );

      for (const variantId of selectedVariants) {
        if (!availableVariantIds.has(String(variantId)))
          throw new AppError(
            `One or more selected variants are invalid or unavailable for ${menuItem._id}`,
            400
          );
      }
    }
  }
}

function getTimeSegments(startHour, endHour) {
  if (endHour > startHour) {
    return [[startHour, endHour]];
  }

  return [
    [startHour, 24],
    [0, endHour],
  ];
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
  const {
    name,
    displayName,
    tagline,
    discountPercent,
    items,
    startHour,
    endHour,
    activeDate,
  } = req.body;

  await validateMenuItems(items);

  const date = activeDate || getTodayNP();


  const session = await SpecialSession.create({
    name,
    displayName,
    tagline,
    discountPercent,
    items,
    startHour,
    endHour,
    activeDate: date,
    isActive: true,
    createdBy: req.user._id,
  });

  await bustCache();

  const populated = await SpecialSession.findById(session._id)
    .populate("items.menuItem", "name image basePrice variants");

  try {
    const User = require("../models/User");
    const { sendMulticastPush } = require("../services/fcm.service");

    const users = await User.find({
      isActive: true,
      fcmTokens: { $exists: true, $not: { $size: 0 } },
    });

    const allTokens = users.flatMap((u) => u.fcmTokens);

    if (allTokens.length > 0) {
      await sendMulticastPush(
        allTokens,
        `Flash Sale: ${session.displayName} ?`,
        `Get ${session.discountPercent}% off on selected items! Tap to view the menu.`,
        {
          type: "special_session",
          sessionId: String(session._id),
        }
      );
    }
  } catch (error) {
    require("../utils/logger").logger.error(
      `[Special Session Push] Failed to send notification: ${error.message}`
    );
  }

  sendSuccess(
    res,
    { session: populated },
    "Special session created",
    201
  );
});

exports.updateSession = catchAsync(async (req, res) => {
  const session = await SpecialSession.findById(req.params.id);

  if (!session)
    throw new AppError("Session not found", 404);

  if (!session.isActive)
    throw new AppError("Cannot edit an inactive session", 400);

  const {
    name,
    displayName,
    tagline,
    discountPercent,
    items,
    startHour,
    endHour,
    activeDate,
  } = req.body;

  const nextItems = items !== undefined ? items : session.items;
  const nextStartHour = startHour !== undefined ? startHour : session.startHour;
  const nextEndHour = endHour !== undefined ? endHour : session.endHour;
  const nextActiveDate = activeDate !== undefined
    ? activeDate
    : session.activeDate;

  if (items !== undefined) {
    await validateMenuItems(items);
  }


  if (name !== undefined) session.name = name;
  if (displayName !== undefined) session.displayName = displayName;
  if (tagline !== undefined) session.tagline = tagline;
  if (discountPercent !== undefined) {
    session.discountPercent = discountPercent;
  }
  if (items !== undefined) session.items = items;
  if (startHour !== undefined) session.startHour = startHour;
  if (endHour !== undefined) session.endHour = endHour;
  if (activeDate !== undefined) session.activeDate = activeDate;

  if (
    startHour !== undefined ||
    endHour !== undefined ||
    activeDate !== undefined
  ) {
    session.startNotifiedAt = null;
    session.endNotifiedAt = null;
  }

  await session.save();
  await bustCache();

  const populated = await SpecialSession.findById(session._id)
    .populate("items.menuItem", "name image basePrice variants");

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
    .populate("items.menuItem", "name image basePrice variants")
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
  if (cached) {
    return sendSuccess(res, { sessions: JSON.parse(cached) });
  }

  const today = getTodayNP();

  const todaySessions = await SpecialSession.find({
    activeDate: today,
    isActive: true,
  })
    .populate(
      "items.menuItem",
      "name image basePrice variants addons isVeg isSpicy tags preparationTime avgRating isAvailable"
    )
    .lean();

  const activeSessions = todaySessions.filter(isSessionActiveNow);

  const sessionsWithPrices = activeSessions.map((session) => {
    const multiplier = 1 - session.discountPercent / 100;

    return {
      ...session,

      items: (session.items || [])
        .filter((entry) => entry.menuItem)
        .map((entry) => {
          const item = entry.menuItem;

          const allVariants = entry.allVariants !== false;

          const selectedVariantIds = new Set(
            (entry.variants || []).map((id) => String(id))
          );

          const hasVariants =
            Array.isArray(item.variants) && item.variants.length > 0;

          const variants = hasVariants
            ? item.variants.map((variant) => {
                const eligible =
                  allVariants ||
                  selectedVariantIds.has(String(variant._id));

                const discountedPrice = eligible
                  ? Math.round(variant.price * multiplier)
                  : variant.price;

                return {
                  ...variant,
                  sessionDiscountEligible: eligible,
                  originalPrice: variant.price,
                  price: discountedPrice,
                  saving: eligible
                    ? variant.price - discountedPrice
                    : 0,
                };
              })
            : [];

          const baseEligible = !hasVariants && allVariants;

          const original = item.basePrice;

          const discounted = baseEligible
            ? Math.round(original * multiplier)
            : original;

          return {
            ...item,
            sessionItemId: entry._id,
            allVariants,
            selectedVariantIds: entry.variants || [],
            originalPrice: original,
            discountedPrice: discounted,
            saving: baseEligible ? original - discounted : 0,
            sessionDiscountEligible: baseEligible,
            variants,
          };
        }),
    };
  });

  await redis
    .setex(CACHE_KEY, CACHE_TTL, JSON.stringify(sessionsWithPrices))
    .catch(() => {});

  sendSuccess(res, { sessions: sessionsWithPrices });
});
