const mongoose = require("mongoose");
const Order = require("../models/Order");
const Review = require("../models/Review");
const MenuItem = require("../models/MenuItem");
const CelebrationPackage = require("../models/CelebrationPackage");
const Coupon = require("../models/Coupon");
const User = require("../models/User");
const SpecialSession = require("../models/SpecialSession");
const ClosedDate = require("../models/ClosedDate");
const Settings = require("../models/Settings");
const { emitOrderUpdate, emitNewOrder } = require("../config/socket");
const { sendOrderStatusSMS } = require("../services/sms.service");
const { sendOrderPush, sendMulticastPush } = require("../services/fcm.service");
const { sendSuccess, sendPaginated } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { securityLogger } = require("../utils/logger");
const { getNepaliComponents, getTodayNP } = require("../utils/nepaliTime");
const { reverseGeocode, validateDeliveryAddress } = require("../utils/geocode");
const { claimMealsAtomic, confirmMealUsages, releaseMealUsages, refundOrderMeals } = require("./subscription.controller");
const {
  addNotificationJob,
  scheduleAutoCancel,
  scheduleDeliveryNotification,
  scheduleLoyaltyPoints,
  scheduleReferralReward,
} = require("../jobs/queues");

const DELIVERY_FEE = require("../config/constants").DELIVERY_FEE;
const FREE_DELIVERY_ABOVE = 500;
const MAX_ITEMS_PER_ORDER = require("../config/constants").MAX_ITEMS_PER_ORDER;
const MAX_QUANTITY_PER_ITEM = require("../config/constants").MAX_QUANTITY_PER_ITEM;
const { distanceKm } = require("../utils/geo");

// ─── Distance-based delivery fee ──────────────────────────────────────────────
// If admin hasn't configured a kitchen location, this falls back to the flat
// DELIVERY_FEE with no range restriction — safe to leave unconfigured.
// Once a kitchen location IS set, delivery orders must include coordinates
// (nudges customers toward the GPS/map-pin address flow) so distance and
// range can actually be checked.
function resolveDeliveryFee(settings, deliveryAddress) {
  const kitchen = settings.kitchenLocation;
  if (!kitchen?.lat || !kitchen?.lng) {
    return { fee: DELIVERY_FEE, distanceKm: null };
  }

  const coords = deliveryAddress?.coordinates;
  const lat = Number(coords?.lat), lng = Number(coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError(
      "Please share your delivery location (GPS/map pin) so we can calculate the delivery fee and confirm we deliver to you.",
      400
    );
  }

  const distance = distanceKm(kitchen.lat, kitchen.lng, lat, lng);

  if (settings.maxDeliveryDistanceKm && distance > settings.maxDeliveryDistanceKm) {
    throw new AppError(
      `Sorry, that address is about ${distance.toFixed(1)} km away — we currently only deliver up to ${settings.maxDeliveryDistanceKm} km. Try pickup instead?`,
      400
    );
  }

  const zones = settings.deliveryZones || [];
  const matchedZone = zones.find((z) => distance <= z.upToKm);
  const fee = matchedZone ? matchedZone.fee : (zones.length > 0 ? zones[zones.length - 1].fee : DELIVERY_FEE);

  return { fee, distanceKm: Math.round(distance * 10) / 10 };
}

async function fetchActiveSpecialSession() {
  const { hour } = getNepaliComponents();
  const today = getTodayNP();

  // Fetch all active sessions for today
  const sessions = await SpecialSession.find({ activeDate: today, isActive: true })
    .select("name discountPercent items displayName startHour endHour")
    .lean();

  if (!sessions.length) return null;

  // Find first session whose time window covers the current hour
  return sessions.find(({ startHour, endHour }) => {
    if (endHour > startHour) {
      return hour >= startHour && hour < endHour; // normal e.g. 12–16
    } else {
      return hour >= startHour || hour < endHour; // crosses midnight e.g. 22–4
    }
  }) || null;
}

