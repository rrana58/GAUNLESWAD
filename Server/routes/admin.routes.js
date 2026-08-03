const router = require("express").Router();
const { body, query } = require("express-validator");
const adminController = require("../controllers/admin.controller");
const closedDateController = require("../controllers/closedDate.controller");
const settingsController = require("../controllers/settings.controller");
const { protect, restrictTo } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

router.use(protect, restrictTo("admin"));

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get("/stats", adminController.getDashboardStats);
router.get("/analytics/revenue", adminController.getRevenueAnalytics);
router.get("/analytics/top-items", adminController.getTopItems);

// ─── Audit Trail ──────────────────────────────────────────────────────────────
router.get("/audit-logs", adminController.getAuditLogs);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get("/users", adminController.getUsers);

router.post(
  "/users",
  allowFields("name", "phone", "email", "password", "role"),
  [
    body("name").trim().notEmpty().withMessage("name is required").isLength({ max: 50 }),
    body("phone").trim().notEmpty().withMessage("phone is required").matches(/^9[678]\d{8}$/).withMessage("invalid nepali phone number"),
    body("email").optional({ checkFalsy: true }).trim().isEmail().withMessage("invalid email"),
    body("password").optional().trim().isLength({ min: 6 }).withMessage("password must be at least 6 characters"),
    body("role").isIn(["customer", "admin", "delivery", "kitchen"]).withMessage("invalid role"),
  ],
  validate,
  adminController.createUser
);

router.patch(
  "/users/:id",
  validateObjectId("id"),
  allowFields("name", "phone", "email", "password", "role"),
  [
    body("name").optional().trim().notEmpty().withMessage("name cannot be empty").isLength({ max: 50 }),
    body("phone").optional().trim().matches(/^9[678]\d{8}$/).withMessage("invalid nepali phone number"),
    body("email").optional({ checkFalsy: true }).trim().isEmail().withMessage("invalid email"),
    body("password").optional().trim().isLength({ min: 6 }).withMessage("password must be at least 6 characters"),
    body("role").optional().isIn(["customer", "admin", "delivery", "kitchen"]).withMessage("invalid role"),
  ],
  validate,
  adminController.updateUser
);

router.delete(
  "/users/:id",
  validateObjectId("id"),
  adminController.deleteUser
);

router.patch(
  "/users/:id/toggle",
  validateObjectId("id"),
  adminController.toggleUserStatus
);

// ─── Coupons ──────────────────────────────────────────────────────────────────
const couponCreateValidators = [
  body("code").trim().notEmpty().withMessage("code is required").isLength({ max: 30 }),
  body("description").optional().trim().isLength({ max: 300 }),
  body("discountType").isIn(["flat", "percent"]).withMessage("discountType must be 'flat' or 'percent'"),
  body("discountValue").isFloat({ gt: 0 }).withMessage("discountValue must be a positive number"),
  body("maxDiscount").optional({ nullable: true }).isFloat({ gt: 0 }),
  body("minOrderAmount").optional().isFloat({ min: 0 }),
  body("usageLimit").optional({ nullable: true }).isInt({ min: 1 }),
  body("perUserLimit").optional().isInt({ min: 1 }),
  body("isActive").optional().isBoolean(),
  body("validFrom").optional().isISO8601().withMessage("validFrom must be a valid date"),
  body("validUntil").optional({ nullable: true }).isISO8601().withMessage("validUntil must be a valid date"),
];

// Same rules, but every field optional — a PATCH may only touch a subset of fields.
const couponUpdateValidators = couponCreateValidators.map((chain) => chain.optional());

router.get("/coupons", adminController.getCoupons);

router.post(
  "/coupons",
  couponCreateValidators,
  validate,
  adminController.createCoupon
);

router.patch(
  "/coupons/:id",
  validateObjectId("id"),
  couponUpdateValidators,
  validate,
  adminController.updateCoupon
);

router.delete(
  "/coupons/:id",
  validateObjectId("id"),
  adminController.deleteCoupon
);

router.post(
  "/coupons/validate",
  [
    body("code").trim().notEmpty().withMessage("code is required"),
    body("amount").isFloat({ gt: 0 }).withMessage("amount must be a positive number"),
  ],
  validate,
  adminController.validateCoupon
);

// ─── Export (CSV/accounting) ───────────────────────────────────────────────────
router.get(
  "/export/orders",
  [
    query("from").optional().isDate().withMessage("from must be YYYY-MM-DD"),
    query("to").optional().isDate().withMessage("to must be YYYY-MM-DD"),
  ],
  validate,
  adminController.exportOrders
);

// ─── Bulk operations ───────────────────────────────────────────────────────────
router.post(
  "/menu/bulk-price",
  [
    body("adjustmentType").isIn(["percent", "fixed"]),
    body("value").isFloat({ ne: 0 }).withMessage("value must be a non-zero number"),
    body("categoryId").optional().isMongoId(),
  ],
  validate,
  adminController.bulkUpdatePrices
);

// ─── Closed Dates (festivals, holidays) ────────────────────────────────────────
router.get(
  "/closed-dates",
  [
    query("from").optional().isDate().withMessage("from must be YYYY-MM-DD"),
    query("to").optional().isDate().withMessage("to must be YYYY-MM-DD"),
    query("includeInactive").optional().isBoolean(),
  ],
  validate,
  closedDateController.listClosedDates
);

router.post(
  "/closed-dates",
  allowFields("date", "reason", "adminNote", "notifyDaysBefore"),
  [
    body("date")
      .notEmpty().withMessage("date is required")
      .isDate().withMessage("date must be YYYY-MM-DD"),
    body("reason")
      .trim().notEmpty().withMessage("reason is required")
      .isLength({ max: 200 }),
    body("adminNote").optional().trim().isLength({ max: 500 }),
    body("notifyDaysBefore").optional().isInt({ min: 0, max: 7 }),
  ],
  validate,
  closedDateController.createClosedDate
);

router.patch(
  "/closed-dates/:id",
  validateObjectId("id"),
  allowFields("reason", "adminNote", "notifyDaysBefore"),
  [
    body("reason").optional().trim().notEmpty().isLength({ max: 200 }),
    body("adminNote").optional().trim().isLength({ max: 500 }),
    body("notifyDaysBefore").optional().isInt({ min: 0, max: 7 }),
  ],
  validate,
  closedDateController.updateClosedDate
);

router.delete(
  "/closed-dates/:id",
  validateObjectId("id"),
  closedDateController.deleteClosedDate
);

// ─── Global Settings ────────────────────────────────────────────────────────────
router.get("/settings", settingsController.getSettings);
router.patch("/settings", settingsController.updateSettings);

module.exports = router;