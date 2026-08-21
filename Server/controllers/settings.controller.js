const Settings = require("../models/Settings");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { getRedis } = require("../config/redis");
const { DELIVERY_FEE } = require("../config/constants");

const CACHE_KEY = "settings:global";
const CACHE_TTL = 60; // seconds

async function bustCache() {
  await getRedis().del(CACHE_KEY).catch(() => {});
}

// ─── Admin ────────────────────────────────────────────────────────────────────

exports.getSettings = catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  sendSuccess(res, { settings });
});

exports.updateSettings = catchAsync(async (req, res) => {
  const allowed = [
    "globalDiscountPercent",
    "globalDiscountLabel",
    "freeDeliveryAbove",
    "kitchenLocation",
    "maxDeliveryDistanceKm",
    "deliveryZones",
    "maintenanceMode",
    "maintenanceMessage",
    "popup", // Added popup to allowed fields
    "contactInfo",
    "aboutUs",
  ];

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (!Object.keys(updates).length)
    throw new AppError("No valid fields to update.", 400);

  if (updates.deliveryZones) {
    if (!Array.isArray(updates.deliveryZones))
      throw new AppError("deliveryZones must be an array.", 400);
    for (const zone of updates.deliveryZones) {
      if (!Number.isFinite(Number(zone.upToKm)) || !Number.isFinite(Number(zone.fee)))
        throw new AppError("Each delivery zone needs a valid upToKm and fee.", 400);
    }
    // Keep tiers sorted ascending — the lookup logic depends on this order.
    updates.deliveryZones = [...updates.deliveryZones].sort((a, b) => a.upToKm - b.upToKm);
  }

  let settings = await Settings.getSettings();
  Object.assign(settings, updates);
  await settings.save();

  await bustCache();
  sendSuccess(res, { settings }, "Settings updated.");
});

// ─── Public ───────────────────────────────────────────────────────────────────

exports.getPublicSettings = catchAsync(async (req, res) => {
  const redis = getRedis();
  const cached = await redis.get(CACHE_KEY).catch(() => null);
  if (cached) return sendSuccess(res, JSON.parse(cached));

  const settings = await Settings.getSettings();
  const publicData = {
    globalDiscountPercent: settings.globalDiscountPercent,
    globalDiscountLabel: settings.globalDiscountLabel,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    freeDeliveryAbove: settings.freeDeliveryAbove,
    deliveryFee: DELIVERY_FEE,
    kitchenLocation: settings.kitchenLocation?.lat != null ? settings.kitchenLocation : null,
    maxDeliveryDistanceKm: settings.maxDeliveryDistanceKm ?? null,
    deliveryZones: settings.deliveryZones || [],
    contactInfo: settings.contactInfo || {},
    aboutUs: settings.aboutUs,
    // Promotional Popup Data
    popup: settings.popup?.enabled ? {
      enabled: true,
      title: settings.popup.title,
      message: settings.popup.message,
      buttonText: settings.popup.buttonText,
      buttonLink: settings.popup.buttonLink,
      bgColor: settings.popup.bgColor,
      validUntil: settings.popup.validUntil,
      image: settings.popup.image,
    } : { enabled: false },
  };

  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(publicData)).catch(() => {});
  sendSuccess(res, publicData);
});