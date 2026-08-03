const mongoose = require("mongoose");

/**
 * Subscription — Customer's meal plan subscription
 *
 * Lifecycle: pending → active → expired / cancelled / paused
 * Admin confirms payment → sets startDate + endDate (+30 days)
 * Each day's meal claim recorded in mealUsages[]
 */
const mealUsageSchema = new mongoose.Schema({
  // Nepal date string "YYYY-MM-DD" — one usage allowed per date
  usageDate: { type: String, required: true },
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  itemName: String, // snapshot
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
  },
  usedAt: { type: Date, default: Date.now },
});

const subscriptionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MealPlan",
      required: true,
    },
    // Snapshot of plan price at subscription time
    pricePaid: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "active", "paused", "expired", "cancelled"],
      default: "pending",
    },
    startDate: Date,
    endDate: Date,    // startDate + 30 days
    mealsUsed: { type: Number, default: 0 },
    maxMeals: { type: Number, required: true }, // copied from plan
    mealUsages: [mealUsageSchema],
    payment: {
      method: {
        type: String,
        enum: ["khalti", "esewa", "bank_transfer", "cash"],
      },
      reference: { type: String, trim: true, maxlength: 120 },
      paidAt: Date,
      confirmedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    adminNote: { type: String, trim: true, maxlength: 500 },
    autoRenew: { type: Boolean, default: false },
  },
  { timestamps: true }
);

subscriptionSchema.index({ customer: 1, status: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });
subscriptionSchema.index({ plan: 1, status: 1 });

subscriptionSchema.methods.isEligibleForMeal = function () {
  if (this.status !== "active") return false;
  if (this.mealsUsed >= this.maxMeals) return false;
  if (this.endDate && new Date() > this.endDate) return false;
  return true;
};


subscriptionSchema.methods.isItemInPlan = function (menuItemId, planItems) {
  return planItems.some((id) => id.toString() === menuItemId.toString());
};

module.exports = mongoose.model("Subscription", subscriptionSchema);