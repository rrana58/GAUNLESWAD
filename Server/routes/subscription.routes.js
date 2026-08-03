const router = require("express").Router();
const { body, query } = require("express-validator");
const subCtrl = require("../controllers/subscription.controller");
const { protect, restrictTo } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

// Customer
router.post(
  "/",
  protect,
  allowFields("planId","payment","meals"),
  [
    body("planId").isMongoId().withMessage("Valid planId required"),
    body("meals").isInt({ min: 1 }).withMessage("Meals count is required"),
    body("payment.method")
      .isIn(subCtrl.ALLOWED_SUBSCRIPTION_PAYMENT_METHODS)
      .withMessage("Valid payment method required. Cash on delivery isn't available for subscriptions — pick a direct payment method."),
    body("payment.reference").optional().trim().isLength({ max: 200 }),
  ],
  validate, subCtrl.subscribe
);

router.get("/my", protect, subCtrl.getMySubscription);
router.get("/my/history", protect, subCtrl.getMyMealHistory);
router.delete("/my", protect, subCtrl.cancelMySubscription);

// Admin
router.get(
  "/admin",
  protect, restrictTo("admin"),
  [
    query("status").optional().isIn(["pending","active","paused","expired","cancelled"]),
    query("planId").optional().isMongoId(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  validate, subCtrl.listSubscriptionsAdmin
);

router.get("/admin/stats", protect, restrictTo("admin"), subCtrl.getSubscriptionStats);

router.patch(
  "/admin/:id/confirm",
  protect, restrictTo("admin"), validateObjectId("id"),
  allowFields("paymentReference","adminNote"),
  [
    body("paymentReference").trim().notEmpty().withMessage("Payment reference is required to confirm.")
      .isLength({ max: 120 }).withMessage("Payment reference is too long."),
    body("adminNote").optional().trim().isLength({ max: 500 }),
  ],
  validate, subCtrl.confirmSubscription
);

router.patch(
  "/admin/:id/status",
  protect, restrictTo("admin"), validateObjectId("id"),
  allowFields("status","adminNote"),
  [body("status").isIn(["paused","expired","cancelled","active"])],
  validate, subCtrl.updateSubscriptionStatus
);

module.exports = router;