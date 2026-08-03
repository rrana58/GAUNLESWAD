const router = require("express").Router();
const { body, query } = require("express-validator");
const orderController = require("../controllers/order.controller");
const closedDateController = require("../controllers/closedDate.controller");
const { protect, restrictTo, optionalAuth } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

// ─── Public (Guests) ──────────────────────────────────────────────────────────
router.get("/closed-dates", closedDateController.listClosedDates);

router.get("/track/:token", orderController.trackOrder);

router.post(
  "/celebration",
  optionalAuth,
  allowFields("packageId", "dietaryPreference", "pax", "deliveryAddress", "deliveryType", "paymentMethod", "specialInstructions", "guestInfo", "celebrationDetails", "fullPayment"),
  orderController.placeCelebrationOrder
);

router.post(
  "/",
  optionalAuth,
  allowFields("items","deliveryAddress","deliveryType","paymentMethod","couponCode","specialInstructions","guestInfo","scheduledFor"),
  [
    body("items").isArray({ min: 1, max: 20 }).withMessage("Order must have 1–20 items"),
    body("items.*.menuItemId").isMongoId().withMessage("Invalid menu item ID"),
    body("items.*.quantity").isInt({ min: 1, max: 10 }).withMessage("Quantity must be 1–10"),
    body("items.*.variantId").optional().isMongoId(),
    body("items.*.addonIds").optional().isArray({ max: 5 }),
    body("items.*.specialInstructions").optional().isString().isLength({ max: 200 }),
    body("paymentMethod").isIn(["cod", "khalti", "esewa"]).withMessage("Invalid payment method"),
    body("deliveryType").optional().isIn(["delivery", "pickup"]).withMessage("Must be delivery or pickup"),
    
    // deliveryAddress required unless pickup
    body("deliveryAddress")
      .if(body("deliveryType").not().equals("pickup"))
      .notEmpty().withMessage("Delivery address is required"),
    body("deliveryAddress.type").optional().isIn(["gps", "manual"]),
    
    // GPS: coordinates required
    body("deliveryAddress.coordinates.lat")
      .if(body("deliveryAddress.type").equals("gps"))
      .notEmpty().withMessage("lat required for GPS")
      .isFloat({ min: 26, max: 31 }).withMessage("Invalid Nepal latitude"),
    body("deliveryAddress.coordinates.lng")
      .if(body("deliveryAddress.type").equals("gps"))
      .notEmpty().withMessage("lng required for GPS")
      .isFloat({ min: 80, max: 89 }).withMessage("Invalid Nepal longitude"),
      
    // Manual: street required
    body("deliveryAddress.street")
      .if(body("deliveryAddress.type").not().equals("gps"))
      .if(body("deliveryType").not().equals("pickup"))
      .trim().notEmpty().withMessage("Street address is required")
      .isLength({ max: 200 }),
      
    body("deliveryAddress.area").optional().trim().isLength({ max: 100 }),
    body("deliveryAddress.city").optional().trim().isLength({ max: 100 }),
    body("deliveryAddress.landmark").optional().trim().isLength({ max: 200 }),
    body("deliveryAddress.coordinates.lat").optional().isFloat({ min: 26, max: 31 }),
    body("deliveryAddress.coordinates.lng").optional().isFloat({ min: 80, max: 89 }),
    body("guestInfo.name").if(body("guestInfo").exists()).trim().notEmpty().isLength({ max: 60 }),
    body("guestInfo.phone").if(body("guestInfo").exists()).matches(/^9[678]\d{8}$/).withMessage("Valid Nepal number required"),
    body("specialInstructions").optional().isString().isLength({ max: 500 }),
    body("couponCode").optional().isString().isLength({ max: 20 }).toUpperCase(),
  ],
  validate,
  orderController.placeOrder
);

// ─── Protected Routes (Logged in Users) ───────────────────────────────────────
router.use(protect);

router.get(
  "/my-orders",
  [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 20 })],
  validate,
  orderController.getMyOrders
);

// ─── Admin / Delivery (MUST BE ABOVE /:id) ────────────────────────────────────
router.get(
  "/all", // <--- Fixed: Changed from "/" to "/all"
  restrictTo("admin", "delivery", "kitchen"),
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().isString(),
    query("orderType").optional().isString(),
    query("date").optional().isISO8601(),
  ],
  validate,
  orderController.getAllOrders
);

// ─── Dynamic ID Routes (MUST BE BELOW SPECIFIC ROUTES LIKE /all) ──────────────
router.get("/:id", validateObjectId("id"), orderController.getOrder);

router.patch(
  "/:id/cancel",
  validateObjectId("id"),
  allowFields("reason"),
  [
    body("reason").optional().isString().isLength({ max: 500 }),
    // Admins must justify cancelling someone else's order — matches the
    // controller-level guard in cancelOrder(); kept here too as defense in depth
    // and to surface a clean 422 before any DB work happens.
    body("reason").custom((value, { req }) => {
      if (req.user?.role === "admin" && !value?.trim()) {
        throw new Error("A cancellation reason is required.");
      }
      return true;
    }),
  ],
  validate,
  orderController.cancelOrder
);

router.post(
  "/:id/rate",
  validateObjectId("id"),
  allowFields("foodRating", "deliveryRating", "comment"),
  [
    body("foodRating").isInt({ min: 1, max: 5 }).withMessage("Food rating must be 1–5"),
    body("deliveryRating").optional().isInt({ min: 1, max: 5 }),
    body("comment").optional().isString().isLength({ max: 500 }),
  ],
  validate,
  orderController.rateOrder
);

router.patch(
  "/:id/status",
  restrictTo("admin", "delivery", "kitchen"),
  validateObjectId("id"),
  allowFields("status", "note"),
  [
    body("status")
      .isIn(["confirmed","preparing","ready","out_for_delivery","delivered","cancelled"])
      .withMessage("Invalid status"),
    body("note").optional().isString().isLength({ max: 500 }),
  ],
  validate,
  orderController.updateOrderStatus
);

module.exports = router;