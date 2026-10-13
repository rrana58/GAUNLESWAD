import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isCapacitorNative } from '@shared/auth/roleRedirect';
import api from '@/api/axios';
import { toast } from 'sonner';

let _initialized = false;

export async function initPushNotifications(navigate) {
  if (!isCapacitorNative() || _initialized) return;

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] Permission not granted.');
      return;
    }

    // Create a dedicated channel for foreground push notifications.
    // Android controls the channel's sound through system notification settings.
    try {
      await LocalNotifications.createChannel({
        id: 'gaunleswad_alerts_v1',
        name: 'Gaunle Swad Alerts',
        description: 'Order updates and other app notifications',
        importance: 4,
        visibility: 1,
        sound: 'default',
      });
    } catch (error) {
      console.warn('[PushNotifications] Channel setup warning:', error);
    }

    _initialized = true;

    // Register every listener before registering with the operating system.
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNotifications] FCM token received.');
      try {
        await api.post('/auth/fcm-token', { fcmToken: token.value });
        console.log('[PushNotifications] FCM token registered with backend.');
      } catch (error) {
        console.error('[PushNotifications] Failed to register FCM token:', error);
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotifications] Registration error:', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      const title = notification.title || 'Gaunle Swad Alert';
      const body = notification.body || '';

      toast.info(title, { description: body });

      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Date.now() % 2147483647),
            title,
            body,
            channelId: 'gaunleswad_alerts_v1',
            schedule: { at: new Date(Date.now() + 1000) },
            extra: notification.data || {},
          }],
        });
      } catch (error) {
        console.error('[PushNotifications] Foreground local notification failed:', error);
      }
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
      const data = event.notification?.data;
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

    await PushNotifications.register();
    console.log('[PushNotifications] Registration requested.');
  } catch (error) {
    _initialized = false;
    console.error('[PushNotifications] Initialization failed:', error);
  }
}

export function resetPushNotifications() {
  _initialized = false;
}
