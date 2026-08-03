const router = require("express").Router();
const ctrl = require("../controllers/coupon.controller");

// Public — customer "Promo Codes" section calls this
router.get("/public", ctrl.getPublicCoupons);

module.exports = router;
