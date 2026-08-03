const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem", required: true },
  name: { type: String, required: true },
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  variant: { name: String, price: Number },
  addons: [{ name: String, price: Number }],
  specialInstructions: String,
  totalPrice: { type: Number, required: true },
  // Special session discount applied to this item
  sessionDiscount: {
  applied: { type: Boolean, default: false },
  sessionType: String,  
  sessionName: String,
  percent: Number,
  savedAmount: Number,
},
  // Subscription plan free meal
  planMeal: {
    applied: { type: Boolean, default: false },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    originalUnitPrice: Number,
    savedAmount: Number,
    note: String,
  },
  // Celebration package reference
  celebrationPackage: { type: mongoose.Schema.Types.ObjectId, ref: "CelebrationPackage" },
});

const statusHistorySchema = new mongoose.Schema({
  status: String,
  timestamp: { type: Date, default: Date.now },
  note: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      default: () => {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `GS-${date}-${rand}`;
      },
    },
    orderType: { type: String, enum: ["standard", "celebration", "subscription"], default: "standard" },
    celebrationDetails: {
      celebrationType: { type: String }, // e.g., "Birthday"
      packageId: { type: mongoose.Schema.Types.ObjectId, ref: "CelebrationPackage" },
      packageName: String,
      menuId: { type: mongoose.Schema.Types.ObjectId },
      menuName: String,
      dietaryPreference: { type: String, enum: ["veg", "non-veg"] },
      pax: Number,
      eventDate: Date,
      eventTime: String,
      advanceAmount: Number,
      balanceAmount: Number,
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guestInfo: { name: String, phone: String },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    couponCode: String,
    couponDiscount: { type: Number, default: 0 },
    walletDiscount: { type: Number, default: 0 },
    // Active special session at time of order (for analytics)
    specialSession: {
      type: { type: String },
      name: String,
      discountPercent: Number,
    },
    deliveryAddress: {
      street: String,
      area: String,
      city: String,
      landmark: String,
      coordinates: { lat: Number, lng: Number },
      source: { type: String, enum: ["gps", "manual"], default: "manual" },
    },
    deliveryType: { type: String, enum: ["delivery", "pickup"], default: "delivery" },
    scheduledFor: Date,
    estimatedDeliveryTime: Date,
    actualDeliveredAt: Date,
    status: {
      type: String,
      enum: ["pending","confirmed","preparing","ready","out_for_delivery","delivered","cancelled","refunded"],
      default: "pending",
    },
    statusHistory: [statusHistorySchema],
    paymentMethod: { type: String, enum: ["cod", "khalti", "esewa"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "advance_paid", "failed", "refunded"], default: "pending" },
    paymentReference: String,
    paidAt: Date,
    adminNote: String,
    specialInstructions: String,
    deliveryPerson: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rating: {
      food: { type: Number, min: 1, max: 5 },
      delivery: { type: Number, min: 1, max: 5 },
      comment: String,
      ratedAt: Date,
    },
    trackingToken: { 
      type: String, 
      default: () => uuidv4() },
    cancellationReason: { type: String, maxlength: 500 },
    
    // Notifications Tracking
    reviewNotified: { type: Boolean, default: false },
    cancelReason: String,
    refundAmount: Number,
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

orderSchema.pre("save", function (next) {
  if (this.isModified("status")) this.statusHistory.push({ status: this.status });
  next();
});

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ trackingToken: 1 });
orderSchema.index({ "guestInfo.phone": 1 });
// Standalone createdAt — required for fast dashboard revenue aggregation
orderSchema.index({ createdAt: -1 });
// For auto-cancel job: find unpaid pending orders older than N minutes
orderSchema.index({ paymentMethod: 1, paymentStatus: 1, createdAt: 1 });

module.exports = mongoose.model("Order", orderSchema);
