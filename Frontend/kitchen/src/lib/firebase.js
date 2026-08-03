import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import api from "../utils/axios";

const firebaseConfig = {
  apiKey: "AIzaSyDGaunleSwadFirebaseKey",
  authDomain: "gaunleswad-1a42b.firebaseapp.com",
  projectId: "gaunleswad-1a42b",
  storageBucket: "gaunleswad-1a42b.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
};

let messagingInstance = null;

export function initFCM() {
  try {
    const app = initializeApp(firebaseConfig);
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (e) {
    console.warn("Firebase init failed:", e);
    return null;
  }
}

/**
 * Request notification permission + register FCM token with the backend.
 */
export async function requestNotificationPermission() {
  try {
    if (!("Notification" in window)) return;
    
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return;
    }

    if (!messagingInstance) initFCM();
    if (!messagingInstance) return;

    // Register the service worker first
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messagingInstance, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || "",
      serviceWorkerRegistration: registration,
    });

    if (token) {
      // Send to backend to store
      await api.post("/auth/fcm-token", { fcmToken: token });
      console.log("FCM token registered");
    }
  } catch (error) {
    console.warn("FCM registration failed:", error);
  }
}

/**
 * Listen for foreground messages (when app is open).
 */
export function onForegroundMessage(callback) {
  if (!messagingInstance) return () => {};
  return onMessage(messagingInstance, (payload) => {
    callback(payload);
  });
}
