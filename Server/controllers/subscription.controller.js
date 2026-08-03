const Subscription = require("../models/Subscription");
const MealPlan = require("../models/MealPlan");
const { sendSuccess, sendPaginated } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { getTodayNP } = require("../utils/nepaliTime");
const { recordActivity } = require("../utils/auditLog");

// Subscriptions are paid upfront for a full month, not collected at a single
// delivery moment — so "cash on delivery" isn't a valid option here, unlike
// for regular food orders. Exported so the route validator uses the exact
// same list instead of a second hand-maintained copy that can drift.
const ALLOWED_SUBSCRIPTION_PAYMENT_METHODS = ["khalti", "esewa", "bank_transfer", "cash"];
exports.ALLOWED_SUBSCRIPTION_PAYMENT_METHODS = ALLOWED_SUBSCRIPTION_PAYMENT_METHODS;

// ─── Customer ─────────────────────────────────────────────────────────────────

exports.subscribe = catchAsync(async (req, res) => {
  const { planId, payment, meals } = req.body;
  const customerId = req.user._id;

  // Defense-in-depth: don't rely solely on the route validator for this —
  // a future route refactor that forgets it must not silently reopen COD.
  if (!payment?.method || !ALLOWED_SUBSCRIPTION_PAYMENT_METHODS.includes(payment.method))
    throw new AppError(
      `Payment method must be one of: ${ALLOWED_SUBSCRIPTION_PAYMENT_METHODS.join(", ")}.`, 400
    );

  const plan = await MealPlan.findOne({ _id: planId, isActive: true });
  if (!plan) throw new AppError("Meal plan not found or inactive", 404);

  const option = plan.pricingOptions.find(o => o.meals === Number(meals));
  if (!option) throw new AppError(`Invalid meal option selected (${meals} meals).`, 400);

  const existing = await Subscription.findOne({
    customer: customerId,
    status: { $in: ["active", "pending"] },
  }).populate("plan", "name");

  if (existing) {
    throw new AppError(
      `You already have a ${existing.status} subscription to "${existing.plan.name}". ` +
      "Cancel or wait for it to expire before subscribing to a new plan.", 400
    );
  }

  const subscription = await Subscription.create({
    customer: customerId,
    plan: planId,
    pricePaid: option.price,
    maxMeals: option.meals,
    status: "pending",
    payment: { method: payment.method, reference: payment.reference || undefined },
  });

  sendSuccess(res, { subscription },
    "Subscription request submitted. Your plan activates once admin confirms payment.", 201);
});

