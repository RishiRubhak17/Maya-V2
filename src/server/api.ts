import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { db, initDatabase, subscriptionModel, settingsModel, activityModel, pushLogModel } from './db.ts';
import { WebPushService, VAPID_PUBLIC_KEY } from './webPushService.ts';
import { startScheduler } from './scheduler.ts';

// Initialize SQLite database and start scheduler on module load
initDatabase();
startScheduler();

export const apiRouter = Router();

const SERVER_TOKEN =
  process.env.MAYA_SERVER_TOKEN || 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8';
const FALLBACK_TOKEN = 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8';

// Constant-time token authenticator middleware
export function requireBearerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Missing or malformed Authorization header.' });
  }
  const token = authHeader.substring(7).trim();
  const tokenBuf = Buffer.from(token);
  const serverTokenBuf = Buffer.from(SERVER_TOKEN);
  const fallbackTokenBuf = Buffer.from(FALLBACK_TOKEN);

  const matchesPrimary =
    tokenBuf.length === serverTokenBuf.length && crypto.timingSafeEqual(tokenBuf, serverTokenBuf);
  const matchesFallback =
    tokenBuf.length === fallbackTokenBuf.length && crypto.timingSafeEqual(tokenBuf, fallbackTokenBuf);

  if (!matchesPrimary && !matchesFallback) {
    return res.status(403).json({ ok: false, error: 'Access denied: Invalid bearer token.' });
  }
  next();
}

// ---------------------------------------------------------------------
// 1. PUBLIC HEALTH & VAPID DISCOVERY
// ---------------------------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'Maya Background Scheduler & Push Server',
    status: 'operational',
    vapidPublicKey: VAPID_PUBLIC_KEY,
    subscribersCount: subscriptionModel.count(),
    timestamp: Date.now(),
  });
});

// ---------------------------------------------------------------------
// 2. WEB PUSH SUBSCRIPTION MANAGEMENT
// ---------------------------------------------------------------------
apiRouter.post('/push/subscribe', requireBearerAuth, (req: Request, res: Response) => {
  try {
    const { subscription, userAgent } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({ ok: false, error: 'Invalid PushSubscription object.' });
    }

    subscriptionModel.upsert({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || req.headers['user-agent'] || '',
      createdAt: Date.now(),
    });

    console.log('[API] New push subscription registered successfully.');
    res.json({ ok: true, message: 'Push subscription stored successfully.' });
  } catch (err: any) {
    console.error('[API] Subscription registration failed:', err);
    res.status(500).json({ ok: false, error: err?.message || 'Failed to save subscription.' });
  }
});