// ─── Price calculation (pure — no side effects) ───────────────────────────────
const calculateOrderTotals = async (cartItems, couponCode, userId, useWallet, dbSession, deliveryType, deliveryAddress) => {
  if (cartItems.length > MAX_ITEMS_PER_ORDER)
    throw new AppError(`Maximum ${MAX_ITEMS_PER_ORDER} items per order.`, 400);

  const itemIds = cartItems.map((ci) => ci.menuItemId);
  const menuItems = await MenuItem.find({ _id: { $in: itemIds }, isAvailable: true }).session(dbSession);

  if (menuItems.length !== new Set(itemIds).size)
    throw new AppError("One or more items are unavailable or invalid.", 400);

  // ── Stock check: prevent overselling when stockQuantity is set ────────────
  for (const menuItem of menuItems) {
    if (menuItem.stockQuantity !== null && menuItem.stockQuantity !== undefined) {
      const cartItem = cartItems.find((ci) => ci.menuItemId === menuItem._id.toString());
      const qty = cartItem?.quantity || 1;
      if (menuItem.stockQuantity < qty) {
        throw new AppError(
          `Sorry, only ${menuItem.stockQuantity} portion(s) of "${menuItem.name}" are available.`,
          400
        );
      }
    }
  }

  const settings = await Settings.getSettings();
  const activeSession = await fetchActiveSpecialSession();
  const sessionItemIds = new Set((activeSession?.items || []).map((id) => id.toString()));

  const orderItems = [];
  let subtotal = 0;
  const mealClaimsMeta = [];

  for (const cartItem of cartItems) {
    if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1 || cartItem.quantity > MAX_QUANTITY_PER_ITEM)
      throw new AppError(`Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}.`, 400);

    const menuItem = menuItems.find((m) => m._id.toString() === cartItem.menuItemId);
    if (!menuItem) throw new AppError("Invalid menu item.", 400);

    let unitPrice = menuItem.basePrice;
    let selectedVariant = null;

    if (cartItem.variantId) {
      selectedVariant = menuItem.variants.id(cartItem.variantId);
      if (!selectedVariant?.isAvailable)
        throw new AppError(`Variant not available for ${menuItem.name}.`, 400);
      unitPrice = selectedVariant.price;
    }

    let addonTotal = 0;
    const selectedAddons = [];
    if (cartItem.addonIds?.length) {
      if (cartItem.addonIds.length > 5) throw new AppError("Maximum 5 addons per item.", 400);
      for (const addonId of cartItem.addonIds) {
        const addon = menuItem.addons.id(addonId);
        if (addon?.isAvailable) {
          addonTotal += addon.price;
          selectedAddons.push({ name: addon.name, price: addon.price });
        }
      }
    }

    // ── Global discount (applies to all items) ──────────────────────────────
    let globalDiscount = { applied: false, percent: 0, savedAmount: 0 };
    if (settings.globalDiscountPercent > 0) {
      const multiplier = 1 - settings.globalDiscountPercent / 100;
      const original = unitPrice;
      unitPrice = Math.round(original * multiplier);
      globalDiscount = {
        applied: true,
        percent: settings.globalDiscountPercent,
        label: settings.globalDiscountLabel,
        savedAmount: original - unitPrice,
      };
    }

    let sessionDiscount = { applied: false, percent: 0, savedAmount: 0 };
    if (activeSession && sessionItemIds.has(menuItem._id.toString())) {
      const multiplier = 1 - activeSession.discountPercent / 100;
      const original = unitPrice;
      unitPrice = Math.round(original * multiplier);
      sessionDiscount = {
        applied: true,
        sessionType: activeSession.type,
        sessionName: activeSession.displayName,
        percent: activeSession.discountPercent,
        savedAmount: original - unitPrice,
      };
    }

    let planMeal = { applied: false };
    if (userId) {
      const eligibility = await claimMealsAtomic(userId, menuItem._id, cartItem.quantity);
      if (eligibility.claimed > 0) {
        const freeQty = eligibility.claimed;
        const paidQty = cartItem.quantity - freeQty;

        planMeal = {
          applied: true,
          subscriptionId: eligibility.subscription._id,
          originalUnitPrice: unitPrice,
          savedAmount: unitPrice * freeQty,
          claimedDate: eligibility.claimedDate,
          freeQuantity: freeQty,
        };

        if (paidQty > 0) {
          planMeal.note = `${freeQty} free meal(s) from plan. ${paidQty} additional unit(s) charged at Rs. ${unitPrice}`;
        } else {
          planMeal.note = `${freeQty} free meal(s) from plan.`;
        }

        const remainingMeals = eligibility.subscription.maxMeals - eligibility.subscription.mealsUsed;
        if ((remainingMeals === 2 || remainingMeals === 1) && req.user?.fcmTokens?.length) {
          sendMulticastPush(
            req.user.fcmTokens,
            "Low Meal Warning ⚠️",
            `You only have ${remainingMeals} meal(s) left in your subscription! Renew your plan now to avoid missing your daily lunch.`,
            { type: "subscription_alert" }
          ).catch(() => {});
        }

        mealClaimsMeta.push({
          subscriptionId: eligibility.subscription._id,
          menuItemId: menuItem._id,
          itemName: menuItem.name,
          claimedDate: eligibility.claimedDate,
          usageIds: eligibility.usageIds,
        });

        const itemTotal = paidQty * unitPrice + addonTotal * cartItem.quantity;
        subtotal += itemTotal;
        if (!Number.isFinite(itemTotal) || itemTotal < 0)
          throw new AppError("Invalid item price calculation.", 400);

        orderItems.push({
          menuItem: menuItem._id, name: menuItem.name, image: menuItem.image?.url,
          quantity: cartItem.quantity, unitPrice: paidQty > 0 ? unitPrice : 0,
          variant: selectedVariant ? { name: selectedVariant.name, price: selectedVariant.price } : undefined,
          addons: selectedAddons, specialInstructions: cartItem.specialInstructions?.slice(0, 200),
          globalDiscount, sessionDiscount, planMeal,
          totalPrice: Math.round(itemTotal * 100) / 100,
        });
        continue;
      }
    }

    const itemTotal = (unitPrice + addonTotal) * cartItem.quantity;
    subtotal += itemTotal;
    if (!Number.isFinite(itemTotal) || itemTotal < 0)
      throw new AppError("Invalid item price calculation.", 400);

    orderItems.push({
      menuItem: menuItem._id, name: menuItem.name, image: menuItem.image?.url,
      quantity: cartItem.quantity, unitPrice,
      variant: selectedVariant ? { name: selectedVariant.name, price: selectedVariant.price } : undefined,
      addons: selectedAddons, specialInstructions: cartItem.specialInstructions?.slice(0, 200),
      globalDiscount, sessionDiscount, planMeal,
      totalPrice: Math.round(itemTotal * 100) / 100,
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  
  // Use the dynamic threshold from settings, fallback to the constant if missing
  const deliveryThreshold = settings.freeDeliveryAbove !== undefined 
    ? settings.freeDeliveryAbove 
    : FREE_DELIVERY_ABOVE;

  let deliveryFee = 0;
  let deliveryDistanceKm = null;
  if (deliveryType !== "pickup") {
    const resolved = resolveDeliveryFee(settings, deliveryAddress);
    deliveryFee = resolved.fee;
    deliveryDistanceKm = resolved.distanceKm;
  }

  // Free delivery once subtotal hits the threshold, overriding the zone fee.
  if (subtotal >= deliveryThreshold) {
    deliveryFee = 0;
  }

  // Allow free delivery if they are claiming a subscription meal
  if (mealClaimsMeta.length > 0) {
    deliveryFee = 0;
  }

  let couponDiscount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const couponLookup = await Coupon.findOne({
      code: couponCode.toUpperCase().trim(), isActive: true,
      validFrom: { $lte: new Date() },
      $or: [{ validUntil: null }, { validUntil: { $gte: new Date() } }],
    }).session(dbSession);

    if (!couponLookup) throw new AppError("Invalid or expired coupon.", 400);

    if (couponLookup.perUserLimit && userId) {
      const userUsage = await Order.countDocuments({
        customer: userId, couponCode: couponLookup.code, status: { $nin: ["cancelled"] },
      }).session(dbSession);
      if (userUsage >= couponLookup.perUserLimit)
        throw new AppError("You have already used this coupon.", 400);
    }

    if (subtotal < couponLookup.minOrderAmount)
      throw new AppError(`Minimum order Rs. ${couponLookup.minOrderAmount} for this coupon.`, 400);

    // ATOMIC coupon claim
    const claimedCoupon = await Coupon.findOneAndUpdate(
      {
        _id: couponLookup._id,
        $or: [
          { usageLimit: null }, { usageLimit: { $exists: false } },
          { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
        ],
      },
      { $inc: { usedCount: 1 } },
      { new: true, session: dbSession }
    );

    if (!claimedCoupon) throw new AppError("Coupon usage limit reached.", 400);

    couponDiscount = Math.round(claimedCoupon.calculateDiscount(subtotal) * 100) / 100;
    appliedCoupon = claimedCoupon;
  }

  let walletDiscount = 0;
  if (useWallet && userId) {
    const user = await User.findById(userId).session(dbSession);
    const balance = user?.loyaltyPoints || 0;
    if (balance >= 1) { // Minimum 1 Rs to use wallet
      // Cannot discount more than (subtotal + delivery - couponDiscount)
      const maxDiscount = Math.max(0, subtotal + deliveryFee - couponDiscount);
      walletDiscount = Math.min(balance, maxDiscount);
    }
  }

  const totalAmount = Math.round(Math.max(0, subtotal + deliveryFee - couponDiscount - walletDiscount) * 100) / 100;
  const taxAmount = Math.round((subtotal - (subtotal / 1.13)) * 100) / 100;

  return { orderItems, subtotal, taxAmount, deliveryFee, deliveryDistanceKm, couponDiscount, walletDiscount, totalAmount, appliedCoupon, mealClaimsMeta, activeSession };
};

// ─── Place Order (wrapped in MongoDB transaction) ─────────────────────────────
exports.placeOrder = catchAsync(async (req, res, next) => {
  const { items, deliveryAddress, deliveryType, paymentMethod, couponCode, useWallet,
    specialInstructions, guestInfo, scheduledFor } = req.body;

  if (!items?.length) throw new AppError("Order must have at least one item.", 400);

  if (deliveryType !== "pickup") {
    const { valid, errors } = validateDeliveryAddress(deliveryAddress);
    if (!valid) throw new AppError(errors.join(". "), 400);
  }

  // ── Closed date check ─────────────────────────────────────────────────────
  const today = getTodayNP();
  const closedToday = await ClosedDate.findOne({ date: today, isActive: true });
  if (closedToday) {
    throw new AppError(
      `We are closed today for ${closedToday.reason}. We'll be back tomorrow — thank you for your patience!`,
      503
    );
  }

  // ── Maintenance mode check ───────────────────────────────────────────────
  const settings = await Settings.getSettings();
  if (settings.maintenanceMode) {
    throw new AppError(settings.maintenanceMessage, 503);
  }

  const userId = req.user?._id;

  // ── Start a MongoDB session for ACID transaction ──────────────────────────
  const dbSession = await mongoose.startSession();
  let order;
  let mealClaimsMeta = []; // Declared in outer block so the catch block can perform manual rollback on failure

  try {
    await dbSession.withTransaction(async () => {
      // Meal-plan claims happen outside the transaction (they have their own
      // atomic MongoDB update). Track them so we can roll back if needed.
      const calcResult = await calculateOrderTotals(items, couponCode, userId, useWallet, dbSession, deliveryType, deliveryAddress);
      const { orderItems, subtotal, taxAmount, deliveryFee, deliveryDistanceKm, couponDiscount, walletDiscount, totalAmount,
        appliedCoupon, activeSession } = calcResult;
      
      // Store reference to outer block variable
      mealClaimsMeta = calcResult.mealClaimsMeta || [];

      // Validating against actual negative calculations rather than throwing errors for Rs. 0 orders
      if (totalAmount < 0) {
        throw new AppError("Order total calculation error. Please contact support.", 400);
      }

      // ── Resolve delivery address ─────────────────────────────────────────
      let resolvedAddress = null;
      if (deliveryType !== "pickup") {
        const addrType = deliveryAddress.type || "manual";
        if (addrType === "gps") {
          const coords = deliveryAddress.coordinates;
          const lat = Number(coords.lat), lng = Number(coords.lng);
          const geocoded = await reverseGeocode(lat, lng);
          resolvedAddress = {
            street:   (deliveryAddress.street   || geocoded.street).trim().slice(0, 200),
            area:     (deliveryAddress.area      || geocoded.area).trim().slice(0, 100),
            city:     (deliveryAddress.city      || geocoded.city).trim().slice(0, 100),
            landmark: (deliveryAddress.landmark  || geocoded.landmark).trim().slice(0, 200),
            coordinates: { lat, lng }, source: "gps",
          };
        } else {
          resolvedAddress = {
            street:      deliveryAddress.street.trim().slice(0, 200),
            area:        (deliveryAddress.area     || "").trim().slice(0, 100),
            city:        (deliveryAddress.city     || "Kathmandu").trim().slice(0, 100),
            landmark:    (deliveryAddress.landmark || "").trim().slice(0, 200),
            coordinates: deliveryAddress.coordinates
              ? { lat: Number(deliveryAddress.coordinates.lat), lng: Number(deliveryAddress.coordinates.lng) }
              : undefined,
            source: "manual",
          };
        }
      }

      const orderData = {
        items: orderItems, subtotal, taxAmount, deliveryFee, deliveryDistanceKm,
        couponCode: appliedCoupon?.code, couponDiscount, walletDiscount, totalAmount,
        deliveryAddress: resolvedAddress, deliveryType: deliveryType || "delivery",
        paymentMethod, specialInstructions: specialInstructions?.slice(0, 500), scheduledFor,
      };

      if (activeSession) {
        orderData.specialSession = {
          type: activeSession.type, name: activeSession.displayName,
          discountPercent: activeSession.discountPercent,
        };
      }

      if (userId) {
        orderData.customer = userId;
      } else {
        if (!guestInfo?.phone || !guestInfo?.name)
          throw new AppError("Guest name and phone are required.", 400);
        if (!/^9[678]\d{8}$/.test(guestInfo.phone))
          throw new AppError("Enter a valid Nepal mobile number.", 400);
        orderData.guestInfo = { name: guestInfo.name.slice(0, 60), phone: guestInfo.phone };
      }

      // ── Decrement stockQuantity for items that have inventory tracking ────
      for (const cartItem of items) {
        const menuItem = await MenuItem.findOne({
          _id: cartItem.menuItemId,
          stockQuantity: { $ne: null },
        }).session(dbSession);

        if (menuItem) {
          const updated = await MenuItem.findOneAndUpdate(
            { _id: cartItem.menuItemId, stockQuantity: { $gte: cartItem.quantity } },
            { $inc: { stockQuantity: -cartItem.quantity } },
            { new: true, session: dbSession }
          );
          if (!updated)
            throw new AppError(`"${menuItem.name}" ran out of stock while you were checking out.`, 409);
        }
      }

      // ── Create order inside transaction ───────────────────────────────────
      const [createdOrder] = await Order.create([orderData], { session: dbSession });
      order = createdOrder;

      // ── Deduct Wallet Balance ─────────────────────────────────────────────
      if (walletDiscount > 0) {
        await User.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: -walletDiscount } }, { session: dbSession });
      }

      // Confirm meal-usage references now that we have an order ID
      for (const claim of mealClaimsMeta)
        await confirmMealUsages(claim.subscriptionId, claim.usageIds, order._id);
    });

    // ── Post-transaction side-effects (non-critical) ──────────────────────
    emitNewOrder(order);

    // Push-notify kitchen & delivery staff so they get alerts even with the app closed
    try {
      const staffUsers = await User.find(
        { role: { $in: ["kitchen", "delivery"] }, isActive: true, fcmTokens: { $exists: true, $ne: [] } },
        "fcmTokens role"
      );
      const kitchenTokens = staffUsers.filter(u => u.role === "kitchen").flatMap(u => u.fcmTokens || []);
      const deliveryTokens = staffUsers.filter(u => u.role === "delivery").flatMap(u => u.fcmTokens || []);
      if (kitchenTokens.length > 0) {
        sendMulticastPush(kitchenTokens, "🔔 New Order!", `Order #${order.orderNumber} needs confirmation.`, { orderId: String(order._id), type: "new_order" }).catch(() => {});
      }
      if (deliveryTokens.length > 0) {
        sendMulticastPush(deliveryTokens, "📦 New Order Placed", `Order #${order.orderNumber} — get ready for delivery.`, { orderId: String(order._id), type: "new_order" }).catch(() => {});
      }
    } catch (pushErr) {
      // Non-critical — don't break order flow
    }

    // Auto-cancel if digital payment not completed within 15 min
    if (paymentMethod !== "cod") {
      await scheduleAutoCancel(order._id).catch(() => {});
    }

    await order.populate("items.menuItem", "name image");
    res.status(201).json({ success: true, message: "Order placed successfully", order });

  } catch (err) {
    // Transaction already rolled back by withTransaction — also undo meal claims
    // (these happen outside the Mongo transaction so they need manual rollback)
    for (const claim of mealClaimsMeta) {
      await releaseMealUsages(claim.subscriptionId, claim.usageIds).catch(() => {});
    }
    throw err;
  } finally {
    dbSession.endSession();
  }
});

