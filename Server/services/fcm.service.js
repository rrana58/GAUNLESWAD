const admin = require("firebase-admin");
const logger = require("../utils/logger");

let firebaseApp;

const initFirebase = () => {
  if (firebaseApp) return firebaseApp;

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
    logger.warn("Firebase credentials not configured. Push notifications disabled.");
    return null;
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });

  logger.info("✅ Firebase initialized");
  return firebaseApp;
};

/**
 * Send push notification to a single device
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  try {
    if (!firebaseApp) initFirebase();
    if (!firebaseApp) return { success: false, error: "Firebase not configured" };

    const message = {
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { 
        priority: "high",
        notification: { sound: "default" }
      },
      apns: { payload: { aps: { badge: 1, sound: "default" } } },
    };

    await admin.messaging().send(message);
    return { success: true };
  } catch (error) {
    logger.error(`FCM error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple devices. Firebase's multicast API
 * hard-rejects calls with more than 500 tokens (throws, doesn't just
 * truncate) — chunks into batches of 500 so a broadcast to a growing user
 * base doesn't start failing outright once you cross that number.
 */
const sendMulticastPush = async (fcmTokens, title, body, data = {}) => {
  if (!fcmTokens?.length) return;
  try {
    if (!firebaseApp) initFirebase();
    if (!firebaseApp) return;

    const payloadData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
    const BATCH_SIZE = 500;
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < fcmTokens.length; i += BATCH_SIZE) {
      const batch = fcmTokens.slice(i, i + BATCH_SIZE);
      const message = {
        tokens: batch,
        notification: { title, body },
        data: payloadData,
        android: {
          priority: "high",
          notification: { sound: "default" }
        },
        apns: { payload: { aps: { badge: 1, sound: "default" } } },
      };
      const response = await admin.messaging().sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    logger.info(`FCM multicast: ${totalSuccess} sent, ${totalFailure} failed (${fcmTokens.length} total tokens)`);
  } catch (error) {
    logger.error(`FCM multicast error: ${error.message}`);
  }
};

/**
 * Send order status push notification to a user
 */
const sendOrderPush = async (user, orderNumber, status, orderId) => {
  if (!user?.fcmTokens?.length) return;

  const titles = {
    confirmed: "Order Confirmed! ✅",
    preparing: "Cooking Started 🍲",
    out_for_delivery: "On the Way! 🛵",
    delivered: "Order Delivered! 😋",
    cancelled: "Order Cancelled",
  };

  const bodies = {
    confirmed: `Your order ${orderNumber} is confirmed.`,
    preparing: `${orderNumber} is being prepared in the kitchen.`,
    out_for_delivery: `${orderNumber} is on the way to you!`,
    delivered: `${orderNumber} delivered. Enjoy your meal!`,
    cancelled: `Your order ${orderNumber} was cancelled.`,
  };

  const title = titles[status] || "Order Update";
  const body = bodies[status] || `Order ${orderNumber}: ${status}`;

  await sendMulticastPush(user.fcmTokens, title, body, { orderId: String(orderId), type: "order_update" });
};

module.exports = { initFirebase, sendPushNotification, sendMulticastPush, sendOrderPush };