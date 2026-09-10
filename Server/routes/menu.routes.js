const router = require("express").Router();
const menuController = require("../controllers/menu.controller");
const { protect, restrictTo } = require("../middleware/auth");
const { uploadMenu, uploadCategory } = require("../config/cloudinary");

// Public routes
router.get("/", menuController.getMenu);
router.get("/grouped", menuController.getMenuGroupedByCategory);
router.get("/categories", menuController.getCategories);
router.get("/celebrations", menuController.getCelebrationMenu);

// Admin-only routes MUST be registered before /:id to avoid being shadowed
// by the wildcard param route (Express matches top-to-bottom).
router.get("/admin/list", protect, restrictTo("admin"), menuController.getMenuAdmin);

// Wildcard param route — must be LAST among GETs
router.get("/:id", menuController.getMenuItem);

// Admin-only middleware for all remaining write operations
router.use(protect, restrictTo("admin"));
router.post("/upload/image", uploadMenu.single("image"), menuController.uploadMenuImage);
router.post("/categories", menuController.createCategory);
router.patch("/categories/:id", menuController.updateCategory);
router.delete("/categories/:id", menuController.deleteCategory);
router.patch("/:id/toggle", menuController.toggleAvailability);
router.patch("/:id", menuController.updateMenuItem);
router.post("/", menuController.createMenuItem);
router.delete("/:id", menuController.deleteMenuItem);

module.exports = router;