// ─── Get single order ─────────────────────────────────────────────────────────
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("customer", "name phone")
    .populate("items.menuItem", "name image");
  if (!order) throw new AppError("Order not found.", 404);
  const isOwner = order.customer?._id?.toString() === req.user?._id?.toString();
  if (req.user && req.user.role !== "admin" && !isOwner) {
    securityLogger.warn(`Order access violation: user ${req.user._id} tried order ${order._id}`);
    throw new AppError("Access denied.", 403);
  }
  sendSuccess(res, { order });
});

// ─── Guest tracking ───────────────────────────────────────────────────────────
exports.trackOrder = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token))
    throw new AppError("Invalid tracking token.", 400);
  const order = await Order.findOne({ trackingToken: token })
    .populate("items.menuItem", "name image")
    .select("-adminNote -paymentReference -guestInfo.phone");
  if (!order) throw new AppError("Order not found.", 404);
  sendSuccess(res, { order });
});

// ─── My orders ────────────────────────────────────────────────────────────────
exports.getMyOrders = catchAsync(async (req, res, next) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(20, parseInt(req.query.limit) || 10);
  const [orders, total] = await Promise.all([
    Order.find({ customer: req.user._id })
      .populate("items.menuItem", "name image")
      .sort("-createdAt").skip((page - 1) * limit).limit(limit).select("-adminNote"),
    Order.countDocuments({ customer: req.user._id }),
  ]);
  sendPaginated(res, { orders }, total, page, limit);
});

