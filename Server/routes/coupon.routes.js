const router = require("express").Router();
const ctrl = require("../controllers/coupon.controller");
const { optionalAuth } = require("../middleware/auth");
const { allowFields } = require("../middleware/sanitize");

// Public — customer "Promo Codes" section calls this
router.get("/public", ctrl.getPublicCoupons);

// Public (guest-checkout friendly) — live checkout preview, no claim made
router.post("/validate", optionalAuth, allowFields("code", "subtotal"), ctrl.validateCoupon);

module.exports = router;