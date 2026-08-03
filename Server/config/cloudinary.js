const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS
});

// ─── Allowed file types (whitelist approach) ──────────────────────────────────
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error("Only JPEG, PNG, and WebP images are allowed."), false);
  }
  cb(null, true);
};

// Menu item images
const menuStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "gharko-swad/menu",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 800, height: 800, crop: "limit", quality: "auto:good" },
      { fetch_format: "auto" }, // Auto WebP for modern browsers
    ],
    // Prevent overwriting with predictable filenames
    public_id: (req, file) => `menu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  },
});

// Category images
const categoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "gharko-swad/categories",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "limit", quality: "auto:good" }],
    public_id: (req, file) => `cat_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  },
});

const uploadMenu = multer({
  storage: menuStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,               // Only one file at a time
    fields: 0,              // No extra non-file fields
  },
});

const uploadCategory = multer({
  storage: categoryStorage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0 },
});

module.exports = { cloudinary, uploadMenu, uploadCategory };