// ─── Cancel order ─────────────────────────────────────────────────────────────
exports.cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found.", 404);
  const isOwner = order.customer?.toString() === req.user._id.toString();
  const isStaff = ["admin", "kitchen"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Access denied.", 403);
  if (!["pending", "confirmed", "preparing"].includes(order.status) && !isStaff)
    throw new AppError(`Cannot cancel an order that is "${order.status}".`, 400);

  order.status = "cancelled";
  order.cancelReason = req.body.reason?.slice(0, 500) || `Cancelled by ${req.user.role || "customer"}`;
  await order.save();

  // Restore stock for items with inventory tracking
  for (const item of order.items) {
    await MenuItem.findOneAndUpdate(
      { _id: item.menuItem, stockQuantity: { $ne: null } },
      { $inc: { stockQuantity: item.quantity } }
    ).catch(() => {});
  }

  // Refund subscription meals if any were used
  await refundOrderMeals(order._id).catch(() => {});

  emitOrderUpdate(order);
  sendSuccess(res, { order }, "Order cancelled");
});

// ─── Price a single item being added to an order during an edit ──────────────
// Deliberately does NOT touch subscription/meal-claim logic (claimMealsAtomic
// mutates subscription usage — an admin/kitchen correction after the fact
// must never silently consume a customer's plan meal). Applies the same
// global/session discounts a customer would see on the live menu.
const priceEditedOrderItem = async (cartItem, settings, activeSession, sessionItemIds) => {
  const menuItem = await MenuItem.findOne({ _id: cartItem.menuItemId, isAvailable: true });
  if (!menuItem) throw new AppError("Selected item is unavailable or invalid.", 400);

  if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1 || cartItem.quantity > MAX_QUANTITY_PER_ITEM)
    throw new AppError(`Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}.`, 400);

  if (menuItem.stockQuantity !== null && menuItem.stockQuantity !== undefined && menuItem.stockQuantity < cartItem.quantity) {
    throw new AppError(`Sorry, only ${menuItem.stockQuantity} portion(s) of "${menuItem.name}" are available.`, 400);
  }

  let unitPrice = menuItem.basePrice;
  let selectedVariant = null;
  if (cartItem.variantId) {
    selectedVariant = menuItem.variants.id(cartItem.variantId);
    if (!selectedVariant?.isAvailable) throw new AppError(`Variant not available for ${menuItem.name}.`, 400);
    unitPrice = selectedVariant.price;
  }

  let addonTotal = 0;
  const selectedAddons = [];
  if (cartItem.addonIds?.length) {
    if (cartItem.addonIds.length > 5) throw new AppError("Maximum 5 addons per item.", 400);
    for (const addonId of cartItem.addonIds) {
      const addon = menuItem.addons.id(addonId);
      if (addon?.isAvailable) {
        addonTotal += addon.price;
        selectedAddons.push({ name: addon.name, price: addon.price });
      }
    }
  }

  let globalDiscount = { applied: false, percent: 0, savedAmount: 0 };
  if (settings.globalDiscountPercent > 0) {
    const multiplier = 1 - settings.globalDiscountPercent / 100;
    const original = unitPrice;
    unitPrice = Math.round(original * multiplier);
    globalDiscount = {
      applied: true, percent: settings.globalDiscountPercent,
      label: settings.globalDiscountLabel, savedAmount: original - unitPrice,
    };
  }

  let sessionDiscount = { applied: false, percent: 0, savedAmount: 0 };
  if (activeSession && sessionItemIds.has(menuItem._id.toString())) {
    const multiplier = 1 - activeSession.discountPercent / 100;
    const original = unitPrice;
    unitPrice = Math.round(original * multiplier);
    sessionDiscount = {
      applied: true, sessionType: activeSession.type, sessionName: activeSession.displayName,
      percent: activeSession.discountPercent, savedAmount: original - unitPrice,
    };
  }

  const itemTotal = (unitPrice + addonTotal) * cartItem.quantity;
  if (!Number.isFinite(itemTotal) || itemTotal < 0) throw new AppError("Invalid item price calculation.", 400);

  return {
    menuItem: menuItem._id, name: menuItem.name, image: menuItem.image?.url,
    quantity: cartItem.quantity, unitPrice,
    variant: selectedVariant ? { name: selectedVariant.name, price: selectedVariant.price } : undefined,
    addons: selectedAddons, specialInstructions: cartItem.specialInstructions?.slice(0, 200),
    globalDiscount, sessionDiscount, planMeal: { applied: false },
    totalPrice: Math.round(itemTotal * 100) / 100,
  };
};

