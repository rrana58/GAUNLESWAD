const router = require("express").Router();
const { body } = require("express-validator");
const paymentController = require("../controllers/payment.controller");
const { protect, optionalAuth, restrictTo } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

// ---------------------------------------------------------
// Guest-capable payment flow
// optionalAuth allows both logged-in users and guests.
// ---------------------------------------------------------

// Khalti - Initiate
router.post(
  "/khalti/initiate",
  optionalAuth,
  allowFields("orderId", "trackingToken"),
  [body("orderId").isMongoId().withMessage("Invalid order ID")],
  validate,
  paymentController.initiateKhalti
);

// Khalti - Verify
router.post(
  "/khalti/verify",
  optionalAuth,
  allowFields("pidx"),
  [
    body("pidx")
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage("Invalid pidx"),
  ],
  validate,
  paymentController.verifyKhalti
);

// eSewa - Payment data
router.post(
  "/esewa/data",
  optionalAuth,
  allowFields("orderId", "trackingToken"),
  [body("orderId").isMongoId().withMessage("Invalid order ID")],
  validate,
  paymentController.getEsewaData
);

// eSewa - Verify
router.post(
  "/esewa/verify",
  optionalAuth,
  allowFields("data"),
  [
    body("data")
      .isString()
      .isLength({ min: 1, max: 2000 })
      .withMessage("Invalid payment data"),
  ],
  validate,
  paymentController.verifyEsewa
);

// ---------------------------------------------------------
// Protected payment-management routes
// These still require authentication.
// ---------------------------------------------------------

// Get payment record
router.get(
  "/order/:orderId",
  protect,
  validateObjectId("orderId"),
  paymentController.getOrderPayment
);

// ---------------------------------------------------------
// Refunds - Admin only
// protect must run before restrictTo so req.user exists.
// ---------------------------------------------------------

router.post(
  "/khalti/refund",
  protect,
  restrictTo("admin"),
  allowFields("orderId", "reason"),
  [body("orderId").isMongoId().withMessage("Invalid order ID")],
  validate,
  paymentController.refundKhalti
);

router.post(
  "/esewa/refund",
  protect,
  restrictTo("admin"),
  allowFields("orderId", "reason"),
  [body("orderId").isMongoId().withMessage("Invalid order ID")],
  validate,
  paymentController.refundEsewa
);

module.exports = router;
