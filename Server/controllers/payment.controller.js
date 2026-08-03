const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { initiateKhaltiPayment, verifyKhaltiPayment } = require("../services/khalti.service");
const { getEsewaPaymentData, verifyEsewaPayment } = require("../services/esewa.service");
const { emitOrderUpdate } = require("../config/socket");
const { sendSuccess } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { paymentLogger, securityLogger } = require("../utils/logger");

// ─── Verify order belongs to the requesting user ──────────────────────────────
const assertOrderOwnership = (order, req) => {
  if (!order) throw new AppError("Order not found.", 404);
  if (order.paymentStatus === "paid") throw new AppError("Order is already paid.", 400);

  // Ownership check: customer can only pay their own orders
  if (req.user && order.customer) {
    const customerId = order.customer._id?.toString() || order.customer.toString();
    if (customerId !== req.user._id.toString() && req.user.role !== "admin") {
      securityLogger.warn(`Payment ownership violation: user ${req.user._id} tried order ${order._id}`);
      throw new AppError("Access denied.", 403);
    }
  }
};

// ─── Initiate Khalti ──────────────────────────────────────────────────────────
exports.initiateKhalti = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  const order = await Order.findById(orderId).populate("customer", "name phone email");
  assertOrderOwnership(order, req);

  if (order.paymentMethod !== "khalti") {
    throw new AppError("This order is not set to Khalti payment.", 400);
  }

  // Prevent duplicate payment initiation
  const existingPending = await Payment.findOne({
    order: order._id,
    method: "khalti",
    status: { $in: ["initiated", "pending"] },
    createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }, // last 10 min
  });
  if (existingPending) {
    paymentLogger.warn(`Duplicate Khalti initiation for order ${order._id}`);
    return sendSuccess(res, { pidx: existingPending.pidx, paymentUrl: null },
      "Payment already initiated. Please complete or wait 10 minutes.");
  }

  const result = await initiateKhaltiPayment({
    orderId: order._id,
    orderNumber: order.orderNumber,
    amount: order.totalAmount,
    customerName: order.customer?.name || order.guestInfo?.name,
    customerPhone: order.customer?.phone || order.guestInfo?.phone,
    customerEmail: order.customer?.email,
    returnUrl: `${process.env.WEB_URL}/payment/khalti/verify`,
  });

  if (!result.success) throw new AppError("Payment gateway error. Please try again.", 503);

  await Payment.create({
    order: order._id,
    amount: order.totalAmount,
    method: "khalti",
    status: "initiated",
    pidx: result.pidx,
  });

  paymentLogger.info(`Khalti initiated: order=${order.orderNumber} pidx=${result.pidx}`);
  sendSuccess(res, { pidx: result.pidx, paymentUrl: result.paymentUrl }, "Payment initiated");
});

// ─── Verify Khalti ────────────────────────────────────────────────────────────
exports.verifyKhalti = catchAsync(async (req, res, next) => {
  const { pidx } = req.body;
  if (!pidx || typeof pidx !== "string" || pidx.length > 200) {
    throw new AppError("Invalid payment identifier.", 400);
  }

  const payment = await Payment.findOne({ pidx }).populate("order");
  if (!payment) throw new AppError("Payment record not found.", 404);

  // Idempotency — already verified
  if (payment.status === "completed") {
    return sendSuccess(res, { order: payment.order }, "Payment already confirmed.");
  }

  const result = await verifyKhaltiPayment(pidx);

  if (!result.success || result.status !== "Completed") {
    payment.status = "failed";
    payment.failedAt = new Date();
    payment.failureReason = result.error || result.status;
    payment.gatewayResponse = result.raw;
    await payment.save();
    paymentLogger.warn(`Khalti verification failed: pidx=${pidx} status=${result.status}`);
    throw new AppError("Payment verification failed.", 400);
  }

  // Double-check amount matches — prevent amount manipulation
  if (Math.abs(result.amount - payment.order.totalAmount) > 0.01) {
    securityLogger.warn(
      `Amount mismatch! Expected Rs.${payment.order.totalAmount}, got Rs.${result.amount} for order ${payment.order._id}`
    );
    payment.status = "failed";
    payment.failureReason = "Amount mismatch";
    await payment.save();
    throw new AppError("Payment amount mismatch. Contact support.", 400);
  }

  payment.status = "completed";
  payment.completedAt = new Date();
  payment.gatewayTransactionId = result.transactionId;
  payment.gatewayResponse = result.raw;
  await payment.save();

  const order = payment.order;
  order.paymentStatus = "paid";
  order.paymentReference = result.transactionId;
  order.paidAt = new Date();
  order.status = "confirmed";
  await order.save();

  emitOrderUpdate(order);
  paymentLogger.info(`Khalti verified: order=${order.orderNumber} txn=${result.transactionId} amount=${result.amount}`);

  sendSuccess(res, { order }, "Payment confirmed! Your order is being prepared.");
});

// ─── eSewa payment data ───────────────────────────────────────────────────────
exports.getEsewaData = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  const order = await Order.findById(orderId);
  assertOrderOwnership(order, req);

  if (order.paymentMethod !== "esewa") {
    throw new AppError("This order is not set to eSewa payment.", 400);
  }

  const esewaData = getEsewaPaymentData({ orderId: order._id, amount: order.totalAmount });

  await Payment.findOneAndUpdate(
    { order: order._id, method: "esewa", status: { $in: ["initiated"] } },
    { $setOnInsert: { order: order._id, amount: order.totalAmount, method: "esewa", status: "initiated" } },
    { upsert: true }
  );

  paymentLogger.info(`eSewa data requested: order=${order.orderNumber}`);
  sendSuccess(res, { esewaData }, "eSewa payment data ready");
});