// ─── Edit Order (Admin & Kitchen Staff) ───────────────────────────────────────
// `items` refers to EXISTING order line items being corrected — each entry
// is { _id: <order item subdocument id>, quantity: <new quantity> }. This is
// deliberately NOT the "place order" cart shape ({menuItemId, variantId, ...})
// since a placed order's item only stores a name/price snapshot of the variant
// and addons it was ordered with, not their live menu IDs — there is nothing
// to re-look-up against the menu for an existing item.
//
// `addItems` is for genuinely changing what's in the order — swapping a dish,
// adding a new one, or picking a different variant. Each entry is a fresh
// cart-shape pick: { menuItemId, quantity, variantId?, addonIds?,
// specialInstructions? }, priced fresh off the live menu via
// priceEditedOrderItem. To "change" an existing item, the client removes the
// old line (removeItemIds) and adds the new selection (addItems) in the same
// request.
exports.editOrder = catchAsync(async (req, res, next) => {
  const { items, removeItemIds, addItems, specialInstructions, adminNote } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found.", 404);

  if (["delivered", "cancelled", "refunded"].includes(order.status)) {
    throw new AppError(`Cannot edit order that is already ${order.status}.`, 400);
  }

  if (specialInstructions !== undefined) {
    order.specialInstructions = specialInstructions.slice(0, 500);
  }
  if (adminNote !== undefined) {
    order.adminNote = adminNote.slice(0, 500);
  }

  // ── Quantity corrections on existing line items ──────────────────────────
  if (items && Array.isArray(items) && items.length > 0) {
    for (const entry of items) {
      if (!entry?._id) continue;
      const orderItem = order.items.id(entry._id);
      if (!orderItem) throw new AppError("One or more items no longer exist on this order.", 400);

      const newQty = Number(entry.quantity);
      if (!Number.isInteger(newQty) || newQty < 1 || newQty > MAX_QUANTITY_PER_ITEM) {
        throw new AppError(`Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}.`, 400);
      }
      const addonsTotal = (orderItem.addons || []).reduce((s, a) => s + (a.price || 0), 0);
      orderItem.quantity = newQty;
      orderItem.totalPrice = Math.round((orderItem.unitPrice + addonsTotal) * newQty * 100) / 100;
    }
  }

  // ── Remove line items entirely ────────────────────────────────────────────
  if (removeItemIds && Array.isArray(removeItemIds) && removeItemIds.length > 0) {
    order.items = order.items.filter((it) => !removeItemIds.includes(it._id.toString()));
  }

  // ── Add / swap-in items priced fresh off the live menu ────────────────────
  if (addItems && Array.isArray(addItems) && addItems.length > 0) {
    if (order.items.length + addItems.length > MAX_ITEMS_PER_ORDER) {
      throw new AppError(`Maximum ${MAX_ITEMS_PER_ORDER} items per order.`, 400);
    }
    const settings = await Settings.getSettings();
    const activeSession = await fetchActiveSpecialSession();
    const sessionItemIds = new Set((activeSession?.items || []).map((sid) => sid.toString()));
    for (const cartItem of addItems) {
      const newItem = await priceEditedOrderItem(cartItem, settings, activeSession, sessionItemIds);
      order.items.push(newItem);
    }
  }

  if (order.items.length === 0) {
    throw new AppError("An order must have at least one item — cancel the order instead.", 400);
  }

  // ── Recompute totals whenever items changed ───────────────────────────────
  if ((items && items.length > 0) || (removeItemIds && removeItemIds.length > 0) || (addItems && addItems.length > 0)) {
    const subtotal = order.items.reduce((s, it) => s + it.totalPrice, 0);
    order.subtotal = Math.round(subtotal * 100) / 100;
    order.totalAmount = Math.round(
      (order.subtotal + (order.deliveryFee || 0) + (order.taxAmount || 0) -
        (order.couponDiscount || 0) - (order.walletDiscount || 0)) * 100
    ) / 100;
  }

  await order.save();
  await order.populate("items.menuItem", "name image");
  emitOrderUpdate(order);
  sendSuccess(res, { order }, "Order updated successfully");
});

