const router = require("express").Router();
const { body } = require("express-validator");
const paymentController = require("../controllers/payment.controller");
const { protect } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

// All payment routes require auth
router.use(protect);

// Khalti
router.post(
  "/khalti/initiate",
  allowFields("orderId"),
  [body("orderId").isMongoId().withMessage("Invalid order ID")],
  validate,
  paymentController.initiateKhalti
);

// Verify (called after gateway redirect — token already validated via protect)
router.post(
  "/khalti/verify",
  allowFields("pidx"),
  [body("pidx").isString().isLength({ min: 1, max: 200 }).withMessage("Invalid pidx")],
  validate,
  paymentController.verifyKhalti
);

// eSewa
router.post(
  "/esewa/data",
  allowFields("orderId"),
  [body("orderId").isMongoId().withMessage("Invalid order ID")],
  validate,
  paymentController.getEsewaData
);

router.post(
  "/esewa/verify",
  allowFields("data", "orderId"),
  [
    body("data").isString().isLength({ min: 1, max: 2000 }).withMessage("Invalid payment data"),
    body("orderId").isMongoId().withMessage("Invalid order ID"),
  ],
  validate,
  paymentController.verifyEsewa
);

router.get(
  "/order/:orderId",
  validateObjectId("orderId"),
  paymentController.getOrderPayment
);

// ─── Refunds (admin only) ─────────────────────────────────────────────────────
const { restrictTo } = require("../middleware/auth");

router.post(
  "/khalti/refund",
  restrictTo("admin"),
  allowFields("orderId", "reason"),
  [body("orderId").isMongoId().withMessage("Invalid order ID")],
  validate,
  paymentController.refundKhalti
);

router.post(
  "/esewa/refund",
  restrictTo("admin"),
  allowFields("orderId", "reason"),
  [body("orderId").isMongoId().withMessage("Invalid order ID")],
  validate,
  paymentController.refundEsewa
);

module.exports = router;
