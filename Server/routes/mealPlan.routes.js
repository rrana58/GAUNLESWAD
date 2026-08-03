const router = require("express").Router();
const { body } = require("express-validator");
const planCtrl = require("../controllers/mealPlan.controller");
const { protect, restrictTo } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

// Public
router.get("/", planCtrl.listPlans);
router.get("/admin/all", protect, restrictTo("admin"), planCtrl.listPlansAdmin);
router.get("/:id", planCtrl.getPlan);

// Admin
router.post(
  "/",
  protect, restrictTo("admin"),
  allowFields("name","description","tag","pricingOptions","items"),
  [
    body("name").trim().notEmpty().isLength({ max: 80 }),
    body("pricingOptions").isArray({ min: 1 }).withMessage("At least one pricing option required"),
    body("pricingOptions.*.meals").isInt({ min: 1 }),
    body("pricingOptions.*.price").isInt({ min: 100 }),
    body("items").isArray({ min: 2, max: 15 }).withMessage("2–15 items required"),
    body("items.*").isMongoId(),
    body("description").optional().trim().isLength({ max: 500 }),
    body("tag").optional().trim().isLength({ max: 40 }),
  ],
  validate, planCtrl.createPlan
);

router.patch(
  "/:id",
  protect, restrictTo("admin"), validateObjectId("id"),
  allowFields("name","description","tag","pricingOptions","items","isActive"),
  [
    body("name").optional().trim().notEmpty().isLength({ max: 80 }),
    body("pricingOptions").optional().isArray({ min: 1 }),
    body("pricingOptions.*.meals").optional().isInt({ min: 1 }),
    body("pricingOptions.*.price").optional().isInt({ min: 100 }),
    body("items").optional().isArray({ min: 2, max: 15 }),
    body("items.*").optional().isMongoId(),
    body("description").optional().trim().isLength({ max: 500 }),
    body("tag").optional().trim().isLength({ max: 40 }),
    body("isActive").optional().isBoolean()
  ],
  validate, planCtrl.updatePlan
);

router.delete("/:id", protect, restrictTo("admin"), validateObjectId("id"), planCtrl.deletePlan);

module.exports = router;
