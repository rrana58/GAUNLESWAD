const router = require("express").Router();
const menuController = require("../controllers/menu.controller");
const { protect, restrictTo } = require("../middleware/auth");
const { uploadMenu, uploadCategory } = require("../config/cloudinary");

// Public routes
router.get("/", menuController.getMenu);
router.get("/grouped", menuController.getMenuGroupedByCategory);
router.get("/categories", menuController.getCategories);
router.get("/celebrations", menuController.getCelebrationMenu);
router.get("/:id", menuController.getMenuItem);

// Admin only
router.use(protect, restrictTo("admin"));
// Admin listing (returns unavailable/toggled-off items too — see controller comment)
router.get("/admin/list", menuController.getMenuAdmin);
router.post("/upload/image", uploadMenu.single("image"), menuController.uploadMenuImage);
router.post("/categories", menuController.createCategory);
router.patch("/categories/:id", menuController.updateCategory);
router.delete("/categories/:id", menuController.deleteCategory);
router.patch("/:id/toggle", menuController.toggleAvailability);
router.patch("/:id", menuController.updateMenuItem);
router.post("/", menuController.createMenuItem);
router.delete("/:id", menuController.deleteMenuItem);

module.exports = router;