const Coupon = require("../models/Coupon");
const { sendSuccess } = require("../utils/response");
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
