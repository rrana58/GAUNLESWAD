const MenuItem = require("../models/MenuItem");
const Category = require("../models/Category");
const { cloudinary } = require("../config/cloudinary");
const { getRedis } = require("../config/redis");
const { sendSuccess, sendPaginated } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const MENU_CACHE_TTL = 300; // 5 minutes

// ─── Categories ───────────────────────────────────────────────────────────────
exports.getCategories = catchAsync(async (req, res) => {
  const redis = getRedis();
  const cached = await redis.get("categories").catch(() => null);
  if (cached) return sendSuccess(res, { categories: JSON.parse(cached) });

  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  await redis.setex("categories", MENU_CACHE_TTL, JSON.stringify(categories)).catch(() => {});
  sendSuccess(res, { categories });
});

exports.createCategory = catchAsync(async (req, res) => {
  // FIX: whitelist fields — prevents mass assignment (e.g. injecting isActive:true on a disabled category)
  const category = await Category.create(pickFields(req.body, CATEGORY_FIELDS));
  await getRedis().del("categories").catch(() => {});
  sendSuccess(res, { category }, "Category created", 201);
});

exports.updateCategory = catchAsync(async (req, res) => {
  // FIX: whitelist fields on update
  const category = await Category.findByIdAndUpdate(req.params.id, pickFields(req.body, CATEGORY_FIELDS), { new: true, runValidators: true });
  if (!category) throw new AppError("Category not found", 404);
  await getRedis().del("categories").catch(() => {});
  sendSuccess(res, { category }, "Category updated");
});

exports.deleteCategory = catchAsync(async (req, res) => {
  const itemCount = await MenuItem.countDocuments({ category: req.params.id });
  if (itemCount > 0) throw new AppError(`Cannot delete category: ${itemCount} menu items exist`, 400);

  await Category.findByIdAndDelete(req.params.id);
  await getRedis().del("categories").catch(() => {});
  sendSuccess(res, {}, "Category deleted");
});

// ─── Menu Items ───────────────────────────────────────────────────────────────
// Whitelist allowed sort values — prevents sort injection attack
const ALLOWED_SORTS = [
  "sortOrder", "-sortOrder",
  "basePrice", "-basePrice",
  "name", "-name",
  "createdAt", "-createdAt",
];

// Field whitelist for menu items — prevents mass assignment (e.g. avgRating, totalOrders)
const MENU_ITEM_FIELDS = [
  "name", "nameNepali", "description", "category", "image", "basePrice",
  "variants", "addons", "isVeg", "isVegan", "isSpicy", "allergens",
  "isAvailable", "isAvailableForDelivery", "isCelebrationEligible", "availableFrom", "availableUntil",
  "isFeatured", "sortOrder", "tags", "preparationTime", "stockQuantity",
  "isCombo", "comboItems"
];

// Field whitelist for categories
const CATEGORY_FIELDS = ["name", "description", "image", "isActive", "sortOrder"];

const pickFields = (body, fields) => {
  const result = {};
  for (const f of fields) {
    if (f in body) result[f] = body[f];
  }
  return result;
};

exports.getMenu = catchAsync(async (req, res) => {
  // FIX: whitelist sort values — raw user input can inject malicious sort operators
  const rawSort = req.query.sort || "sortOrder";
  const sort = ALLOWED_SORTS.includes(rawSort) ? rawSort : "sortOrder";

  // FIX: parse page/limit as integers — query strings are always strings
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);

  const { category, search, featured, isCombo } = req.query;

  const filter = { isAvailable: true };
  if (category) filter.category = category;
  if (featured === "true") filter.isFeatured = true;
  if (isCombo === "true") filter.isCombo = true;
  if (isCombo === "false") filter.isCombo = { $ne: true };
  if (search) filter.$text = { $search: search };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MenuItem.find(filter)
      .populate("category", "name slug")
      .populate("comboItems.item", "name image basePrice")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    MenuItem.countDocuments(filter),
  ]);

  sendPaginated(res, { items }, total, page, limit);
});