// ─── Valid status transitions ─────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  pending:          ["confirmed", "cancelled"],
  confirmed:        ["preparing", "cancelled"],
  preparing:        ["ready"],
  ready:            ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
};

// ─── Update order status (admin/delivery) ─────────────────────────────────────
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id).populate("customer", "name phone fcmTokens");
  if (!order) throw new AppError("Order not found.", 404);

  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed?.includes(status))
    throw new AppError(`Cannot move from "${order.status}" to "${status}".`, 400);

  order.status = status;
  if (note) {
    const last = order.statusHistory[order.statusHistory.length - 1];
    if (last) last.note = note.slice(0, 500);
  }

  if (status === "delivered") {
    order.actualDeliveredAt = new Date();
    if (order.paymentMethod === "cod") {
      order.paymentStatus = "paid";
      order.paidAt = new Date();
    }
  }

  await order.save();
  emitOrderUpdate(order);

  // SMS + Push
  const phone = order.customer?.phone || order.guestInfo?.phone;
  if (phone) sendOrderStatusSMS(phone, order.orderNumber, status).catch(() => {});
  if (order.customer) sendOrderPush(order.customer, order.orderNumber, status, order._id).catch(() => {});

  // On delivery: update user stats + award loyalty points
  if (status === "delivered" && order.customer) {
    const customerDoc = await User.findByIdAndUpdate(order.customer._id, {
      $inc: { totalOrders: 1, totalSpent: order.totalAmount },
    });
    if (customerDoc && customerDoc.totalOrders === 0 && customerDoc.referredBy) {
      await scheduleReferralReward(order.customer._id).catch(() => {});
    }
    // 1 loyalty point per Rs. 100 spent
    await scheduleLoyaltyPoints(order._id, order.customer._id, order.totalAmount).catch(() => {});
  }

  // Notify delivery person when order is Ready for pickup
  if (status === "ready") {
    await scheduleDeliveryNotification(order._id).catch(() => {});
  }

  sendSuccess(res, { order }, "Order status updated");
});

