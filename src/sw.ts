/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
try {
  precacheAndRoute(self.__WB_MANIFEST || []);
} catch (e) {
  // If no manifest during dynamic dev compilation
}

// In-memory credential cache inside service worker
let cachedServerToken = '';
let cachedServerUrl = '';
let cachedVapidKey = '';

// IndexedDB Helper to read credentials and queue offline acks
const DB_NAME = 'maya_sw_store';
const STORE_NAME = 'credentials';
const QUEUE_STORE = 'offline_acks';

function openSwDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredValue(key: string): Promise<string> {
  try {
    const db = await openSwDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || '');
      req.onerror = () => resolve('');
    });
  } catch (e) {
    return '';
  }
}

async function setStoredValue(key: string, value: string): Promise<void> {
  try {
    const db = await openSwDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {}
}

async function queueOfflineAck(item: { id: string; action: string }): Promise<void> {
  try {
    const db = await openSwDb();
    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      store.add({ ...item, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {}
}

async function flushOfflineAcks(): Promise<void> {
  try {
    const serverUrl = cachedServerUrl || (await getStoredValue('serverUrl'));
    const token = cachedServerToken || (await getStoredValue('token'));
    if (!serverUrl || !token) return;

    const db = await openSwDb();
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.getAll();

    req.onsuccess = async () => {
      const items = req.result || [];
      for (const item of items) {
        try {
          await fetch(`${serverUrl}/api/push/ack`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ id: item.id, action: item.action }),
          });
          const delTx = db.transaction(QUEUE_STORE, 'readwrite');
          delTx.objectStore(QUEUE_STORE).delete(item.id);
        } catch (err) {
          break; // Stop and retry later if network still down
        }
      }
    };
  } catch (e) {}
}

// Listen for messages from client page
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_CREDENTIALS') {
    cachedServerToken = event.data.token || '';
    cachedServerUrl = event.data.serverUrl || '';
    cachedVapidKey = event.data.vapidKey || '';
    setStoredValue('token', cachedServerToken);
    setStoredValue('serverUrl', cachedServerUrl);
    setStoredValue('vapidKey', cachedVapidKey);
  } else if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ----------------------------------------------------
// 1. PUSH EVENT HANDLER
// ----------------------------------------------------
self.addEventListener('push', (event) => {
  let payload: any = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'Maya Assistant', body: event.data.text() };
    }
  }

  const title = payload.title || 'Maya Assistant';
  const options: any = {
    body: payload.body || 'You have a pending notification.',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/icon.svg',
    tag: payload.tag || `maya-push-${Date.now()}`,
    data: payload.data || {},
    requireInteraction: payload.requireInteraction !== undefined ? payload.requireInteraction : false,
    actions: payload.actions || [{ action: 'open', title: 'Open' }],
  };

  event.waitUntil(
    (async () => {
      // Deduplicate: If app is currently open and focused, notify in-app instead of OS banner
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const focusedClient = windowClients.find((c) => c.focused);
      if (focusedClient) {
        focusedClient.postMessage({
          type: 'MAYA_PUSH_ARRIVED',
          payload,
        });
        return;
      }

      await self.registration.showNotification(title, options);
    })()
  );
});

// ----------------------------------------------------
// 2. NOTIFICATION CLICK & ACTION CLICK HANDLER
// ----------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action || 'open';
  const data = event.notification.data || {};
  const id = data.reminderId || data.taskId || data.id;

  event.waitUntil(
    (async () => {
      // Handle Done / Snooze 15 actions directly without opening browser window
      if (action === 'done' || action === 'snooze_15') {
        const serverUrl = cachedServerUrl || (await getStoredValue('serverUrl'));
        const token = cachedServerToken || (await getStoredValue('token'));

        if (serverUrl && token) {
          try {
            await fetch(`${serverUrl}/api/push/ack`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ id, action }),
            });
          } catch (err) {
            await queueOfflineAck({ id, action });
          }
        } else {
          await queueOfflineAck({ id, action });
        }
        return;
      }

      // Handle Open or clicking notification body
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        if ('focus' in client) {
          if (data.prefill) {
            client.postMessage({ type: 'MAYA_PREFILL_PROMPT', prompt: data.prefill });
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        const urlToOpen = data.prefill ? `/?prefill=${encodeURIComponent(data.prefill)}` : '/';
        return self.clients.openWindow(urlToOpen);
      }
    })()
  );
});

// ----------------------------------------------------
// 3. BACKGROUND SYNC HANDLER (FOR OFFLINE ACKS)
// ----------------------------------------------------
self.addEventListener('sync' as any, (event: any) => {
  if (event.tag === 'maya-ack-sync') {
    event.waitUntil(flushOfflineAcks());
  }
});

// ----------------------------------------------------
// 4. PUSH SUBSCRIPTION CHANGE HANDLER
// ----------------------------------------------------
self.addEventListener('pushsubscriptionchange' as any, (event: any) => {
  event.waitUntil(
    (async () => {
      const serverUrl = cachedServerUrl || (await getStoredValue('serverUrl'));
      const token = cachedServerToken || (await getStoredValue('token'));
      const vapidKey = cachedVapidKey || (await getStoredValue('vapidKey'));

      if (!serverUrl || !token || !vapidKey) return;

      try {
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });

        await fetch(`${serverUrl}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subscription: newSub }),
        });
      } catch (err) {
        console.error('[SW] Failed to resubscribe after subscription change:', err);
      }
    })()
  );
});
