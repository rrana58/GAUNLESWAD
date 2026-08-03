const router = require("express").Router();
const { body, query } = require("express-validator");
const ctrl = require("../controllers/specialSession.controller");
const { protect, restrictTo } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

// Public — customer menu page calls this on load
router.get("/active", ctrl.getActiveSession);

// Admin only
router.use(protect, restrictTo("admin"));

router.get("/available-items", ctrl.getAvailableItems);
router.get("/", [query("date").optional().isDate()], validate, ctrl.listSessions);

router.post(
  "/",
  allowFields("name", "displayName", "tagline", "discountPercent", "items", "startHour", "endHour", "activeDate"),
  [
    body("name").trim().notEmpty().withMessage("Session name is required").isLength({ max: 80 }),
    body("displayName").trim().notEmpty().isLength({ max: 80 }),
    body("tagline").optional().trim().isLength({ max: 120 }),
    body("discountPercent").isInt({ min: 1, max: 50 }).withMessage("discountPercent must be 1–50"),
    body("items").isArray({ min: 1, max: 30 }).withMessage("items must be array of 1–30 IDs"),
    body("items.*").isMongoId(),
    body("startHour").isInt({ min: 0, max: 23 }).withMessage("startHour must be 0–23"),
    body("endHour").isInt({ min: 0, max: 23 }).withMessage("endHour must be 0–23")
      .custom((endHour, { req }) => {
        if (endHour === req.body.startHour)
          throw new Error("endHour must differ from startHour");
        return true;
      }),
    body("activeDate").optional().isDate().withMessage("activeDate must be YYYY-MM-DD"),
  ],
  validate,
  ctrl.createSession
);

router.patch(
  "/:id",
  validateObjectId("id"),
  allowFields("name", "displayName", "tagline", "discountPercent", "items", "startHour", "endHour", "activeDate"),
  [
    body("name").optional().trim().isLength({ min: 1, max: 80 }),
    body("displayName").optional().trim().isLength({ min: 1, max: 80 }),
    body("tagline").optional().trim().isLength({ max: 120 }),
    body("discountPercent").optional().isInt({ min: 1, max: 50 }),
    body("items").optional().isArray({ min: 1, max: 30 }),
    body("items.*").optional().isMongoId(),
    body("startHour").optional().isInt({ min: 0, max: 23 }),
    body("endHour").optional().isInt({ min: 0, max: 23 }),
    body("activeDate").optional().isDate(),
  ],
  validate,
  ctrl.updateSession
);

router.delete("/:id", validateObjectId("id"), ctrl.deactivateSession);

module.exports = router;