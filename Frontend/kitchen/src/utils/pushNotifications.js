import { PushNotifications } from '@capacitor/push-notifications';
import { isCapacitorNative } from '@shared/auth/roleRedirect';
import api from '../utils/axios';
import { toast } from 'sonner';

/**
 * Initialize Push Notifications for Kitchen app.
 * Called after successful kitchen staff login.
 * Registers FCM token with POST /api/v1/auth/fcm-token,
 * displays foreground toasts, and routes notification taps.
 */
export async function initPushNotifications(navigate) {
  if (!isCapacitorNative()) {
    console.log('[PushNotifications] Skipping push notification setup on web platform.');
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

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNotifications] FCM Device Token (Kitchen):', token.value);
      try {
        await api.post('/auth/fcm-token', { fcmToken: token.value });
        console.log('[PushNotifications] Kitchen FCM token successfully registered with backend.');
      } catch (err) {
        console.error('[PushNotifications] Failed to send kitchen FCM token to backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotifications] Registration Error (Kitchen):', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNotifications] Kitchen Order Push received:', notification);
      toast.info(notification.title || 'New Kitchen Alert', {
        description: notification.body || '',
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[PushNotifications] Push Action performed:', notification);
      if (navigate) {
        navigate('/');
      }
    });
  } catch (error) {
    console.error('[PushNotifications] Failed to initialize kitchen push notifications:', error);
  }
}
