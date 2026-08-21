const mongoose = require("mongoose");

/**
 * Settings — Global kitchen configuration
 */
const settingsSchema = new mongoose.Schema(
  {
    // Global discount applied to every item at checkout
    globalDiscountPercent: {
      type: Number,
      default: 0,
      min: [0, "Cannot be negative"],
      max: [50, "Maximum 50%"],
    },
    // Label shown to customer on receipt/cart
    globalDiscountLabel: {
      type: String,
      default: "Global Discount",
      trim: true,
      maxlength: 80,
    },
    // Free delivery threshold
    freeDeliveryAbove: {
      type: Number,
      default: 500,
      min: 0,
    },
    // ─── Delivery zones — restrict how far orders can be placed from, and
    // charge a distance-appropriate fee. Optional: if kitchenLocation isn't
    // set, the app falls back to the flat DELIVERY_FEE constant with no
    // range restriction (so this is safe to leave unconfigured).
    kitchenLocation: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    // Hard cutoff — orders from further than this are rejected outright.
    maxDeliveryDistanceKm: {
      type: Number,
      min: 0,
    },
    // Tiered fees by distance. Sorted ascending by upToKm; the first tier
    // whose upToKm >= the customer's distance applies. e.g.
    // [{upToKm:3, fee:30}, {upToKm:7, fee:50}, {upToKm:12, fee:80}]
    deliveryZones: [
      {
        upToKm: { type: Number, required: true, min: 0 },
        fee: { type: Number, required: true, min: 0 },
      },
    ],
    // Maintenance mode — blocks all orders
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: "We are temporarily unavailable. Please try again shortly.",
      trim: true,
      maxlength: 300,
    },
    // ─── Contact Us ───────────────────────────────────────────────────────────────
    contactInfo: {
      phone: { type: String, trim: true, maxlength: 20 },
      whatsapp: { type: String, trim: true, maxlength: 20 },
      email: { type: String, trim: true, maxlength: 100 },
      address: { type: String, trim: true, maxlength: 200 },
      mapLink: { type: String, trim: true, maxlength: 300 },
      facebook: { type: String, trim: true, maxlength: 300 },
      instagram: { type: String, trim: true, maxlength: 300 },
    },
    // ─── About Us ─────────────────────────────────────────────────────────────────
    aboutUs: {
      type: String,
      trim: true,
      maxlength: 3000,
      default:
        "Gharko Swad brings home-style Nepali thalis and momo straight to your doorstep — cooked fresh, every day.",
    },
    // ─── Promotional Popup ────────────────────────────────────────────────────────
    popup: {
      enabled: { type: Boolean, default: false },
      title: { type: String, trim: true, maxlength: 100 },
      message: { type: String, trim: true, maxlength: 500 },
      buttonText: { type: String, trim: true, maxlength: 50, default: "Order Now" },
      buttonLink: { type: String, trim: true, maxlength: 200 },
      bgColor: { type: String, default: "#f97316" },
      validUntil: { type: Date },
      image: {
        url: String,
        publicId: String,
      },
    },
  },
  { timestamps: true }
);

// Singleton helper — always returns the one Settings document
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);