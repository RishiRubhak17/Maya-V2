// public/sw.js - Maya PWA Service Worker for Web Push & Offline Support

const CACHE_NAME = 'maya-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

// In-memory credential cache
let cachedServerToken = '';
let cachedServerUrl = '';
let cachedVapidKey = '';

const DB_NAME = 'maya_sw_store';
const STORE_NAME = 'credentials';
const QUEUE_STORE = 'offline_acks';

function openSwDb() {
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

async function getStoredValue(key) {
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

async function setStoredValue(key, value) {
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

async function queueOfflineAck(item) {
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

async function flushOfflineAcks() {
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
          break;
        }
      }
    };
  } catch (e) {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

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
// PUSH EVENT
// ----------------------------------------------------
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'Maya Assistant', body: event.data.text() };
    }
  }

  const title = payload.title || 'Maya Assistant';
  const options = {
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
      // In-app deduplication
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
// NOTIFICATION CLICK & ACTION CLICK
// ----------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action || 'open';
  const data = event.notification.data || {};
  const id = data.reminderId || data.taskId || data.id;

  event.waitUntil(
    (async () => {
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
// BACKGROUND SYNC
// ----------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'maya-ack-sync') {
    event.waitUntil(flushOfflineAcks());
  }
});