// ─── Get all orders (admin / delivery) ───────────────────────────────────────
exports.getAllOrders = catchAsync(async (req, res, next) => {
  const { status, page, limit, date, orderType } = req.query;
  const safePage  = Math.max(1, parseInt(page)  || 1);
  const safeLimit = Math.min(50, parseInt(limit) || 20);
  const filter = {};

  if (status) {
    const v = ["pending","confirmed","preparing","ready","out_for_delivery","delivered","cancelled"];
    if (!v.includes(status)) throw new AppError("Invalid status filter.", 400);
    filter.status = status;
  }
  if (orderType && orderType !== 'all') {
    filter.orderType = orderType;
  }
  if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) throw new AppError("Invalid date format.", 400);
    filter.createdAt = {
      $gte: new Date(d.setHours(0,0,0,0)),
      $lte: new Date(d.setHours(23,59,59,999)),
    };
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).populate("customer", "name phone").sort("-createdAt")
      .skip((safePage - 1) * safeLimit).limit(safeLimit),
    Order.countDocuments(filter),
  ]);
  sendPaginated(res, { orders }, total, safePage, safeLimit);
});

// ─── Rate order ───────────────────────────────────────────────────────────────
exports.rateOrder = catchAsync(async (req, res, next) => {
  const { foodRating, deliveryRating, comment } = req.body;
  if (!Number.isInteger(foodRating) || foodRating < 1 || foodRating > 5)
    throw new AppError("Food rating must be between 1 and 5.", 400);
  const order = await Order.findOne({ _id: req.params.id, customer: req.user._id, status: "delivered" });
  if (!order) throw new AppError("Order not found or not eligible for rating.", 404);
  if (order.rating?.food) throw new AppError("Order already rated.", 400);

  const trimmedComment = comment?.slice(0, 500);
  order.rating = { food: foodRating, delivery: deliveryRating, comment: trimmedComment, ratedAt: new Date() };
  await order.save();

  // The admin dashboard's Reviews page (list, stats, publish/unpublish,
  // replies) reads from the separate Review collection, not order.rating —
  // so a Review has to be created here too, or customer ratings never show
  // up on the admin side at all.
  await Review.create({
    order: order._id,
    customer: req.user._id,
    foodRating,
    deliveryRating,
    comment: trimmedComment,
  });

  sendSuccess(res, {}, "Thank you for your feedback!");
});

