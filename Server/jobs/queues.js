/**
 * jobs/queues.js
 *
 * All background queues and cron jobs for Gharko Swad.
 *
 * Queues
 * ──────
 *   notifications  – FCM push + DB notification record
 *   orders         – auto_cancel (unpaid digital orders)
 *                  – loyalty_points (award after delivery)
 *                  – notify_delivery (ping delivery person when order is Ready)
 *
 * Crons
 * ─────
 *   Subscription expiry   – daily 00:15 NPT
 *   OTP cleanup           – daily 01:00 NPT (remove expired pending users)
 *   Subscription pause    – daily 00:30 NPT (extend endDate for paused subs)
 */

const Bull = require("bull");
const cron = require("node-cron");
const { logger } = require("../utils/logger");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const QUEUE_OPTS = {
  redis: {
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  },
};

const notificationQueue = new Bull("notifications", REDIS_URL, QUEUE_OPTS);
const orderQueue        = new Bull("orders",        REDIS_URL, QUEUE_OPTS);

// ─── Error listeners ──────────────────────────────────────────────────────────
for (const queue of [notificationQueue, orderQueue]) {
  queue.on("error",  (err) => logger.error(`Queue [${queue.name}] error: ${err.message}`));
  queue.on("failed", (job, err) => logger.error(`Job ${job.id} [${queue.name}] failed: ${err.message}`));
}

// ─── Notification processor ───────────────────────────────────────────────────
notificationQueue.process(async (job) => {
  const { userId, title, body, data } = job.data;
  const { sendPushNotification } = require("../services/fcm.service");
  const User         = require("../models/User");
  const Notification = require("../models/Notification");

  await Notification.create({ user: userId, title, body, type: "order_update", data, sentVia: ["fcm"] });

  const user = await User.findById(userId);
  if (!user?.fcmTokens?.length) return;

  const deadTokens = [];
  for (const token of user.fcmTokens) {
    const result = await sendPushNotification(token, title, body, data);
    if (!result.success && result.error?.includes("registration-token-not-registered")) {
      deadTokens.push(token);
    }
  }
  if (deadTokens.length > 0) {
    await User.findByIdAndUpdate(userId, { $pull: { fcmTokens: { $in: deadTokens } } });
    logger.info(`Removed ${deadTokens.length} dead FCM tokens for user ${userId}`);
  }
});