// ─── Verify eSewa ─────────────────────────────────────────────────────────────
exports.verifyEsewa = catchAsync(async (req, res, next) => {
  const { data: encodedData, orderId } = req.body;

  if (!encodedData || typeof encodedData !== "string" || encodedData.length > 2000) {
    throw new AppError("Invalid payment data.", 400);
  }

  const result = await verifyEsewaPayment(encodedData);
  if (!result.success) throw new AppError(result.error || "Payment verification failed.", 400);

  const order = await Order.findById(orderId);
  if (!order) throw new AppError("Order not found.", 404);
  if (order.paymentStatus === "paid") {
    return sendSuccess(res, { order }, "Payment already confirmed.");
  }

  // Amount check
  const paidAmount = parseFloat(result.amount);
  if (Math.abs(paidAmount - order.totalAmount) > 0.01) {
    securityLogger.warn(
      `eSewa amount mismatch: expected Rs.${order.totalAmount}, got Rs.${paidAmount} for order ${order._id}`
    );
    throw new AppError("Payment amount mismatch. Contact support.", 400);
  }

  await Payment.findOneAndUpdate(
    { order: order._id, method: "esewa" },
    {
      status: "completed",
      completedAt: new Date(),
      refId: result.transactionId,
      gatewayTransactionId: result.transactionId,
      gatewayResponse: result.raw,
    }
  );

  order.paymentStatus = "paid";
  order.paymentReference = result.transactionId;
  order.paidAt = new Date();
  order.status = "confirmed";
  await order.save();

  emitOrderUpdate(order);
  paymentLogger.info(`eSewa verified: order=${order.orderNumber} txn=${result.transactionId}`);

  sendSuccess(res, { order }, "eSewa payment confirmed!");
});

// ─── Get payment record ───────────────────────────────────────────────────────
exports.getOrderPayment = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) throw new AppError("Order not found.", 404);

  if (req.user.role !== "admin" && order.customer?.toString() !== req.user._id.toString()) {
    throw new AppError("Access denied.", 403);
  }

  const payment = await Payment.findOne({ order: req.params.orderId }).select("-gatewayResponse");
  if (!payment) throw new AppError("Payment record not found.", 404);
  sendSuccess(res, { payment });
});

// ─── Refund — Khalti ─────────────────────────────────────────────────────────
// POST /api/v1/payments/khalti/refund
// Body: { orderId, reason }
// Admin-only. Triggers gateway refund + marks order as refunded.
exports.refundKhalti = catchAsync(async (req, res, next) => {
  const { orderId, reason } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new AppError("Order not found.", 404);
  if (!["delivered", "cancelled"].includes(order.status))
    throw new AppError("Only delivered or cancelled orders can be refunded.", 400);
  if (order.paymentStatus === "refunded")
    throw new AppError("Order is already refunded.", 400);
  if (order.paymentMethod !== "khalti")
    throw new AppError("This order was not paid via Khalti.", 400);

  const payment = await Payment.findOne({ order: orderId, method: "khalti", status: "completed" });
  if (!payment?.pidx) throw new AppError("No completed Khalti payment found for this order.", 404);

  // ── Call Khalti Refund API ─────────────────────────────────────────────────
  const { refundKhaltiPayment } = require("../services/khalti.service");
  const result = await refundKhaltiPayment({ pidx: payment.pidx, amount: order.totalAmount });

  if (!result.success)
    throw new AppError(`Khalti refund failed: ${result.error}`, 502);

  payment.status = "refunded";
  payment.refundedAt = new Date();
  payment.refundReason = reason?.slice(0, 200);
  await payment.save();

  order.paymentStatus = "refunded";
  order.status = "refunded";
  order.refundAmount = order.totalAmount;
  await order.save();

  paymentLogger.info(`Khalti refund: order=${order.orderNumber} amount=Rs.${order.totalAmount}`);
  sendSuccess(res, { order }, "Refund processed via Khalti.");
});

// ─── Refund — eSewa ───────────────────────────────────────────────────────────
// POST /api/v1/payments/esewa/refund
// Body: { orderId, reason }
exports.refundEsewa = catchAsync(async (req, res, next) => {
  const { orderId, reason } = req.body;

  const order = await Order.findById(orderId);
  if (!order) throw new AppError("Order not found.", 404);
  if (!["delivered", "cancelled"].includes(order.status))
    throw new AppError("Only delivered or cancelled orders can be refunded.", 400);
  if (order.paymentStatus === "refunded")
    throw new AppError("Order is already refunded.", 400);
  if (order.paymentMethod !== "esewa")
    throw new AppError("This order was not paid via eSewa.", 400);

  // eSewa refund API: https://developer.esewa.com.np/#/refund
  const { refundEsewaPayment } = require("../services/esewa.service");
  const result = await refundEsewaPayment({
    transactionId: order.paymentReference,
    amount: order.totalAmount,
  });

  if (!result.success)
    throw new AppError(`eSewa refund failed: ${result.error}`, 502);

  const payment = await Payment.findOneAndUpdate(
    { order: orderId, method: "esewa" },
    { status: "refunded", refundedAt: new Date(), refundReason: reason?.slice(0, 200) }
  );

  order.paymentStatus = "refunded";
  order.status = "refunded";
  order.refundAmount = order.totalAmount;
  await order.save();

  paymentLogger.info(`eSewa refund: order=${order.orderNumber} amount=Rs.${order.totalAmount}`);
  sendSuccess(res, { order }, "Refund processed via eSewa.");
});