exports.getMySubscription = catchAsync(async (req, res) => {
  const subscription = await Subscription.findOne({
    customer: req.user._id,
    status: { $in: ["active", "pending", "paused"] },
  }).populate({
    path: "plan",
    select: "name tag description pricingOptions items",
    populate: {
      path: "items",
      model: "MenuItem",
      select: "name image basePrice variants addons isAvailable isVeg isSpicy tags preparationTime avgRating",
      match: { isAvailable: true }, // only show available items
    },
  });

  if (!subscription) return sendSuccess(res, { subscription: null });
  
  const mealsRemaining = subscription.maxMeals - subscription.mealsUsed;
  const daysRemaining = subscription.endDate
    ? Math.max(0, Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  sendSuccess(res, {
    subscription,
    summary: {
      mealsUsed: subscription.mealsUsed,
      mealsRemaining,
      daysRemaining,
      canUseMeals: subscription.isEligibleForMeal(),
    },
  });
});

exports.getMyMealHistory = catchAsync(async (req, res) => {
  const sub = await Subscription.findOne({ customer: req.user._id })
    .select("mealUsages plan")
    .populate("mealUsages.menuItem", "name image");
  if (!sub) return sendSuccess(res, { usages: [] });
  sendSuccess(res, { usages: [...sub.mealUsages].reverse() });
});

exports.cancelMySubscription = catchAsync(async (req, res) => {
  const sub = await Subscription.findOne({ customer: req.user._id, status: "pending" });
  if (!sub) throw new AppError(
    "No pending subscription to cancel. Active subscriptions can only be cancelled by admin.", 400
  );
  sub.status = "cancelled";
  await sub.save();
  sendSuccess(res, {}, "Subscription cancelled");
});

// ─── Admin ────────────────────────────────────────────────────────────────────

exports.listSubscriptionsAdmin = catchAsync(async (req, res) => {
  // FIX: parse page/limit as integers — query strings are always strings,
  // so arithmetic like (page - 1) * limit produces NaN without parseInt
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const { status, planId } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (planId) filter.plan = planId;

  const skip = (page - 1) * limit;
  const [subs, total] = await Promise.all([
    Subscription.find(filter)
      .populate("customer", "name phone email")
      .populate("plan", "name pricingOptions tag")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Subscription.countDocuments(filter),
  ]);
  sendPaginated(res, { subscriptions: subs }, total, page, limit);
});

exports.confirmSubscription = catchAsync(async (req, res) => {
  const { paymentReference } = req.body;

  // Enforce "confirm only after successful payment" in code, not just
  // admin discipline: a reference to what was actually paid (gateway txn
  // id, bank transfer id, cash receipt no.) must be recorded to activate.
  if (!paymentReference || typeof paymentReference !== "string" || !paymentReference.trim())
    throw new AppError("A payment reference is required to confirm this subscription.", 400);
  if (paymentReference.length > 120)
    throw new AppError("Payment reference is too long.", 400);

  const sub = await Subscription.findById(req.params.id).populate("plan", "name pricingOptions");
  if (!sub) throw new AppError("Subscription not found", 404);
  if (sub.status !== "pending") throw new AppError(`Cannot confirm a "${sub.status}" subscription`, 400);

  const now = new Date();
  sub.status = "active";
  sub.startDate = now;
  sub.endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  sub.payment.paidAt = now;
  sub.payment.confirmedBy = req.user._id;
  sub.payment.reference = paymentReference.trim();
  if (req.body.adminNote) sub.adminNote = req.body.adminNote.slice(0, 500);

  await sub.save();
  await recordActivity(
    req, "SUBSCRIPTION_CONFIRM",
    `Subscription ${sub._id} for customer ${sub.customer} activated (plan: ${sub.plan?.name}, ref: ${sub.payment.reference})`
  );
  
  // Award loyalty points for the subscription purchase (0.5 pts per Rs 100 spent)
  if (sub.pricePaid && sub.pricePaid > 0) {
    const points = Number((sub.pricePaid * 0.005).toFixed(2));
    if (points > 0) {
      const User = require("../models/User");
      await User.findByIdAndUpdate(sub.customer, { $inc: { loyaltyPoints: points } }).catch(() => {});
    }
  }

  // TODO: SMS via Sparrow — "Your [plan.name] subscription is active until [endDate]"
  sendSuccess(res, { subscription: sub }, "Subscription activated");
});

exports.updateSubscriptionStatus = catchAsync(async (req, res) => {
  const { status, adminNote } = req.body;
  const allowed = ["paused", "expired", "cancelled", "active"];
  if (!allowed.includes(status)) throw new AppError(`status must be one of: ${allowed.join(", ")}`, 400);

  const sub = await Subscription.findById(req.params.id);
  if (!sub) throw new AppError("Subscription not found", 404);
  const previousStatus = sub.status;
  sub.status = status;
  if (adminNote) sub.adminNote = adminNote;
  await sub.save();
  await recordActivity(
    req, "SUBSCRIPTION_STATUS_UPDATE",
    `Subscription ${sub._id} status changed ${previousStatus} → ${status}`
  );
  sendSuccess(res, { subscription: sub }, `Subscription ${status}`);
});

exports.getSubscriptionStats = catchAsync(async (req, res) => {
  const [statusBreakdown, planBreakdown, recentPending] = await Promise.all([
    Subscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$pricePaid" } } },
    ]),
    Subscription.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$plan", count: { $sum: 1 } } },
      { $lookup: { from: "mealplans", localField: "_id", foreignField: "_id", as: "plan" } },
      { $unwind: "$plan" },
      { $project: { planName: "$plan.name", count: 1 } },
    ]),
    Subscription.find({ status: "pending" })
      .populate("customer", "name phone")
      .populate("plan", "name pricingOptions")
      .sort({ createdAt: -1 })
      .limit(5),
  ]);
  sendSuccess(res, { statusBreakdown, planBreakdown, recentPending });
});

