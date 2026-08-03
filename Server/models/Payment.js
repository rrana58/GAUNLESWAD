const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ["khalti", "esewa", "cod"],
      required: true,
    },
    status: {
      type: String,
      enum: ["initiated", "pending", "completed", "failed", "refunded"],
      default: "initiated",
    },

    // Gateway-specific fields
    gatewayTransactionId: String, // From Khalti/eSewa
    pidx: String, // Khalti payment identifier
    refId: String, // eSewa reference ID
    
    // Raw response from gateway (for debugging)
    gatewayResponse: mongoose.Schema.Types.Mixed,

    initiatedAt: { type: Date, default: Date.now },
    completedAt: Date,
    failedAt: Date,
    failureReason: String,

    // Refund details
    refundAmount: Number,
    refundedAt: Date,
    refundTransactionId: String,
  },
  { timestamps: true }
);

paymentSchema.index({ order: 1 });
paymentSchema.index({ pidx: 1 });
paymentSchema.index({ refId: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
