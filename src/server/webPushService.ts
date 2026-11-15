import webpush from 'web-push';
import { subscriptionModel, pushLogModel, settingsModel, type PushSubscriptionRow } from './db.ts';

// Default VAPID details (fallback to generated pair if environment variables not yet set)
export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BGqZgwy9Y_9QIQ_jBtBPZz8T8xcREiZZOVSGihyZDxaGVl2EhVUNMYjTS4tHyXTqjlDI2xi-f2lNV3z8uAGZ39U';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'RY62yAu_Nb6FMt_Pu4Kz9D8wVTg4vYvFzU2uZPfHcXQ';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:sirius@axiomsecurecrafts.com';

// Configure Web Push with VAPID credentials
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[WebPush] VAPID details initialized successfully.');
} catch (err: any) {
  console.error('[WebPush] Failed to set VAPID details:', err?.message || err);
}

export interface PushPayload {
  title: string;
  body: string;
  kind: 'reminder' | 'task_deadline' | 'morning_briefing' | 'evening_review' | 'checkin' | 'test';
  id?: string;
  actions?: Array<{ action: string; title: string }>;
  data?: Record<string, any>;
  badge?: string;
  icon?: string;
  tag?: string;
  timestamp?: number;
  requireInteraction?: boolean;
}

export class WebPushService {
  /**
   * Send a push notification to all stored subscriptions with error handling,
   * 404/410 unregistration cleanup, and audit logging.
   */
  public static async broadcast(payload: PushPayload): Promise<{
    sent: number;
    failed: number;
    cleaned: number;
  }> {
    const subscriptions = subscriptionModel.getAll();
    if (subscriptions.length === 0) {
      console.log('[WebPush] No active subscriptions to dispatch push notification.');
      return { sent: 0, failed: 0, cleaned: 0 };
    }

    const settings = settingsModel.get();
    let finalPayload = { ...payload };

    // Respect private notifications lock-screen privacy setting
    if (settings?.privateNotifications) {
      finalPayload = {
        ...payload,
        title: 'Maya Assistant',
        body: payload.kind === 'checkin' ? 'Maya sent you a check-in message.' : 'You have a pending notification.',
      };
    }

    const jsonString = JSON.stringify(finalPayload);
    let sent = 0;
    let failed = 0;
    let cleaned = 0;

    for (const sub of subscriptions) {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      let success = false;
      let lastError: any = null;

      // Retry up to 3 times for transient failures
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await webpush.sendNotification(pushConfig, jsonString, {
            TTL: 60 * 60, // 1 hour TTL
            urgency: payload.kind === 'reminder' ? 'high' : 'normal',
          });
          success = true;
          sent++;
          pushLogModel.record(payload.kind, finalPayload, 'success');
          break;
        } catch (err: any) {
          lastError = err;
          const statusCode = err?.statusCode || err?.status;

          // 404 Not Found or 410 Gone means the subscription is no longer valid (e.g. user uninstalled PWA or revoked permission)
          if (statusCode === 404 || statusCode === 410) {
            console.log(`[WebPush] Subscription expired or revoked (${statusCode}). Removing endpoint:`, sub.endpoint);
            subscriptionModel.delete(sub.endpoint);
            cleaned++;
            pushLogModel.record(payload.kind, finalPayload, `${statusCode}_unregistered`, err?.message);
            break;
          }

          if (attempt < 3) {
            // Exponential backoff wait (300ms, 900ms)
            await new Promise((resolve) => setTimeout(resolve, attempt * 300));
          }
        }
      }

      if (!success && lastError?.statusCode !== 404 && lastError?.statusCode !== 410) {
        failed++;
        pushLogModel.record(payload.kind, finalPayload, 'error', lastError?.message || String(lastError));
        console.warn('[WebPush] Dispatch error after retries:', lastError?.message || lastError);
      }
    }

    return { sent, failed, cleaned };
  }
}