// Admin listing — unlike getMenu (public/customer-facing), this does NOT
// hardcode isAvailable:true, so toggled-off items still show up in the
// admin table instead of appearing to vanish. Mounted behind protect+restrictTo("admin").
exports.getMenuAdmin = catchAsync(async (req, res) => {
  const rawSort = req.query.sort || "sortOrder";
  const sort = ALLOWED_SORTS.includes(rawSort) ? rawSort : "sortOrder";

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);

  const { category, search, featured, isAvailable, isCombo } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (featured === "true") filter.isFeatured = true;
  if (isCombo === "true") filter.isCombo = true;
  if (isCombo === "false") filter.isCombo = { $ne: true };
  // Only filter on availability if the admin UI explicitly asks for it
  // (e.g. a future "show only unavailable" toggle) — default is "show all".
  if (isAvailable === "true") filter.isAvailable = true;
  if (isAvailable === "false") filter.isAvailable = false;
  if (search) filter.$text = { $search: search };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MenuItem.find(filter)
      .populate("category", "name slug")
      .populate("comboItems.item", "name image basePrice")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    MenuItem.countDocuments(filter),
  ]);

  sendPaginated(res, { items }, total, page, limit);
});

exports.getMenuGroupedByCategory = catchAsync(async (req, res) => {
  const redis = getRedis();
  const cached = await redis.get("menu:grouped").catch(() => null);
  if (cached) return sendSuccess(res, { menu: JSON.parse(cached) });

  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 });
  const items = await MenuItem.find({ isAvailable: true })
    .populate("category", "name slug")
    .populate("comboItems.item", "name image basePrice")
    .sort({ sortOrder: 1 })
    .lean();

  const menu = categories.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category._id.toString() === cat._id.toString()),
  }));

  await redis.setex("menu:grouped", MENU_CACHE_TTL, JSON.stringify(menu)).catch(() => {});
  sendSuccess(res, { menu });
});

exports.getMenuItem = catchAsync(async (req, res) => {
  const item = await MenuItem.findOne({
    $or: [{ _id: req.params.id }, { slug: req.params.id }],
    isAvailable: true,
  }).populate("category", "name slug").populate("comboItems.item", "name image basePrice");

  if (!item) throw new AppError("Menu item not found", 404);
  sendSuccess(res, { item });
});

exports.getCelebrationMenu = catchAsync(async (req, res) => {
  const items = await MenuItem.find({ isAvailable: true, isCelebrationEligible: true })
    .populate("category", "name slug")
    .sort({ sortOrder: 1 })
    .lean();

  sendSuccess(res, { items });
});

exports.createMenuItem = catchAsync(async (req, res) => {
  // FIX: whitelist fields — prevents faking avgRating, totalOrders, etc.
  const item = await MenuItem.create(pickFields(req.body, MENU_ITEM_FIELDS));
  await getRedis().del("menu:grouped").catch(() => {});
  sendSuccess(res, { item }, "Menu item created", 201);
});

exports.updateMenuItem = catchAsync(async (req, res) => {
  // FIX: whitelist fields on update
  const item = await MenuItem.findByIdAndUpdate(req.params.id, pickFields(req.body, MENU_ITEM_FIELDS), { new: true, runValidators: true });
  if (!item) throw new AppError("Menu item not found", 404);
  await getRedis().del("menu:grouped").catch(() => {});
  sendSuccess(res, { item }, "Menu item updated");
});

exports.deleteMenuItem = catchAsync(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw new AppError("Menu item not found", 404);

  // Soft-delete: marks isDeleted=true + isAvailable=false, preserves order history
  // Hard-delete only happens if the item has never been ordered (totalOrders=0)
  if (item.totalOrders > 0) {
    await item.safeDelete();
    await getRedis().del("menu:grouped").catch(() => {});
    return sendSuccess(res, {}, "Menu item hidden (has order history — soft deleted)");
  }

  // No order history — safe to hard-delete and remove Cloudinary image
  if (item.image?.publicId) {
    await cloudinary.uploader.destroy(item.image.publicId).catch(() => {});
  }
  await item.deleteOne();
  await getRedis().del("menu:grouped").catch(() => {});
  sendSuccess(res, {}, "Menu item deleted");
});

exports.toggleAvailability = catchAsync(async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw new AppError("Menu item not found", 404);
  item.isAvailable = !item.isAvailable;
  await item.save();
  await getRedis().del("menu:grouped").catch(() => {});
  sendSuccess(res, { item }, `Item ${item.isAvailable ? "enabled" : "disabled"}`);
});

// ─── Upload image ─────────────────────────────────────────────────────────────
exports.uploadMenuImage = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError("No image uploaded", 400);
  sendSuccess(res, {
    url: req.file.path,
    publicId: req.file.filename,
  }, "Image uploaded");
});