// Firebase Messaging Service Worker for background push notifications

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDGaunleSwadFirebaseKey",
  authDomain: "gaunleswad-1a42b.firebaseapp.com",
  projectId: "gaunleswad-1a42b",
  storageBucket: "gaunleswad-1a42b.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const options = {
    body: body || "You have a new notification",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [200, 100, 200],
    tag: "order-notification",
    renotify: true,
  };
  self.registration.showNotification(title || "Gaunle Swad", options);
});
