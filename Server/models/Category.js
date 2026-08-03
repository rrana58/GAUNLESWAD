const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
    },
    description: String,
    image: {
      url: String,
      publicId: String, // Cloudinary public ID for deletion
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }, // For controlling display order
  },
  { timestamps: true }
);

// Auto-generate slug from name
// Auto-generate slug from name
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")  // strip special chars first
      .trim()
      .replace(/\s+/g, "-")           // spaces → single hyphen
      .replace(/-+/g, "-");           // collapse any repeated hyphens
  }
  next();
});


/**
 * Referential integrity guard.
 * MongoDB has no FK constraints — this hook enforces them manually.
 * Prevents orphaned MenuItems with a dead categoryId.
 */
categorySchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  const MenuItem = require("./MenuItem");
  const count = await MenuItem.countDocuments({ category: this._id });
  if (count > 0) {
    return next(
      new Error(`Cannot delete category "${this.name}" — it has ${count} menu item(s). Reassign or delete them first.`)
    );
  }
  next();
});

// Useful for admin list queries sorted by display order
categorySchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model("Category", categorySchema);
