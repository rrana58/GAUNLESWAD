const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: String,
    discountType: {
      type: String,
      enum: ["percent", "flat"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: Number,
    minOrderAmount: { type: Number, default: 0 },
    usageLimit: Number,
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    validFrom: { type: Date, default: Date.now },
    validUntil: Date,
    applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  },
  { timestamps: true }
);


couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1, validUntil: 1 });

couponSchema.methods.calculateDiscount = function (amount) {
  if (this.discountType === "flat") return Math.min(this.discountValue, amount);
  const discount = (amount * this.discountValue) / 100;
  return this.maxDiscount ? Math.min(discount, this.maxDiscount) : discount;
};

module.exports = mongoose.model("Coupon", couponSchema);