// ─── Helpers called from order controller ────────────────────────────────────

/**
 * ATOMIC claim bulk: combines eligibility check + reservation into a single
 * conditional update so two concurrent requests can't overdraw.
 * Reserves the meal slot(s) BEFORE the order is created.
 *
 * Returns { claimed: 0 } or { claimed: number, subscription, claimedDate, usageIds: ObjectId[] }
 */
exports.claimMealsAtomic = async (customerId, menuItemId, requestedQty) => {
  if (!customerId || requestedQty <= 0) return { claimed: 0 };

  const sub = await Subscription.findOne({ customer: customerId, status: "active" })
    .populate("plan", "items pricingOptions");
  if (!sub || !sub.plan || !sub.isItemInPlan(menuItemId, sub.plan.items)) return { claimed: 0 };

  const remaining = sub.maxMeals - sub.mealsUsed;
  const toClaim = Math.min(requestedQty, remaining);
  if (toClaim <= 0) return { claimed: 0 };

  const today = getTodayNP();
  const mongoose = require("mongoose");
  
  const newUsages = Array.from({ length: toClaim }, () => ({
    _id: new mongoose.Types.ObjectId(),
    usageDate: today,
    menuItem: menuItemId,
    order: null,
    usedAt: new Date()
  }));

  const updated = await Subscription.findOneAndUpdate(
    {
      _id: sub._id,
      mealsUsed: { $lte: sub.maxMeals - toClaim },
    },
    {
      $inc: { mealsUsed: toClaim },
      $push: { mealUsages: { $each: newUsages } },
    },
    { new: true }
  );

  if (!updated) return { claimed: 0 };
  
  return { 
    claimed: toClaim, 
    subscription: updated, 
    claimedDate: today, 
    usageIds: newUsages.map(u => u._id)
  };
};

/**
 * Patch the reserved mealUsages entries with the real order id once saved.
 */
exports.confirmMealUsages = async (subscriptionId, usageIds, orderId) => {
  if (!usageIds || usageIds.length === 0) return;
  await Subscription.updateOne(
    { _id: subscriptionId },
    { $set: { "mealUsages.$[elem].order": orderId } },
    { arrayFilters: [{ "elem._id": { $in: usageIds } }] }
  );
};

/**
 * Roll back claimed slots if order creation ultimately fails.
 */
exports.releaseMealUsages = async (subscriptionId, usageIds) => {
  if (!usageIds || usageIds.length === 0) return;
  await Subscription.updateOne(
    { _id: subscriptionId },
    { 
      $pull: { mealUsages: { _id: { $in: usageIds }, order: null } },
      $inc: { mealsUsed: -usageIds.length }
    }
  );
};

/**
 * Refunds meal usages when an order is cancelled before delivery.
 */
exports.refundOrderMeals = async (orderId) => {
  if (!orderId) return;
  const subscriptions = await Subscription.find({ "mealUsages.order": orderId });
  for (const sub of subscriptions) {
    const usagesToRefund = sub.mealUsages.filter(u => u.order?.toString() === orderId.toString());
    if (usagesToRefund.length > 0) {
      await Subscription.updateOne(
        { _id: sub._id },
        { 
          $pull: { mealUsages: { order: orderId } },
          $inc: { mealsUsed: -usagesToRefund.length }
        }
      );
    }
  }
};