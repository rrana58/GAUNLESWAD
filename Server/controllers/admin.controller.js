const Order = require("../models/Order");
const User = require("../models/User");
const MenuItem = require("../models/MenuItem");
const Coupon = require("../models/Coupon");
const mongoose = require("mongoose");
const { Parser } = require("json2csv");
const { sendSuccess, sendPaginated } = require("../utils/response");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");

const { recordActivity } = require("../utils/auditLog");

// Loaded defensively — a missing/renamed model file must never crash server
// boot; getAuditLogs() returns a clear 503 instead.
let AuditLog;
try {
  AuditLog = require("../models/AuditLog");
} catch {
  AuditLog = null;
  console.warn("[admin.controller] AuditLog model not found — audit log reads disabled.");
}

// ─── HELPER: PERIOD → DATE RANGE (Rolling Windows) ──────────────────────────
// Single source of truth for what "week/month/year" means — shared by
// getRevenueAnalytics and getTopItems so they can never drift apart again.
const VALID_PERIODS = ["week", "month", "year"];

const getDateRangeForPeriod = (period) => {
  if (!VALID_PERIODS.includes(period)) {
    throw new AppError("period must be week, month, or year", 400);
  }

  const now = new Date();
  const matchFrom = new Date(now);

  if (period === "week") {
    matchFrom.setDate(now.getDate() - 7);
    return {
      matchFrom,
      groupBy: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    };
  }

  if (period === "month") {
    // Rolling last 30 days (not calendar month)
    matchFrom.setDate(now.getDate() - 30);
    return {
      matchFrom,
      groupBy: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    };
  }

  // period === "year" — rolling last 365 days
  matchFrom.setFullYear(now.getFullYear() - 1);
  return {
    matchFrom,
    groupBy: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
  };
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
exports.getDashboardStats = catchAsync(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    todayOrders, monthOrders, totalRevenue, todayRevenue,
    pendingOrders, totalUsers, totalMenuItems,
  ] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
    Order.countDocuments({ createdAt: { $gte: thisMonthStart }, status: { $ne: "cancelled" } }),
    Order.aggregate([{ $match: { status: "delivered" } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
    // NOTE: aligned to "delivered" to match totalRevenue's definition — previously
    // this included pending/confirmed/preparing orders, so "today's revenue" could
    // shrink later if those orders got cancelled. Confirm this is the definition
    // you want; revert to { $ne: "cancelled" } if you'd rather count in-flight orders.
    Order.aggregate([{ $match: { createdAt: { $gte: today, $lt: tomorrow }, status: "delivered" } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
    Order.countDocuments({ status: { $in: ["pending", "confirmed", "preparing"] } }),
    User.countDocuments({ role: "customer" }),
    MenuItem.countDocuments({ isAvailable: true }),
  ]);

  // totalUsers is a lifetime count and intentionally ignores any period filter.
  sendSuccess(res, {
    stats: {
      todayOrders, monthOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      todayRevenue: todayRevenue[0]?.total || 0,
      pendingOrders, totalUsers, totalMenuItems,
    },
  });
});

// ─── Revenue Analytics ────────────────────────────────────────────────────────
exports.getRevenueAnalytics = catchAsync(async (req, res) => {
  const { period = "week" } = req.query;
  const { matchFrom, groupBy } = getDateRangeForPeriod(period);

  const data = await Order.aggregate([
    // Only 'delivered' counts as finalized income
    { $match: { createdAt: { $gte: matchFrom }, status: "delivered" } },
    {
      $group: {
        _id: groupBy,
        subtotal: { $sum: "$subtotal" },
        discounts: { $sum: "$couponDiscount" },
        deliveryFees: { $sum: "$deliveryFee" },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  sendSuccess(res, { analytics: data });
});

// ─── Top-selling items ────────────────────────────────────────────────────────
// Uses the same date-range logic as revenue analytics — period filter now
// actually applies here (previously this endpoint ignored `period` entirely).
exports.getTopItems = catchAsync(async (req, res) => {
  const { period = "week" } = req.query;
  const { matchFrom } = getDateRangeForPeriod(period);

  const topItems = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: matchFrom },
        status: { $nin: ["cancelled", "refunded"] },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.menuItem",
        name: { $first: "$items.name" },
        totalSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.totalPrice" },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);

  sendSuccess(res, { topItems });
});

// ─── Audit Trail ──────────────────────────────────────────────────────────────
exports.getAuditLogs = catchAsync(async (req, res) => {
  if (!AuditLog) {
    throw new AppError("Audit logging is not configured on this server", 503);
  }

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const { action, userId } = req.query;

  const filter = {};
  if (action) filter.action = action;
  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid userId", 400);
    }
    filter.user = userId;
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("user", "name role")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  sendPaginated(res, { logs }, total, page, limit);
});

// ─── User management (With Audit) ──────────────────────────────────────────────
exports.getUsers = catchAsync(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const { search, role } = req.query;

  const filter = {};
  if (role) {
    const validRoles = ["customer", "admin", "delivery", "kitchen"];
    if (!validRoles.includes(role)) throw new AppError("Invalid role filter", 400);
    filter.role = role;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { phone: { $regex: `^${escaped}` } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort("-createdAt").skip((page - 1) * limit).limit(limit).select("-__v"),
    User.countDocuments(filter),
  ]);

  sendPaginated(res, { users }, total, page, limit);
});

exports.toggleUserStatus = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);

  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError("You cannot deactivate your own account", 400);
  }

  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });

  await recordActivity(
    req,
    "user_updated",
    `Admin ${req.user._id} ${user.isActive ? "reactivated" : "suspended"} user ${user._id}`,
    { userId: user._id, isActive: user.isActive }
  );

  sendSuccess(res, { isActive: user.isActive }, "User status updated");
});