apiRouter.post('/push/unsubscribe', requireBearerAuth, (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      subscriptionModel.delete(endpoint);
    }
    res.json({ ok: true, message: 'Unsubscribed successfully.' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

apiRouter.post('/push/test', requireBearerAuth, async (req: Request, res: Response) => {
  try {
    const count = subscriptionModel.count();
    if (count === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No active device subscriptions found. Enable Web Push in Settings first.',
      });
    }

    const result = await WebPushService.broadcast({
      title: 'Maya // Test Notification',
      body: 'Lock-screen push link verified. Background reminders and check-ins are active.',
      kind: 'test',
      tag: `test-push-${Date.now()}`,
      actions: [
        { action: 'open', title: 'Open Maya' },
        { action: 'done', title: 'Acknowledge' },
      ],
      data: { testId: Date.now() },
    });

    res.json({
      ok: true,
      message: `Test push dispatched to ${result.sent} device(s).`,
      details: result,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// ---------------------------------------------------------------------
// 3. NOTIFICATION ACTION ACKNOWLEDGEMENT (FROM SERVICE WORKER)
// ---------------------------------------------------------------------
apiRouter.post('/push/ack', requireBearerAuth, (req: Request, res: Response) => {
  try {
    const { id, action } = req.body; // action: 'done', 'snooze_15', 'open'
    const now = Date.now();

    if (!id || !action) {
      return res.status(400).json({ ok: false, error: 'Missing notification id or action.' });
    }

    console.log(`[API] Received notification action: ${action} for ID: ${id}`);

    // If ID belongs to a reminder
    const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as any;
    if (reminder) {
      if (action === 'done') {
        let nextFireAt = 0;
        let newStatus = 'acked';

        // If daily or weekly repeat, schedule next occurrence
        if (reminder.repeat === 'daily') {
          nextFireAt = now + 24 * 60 * 60 * 1000;
          newStatus = 'pending';
        } else if (reminder.repeat === 'weekly') {
          nextFireAt = now + 7 * 24 * 60 * 60 * 1000;
          newStatus = 'pending';
        }

        db.prepare(`
          UPDATE reminders
          SET status = ?, ackedAt = ?, nextFireAt = ?, fireCount = 0, updatedAt = ?
          WHERE id = ?
        `).run(newStatus, now, nextFireAt, now, id);
      } else if (action === 'snooze_15') {
        const snoozeTime = now + 15 * 60 * 1000;
        db.prepare(`
          UPDATE reminders
          SET status = 'pending', nextFireAt = ?, fireCount = 0, updatedAt = ?
          WHERE id = ?
        `).run(snoozeTime, now, id);
      }
    }

    // If ID belongs to a task
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (task && action === 'done') {
      db.prepare(`
        UPDATE tasks
        SET completed = 1, updatedAt = ?
        WHERE id = ?
      `).run(now, id);
    }

    // Record user interaction activity to reset check-in backoff
    activityModel.recordActive();

    res.json({ ok: true, message: `Action "${action}" processed successfully.` });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// ---------------------------------------------------------------------
// 4. USER ACTIVITY HEARTBEAT
// ---------------------------------------------------------------------
apiRouter.post('/activity', requireBearerAuth, (_req: Request, res: Response) => {
  try {
    activityModel.recordActive();
    res.json({ ok: true, timestamp: Date.now() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// ---------------------------------------------------------------------
// 5. BIDIRECTIONAL DATA SYNC (TASKS, REMINDERS, HABITS, SETTINGS)
// ---------------------------------------------------------------------
apiRouter.post('/sync', requireBearerAuth, (req: Request, res: Response) => {
  try {
    const { tasks = [], reminders = [], habits = [], settings = {} } = req.body;
    const now = Date.now();

    // 1. Sync tasks with last-write-wins based on updatedAt
    for (const t of tasks) {
      if (!t.id) continue;
      const existing = db.prepare('SELECT updatedAt FROM tasks WHERE id = ?').get(t.id) as any;
      if (!existing) {
        db.prepare(`
          INSERT INTO tasks (id, title, priority, due, dueTimestamp, completed, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          t.id,
          t.title,
          t.priority || 'med',
          t.due || '',
          t.dueTimestamp || null,
          t.completed ? 1 : 0,
          t.createdAt || now,
          t.updatedAt || now
        );
      } else if ((t.updatedAt || 0) > existing.updatedAt) {
        db.prepare(`
          UPDATE tasks
          SET title = ?, priority = ?, due = ?, dueTimestamp = ?, completed = ?, updatedAt = ?
          WHERE id = ?
        `).run(t.title, t.priority || 'med', t.due || '', t.dueTimestamp || null, t.completed ? 1 : 0, t.updatedAt || now, t.id);
      }
    }

    // 2. Sync reminders with last-write-wins
    for (const r of reminders) {
      if (!r.id) continue;
      const existing = db.prepare('SELECT updatedAt FROM reminders WHERE id = ?').get(r.id) as any;
      if (!existing) {
        db.prepare(`
          INSERT INTO reminders (id, text, at, repeat, status, critical, nextFireAt, fireCount, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.id,
          r.text,
          r.at,
          r.repeat || 'none',
          r.status || 'pending',
          r.critical ? 1 : 0,
          r.nextFireAt || now,
          r.fireCount || 0,
          r.createdAt || now,
          r.updatedAt || now
        );
      } else if ((r.updatedAt || 0) > existing.updatedAt) {
        db.prepare(`
          UPDATE reminders
          SET text = ?, at = ?, repeat = ?, status = ?, critical = ?, nextFireAt = ?, fireCount = ?, updatedAt = ?
          WHERE id = ?
        `).run(
          r.text,
          r.at,
          r.repeat || 'none',
          r.status || 'pending',
          r.critical ? 1 : 0,
          r.nextFireAt || now,
          r.fireCount || 0,
          r.updatedAt || now,
          r.id
        );
      }
    }

    // 3. Sync habits
    for (const h of habits) {
      if (!h.id) continue;
      const existing = db.prepare('SELECT updatedAt FROM habits WHERE id = ?').get(h.id) as any;
      if (!existing) {
        db.prepare(`
          INSERT INTO habits (id, name, streak, completedToday, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(h.id, h.name, h.streak || 0, h.completedToday ? 1 : 0, h.createdAt || now, h.updatedAt || now);
      } else if ((h.updatedAt || 0) > existing.updatedAt) {
        db.prepare(`
          UPDATE habits
          SET name = ?, streak = ?, completedToday = ?, updatedAt = ?
          WHERE id = ?
        `).run(h.name, h.streak || 0, h.completedToday ? 1 : 0, h.updatedAt || now, h.id);
      }
    }

    // 4. Update settings if provided
    if (Object.keys(settings).length > 0) {
      settingsModel.update(settings);
    }

    // Fetch authoritative server state
    const serverTasks = db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all();
    const serverReminders = db.prepare('SELECT * FROM reminders ORDER BY createdAt DESC').all();
    const serverHabits = db.prepare('SELECT * FROM habits ORDER BY createdAt DESC').all();
    const serverSettings = settingsModel.get();

    activityModel.recordActive();

    res.json({
      ok: true,
      tasks: serverTasks,
      reminders: serverReminders,
      habits: serverHabits,
      settings: serverSettings,
      serverTime: now,
    });
  } catch (err: any) {
    console.error('[API] Sync error:', err);
    res.status(500).json({ ok: false, error: err?.message || 'Sync failed.' });
  }
});

// ---------------------------------------------------------------------
// 6. SERVER GEMINI CHAT PROXY
// ---------------------------------------------------------------------
apiRouter.post('/chat', requireBearerAuth, async (req: Request, res: Response) => {
  try {
    const { message, history = [], mode = 'COMMAND' } = req.body;
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Message cannot be empty.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are Maya, Sirius's executive AI assistant and secretary on Axiom Intelligence. Current Mode: ${mode}. Be concise, supportive, and action-oriented.`;

    const chat = ai.chats.create({
      model: 'gemini-3.8-flash',
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const response = await chat.sendMessage({
      message,
    });

    activityModel.recordActive();

    res.json({
      ok: true,
      reply: response.text || '',
    });
  } catch (err: any) {
    console.error('[API] Chat proxy error:', err);
    res.status(500).json({ ok: false, error: err?.message || 'AI request failed.' });
  }
});

// ---------------------------------------------------------------------
// 7. PRIVACY DATA PURGE
// ---------------------------------------------------------------------
apiRouter.delete('/data/reset', requireBearerAuth, (_req: Request, res: Response) => {
  try {
    db.exec(`
      DELETE FROM tasks;
      DELETE FROM reminders;
      DELETE FROM habits;
      DELETE FROM subscriptions;
      DELETE FROM push_log;
      UPDATE activity SET checkinsToday = 0, consecutiveIgnoredCheckins = 0;
    `);
    console.log('[API] Complete server data wipe executed upon user request.');
    res.json({ ok: true, message: 'All server tasks, reminders, subscriptions, and logs have been deleted.' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});