// ─── Place Celebration Order ──────────────────────────────────────────────────
exports.placeCelebrationOrder = catchAsync(async (req, res, next) => {
  const { packageId, menuId, dietaryPreference, pax, deliveryAddress, deliveryType, paymentMethod, couponCode, useWallet,
    specialInstructions, guestInfo, celebrationDetails, fullPayment } = req.body;

  if (!packageId) throw new AppError("Package ID is required.", 400);
  if (!menuId) throw new AppError("Menu Option ID is required.", 400);
  if (!dietaryPreference || !['veg', 'non-veg'].includes(dietaryPreference)) throw new AppError("Valid dietary preference (veg or non-veg) is required.", 400);

  const pkg = await CelebrationPackage.findById(packageId);
  if (!pkg || !pkg.isActive) throw new AppError("Selected celebration package is not available.", 404);

  const menu = pkg.menus.id(menuId);
  if (!menu) throw new AppError("Selected menu option is not available in this package.", 404);

  const minPax = menu.minPax || 4;
  if (!pax || pax < minPax) throw new AppError(`Minimum of ${minPax} people (pax) required for this menu option.`, 400);

  if (deliveryType !== "pickup") {
    const { valid, errors } = validateDeliveryAddress(deliveryAddress);
    if (!valid) throw new AppError(errors.join(". "), 400);
  }

  // Validations for Celebration
  if (!celebrationDetails || !celebrationDetails.eventDate || !celebrationDetails.celebrationType) {
    throw new AppError("Celebration details (type, event date) are required.", 400);
  }

  const eventDate = new Date(celebrationDetails.eventDate);
  const now = new Date();
  const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
  
  if (diffDays < 1 || diffDays > 7) {
    throw new AppError("Celebration orders must be booked between 1 to 7 days in advance.", 400);
  }

  // Check if eventDate is a closed date
  const eventDateString = eventDate.toISOString().slice(0, 10);
  const closedEventDate = await ClosedDate.findOne({ date: eventDateString, isActive: true });
  if (closedEventDate) {
    throw new AppError(`We are closed on ${eventDateString} for ${closedEventDate.reason}. Please select another date.`, 400);
  }

  if (paymentMethod === "cod") {
    throw new AppError("Celebration orders require an online payment (eSewa or Khalti).", 400);
  }

  const pricePerPerson = dietaryPreference === 'veg' ? menu.vegDetails.price : menu.nonVegDetails.price;
  const itemsList = dietaryPreference === 'veg' ? menu.vegDetails.items : menu.nonVegDetails.items;

  if (!pricePerPerson) {
    throw new AppError(`Price for ${dietaryPreference} is not configured in this menu.`, 400);
  }

  const subtotal = pricePerPerson * pax;
  const settings = await require("../models/Settings").getSettings();

  let actualDeliveryFee = 0;
  if (deliveryType !== "pickup") {
    actualDeliveryFee = resolveDeliveryFee(settings, deliveryAddress).fee;
    const deliveryThreshold = settings.freeDeliveryAbove ?? FREE_DELIVERY_ABOVE;
    if (subtotal >= deliveryThreshold) actualDeliveryFee = 0;
  }

  const taxAmount = 0; // Simplified
  const totalAmount = subtotal + actualDeliveryFee;

  if (totalAmount <= 0) {
    throw new AppError("Order total calculation error.", 400);
  }

  let advanceAmount = totalAmount;
  let balanceAmount = 0;

  if (!fullPayment) {
    advanceAmount = Math.round((totalAmount / 2) * 100) / 100;
    balanceAmount = totalAmount - advanceAmount;
  }

  const userId = req.user?._id;
  const dbSession = await mongoose.startSession();
  let order;

  try {
    await dbSession.withTransaction(async () => {
      let resolvedAddress = null;
      if (deliveryType !== "pickup") {
        const addrType = deliveryAddress.type || "manual";
        if (addrType === "gps") {
          const coords = deliveryAddress.coordinates;
          const lat = Number(coords.lat), lng = Number(coords.lng);
          const geocoded = await require("../utils/geocoder").reverseGeocode(lat, lng);
          resolvedAddress = {
            street:   (deliveryAddress.street   || geocoded.street).trim().slice(0, 200),
            area:     (deliveryAddress.area      || geocoded.area).trim().slice(0, 100),
            city:     (deliveryAddress.city      || geocoded.city).trim().slice(0, 100),
            landmark: (deliveryAddress.landmark  || geocoded.landmark).trim().slice(0, 200),
            coordinates: { lat, lng }, source: "gps",
          };
        } else {
          resolvedAddress = {
            street:      deliveryAddress.street.trim().slice(0, 200),
            area:        (deliveryAddress.area     || "").trim().slice(0, 100),
            city:        (deliveryAddress.city     || "Kathmandu").trim().slice(0, 100),
            landmark:    (deliveryAddress.landmark || "").trim().slice(0, 200),
            coordinates: deliveryAddress.coordinates
              ? { lat: Number(deliveryAddress.coordinates.lat), lng: Number(deliveryAddress.coordinates.lng) }
              : undefined,
            source: "manual",
          };
        }
      }

      const orderData = {
        orderType: "celebration",
        celebrationPackage: pkg._id,
        celebrationDetails: {
          celebrationType: celebrationDetails.celebrationType,
          packageId: pkg._id,
          packageName: pkg.name,
          menuId: menu._id,
          menuName: menu.name,
          dietaryPreference,
          pax,
          eventDate: eventDate,
          eventTime: celebrationDetails.eventTime,
          advanceAmount,
          balanceAmount,
        },
        items: [], // Celebration uses package instead of individual standard menu items
        subtotal, taxAmount, deliveryFee: actualDeliveryFee,
        totalAmount,
        deliveryAddress: resolvedAddress, deliveryType: deliveryType || "delivery",
        paymentMethod, specialInstructions: specialInstructions?.slice(0, 500), 
        scheduledFor: eventDate,
      };

      if (userId) {
        orderData.customer = userId;
      } else {
        if (!guestInfo?.phone || !guestInfo?.name)
          throw new AppError("Guest name and phone are required.", 400);
        orderData.guestInfo = { name: guestInfo.name.slice(0, 60), phone: guestInfo.phone };
      }

      const [createdOrder] = await Order.create([orderData], { session: dbSession });
      order = createdOrder;
    });

    emitNewOrder(order);

    // Push-notify kitchen & delivery staff so they get alerts even with the app closed
    try {
      const staffUsers = await User.find(
        { role: { $in: ["kitchen", "delivery"] }, isActive: true, fcmTokens: { $exists: true, $ne: [] } },
        "fcmTokens role"
      );
      const kitchenTokens = staffUsers.filter(u => u.role === "kitchen").flatMap(u => u.fcmTokens || []);
      const deliveryTokens = staffUsers.filter(u => u.role === "delivery").flatMap(u => u.fcmTokens || []);
      if (kitchenTokens.length > 0) {
        sendMulticastPush(kitchenTokens, "🔔 New Order!", `Order #${order.orderNumber} needs confirmation.`, { orderId: String(order._id), type: "new_order" }).catch(() => {});
      }
      if (deliveryTokens.length > 0) {
        sendMulticastPush(deliveryTokens, "📦 New Order Placed", `Order #${order.orderNumber} — get ready for delivery.`, { orderId: String(order._id), type: "new_order" }).catch(() => {});
      }
    } catch (pushErr) {
      // Non-critical — don't break order flow
    }
    await require("../jobs/agenda").scheduleAutoCancel(order._id).catch(() => {});

    // Notify admins about the new Celebration Booking
    try {
      const admins = await User.find({ role: "admin", isActive: true });
      const adminTokens = admins.flatMap(a => a.fcmTokens || []);
      if (adminTokens.length > 0) {
        await sendMulticastPush(
          adminTokens, 
          "New Celebration Booking! 🎉", 
          `A new celebration package for ${pax} pax was booked.`, 
          { orderId: String(order._id), type: "order_update" }
        );
      }
    } catch (e) {
      console.error("Failed to send celebration admin alert", e);
    }

    res.status(201).json({ success: true, message: "Celebration Order placed successfully", order });

  } catch (err) {
    throw err;
  } finally {
    dbSession.endSession();
  }
});