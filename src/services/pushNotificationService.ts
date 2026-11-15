// Client-side Web Push Manager for Maya

export const DEFAULT_VAPID_PUBLIC_KEY =
  'BGqZgwy9Y_9QIQ_jBtBPZz8T8xcREiZZOVSGihyZDxaGVl2EhVUNMYjTS4tHyXTqjlDI2xi-f2lNV3z8uAGZ39U';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushStatus = 'subscribed' | 'unsubscribed' | 'blocked' | 'unsupported' | 'loading';

export class PushNotificationService {
  /**
   * Determine current push readiness
   */
  public static async getStatus(): Promise<PushStatus> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'unsupported';
    }

    if (Notification.permission === 'denied') {
      return 'blocked';
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return sub ? 'subscribed' : 'unsubscribed';
    } catch (e) {
      return 'unsubscribed';
    }
  }

  /**
   * Request permission and subscribe to Web Push using VAPID
   */
  public static async subscribe(
    serverUrl: string = '',
    serverToken: string = '',
    vapidKey: string = DEFAULT_VAPID_PUBLIC_KEY
  ): Promise<{ ok: boolean; error?: string }> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, error: 'Web Push is not supported in this browser.' };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { ok: false, error: 'Notification permission was denied or dismissed.' };
      }

      // Ensure service worker is active
      const reg = await navigator.serviceWorker.ready;

      // Subscribe via PushManager
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource,
        });
      }

      // Sync credentials to the service worker
      if (reg.active) {
        reg.active.postMessage({
          type: 'SET_CREDENTIALS',
          token: serverToken,
          serverUrl: serverUrl,
          vapidKey: vapidKey,
        });
      }

      // Send subscription to server
      const targetUrl = serverUrl.replace(/\/$/, '');
      const response = await fetch(`${targetUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serverToken}`,
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        return { ok: false, error: data.error || 'Server rejected push subscription.' };
      }

      return { ok: true };
    } catch (err: any) {
      console.error('[PushService] Subscribe error:', err);
      return { ok: false, error: err?.message || 'Failed to activate background notifications.' };
    }
  }

  /**
   * Unsubscribe from Web Push
   */
  public static async unsubscribe(
    serverUrl: string = '',
    serverToken: string = ''
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      if (!('serviceWorker' in navigator)) return { ok: true };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        const targetUrl = serverUrl.replace(/\/$/, '');
        await fetch(`${targetUrl}/api/push/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serverToken}`,
          },
          body: JSON.stringify({ endpoint }),
        });
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message };
    }
  }

  /**
   * Dispatch instant test push from server
   */
  public static async sendTestPush(
    serverUrl: string = '',
    serverToken: string = ''
  ): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const targetUrl = serverUrl.replace(/\/$/, '');
      const res = await fetch(`${targetUrl}/api/push/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serverToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Server failed to send test notification.' };
      }
      return { ok: true, message: data.message };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error reaching backend.' };
    }
  }
}
