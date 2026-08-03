const router = require("express").Router();
const Review = require("../models/Review");
const { protect, restrictTo } = require("../middleware/auth");
const { validateObjectId } = require("../middleware/sanitize");
const { sendSuccess } = require("../utils/response");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/AppError");

/** PUBLIC: Get reviews for a dish **/
router.get("/menu/:menuItemId", validateObjectId("menuItemId"), catchAsync(async (req, res) => {
  const reviews = await Review.find({ menuItem: req.params.menuItemId, isPublished: true })
    .populate("customer", "name")
    .sort("-createdAt")
    .limit(20);
  sendSuccess(res, { reviews });
}));

/** ADMIN ONLY ROUTES **/
router.use(protect, restrictTo("admin"));

// GET stats for dashboard cards
router.get("/admin/stats", catchAsync(async (req, res) => {
  const stats = await Review.aggregate([
    {
      $group: {
        _id: null,
        avgFood: { $avg: "$foodRating" },
        avgDelivery: { $avg: "$deliveryRating" },
        total: { $sum: 1 },
      }
    }
  ]);

  const ratingBreakdown = await Review.aggregate([
    { $group: { _id: "$foodRating", count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);

  const recentNegative = await Review.find({ foodRating: { $lte: 2 } })
    .populate("customer", "name")
    .populate("menuItem", "name")
    .populate("order", "orderNumber")
    .sort("-createdAt")
    .limit(5);

  sendSuccess(res, {
    avgFood: stats[0]?.avgFood?.toFixed(1) || 0,
    avgDelivery: stats[0]?.avgDelivery?.toFixed(1) || 0,
    total: stats[0]?.total || 0,
    ratingBreakdown,
    recentNegative
  });
}));

// GET list of reviews with filters/search
router.get("/admin", catchAsync(async (req, res) => {
  const { page = 1, limit = 20, rating, published, search } = req.query;
  const query = {};
  
  if (rating) query.foodRating = rating;
  if (published === 'true') query.isPublished = true;
  if (published === 'false') query.isPublished = false;
  if (search) query.comment = { $regex: search, $options: 'i' };

  const reviews = await Review.find(query)
    .populate("customer", "name phone")
    .populate("menuItem", "name image")
    .populate("order", "orderNumber")
    .sort("-createdAt")
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Review.countDocuments(query);

  sendSuccess(res, {
    reviews,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page)
  });
}));

router.patch("/:id/reply", validateObjectId("id"), catchAsync(async (req, res) => {
  const review = await Review.findByIdAndUpdate(req.params.id, { adminReply: req.body.reply }, { new: true });
  if (!review) throw new AppError("Review not found", 404);
  sendSuccess(res, { review }, "Reply posted");
}));

router.patch("/:id/unpublish", validateObjectId("id"), catchAsync(async (req, res) => {
  const review = await Review.findByIdAndUpdate(req.params.id, { isPublished: false }, { new: true });
  sendSuccess(res, { review }, "Review hidden");
}));

router.patch("/:id/publish", validateObjectId("id"), catchAsync(async (req, res) => {
  const review = await Review.findByIdAndUpdate(req.params.id, { isPublished: true }, { new: true });
  sendSuccess(res, { review }, "Review published");
}));

router.delete("/:id", validateObjectId("id"), catchAsync(async (req, res) => {
  await Review.findByIdAndDelete(req.params.id);
  sendSuccess(res, null, "Deleted");
}));

module.exports = router;