// ─── Order job processor ──────────────────────────────────────────────────────
orderQueue.process(async (job) => {
  const { type, orderId, userId, amount } = job.data;

  // ── 1. Auto-cancel unpaid digital orders after 15 minutes ─────────────────
  if (type === "auto_cancel_unpaid") {
    const Order = require("../models/Order");
    const order = await Order.findById(orderId);
    if (!order) return;
    // Only cancel if still pending + unpaid (customer may have paid in the meantime)
    if (order.status === "pending" && order.paymentStatus !== "paid") {
      order.status      = "cancelled";
      order.cancelReason = "Order auto-cancelled: payment not completed within 15 minutes.";
      await order.save();
      logger.info(`Auto-cancelled unpaid order ${order.orderNumber}`);

      // Notify customer
      if (order.customer) {
        await addNotificationJob({
          userId: order.customer.toString(),
          title:  "Order Cancelled",
          body:   `Order ${order.orderNumber} was cancelled because payment wasn't completed.`,
          data:   { orderId, type: "order_cancelled" },
        });
      }
    }
    return;
  }

  // ── 2. Award loyalty points (0.5 pts per Rs. 100 spent) ─────────
  if (type === "loyalty_points") {
    const User = require("../models/User");
    // 0.5 Rs per 100 Rs is a 0.5% earning rate
    const points = Number(((amount || 0) * 0.005).toFixed(2));
    if (points > 0) {
      await User.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: points } });
      logger.info(`Awarded ${points} loyalty points to user ${userId} for order ${orderId}`);
    }
    return;
  }

  // ── 3. Notify delivery person when order status is "ready" ─────────────────
  if (type === "notify_delivery") {
    const { emitDeliveryAssignment } = require("../config/socket");
    const Order = require("../models/Order");
    const User  = require("../models/User");
    const { sendOrderStatusSMS } = require("../services/sms.service");

    const order = await Order.findById(orderId).populate("deliveryPerson", "phone fcmTokens");
    if (!order?.deliveryPerson) return;

    // Socket.IO real-time ping
    emitDeliveryAssignment(order.deliveryPerson._id.toString(), order);

    // SMS fallback
    if (order.deliveryPerson.phone) {
      await sendOrderStatusSMS(order.deliveryPerson.phone, order.orderNumber, "ready_for_pickup").catch(() => {});
    }

    // FCM push
    if (order.deliveryPerson.fcmTokens?.length) {
      const { sendPushNotification } = require("../services/fcm.service");
      for (const token of order.deliveryPerson.fcmTokens) {
        await sendPushNotification(token, "Order Ready for Pickup", `Order #${order.orderNumber} is ready`, { orderId }).catch(() => {});
      }
    }
    return;
  }

  // ── 4. Referral Reward ────────────────────────────────────────────────────────
  if (type === "referral_reward") {
    const User = require("../models/User");
    const Coupon = require("../models/Coupon");
    
    const user = await User.findById(userId);
    if (!user || !user.referredBy) return;

    const referrer = await User.findById(user.referredBy);
    if (!referrer) return;

    const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await Coupon.create({
      code,
      description: `Referral reward for referring ${user.name}`,
      discountType: "flat",
      discountValue: 50,
      usageLimit: 1,
      perUserLimit: 1,
    });

    await addNotificationJob({
      userId: referrer._id.toString(),
      title: "Referral Reward Earned! 🎉",
      body: `Your friend ${user.name} made their first order! Use coupon ${code} for Rs. 50 off your next order.`,
      data: { type: "referral_reward", code },
    });
    
    logger.info(`Referral reward generated for ${referrer._id} (referred ${user._id})`);
    return;
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const addNotificationJob = (data, delay = 0) =>
  notificationQueue.add(data, { delay, attempts: 3, backoff: 5000 });

/**
 * Schedule auto-cancel for an unpaid digital order.
 * Call this in order.controller.js right after order creation when paymentMethod != "cod".
 */
const scheduleAutoCancel = (orderId) =>
  orderQueue.add(
    { type: "auto_cancel_unpaid", orderId: orderId.toString() },
    { delay: 15 * 60 * 1000, attempts: 2 }   // 15 minutes
  );

const scheduleDeliveryNotification = (orderId) =>
  orderQueue.add({ type: "notify_delivery", orderId: orderId.toString() }, { delay: 0, attempts: 2 });

const scheduleLoyaltyPoints = (orderId, userId, amount) =>
  orderQueue.add({ type: "loyalty_points", orderId: orderId.toString(), userId: userId.toString(), amount }, { delay: 0, attempts: 2 });

const scheduleReferralReward = (userId) =>
  orderQueue.add({ type: "referral_reward", userId: userId.toString() }, { delay: 0, attempts: 2 });

// ─── Redis distributed lock helper ────────────────────────────────────────────
async function acquireLock(key, ttlSeconds) {
  const { getRedis } = require("../config/redis");
  const result = await getRedis().set(key, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
}

// ─── Cron: subscription expiry — 00:15 NPT (18:30 UTC) ───────────────────────
cron.schedule("30 18 * * *", async () => {
  if (!(await acquireLock("cron:sub-expiry", 300))) return;
  try {
    const Subscription = require("../models/Subscription");
    const result = await Subscription.updateMany(
      { status: "active", endDate: { $lt: new Date() } },
      { status: "expired" }
    );
    if (result.modifiedCount > 0)
      logger.info(`[CRON] Expired ${result.modifiedCount} subscriptions`);
  } catch (err) {
    logger.error(`[CRON] Subscription expiry failed: ${err.message}`);
  }
});

// ─── Cron: OTP cleanup — 01:00 NPT (19:15 UTC) ───────────────────────────────
// Delete "pending" (unverified) user records whose OTP has expired.
// These are created in sendRegistrationOtp but never verified.
cron.schedule("15 19 * * *", async () => {
  if (!(await acquireLock("cron:otp-cleanup", 300))) return;
  try {
    const User = require("../models/User");
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    // Unverified placeholder accounts where OTP expired > 15 min ago
    const result = await User.deleteMany({
      isPhoneVerified: false,
      isActive: false,
      otpExpiry: { $lt: fifteenMinsAgo },
    });
    if (result.deletedCount > 0)
      logger.info(`[CRON] Cleaned up ${result.deletedCount} expired OTP placeholder accounts`);
  } catch (err) {
    logger.error(`[CRON] OTP cleanup failed: ${err.message}`);
  }
});

// ─── Cron: subscription pause extension — 00:30 NPT (18:45 UTC) ──────────────
// For paused subscriptions, extend endDate by 1 day each day they remain paused.
// This gives subscribers back the time they missed while paused.
cron.schedule("45 18 * * *", async () => {
  if (!(await acquireLock("cron:pause-extension", 300))) return;
  try {
    const Subscription = require("../models/Subscription");
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const paused = await Subscription.find({ status: "paused", endDate: { $gt: new Date() } });
    let extended = 0;
    for (const sub of paused) {
      sub.endDate = new Date(sub.endDate.getTime() + ONE_DAY_MS);
      await sub.save({ validateBeforeSave: false });
      extended++;
    }
    if (extended > 0)
      logger.info(`[CRON] Extended endDate for ${extended} paused subscriptions`);
  } catch (err) {
    logger.error(`[CRON] Pause extension failed: ${err.message}`);
  }
});

// ─── Cron: closed-date advance notifications — 8:00 AM NPT (2:15 UTC) ────────
cron.schedule("15 2 * * *", async () => {
  if (!(await acquireLock("cron:closed-date-notify", 300))) return;
  try {
    const ClosedDate = require("../models/ClosedDate");
    const User = require("../models/User");
    const { sendMulticastPush } = require("../services/fcm.service");
    const { sendSMS } = require("../services/sms.service");
    const { getTodayNP } = require("../utils/nepaliTime");

    const today = getTodayNP();
    const upcoming = await ClosedDate.find({ isActive: true, notificationSentAt: null });

    for (const closed of upcoming) {
      const daysUntil = Math.ceil(
        (new Date(closed.date) - new Date(today)) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil !== closed.notifyDaysBefore) continue;

      const title = "Kitchen Closed Notice 🙏";
      const body = `Gharko Swad will be closed on ${closed.date} for ${closed.reason}. Please plan your orders accordingly.`;

      const users = await User.find(
        { isActive: true, "fcmTokens.0": { $exists: true } },
        { fcmTokens: 1 }
      );
      const allTokens = users.flatMap((u) => u.fcmTokens).filter(Boolean);
      if (allTokens.length) {
        for (let i = 0; i < allTokens.length; i += 500) {
          await sendMulticastPush(
            allTokens.slice(i, i + 500), title, body,
            { type: "kitchen_closed", date: closed.date, reason: closed.reason }
          ).catch(() => {});
        }
      }

      const customers = await User.find(
        { isActive: true, role: "customer", isPhoneVerified: true },
        { phone: 1 }
      );
      for (const customer of customers) {
        await sendSMS(customer.phone, body).catch(() => {});
      }

      closed.notificationSentAt = new Date();
      await closed.save({ validateBeforeSave: false });
      logger.info(`[CRON] Closed-date notification sent for ${closed.date} (${closed.reason}) — ${allTokens.length} push, ${customers.length} SMS`);
    }
  } catch (err) {
    logger.error(`[CRON] Closed-date notification failed: ${err.message}`);
  }
});  

// ─── Cron: subscription expiry reminder — 8:05 AM NPT (2:20 UTC) ─────────────
// Sends FCM push + SMS reminders to customers whose subscription
// expires in 3 days (early warning) or 1 day (final warning).
cron.schedule("20 2 * * *", async () => {
  if (!(await acquireLock("cron:sub-reminder", 300))) return;
  try {
    const Subscription = require("../models/Subscription");
    const User = require("../models/User");
    const { sendPushNotification } = require("../services/fcm.service");
    const { sendSMS } = require("../services/sms.service");

    const now = new Date();

    // Check both 3-day and 1-day windows
    for (const daysLeft of [3, 1]) {
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + daysLeft);
      windowStart.setHours(0, 0, 0, 0);

      const windowEnd = new Date(windowStart);
      windowEnd.setHours(23, 59, 59, 999);

      const expiring = await Subscription.find({
        status: "active",
        endDate: { $gte: windowStart, $lte: windowEnd },
      }).populate("customer", "name phone fcmTokens").populate("plan", "name");

      for (const sub of expiring) {
        if (!sub.customer) continue;

        const title = daysLeft === 1
          ? "⚠️ Subscription Expires Tomorrow!"
          : "📅 Subscription Expiring Soon";

        const body = daysLeft === 1
          ? `${sub.customer.name}, your ${sub.plan?.name || "meal plan"} subscription expires tomorrow. Renew now to keep enjoying your meals!`
          : `${sub.customer.name}, your ${sub.plan?.name || "meal plan"} subscription expires in 3 days. Renew soon to avoid interruption!`;

        // FCM push to all customer devices
        if (sub.customer.fcmTokens?.length) {
          for (const token of sub.customer.fcmTokens) {
            await sendPushNotification(token, title, body, {
              type: "subscription_expiry",
              subscriptionId: sub._id.toString(),
              daysLeft: String(daysLeft),
            }).catch(() => {});
          }
        }

        // SMS fallback
        await sendSMS(sub.customer.phone, body).catch(() => {});

        logger.info(`[CRON] Sub expiry reminder sent to ${sub.customer.phone} (${daysLeft} days left)`);
      }
    }
  } catch (err) {
    logger.error(`[CRON] Sub expiry reminder failed: ${err.message}`);
  }
});

module.exports = {
  notificationQueue,
  orderQueue,
  addNotificationJob,
  scheduleAutoCancel,
  scheduleDeliveryNotification,
  scheduleLoyaltyPoints,
  scheduleReferralReward,
};
// -- Cron: Rate Your Meal Reminder (Every 15 mins) --
cron.schedule('*/15 * * * *', async () => {
  if (!(await acquireLock('cron:rate-meal', 300))) return;
  try {
    const Order = require('../models/Order');
    const User = require('../models/User');
    const { sendPushNotification } = require('../services/fcm.service');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const twoAndHalfHoursAgo = new Date(Date.now() - 2.5 * 60 * 60 * 1000);

    const orders = await Order.find({
      status: 'delivered',
      actualDeliveredAt: { $gte: twoAndHalfHoursAgo, $lte: twoHoursAgo },
      reviewNotified: false,
    }).populate('customer', 'fcmTokens');

    for (const order of orders) {
      if (order.customer?.fcmTokens?.length) {
        for (const token of order.customer.fcmTokens) {
          await sendPushNotification(token, 'How was your meal? ??', 'Tap to rate your recent order and share your feedback!', { orderId: String(order._id), type: 'rate_meal' }).catch(() => {});
        }
      }
      order.reviewNotified = true;
      await order.save({ validateBeforeSave: false });
    }
  } catch (err) {
    require('../utils/logger').logger.error("[CRON] Rate meal reminder failed: ");
  }
});

// -- Cron: Abandoned Cart Reminder (Every 15 mins) --
cron.schedule('*/15 * * * *', async () => {
  if (!(await acquireLock('cron:abandoned-cart', 300))) return;
  try {
    const User = require('../models/User');
    const { sendMulticastPush } = require('../services/fcm.service');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneAndHalfHoursAgo = new Date(Date.now() - 90 * 60 * 1000);

    const users = await User.find({
      hasItemsInCart: true,
      abandonedCartNotified: false,
      lastCartUpdate: { $gte: oneAndHalfHoursAgo, $lte: oneHourAgo }
    });

    for (const user of users) {
      if (user.fcmTokens?.length) {
        await sendMulticastPush(user.fcmTokens, 'You left something delicious! ??', 'Complete your order now before you get too hungry.', { type: 'abandoned_cart' });
      }
      user.abandonedCartNotified = true;
      await user.save({ validateBeforeSave: false });
    }
  } catch (err) {
    require('../utils/logger').logger.error("[CRON] Abandoned cart reminder failed: ");
  }
});

