const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  isAvailable: { type: Boolean, default: true },
});

const addonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  isAvailable: { type: Boolean, default: true },
});

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    nameNepali: String,
    // FIX: removed `unique: true` from field — defined via index below to avoid duplicate index warning
    slug: { type: String, lowercase: true },
    description: { type: String, maxlength: 500 },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    }],
    image: { url: String, publicId: String },
    basePrice: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    variants: [variantSchema],
    addons: [addonSchema],
    isVeg: { type: Boolean, default: false },
    isVegan: { type: Boolean, default: false },
    isSpicy: { type: Boolean, default: false },
    allergens: [String],
    isAvailable: { type: Boolean, default: true },
    isAvailableForDelivery: { type: Boolean, default: true },
    isCelebrationEligible: { type: Boolean, default: false },
    isCombo: { type: Boolean, default: false },
    comboItems: [{
      item: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
      quantity: { type: Number, default: 1 }
    }],
    availableFrom: String,
    availableUntil: String,
    totalOrders: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    tags: [String],
    preparationTime: { type: Number, default: 15 },
    // ── Inventory ────────────────────────────────────────────────────────────
    // null means unlimited (most cloud-kitchen items); a number enables stock gating
    stockQuantity: { type: Number, default: null, min: 0 },
    // ── Soft delete — preserves order history and subscription references ────
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt:  { type: Date,    default: null,  select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Virtual: effective price (lowest variant or basePrice)
menuItemSchema.virtual("effectivePrice").get(function () {
  if (this.variants && this.variants.length > 0) {
    const availableVariants = this.variants.filter((v) => v.isAvailable);
    if (availableVariants.length > 0) {
      return Math.min(...availableVariants.map((v) => v.price));
    }
  }
  return this.basePrice;
});

// Automatically exclude soft-deleted items from all queries
menuItemSchema.pre(/^find/, function (next) {
  if (!this.getOptions()._includeSoftDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

menuItemSchema.methods.safeDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isAvailable = false;
  await this.save({ validateBeforeSave: false });
};

menuItemSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 80);
  }
  // Ensure categories and category sync seamlessly
  if (this.categories && this.categories.length > 0) {
    if (!this.category) this.category = this.categories[0];
  } else if (this.category) {
    this.categories = [this.category];
  }
  next();
});

// FIX: all indexes defined here only — not duplicated in field definitions above
menuItemSchema.index({ slug: 1 }, { unique: true, sparse: true });
menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ categories: 1, isAvailable: 1 });
menuItemSchema.index({ isFeatured: -1, sortOrder: 1 });
menuItemSchema.index({ name: "text", description: "text", tags: "text" });
// Needed for dashboard analytics sorting
menuItemSchema.index({ createdAt: -1 });

module.exports = mongoose.model("MenuItem", menuItemSchema);