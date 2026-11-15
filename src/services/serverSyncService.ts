// Client-side synchronization manager for Maya tasks, reminders, habits & activity
import { safeFetchJson } from '../utils/safeFetch';

export interface SyncPayload {
  tasks?: any[];
  reminders?: any[];
  habits?: any[];
  settings?: Record<string, any>;
}

export interface SyncResult {
  ok: boolean;
  tasks?: any[];
  reminders?: any[];
  habits?: any[];
  settings?: any;
  serverTime?: number;
  error?: string;
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

export class ServerSyncService {
  private static syncTimeout: any = null;
  private static lastActivityReported = 0;

  /**
   * Perform bidirectional sync with the server
   */
  public static async sync(
    serverUrl: string,
    token: string,
    payload: SyncPayload
  ): Promise<SyncResult> {
    if (!token) {
      return { ok: false, error: 'No backend token configured.' };
    }

    const targetUrl = (serverUrl || window.location.origin).replace(/\/$/, '');
    const res = await safeFetchJson(`${targetUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.data) {
      return { ok: false, error: res.error || `HTTP ${res.status}` };
    }

    const data = res.data;
    return {
      ok: true,
      tasks: data.tasks,
      reminders: data.reminders,
      habits: data.habits,
      settings: data.settings,
      serverTime: data.serverTime,
    };
  }

  /**
   * Report user activity to backend to reset check-in counters and backoff
   */
  public static async reportActivity(serverUrl: string, token: string): Promise<void> {
    const now = Date.now();
    // Throttle activity pings to once every 30 seconds
    if (now - this.lastActivityReported < 30000) return;
    this.lastActivityReported = now;

    if (!token) return;

    try {
      const targetUrl = (serverUrl || window.location.origin).replace(/\/$/, '');
      await safeFetchJson(`${targetUrl}/api/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ source: 'client_active' }),
      });
    } catch {
      // Quiet fail if offline
    }
  }

  /**
   * Forward a chat request through the secure server-side Gemini proxy
   */
  public static async proxyChat(
    serverUrl: string,
    token: string,
    message: string,
    history: any[] = [],
    mode: string = 'COMMAND'
  ): Promise<{ ok: boolean; reply?: string; error?: string }> {
    if (!token) {
      return { ok: false, error: 'Server token is required to use the server AI proxy.' };
    }

    const targetUrl = (serverUrl || window.location.origin).replace(/\/$/, '');
    const res = await safeFetchJson(`${targetUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, history, mode }),
    });

    if (!res.ok || !res.data?.ok) {
      return { ok: false, error: res.error || res.data?.error || 'Server AI call failed.' };
    }

    return { ok: true, reply: res.data.reply };
  }

  /**
   * Wipe all user data stored on the server
   */
  public static async purgeServerData(
    serverUrl: string,
    token: string
  ): Promise<{ ok: boolean; message?: string; error?: string }> {
    const targetUrl = (serverUrl || window.location.origin).replace(/\/$/, '');
    const res = await safeFetchJson(`${targetUrl}/api/data/reset`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok || !res.data?.ok) {
      return { ok: false, error: res.error || res.data?.error || 'Failed to wipe server data.' };
    }
    return { ok: true, message: res.data.message };
  }
}
