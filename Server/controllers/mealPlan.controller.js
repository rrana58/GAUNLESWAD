const MealPlan = require("../models/MealPlan");
const MenuItem = require("../models/MenuItem");
const Subscription = require("../models/Subscription");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

async function validatePlanItems(ids) {
  if (!Array.isArray(ids) || ids.length < 2) throw new AppError("A plan must have at least 2 items", 400);
  if (ids.length > 15) throw new AppError("A plan can have at most 15 items", 400);
  const count = await MenuItem.countDocuments({ _id: { $in: ids }, isAvailable: true });
  if (count !== ids.length) throw new AppError("One or more items are invalid or unavailable", 400);
}

// ─── Admin ────────────────────────────────────────────────────────────────────

exports.createPlan = catchAsync(async (req, res) => {
  const { name, description, tag, pricingOptions, items } = req.body;
  await validatePlanItems(items);
  const plan = await MealPlan.create({
    name, description, tag, pricingOptions, items,
    createdBy: req.user._id,
  });
  const populated = await plan.populate("items", "name image basePrice category");
  sendSuccess(res, { plan: populated }, "Meal plan created", 201);
});

exports.updatePlan = catchAsync(async (req, res) => {
  const plan = await MealPlan.findById(req.params.id);
  if (!plan) throw new AppError("Meal plan not found", 404);

  const { name, description, tag, pricingOptions, items, isActive } = req.body;

  let activeSubCount = 0;
  if (pricingOptions !== undefined || items !== undefined) {
    activeSubCount = await Subscription.countDocuments({ plan: plan._id, status: "active" });
  }

  if (items !== undefined) await validatePlanItems(items);
  if (name !== undefined) plan.name = name;
  if (description !== undefined) plan.description = description;
  if (tag !== undefined) plan.tag = tag;
  if (pricingOptions !== undefined) plan.pricingOptions = pricingOptions;
  if (items !== undefined) plan.items = items;
  if (isActive !== undefined) plan.isActive = isActive;

  await plan.save();
  const populated = await plan.populate("items", "name image basePrice category");
  sendSuccess(res, {
    plan: populated,
    warning: activeSubCount > 0
      ? `${activeSubCount} active subscribers — price/item changes won't affect their current period`
      : undefined,
  }, "Meal plan updated");
});

exports.deletePlan = catchAsync(async (req, res) => {
  const plan = await MealPlan.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!plan) throw new AppError("Meal plan not found", 404);
  sendSuccess(res, {}, "Meal plan deactivated (existing subscriptions unaffected)");
});

exports.listPlansAdmin = catchAsync(async (req, res) => {
  const plans = await MealPlan.find()
    .populate("items", "name image basePrice")
    .sort({ createdAt: -1 });

  const planIds = plans.map((p) => p._id);
  const subCounts = await Subscription.aggregate([
    { $match: { plan: { $in: planIds }, status: "active" } },
    { $group: { _id: "$plan", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(subCounts.map((s) => [s._id.toString(), s.count]));

  const plansWithCounts = plans.map((p) => ({
    ...p.toObject(),
    activeSubscribers: countMap[p._id.toString()] || 0,
  }));
  sendSuccess(res, { plans: plansWithCounts });
});

// ─── Customer ─────────────────────────────────────────────────────────────────

exports.listPlans = catchAsync(async (req, res) => {
  const plans = await MealPlan.find({ isActive: true })
    .populate("items", "name image basePrice isVeg tags")
    .sort({ "pricingOptions.0.price": 1 });
  sendSuccess(res, { plans });
});

exports.getPlan = catchAsync(async (req, res) => {
  const plan = await MealPlan.findOne({
    $or: [{ _id: req.params.id }, { slug: req.params.id }],
    isActive: true,
  }).populate("items", "name image basePrice isVeg isSpicy tags description");
  if (!plan) throw new AppError("Meal plan not found", 404);
  sendSuccess(res, { plan });
});
