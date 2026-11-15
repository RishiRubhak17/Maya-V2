import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

// Ensure data storage directory exists
const DATA_DIR = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'maya.db');
export const db = new DatabaseSync(DB_PATH);

// Initialize database tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      endpoint TEXT PRIMARY KEY,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      userAgent TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      priority TEXT DEFAULT 'med',
      due TEXT,
      dueTimestamp INTEGER,
      completed INTEGER DEFAULT 0,
      preReminderFired INTEGER DEFAULT 0,
      dueReminderFired INTEGER DEFAULT 0,
      overdueFiredDate TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      at TEXT NOT NULL,
      repeat TEXT DEFAULT 'none',
      status TEXT DEFAULT 'pending',
      critical INTEGER DEFAULT 0,
      nextFireAt INTEGER NOT NULL,
      fireCount INTEGER DEFAULT 0,
      lastFiredAt INTEGER,
      ackedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      streak INTEGER DEFAULT 0,
      completedToday INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      timezone TEXT DEFAULT 'Asia/Kolkata',
      quietStart TEXT DEFAULT '22:00',
      quietEnd TEXT DEFAULT '07:00',
      checkinsEnabled INTEGER DEFAULT 1,
      maxCheckinsPerDay INTEGER DEFAULT 3,
      hoursOfSilence INTEGER DEFAULT 4,
      tone TEXT DEFAULT 'friendly',
      paused INTEGER DEFAULT 0,
      privateNotifications INTEGER DEFAULT 0,
      briefingMorningTime TEXT DEFAULT '08:00',
      briefingEveningTime TEXT DEFAULT '21:00',
      inactivityCheckIntervalMinutes INTEGER DEFAULT 10,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      lastActiveAt INTEGER NOT NULL,
      lastCheckinAt INTEGER,
      checkinsToday INTEGER DEFAULT 0,
      consecutiveIgnoredCheckins INTEGER DEFAULT 0,
      lastCheckinDate TEXT,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_log (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      payload TEXT,
      sentAt INTEGER NOT NULL,
      result TEXT NOT NULL,
      errorDetails TEXT
    );
  `);

  // Ensure inactivityCheckIntervalMinutes column exists in existing DBs
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN inactivityCheckIntervalMinutes INTEGER DEFAULT 10`);
  } catch (e) {
    // Column already exists
  }

  // Ensure initial settings and activity rows exist
  const existingSettings = db.prepare('SELECT key FROM settings WHERE key = ?').get('global');
  if (!existingSettings) {
    db.prepare(`
      INSERT INTO settings (
        key, timezone, quietStart, quietEnd, checkinsEnabled, maxCheckinsPerDay,
        hoursOfSilence, tone, paused, privateNotifications, briefingMorningTime, briefingEveningTime,
        inactivityCheckIntervalMinutes, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'global',
      'Asia/Kolkata',
      '22:00',
      '07:00',
      1,
      12,
      4,
      'friendly',
      0,
      0,
      '08:00',
      '21:00',
      10,
      Date.now()
    );
  }

  const existingActivity = db.prepare('SELECT id FROM activity WHERE id = ?').get('global');
  if (!existingActivity) {
    db.prepare(`
      INSERT INTO activity (
        id, lastActiveAt, lastCheckinAt, checkinsToday, consecutiveIgnoredCheckins, lastCheckinDate, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('global', Date.now(), null, 0, 0, new Date().toISOString().split('T')[0], Date.now());
  }
}

// Subscription queries
export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: number;
}

export const subscriptionModel = {
  upsert(sub: PushSubscriptionRow) {
    const stmt = db.prepare(`
      INSERT INTO subscriptions (endpoint, p256dh, auth, userAgent, createdAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        userAgent = excluded.userAgent,
        createdAt = excluded.createdAt
    `);
    stmt.run(sub.endpoint, sub.p256dh, sub.auth, sub.userAgent || '', sub.createdAt);
  },

  getAll(): PushSubscriptionRow[] {
    return db.prepare('SELECT * FROM subscriptions').all() as unknown as PushSubscriptionRow[];
  },

  delete(endpoint: string) {
    db.prepare('DELETE FROM subscriptions WHERE endpoint = ?').run(endpoint);
  },

  count(): number {
    const res = db.prepare('SELECT count(*) as count FROM subscriptions').get() as { count: number };
    return res?.count || 0;
  },
};

// Push log queries
export const pushLogModel = {
  record(kind: string, payload: any, result: string, errorDetails?: string) {
    const id = `plog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO push_log (id, kind, payload, sentAt, result, errorDetails)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, kind, JSON.stringify(payload), Date.now(), result, errorDetails || null);
  },

  getRecent(limitCount: number = 50) {
    return db.prepare('SELECT * FROM push_log ORDER BY sentAt DESC LIMIT ?').all(limitCount);
  },
};

// Activity model
export const activityModel = {
  get() {
    return db.prepare('SELECT * FROM activity WHERE id = ?').get('global') as any;
  },

  recordActive() {
    const now = Date.now();
    db.prepare(`
      UPDATE activity
      SET lastActiveAt = ?, consecutiveIgnoredCheckins = 0, updatedAt = ?
      WHERE id = 'global'
    `).run(now, now);
  },

  recordCheckinSent(dateStr: string) {
    const now = Date.now();
    const current = this.get();
    let checkinsToday = (current?.checkinsToday || 0) + 1;
    if (current?.lastCheckinDate !== dateStr) {
      checkinsToday = 1;
    }
    const ignored = (current?.consecutiveIgnoredCheckins || 0) + 1;

    db.prepare(`
      UPDATE activity
      SET lastCheckinAt = ?, checkinsToday = ?, consecutiveIgnoredCheckins = ?, lastCheckinDate = ?, updatedAt = ?
      WHERE id = 'global'
    `).run(now, checkinsToday, ignored, dateStr, now);
  },

  resetDailyCheckinsIfNeeded(dateStr: string) {
    const current = this.get();
    if (current?.lastCheckinDate !== dateStr) {
      db.prepare(`
        UPDATE activity
        SET checkinsToday = 0, lastCheckinDate = ?, updatedAt = ?
        WHERE id = 'global'
      `).run(dateStr, Date.now());
    }
  },
};

// Settings model
export const settingsModel = {
  get() {
    return db.prepare('SELECT * FROM settings WHERE key = ?').get('global') as any;
  },

  update(patch: Record<string, any>) {
    const current = this.get() || {};
    const merged = { ...current, ...patch, updatedAt: Date.now() };
    db.prepare(`
      UPDATE settings
      SET timezone = ?, quietStart = ?, quietEnd = ?, checkinsEnabled = ?, maxCheckinsPerDay = ?,
          hoursOfSilence = ?, tone = ?, paused = ?, privateNotifications = ?,
          briefingMorningTime = ?, briefingEveningTime = ?, inactivityCheckIntervalMinutes = ?, updatedAt = ?
      WHERE key = 'global'
    `).run(
      merged.timezone || 'Asia/Kolkata',
      merged.quietStart || '22:00',
      merged.quietEnd || '07:00',
      merged.checkinsEnabled !== undefined ? (merged.checkinsEnabled ? 1 : 0) : 1,
      merged.maxCheckinsPerDay || 12,
      merged.hoursOfSilence || 4,
      merged.tone || 'friendly',
      merged.paused ? 1 : 0,
      merged.privateNotifications ? 1 : 0,
      merged.briefingMorningTime || '08:00',
      merged.briefingEveningTime || '21:00',
      merged.inactivityCheckIntervalMinutes || 10,
      merged.updatedAt
    );
    return this.get();
  },
};
