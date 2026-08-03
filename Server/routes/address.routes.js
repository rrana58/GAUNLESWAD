const router = require("express").Router();
const { body } = require("express-validator");
const { protect } = require("../middleware/auth");
const { allowFields, validateObjectId } = require("../middleware/sanitize");
const validate = require("../middleware/validate");
const User = require("../models/User");
const { reverseGeocode, isWithinNepal } = require("../utils/geocode");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/response");

// POST /api/v1/addresses/reverse-geocode (PUBLIC for Guest Checkout)
router.post(
  "/reverse-geocode",
  allowFields("lat","lng"),
  [
    body("lat").isFloat({ min: 26, max: 31 }).withMessage("Invalid Nepal latitude"),
    body("lng").isFloat({ min: 80, max: 89 }).withMessage("Invalid Nepal longitude"),
  ],
  validate,
  catchAsync(async (req, res) => {
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (!isWithinNepal(lat, lng)) throw new AppError("Coordinates outside Nepal", 400);
    const address = await reverseGeocode(lat, lng);
    sendSuccess(res, { address });
  })
);

router.use(protect);

// GET /api/v1/addresses
router.get("/", catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("addresses");
  sendSuccess(res, { addresses: user.addresses || [] });
}));



// POST /api/v1/addresses
router.post(
  "/",
  allowFields("label","street","area","city","landmark","coordinates","isDefault","type"),
  [
    body("label").optional().isIn(["Home","Work","Other"]),
    body("type").optional().isIn(["gps","manual"]),
    body("street").optional().trim().isLength({ max: 200 }),
    body("landmark").optional().trim().isLength({ max: 200 }),
    body("coordinates.lat").optional().isFloat({ min: 26, max: 31 }),
    body("coordinates.lng").optional().isFloat({ min: 80, max: 89 }),
    body("isDefault").optional().isBoolean(),
  ],
  validate,
  catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id);
    if ((user.addresses || []).length >= 5)
      throw new AppError("Maximum 5 saved addresses. Delete one first.", 400);

    let { label, street, area, city, landmark, coordinates, isDefault, type } = req.body;

    if (type === "gps" && coordinates) {
      const geocoded = await reverseGeocode(Number(coordinates.lat), Number(coordinates.lng));
      street = street || geocoded.street;
      area = area || geocoded.area;
      city = city || geocoded.city;
      landmark = landmark || geocoded.landmark;
    }

    if (!street?.trim()) throw new AppError("Street address is required", 400);

    if (isDefault) user.addresses.forEach((a) => { a.isDefault = false; });

    user.addresses.push({
      label: label || "Other",
      street: street.trim().slice(0, 200),
      area: (area || "").trim().slice(0, 100),
      city: (city || "Kathmandu").trim().slice(0, 100),
      landmark: (landmark || "").trim().slice(0, 200),
      coordinates: coordinates ? { lat: Number(coordinates.lat), lng: Number(coordinates.lng) } : undefined,
      isDefault: !!isDefault,
      source: type === "gps" ? "gps" : "manual",
    });

    await user.save();
    sendSuccess(res, { addresses: user.addresses }, "Address saved", 201);
  })
);

// PATCH /api/v1/addresses/:addressId
router.patch(
  "/:addressId",
  validateObjectId("addressId"),
  allowFields("label","street","area","city","landmark","coordinates","isDefault"),
  validate,
  catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);
    if (!address) throw new AppError("Address not found", 404);

    const { label, street, area, city, landmark, coordinates, isDefault } = req.body;
    if (label !== undefined) address.label = label;
    if (street !== undefined) address.street = street.trim().slice(0, 200);
    if (area !== undefined) address.area = area.trim().slice(0, 100);
    if (city !== undefined) address.city = city.trim().slice(0, 100);
    if (landmark !== undefined) address.landmark = landmark.trim().slice(0, 200);
    if (coordinates !== undefined) address.coordinates = { lat: Number(coordinates.lat), lng: Number(coordinates.lng) };
    if (isDefault) { user.addresses.forEach((a) => { a.isDefault = false; }); address.isDefault = true; }

    await user.save();
    sendSuccess(res, { addresses: user.addresses }, "Address updated");
  })
);

// DELETE /api/v1/addresses/:addressId
router.delete(
  "/:addressId",
  validateObjectId("addressId"),
  catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id);
    const before = user.addresses.length;
    user.addresses = user.addresses.filter((a) => a._id.toString() !== req.params.addressId);
    if (user.addresses.length === before) throw new AppError("Address not found", 404);
    await user.save();
    sendSuccess(res, { addresses: user.addresses }, "Address deleted");
  })
);

module.exports = router;
