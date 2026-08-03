import { PushNotifications } from '@capacitor/push-notifications';
import { isCapacitorNative } from '@shared/auth/roleRedirect';
import api from '../utils/axios';
import { toast } from 'sonner';

/**
 * Initialize Push Notifications for Rider app.
 * Called after successful delivery rider login.
 * Registers FCM token with POST /api/v1/auth/fcm-token,
 * displays foreground toasts for new delivery alerts, and routes notification taps.
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
      console.warn('[PushNotifications] Permission not granted for rider push notifications.');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNotifications] FCM Device Token (Rider):', token.value);
      try {
        await api.post('/auth/fcm-token', { fcmToken: token.value });
        console.log('[PushNotifications] Rider FCM token successfully registered with backend.');
      } catch (err) {
        console.error('[PushNotifications] Failed to send rider FCM token to backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotifications] Registration Error (Rider):', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNotifications] New Delivery Push received:', notification);
      toast.info(notification.title || 'New Delivery Alert', {
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
    console.error('[PushNotifications] Failed to initialize rider push notifications:', error);
  }
}