exports.createUser = catchAsync(async (req, res) => {
  const { name, phone, email, password, role } = req.body;
  
  if (!name || !phone || !role) {
    throw new AppError("Name, phone, and role are required", 400);
  }
  
  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw new AppError("A user with this phone number already exists", 400);
  }

  const user = await User.create({
    name,
    phone,
    email: email || undefined,
    password: password || phone, // Default password to phone if not provided
    role,
    isActive: true,
    isPhoneVerified: true
  });

  await recordActivity(
    req,
    "user_created",
    `Admin ${req.user._id} created user ${user._id} with role ${role}`,
    { userId: user._id, role }
  );

  sendSuccess(res, { user }, "User created successfully", 201);
});

exports.updateUser = catchAsync(async (req, res) => {
  const { name, phone, email, password, role } = req.body;
  
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);

  // Prevent changing own role or deactivating oneself
  if (user._id.toString() === req.user._id.toString() && role && role !== user.role) {
    throw new AppError("You cannot change your own role", 400);
  }

  if (phone && phone !== user.phone) {
    const existing = await User.findOne({ phone });
    if (existing) throw new AppError("Phone number already in use", 400);
  }

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (email !== undefined) user.email = email || undefined;
  if (role) user.role = role;
  if (password) user.password = password; // Will be hashed by pre-save middleware

  await user.save();

  await recordActivity(
    req,
    "user_updated",
    `Admin ${req.user._id} updated user ${user._id}`,
    { userId: user._id }
  );

  sendSuccess(res, { user }, "User updated successfully");
});

exports.deleteUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError("User not found", 404);

  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError("You cannot delete your own account", 400);
  }

  // Soft delete using the model's softDelete method (which sets isActive=false and scrambles phone/email)
  await user.softDelete();

  await recordActivity(
    req,
    "user_deleted",
    `Admin ${req.user._id} deleted user ${user._id}`,
    { userId: user._id }
  );

  sendSuccess(res, null, "User deleted successfully");
});

// ─── Coupon management (With Audit) ────────────────────────────────────────────
const COUPON_ALLOWED_FIELDS = [
  "code", "description", "discountType", "discountValue",
  "maxDiscount", "minOrderAmount", "usageLimit", "perUserLimit",
  "isActive", "validFrom", "validUntil", "applicableCategories",
];

const pickCouponFields = (body) => {
  const picked = {};
  for (const field of COUPON_ALLOWED_FIELDS) {
    if (field in body) picked[field] = body[field];
  }
  return picked;
};

exports.createCoupon = catchAsync(async (req, res) => {
  const data = pickCouponFields(req.body);
  if (!data.code || !data.discountType || data.discountValue === undefined) {
    throw new AppError("code, discountType, and discountValue are required", 400);
  }
  const coupon = await Coupon.create(data);

  await recordActivity(req, "COUPON_CREATE", `Coupon ${coupon.code} created`);

  try {
    const { sendMulticastPush } = require("../services/fcm.service");
    // Get all active users with FCM tokens
    const users = await User.find({ isActive: true, fcmTokens: { $exists: true, $not: { $size: 0 } } });
    const allTokens = users.flatMap(u => u.fcmTokens);
    if (allTokens.length > 0) {
      const discountText = data.discountType === "percent" ? `${data.discountValue}%` : `Rs. ${data.discountValue}`;
      await sendMulticastPush(allTokens, "New Offer Unlocked! 🎉", `Use code ${coupon.code} to get ${discountText} off on your next order!`, { type: "promo_code", couponId: String(coupon._id) });
    }
  } catch (error) {
    require("../utils/logger").logger.error(`[Coupon Push] Failed to send coupon notification: ${error.message}`);
  }

  sendSuccess(res, { coupon }, "Coupon created", 201);
});

