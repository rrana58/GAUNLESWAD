const mongoose = require("mongoose");

const mealPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
      maxlength: 80,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    tag: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    pricingOptions: {
      type: [
        {
          meals: { type: Number, required: true, min: 1 },
          price: { type: Number, required: true, min: 100 },
        }
      ],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one pricing option is required."
      }
    },
    items: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" }],
      validate: {
        validator: (arr) => arr.length >= 2 && arr.length <= 15,
        message: "A plan must have between 2 and 15 items",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    image: {
      url: String,
      publicId: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

mealPlanSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
  next();
});


mealPlanSchema.index({ isActive: 1 });
mealPlanSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model("MealPlan", mealPlanSchema);