import { openDB, IDBPDatabase } from 'idb';
import {
  TacticalTask,
  AscProject,
  ReminderItem,
  HabitItem,
  TacticalNote,
  ExpenseItem,
  DecisionLogItem,
  FollowUpItem,
  FocusSession,
  MemoryItem,
  ChatMessage,
  ActionLogItem,
  AppSettings,
  FlashcardItem,
  ExamPlanItem,
  HardwareReading,
  CalendarEvent,
  DocumentChunk,
} from '../types';

const DB_NAME = 'maya_os_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDatabase(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, _tx) {
        const stores = [
          'tasks',
          'projects',
          'reminders',
          'habits',
          'notes',
          'expenses',
          'decisions',
          'followups',
          'focus_sessions',
          'memory',
          'chat_messages',
          'action_logs',
          'settings',
          'flashcards',
          'exam_plans',
          'hardware_readings',
          'calendar_events',
          'document_chunks',
        ];

        for (const store of stores) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
}

// Generic store operations
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getDatabase();
    return await db.getAll(storeName);
  } catch (err) {
    console.warn(`IndexedDB read failed for ${storeName}:`, err);
    return [];
  }
}

export async function putToStore<T extends { id: string }>(storeName: string, item: T): Promise<void> {
  try {
    const db = await getDatabase();
    await db.put(storeName, item);
  } catch (err) {
    console.warn(`IndexedDB put failed for ${storeName}:`, err);
  }
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.delete(storeName, id);
  } catch (err) {
    console.warn(`IndexedDB delete failed for ${storeName}:`, err);
  }
}

export async function clearStore(storeName: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.clear(storeName);
  } catch (err) {
    console.warn(`IndexedDB clear failed for ${storeName}:`, err);
  }
}

export async function bulkPutToStore<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
  try {
    const db = await getDatabase();
    const tx = db.transaction(storeName, 'readwrite');
    for (const item of items) {
      tx.store.put(item);
    }
    await tx.done;
  } catch (err) {
    console.warn(`IndexedDB bulk put failed for ${storeName}:`, err);
  }
}

// Initial hydration & migration from legacy localStorage
export async function hydrateAllStores() {
  const db = await getDatabase();

  // Tasks
  let tasks = await db.getAll('tasks');
  if (tasks.length === 0) {
    const legacy = localStorage.getItem('maya_tasks');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await bulkPutToStore('tasks', parsed);
          tasks = parsed;
        }
      } catch (e) {}
    }
  }

  // Reminders
  let reminders = await db.getAll('reminders');
  if (reminders.length === 0) {
    const legacy = localStorage.getItem('maya_reminders');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await bulkPutToStore('reminders', parsed);
          reminders = parsed;
        }
      } catch (e) {}
    }
  }

  // Notes
  let notes = await db.getAll('notes');
  if (notes.length === 0) {
    const legacy = localStorage.getItem('maya_notes');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await bulkPutToStore('notes', parsed);
          notes = parsed;
        }
      } catch (e) {}
    }
  }

  // Memory
  let memory = await db.getAll('memory');
  if (memory.length === 0) {
    const legacy = localStorage.getItem('maya_memory');
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await bulkPutToStore('memory', parsed);
          memory = parsed;
        }
      } catch (e) {}
    }
  }

  // Habits
  let habits = await db.getAll('habits');
  if (habits.length === 0) {
    // Default starter habits for Sirius
    const defaultHabits: HabitItem[] = [
      {
        id: 'habit-1',
        name: 'Deep Work / CTF Lab Practice',
        category: 'code',
        targetDaysPerWeek: 5,
        currentStreak: 4,
        bestStreak: 14,
        history: {},
        reminderTime: '18:00',
      },
      {
        id: 'habit-2',
        name: 'Posture Check & Hydration (2.5L)',
        category: 'health',
        targetDaysPerWeek: 7,
        currentStreak: 6,
        bestStreak: 21,
        history: {},
        reminderTime: '11:00',
      },
      {
        id: 'habit-3',
        name: 'Daily ASC Exec Review',
        category: 'study',
        targetDaysPerWeek: 6,
        currentStreak: 8,
        bestStreak: 19,
        history: {},
        reminderTime: '20:30',
      },
    ];
    await bulkPutToStore('habits', defaultHabits);
    habits = defaultHabits;
  }

  // Settings
  let settingsList = await db.getAll('settings');
  let settings: AppSettings | null = settingsList.length > 0 ? (settingsList[0] as any) : null;
  if (!settings) {
    const legacy = localStorage.getItem('maya_settings');
    if (legacy) {
      try {
        settings = JSON.parse(legacy);
      } catch (e) {}
    }
  }

  return {
    tasks,
    reminders,
    habits,
    notes,
    memory,
    settings,
    projects: await db.getAll('projects'),
    expenses: await db.getAll('expenses'),
    decisions: await db.getAll('decisions'),
    followups: await db.getAll('followups'),
    focusSessions: await db.getAll('focus_sessions'),
    chatMessages: await db.getAll('chat_messages'),
    actionLogs: await db.getAll('action_logs'),
    flashcards: await db.getAll('flashcards'),
    examPlans: await db.getAll('exam_plans'),
    hardwareReadings: await db.getAll('hardware_readings'),
    calendarEvents: await db.getAll('calendar_events'),
    documentChunks: await db.getAll('document_chunks'),
  };
}

