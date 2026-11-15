// Client-side synchronization manager for Maya tasks, reminders, habits & activity

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

    try {
      const targetUrl = (serverUrl || window.location.origin).replace(/\/$/, '');
      const response = await fetch(`${targetUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return { ok: false, error: errJson.error || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return {
        ok: true,
        tasks: data.tasks,
        reminders: data.reminders,
        habits: data.habits,
        settings: data.settings,
        serverTime: data.serverTime,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network disconnected' };
    }
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
      await fetch(`${targetUrl}/api/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ source: 'client_active' }),
      });
    } catch (e) {
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

    try {
      const targetUrl = (serverUrl || window.location.origin).replace(/\/$/, '');
      const response = await fetch(`${targetUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, history, mode }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        return { ok: false, error: data.error || 'Server AI call failed.' };
      }

      return { ok: true, reply: data.reply };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error reaching server proxy.' };
    }
  }

  /**
   * Wipe all user data stored on the server
   */
  public static async purgeServerData(
    serverUrl: string,
    token: string
  ): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const targetUrl = (serverUrl || window.location.origin).replace(/\/$/, '');
      const response = await fetch(`${targetUrl}/api/data/reset`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        return { ok: false, error: data.error || 'Failed to wipe server data.' };
      }
      return { ok: true, message: data.message };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error' };
    }
  }
}
