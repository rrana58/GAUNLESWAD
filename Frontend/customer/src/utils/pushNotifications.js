import { PushNotifications } from '@capacitor/push-notifications';
import { isCapacitorNative } from '@shared/auth/roleRedirect';
import api from '@/api/axios';
import { toast } from 'sonner';

// Module-level flag — survives re-renders, resets on full page reload (which
// is fine: the native layer also re-initialises on a hard reload).
let _initialized = false;

export async function initPushNotifications(navigate) {
  if (!isCapacitorNative()) {
    return; // PWA / web: push handled by service-worker, not Capacitor
  }

  if (_initialized) {
    // Already registered — Capacitor will fire 'registration' again if the
    // token rotates, so we don't need to re-add listeners.
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] Permission not granted for push notifications.');
      return;
    }

    // Mark before adding listeners so a rapid double-call doesn't race
    _initialized = true;

    // Register with the OS — fires 'registration' listener with the FCM token
    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNotifications] FCM Device Token (Customer):', token.value);
      try {
        await api.post('/auth/fcm-token', { fcmToken: token.value });
        console.log('[PushNotifications] FCM token registered with backend.');
      } catch (err) {
        console.error('[PushNotifications] Failed to send FCM token to backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotifications] Registration error:', error);
    });

    // Show in-app toast when app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      toast.info(notification.title || 'Gaunle Swad Alert', {
        description: notification.body || '',
      });
    });

    // Navigate on tap when app is backgrounded / killed
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      const data = notification.notification?.data;
      if (!navigate) return;
      if (data?.orderId) {
        navigate(`/track/${data.orderId}`);
      } else if (data?.type === 'abandoned_cart') {
        navigate('/cart');
      } else if (
        data?.type === 'weather_promo' ||
        data?.type === 'session_promo' ||
        data?.type === 'announcement' ||
        data?.type === 'broadcast'
      ) {
        navigate('/');
      } else {
        navigate('/orders');
      }
    });
  } catch (error) {
    // Reset so a retry after a transient error is possible
    _initialized = false;
    console.error('[PushNotifications] Failed to initialise customer push notifications:', error);
  }
}

/** Call on logout so the next login re-registers cleanly. */
export function resetPushNotifications() {
  _initialized = false;
}