// Backup & Export / Import
export async function exportAllDataAsJson(): Promise<string> {
  const db = await getDatabase();
  const stores = [
    'tasks',
    'projects',
    'reminders',
    'habits',
    'notes',
    'expenses',
    'decisions',
    'followups',
    'focus_sessions',
    'memory',
    'chat_messages',
    'action_logs',
    'settings',
    'flashcards',
    'exam_plans',
    'hardware_readings',
    'calendar_events',
  ];

  const dump: Record<string, any[]> = {};
  for (const s of stores) {
    dump[s] = await db.getAll(s);
  }

  return JSON.stringify(
    {
      version: 1,
      appName: 'Axiom Intelligence // Maya',
      exportedAt: new Date().toISOString(),
      data: dump,
    },
    null,
    2
  );
}

export async function importAllDataFromJson(jsonStr: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonStr);
    const dump = parsed.data;
    if (!dump || typeof dump !== 'object') return false;

    for (const [storeName, items] of Object.entries(dump)) {
      if (Array.isArray(items)) {
        await clearStore(storeName);
        await bulkPutToStore(storeName, items);
      }
    }
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
}

// Web Crypto PBKDF2 + AES-GCM Encrypted Backup
export async function exportEncryptedBackup(passphrase: string): Promise<string> {
  const rawJson = await exportAllDataAsJson();
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    enc.encode(rawJson)
  );

  const payload = {
    salt: Array.from(salt),
    iv: Array.from(iv),
    cipherText: Array.from(new Uint8Array(cipherBuffer)),
    createdAt: new Date().toISOString(),
  };

  return JSON.stringify(payload);
}

export async function importEncryptedBackup(encryptedStr: string, passphrase: string): Promise<boolean> {
  try {
    const payload = JSON.parse(encryptedStr);
    const salt = new Uint8Array(payload.salt);
    const iv = new Uint8Array(payload.iv);
    const cipherText = new Uint8Array(payload.cipherText);

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      cipherText
    );

    const jsonStr = dec.decode(decryptedBuffer);
    return await importAllDataFromJson(jsonStr);
  } catch (err) {
    console.error('Decryption failed. Invalid passphrase or corrupt data:', err);
    return false;
  }
}

// Origin Private File System (OPFS) Auto-Backup
export async function saveToOpfsBackup(filename: string = 'maya_backup.json'): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.getDirectory) {
    return false;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename, { create: true });
    // @ts-ignore
    const writable = await fileHandle.createWritable();
    const data = await exportAllDataAsJson();
    await writable.write(data);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('OPFS backup write failed:', err);
    return false;
  }
}
