import { PushNotifications } from '@capacitor/push-notifications';
import { isCapacitorNative } from '@shared/auth/roleRedirect';
import api from '../utils/axios';
import { toast } from 'sonner';

// Module-level flag — prevents duplicate listener registration across re-renders.
let _initialized = false;

export async function initPushNotifications(navigate) {
  if (!isCapacitorNative()) {
    return; // Web/PWA — no Capacitor push setup needed
  }

  if (_initialized) {
    // Already registered; Capacitor will fire 'registration' again if the
    // OS rotates the token, no need to re-add listeners.
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] Permission not granted for kitchen push notifications.');
      return;
    }

    // Mark before adding listeners to prevent a race on rapid double-call
    _initialized = true;

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNotifications] FCM Device Token (Kitchen):', token.value);
      try {
        await api.post('/auth/fcm-token', { fcmToken: token.value });
        console.log('[PushNotifications] Kitchen FCM token registered with backend.');
      } catch (err) {
        console.error('[PushNotifications] Failed to send kitchen FCM token to backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotifications] Registration Error (Kitchen):', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      toast.info(notification.title || 'New Kitchen Alert', {
        description: notification.body || '',
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      if (navigate) {
        navigate('/');
      }
    });
  } catch (error) {
    _initialized = false; // Allow retry after transient failures
    console.error('[PushNotifications] Failed to initialize kitchen push notifications:', error);
  }
}

/** Call on logout so the next login re-registers cleanly. */
export function resetPushNotifications() {
  _initialized = false;
}
