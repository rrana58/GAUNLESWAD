const express = require("express");
const router = express.Router();
const controller = require("../controllers/celebrationPackageController");
const { protect, restrictTo } = require("../middleware/auth");

// Public routes
router.get("/", controller.getPackages);
router.get("/types", controller.getCelebrationTypes);

// Admin routes
router.post("/", protect, restrictTo("admin"), controller.createPackage);
router.put("/:id", protect, restrictTo("admin"), controller.updatePackage);
router.delete("/:id", protect, restrictTo("admin"), controller.deletePackage);

module.exports = router;
