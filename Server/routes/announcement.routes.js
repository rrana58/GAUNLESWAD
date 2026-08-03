const router = require("express").Router();
const { body } = require("express-validator");
const ctrl = require("../controllers/announcement.controller");
const { protect, restrictTo } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");

// Public — customer "More" tab calls this
router.get("/active", ctrl.getActiveAnnouncements);

// Admin only
router.use(protect, restrictTo("admin"));

router.get("/", ctrl.listAnnouncements);

router.post(
  "/",
  allowFields("title", "body", "expiresAt"),
  [
    body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 100 }),
    body("body").trim().notEmpty().withMessage("Body is required").isLength({ max: 1000 }),
    body("expiresAt").optional({ nullable: true }).isISO8601().withMessage("expiresAt must be a valid date"),
  ],
  validate,
  ctrl.createAnnouncement
);

router.patch(
  "/:id",
  validateObjectId("id"),
  allowFields("title", "body", "isActive", "expiresAt"),
  [
    body("title").optional().trim().isLength({ min: 1, max: 100 }),
    body("body").optional().trim().isLength({ min: 1, max: 1000 }),
    body("isActive").optional().isBoolean(),
    body("expiresAt").optional({ nullable: true }).isISO8601(),
  ],
  validate,
  ctrl.updateAnnouncement
);

router.delete("/:id", validateObjectId("id"), ctrl.deleteAnnouncement);

module.exports = router;