exports.getCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find().sort("-createdAt");
  sendSuccess(res, { coupons });
});

exports.updateCoupon = catchAsync(async (req, res) => {
  const data = pickCouponFields(req.body);
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!coupon) throw new AppError("Coupon not found", 404);

  await recordActivity(req, "COUPON_UPDATE", `Coupon ${coupon.code} updated`);

  sendSuccess(res, { coupon }, "Coupon updated");
});

exports.deleteCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new AppError("Coupon not found", 404);

  await recordActivity(req, "COUPON_DELETE", `Coupon ${coupon.code} deleted`);

  sendSuccess(res, {}, "Coupon deleted");
});

exports.validateCoupon = catchAsync(async (req, res) => {
  const { code, amount } = req.body;
  if (!code || typeof code !== "string") throw new AppError("Coupon code required", 400);
  if (!amount || isNaN(Number(amount))) throw new AppError("Valid amount required", 400);

  const coupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
    validFrom: { $lte: new Date() },
    $or: [{ validUntil: null }, { validUntil: { $gte: new Date() } }],
  });

  if (!coupon) throw new AppError("Invalid or expired coupon", 400);
  if (Number(amount) < coupon.minOrderAmount) {
    throw new AppError(`Minimum order Rs. ${coupon.minOrderAmount}`, 400);
  }

  const discount = coupon.calculateDiscount(Number(amount));
  sendSuccess(res, {
    discount,
    coupon: { code: coupon.code, description: coupon.description },
  }, "Coupon valid");
});

// ─── CSV / Excel Export ───────────────────────────────────────────────────────
exports.exportOrders = catchAsync(async (req, res) => {
  const { from, to } = req.query;
  const filter = { status: "delivered" };

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to + "T23:59:59.999Z");
  }

  const orders = await Order.find(filter)
    .populate("customer", "name phone")
    .sort("createdAt")
    .lean();

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    date: o.createdAt?.toISOString().split("T")[0],
    customerName: o.customer?.name || o.guestInfo?.name || "Guest",
    customerPhone: o.customer?.phone || o.guestInfo?.phone || "",
    paymentMethod: o.paymentMethod,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    couponDiscount: o.couponDiscount || 0,
    totalAmount: o.totalAmount,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
  }));

  if (rows.length === 0) {
    return res.status(200).json({ success: true, message: "No orders in date range", count: 0 });
  }

  const fields = [
    "orderNumber", "date", "customerName", "customerPhone",
    "paymentMethod", "subtotal", "deliveryFee", "couponDiscount", "totalAmount", "itemCount",
  ];
  const parser = new Parser({ fields });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="orders-export-${Date.now()}.csv"`);
  res.status(200).send(csv);
});

// ─── Bulk price update (With Audit) ────────────────────────────────────────────
exports.bulkUpdatePrices = catchAsync(async (req, res) => {
  const { adjustmentType, value, categoryId } = req.body;

  if (!["percent", "fixed"].includes(adjustmentType)) {
    throw new AppError("adjustmentType must be 'percent' or 'fixed'", 400);
  }
  if (typeof value !== "number" || value === 0) {
    throw new AppError("value must be a non-zero number", 400);
  }

  const filter = {};
  // Match either the legacy single "category" field or membership in the
  // "categories" array — mirrors menu.controller.js's getMenu filter.
  // Items can have several categories with only the first stored as the
  // legacy field, so filtering by "category" alone silently missed items.
  if (categoryId) filter.$or = [{ category: categoryId }, { categories: categoryId }];

  const items = await MenuItem.find(filter);
  if (items.length === 0) throw new AppError("No items matched the filter", 404);

  // bulkWrite instead of N sequential awaits — scales to large menus without
  // holding N round-trips open one at a time.
  const ops = items
    .map((item) => {
      const newPrice = adjustmentType === "percent"
        ? Math.round(item.basePrice * (1 + value / 100))
        : Math.round(item.basePrice + value);
      return newPrice >= 1
        ? { updateOne: { filter: { _id: item._id }, update: { basePrice: newPrice } } }
        : null;
    })
    .filter(Boolean);

  const result = ops.length > 0 ? await MenuItem.bulkWrite(ops) : { modifiedCount: 0 };

  await recordActivity(req, "BULK_PRICE_UPDATE", `Updated ${result.modifiedCount} items by ${value} (${adjustmentType})`);

  try {
    const { getRedis } = require("../config/redis");
    await getRedis().del("menu:grouped").catch(() => {});
  } catch {
    // Redis optional — don't fail the request over cache invalidation
  }

  sendSuccess(res, { updatedCount: result.modifiedCount }, `Updated prices for ${result.modifiedCount} item(s)`);
});