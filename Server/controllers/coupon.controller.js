const Coupon = require("../models/Coupon");
const Order = require("../models/Order");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// ─── Public ───────────────────────────────────────────────────────────────────
// Browsable promo codes for the customer app's "Promo Codes" section.
// Deliberately exposes only what a customer needs to decide whether to use a
// code — internal counters (usedCount, perUserLimit) stay admin-only.
exports.getPublicCoupons = catchAsync(async (req, res) => {
  const now = new Date();

  const coupons = await Coupon.find({
    isActive: true,
    validFrom: { $lte: now },
    $or: [{ validUntil: null }, { validUntil: { $exists: false } }, { validUntil: { $gte: now } }],
    $expr: {
      $or: [
        { $eq: ["$usageLimit", null] },
        { $not: "$usageLimit" },
        { $lt: ["$usedCount", "$usageLimit"] },
      ],
    },
  })
    .select("code description discountType discountValue maxDiscount minOrderAmount validUntil")
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, { coupons });
});

// ─── Public: preview a coupon before checkout ─────────────────────────────────
// Read-only — does NOT increment usedCount or reserve anything, so the
// customer can freely retype/change codes before placing the order. The
// actual claim (atomic $inc) happens in order.controller.js at placement,
// which re-validates everything here independently — this is purely for an
// honest checkout preview, never trusted as the final word on eligibility.
exports.validateCoupon = catchAsync(async (req, res) => {
  const { code, subtotal } = req.body;
  const amount = Number(subtotal);

  if (!code || typeof code !== "string") throw new AppError("Enter a coupon code.", 400);
  if (!Number.isFinite(amount) || amount < 0) throw new AppError("Invalid order amount.", 400);

  const now = new Date();
  const coupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
    validFrom: { $lte: now },
    $or: [{ validUntil: null }, { validUntil: { $exists: false } }, { validUntil: { $gte: now } }],
  });

  if (!coupon) throw new AppError("Invalid or expired coupon code.", 400);

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError("This coupon has reached its usage limit.", 400);
  }

  if (amount < coupon.minOrderAmount) {
    throw new AppError(`Minimum order of Rs. ${coupon.minOrderAmount} needed for this coupon.`, 400);
  }

  if (coupon.perUserLimit && req.user?._id) {
    const userUsage = await Order.countDocuments({
      customer: req.user._id, couponCode: coupon.code, status: { $nin: ["cancelled"] },
    });
    if (userUsage >= coupon.perUserLimit) {
      throw new AppError("You've already used this coupon.", 400);
    }
  }

  const discount = Math.round(coupon.calculateDiscount(amount) * 100) / 100;

  sendSuccess(res, {
    valid: true,
    discount,
    coupon: {
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    },
  });
});