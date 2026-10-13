const express = require("express");
const { protect, restrictTo } = require("../middleware/auth");
const controller = require("../controllers/problemReport.controller");

const router = express.Router();

router.use(protect);

router.post("/", controller.createReport);
router.get("/my", controller.getMyReports);
router.use(restrictTo("admin"));
router.get("/", controller.listReports);
router.patch("/:id", controller.updateReportStatus);

module.exports = router;
