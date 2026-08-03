const router = require("express").Router();
const { protect, restrictTo } = require("../middleware/auth");
const { uploadMenu } = require("../config/cloudinary");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

router.post("/image",
  protect,
  restrictTo("admin"),
  uploadMenu.single("image"),
  catchAsync(async (req, res) => {
    if (!req.file) throw new AppError("No file uploaded", 400);
    sendSuccess(res, { url: req.file.path, publicId: req.file.filename }, "Uploaded successfully");
  })
);

module.exports = router;
