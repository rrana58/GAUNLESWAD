const router = require("express").Router();
const { body, query } = require("express-validator");
const ctrl = require("../controllers/job.controller");
const { protect, restrictTo, optionalAuth } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");
const { jobApplyLimiter } = require("../middleware/rateLimiter");

// ─── Public ───────────────────────────────────────────────────────────────────

router.get("/active", ctrl.getActiveJobs);

router.post(
  "/:id/apply",
  jobApplyLimiter,
  optionalAuth,
  validateObjectId("id"),
  allowFields("name", "phone", "message"),
  [
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 80 }),
    body("phone").trim().notEmpty().withMessage("Phone is required")
      .matches(/^9\d{9}$/).withMessage("Enter a valid 10-digit phone number"),
    body("message").optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  ctrl.applyToJob
);

// ─── Admin ────────────────────────────────────────────────────────────────────

router.use(protect, restrictTo("admin"));

router.get("/", ctrl.listJobs);

router.post(
  "/",
  allowFields("title", "description", "location", "employmentType"),
  [
    body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 100 }),
    body("description").trim().notEmpty().withMessage("Description is required").isLength({ max: 2000 }),
    body("location").optional().trim().isLength({ max: 100 }),
    body("employmentType").optional().isIn(["full-time", "part-time", "internship", "contract"]),
  ],
  validate,
  ctrl.createJob
);

router.patch(
  "/:id",
  validateObjectId("id"),
  allowFields("title", "description", "location", "employmentType", "isActive"),
  [
    body("title").optional().trim().isLength({ min: 1, max: 100 }),
    body("description").optional().trim().isLength({ min: 1, max: 2000 }),
    body("location").optional().trim().isLength({ max: 100 }),
    body("employmentType").optional().isIn(["full-time", "part-time", "internship", "contract"]),
    body("isActive").optional().isBoolean(),
  ],
  validate,
  ctrl.updateJob
);

router.delete("/:id", validateObjectId("id"), ctrl.deleteJob);

router.get(
  "/applications",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("jobId").optional().isMongoId(),
    query("status").optional().isIn(["new", "reviewed", "contacted", "rejected"]),
  ],
  validate,
  ctrl.listApplications
);

router.patch(
  "/applications/:id",
  validateObjectId("id"),
  allowFields("status"),
  [body("status").isIn(["new", "reviewed", "contacted", "rejected"])],
  validate,
  ctrl.updateApplicationStatus
);

module.exports = router;
