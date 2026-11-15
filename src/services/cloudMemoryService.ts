import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  getDocFromServer,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getApps, getApp, initializeApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from '../auth/googleAuth';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore targeting the user's specific database ID
const DATABASE_ID = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-axiomintelligenc-8b863e5a-454b-470c-871e-692c12a69d8c';
export const db = getFirestore(app, DATABASE_ID);

export interface CloudMemoryEntry {
  id: string;
  key: string;
  value: string;
  category: string;
  userId: string;
  updatedAt: string;
}

export class CloudMemoryService {
  private static isTested = false;

  /**
   * Validate connection to Firestore on boot as requested by skill
   */
  public static async validateConnection(): Promise<boolean> {
    if (this.isTested) return true;
    try {
      const user = auth.currentUser;
      if (!user) return false;
      await getDocFromServer(doc(db, 'users', user.uid, 'memory', '_init_check'));
      this.isTested = true;
      return true;
    } catch (err: any) {
      if (err?.message?.includes('the client is offline')) {
        console.warn('[CloudMemory] Firestore client is currently offline.');
      }
      return false;
    }
  }

  /**
   * Save a private memory entry to Firestore in the cloud
   */
  public static async saveMemory(key: string, value: string, category: string = 'personal'): Promise<{
    ok: boolean;
    id?: string;
    error?: string;
  }> {
    const id = `cloud-mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const user = auth.currentUser;
    const data: CloudMemoryEntry = {
      id,
      key,
      value,
      category,
      userId: user?.uid || 'local',
      updatedAt: new Date().toISOString(),
    };

    // Always preserve locally for immediate resilience and offline recovery
    try {
      const cached: CloudMemoryEntry[] = JSON.parse(localStorage.getItem('maya_cloud_memories_cache') || '[]');
      localStorage.setItem('maya_cloud_memories_cache', JSON.stringify([data, ...cached.filter((m) => m.id !== id)]));
    } catch (e) {}

    if (!user) {
      return { ok: true, id };
    }

    try {
      const memDoc = doc(db, 'users', user.uid, 'memory', id);
      await setDoc(memDoc, data);
      return { ok: true, id };
    } catch (err: any) {
      console.warn('[CloudMemory] Firestore save notice (stored locally):', err?.message || err);
      return { ok: true, id };
    }
  }

  /**
   * Retrieve all private memories from the cloud
   */
  public static async listMemories(): Promise<{
    ok: boolean;
    memories: CloudMemoryEntry[];
    error?: string;
  }> {
    const user = auth.currentUser;

    // Retrieve local cache for instant fallback
    let localCache: CloudMemoryEntry[] = [];
    try {
      localCache = JSON.parse(localStorage.getItem('maya_cloud_memories_cache') || '[]');
    } catch (e) {}

    if (!user) {
      return { ok: true, memories: localCache };
    }

    try {
      const memoryCollection = collection(db, 'users', user.uid, 'memory');
      const q = query(memoryCollection, orderBy('updatedAt', 'desc'), limit(100));
      const snap = await getDocs(q);

      const list: CloudMemoryEntry[] = [];
      snap.forEach((d) => {
        if (d.id !== '_init_check') {
          list.push(d.data() as CloudMemoryEntry);
        }
      });

      // Sync fresh results to local cache
      try {
        localStorage.setItem('maya_cloud_memories_cache', JSON.stringify(list));
      } catch (e) {}

      return { ok: true, memories: list };
    } catch (err: any) {
      console.warn('[CloudMemory] Firestore sync notice (using local memory):', err?.message || err);
      return { ok: true, memories: localCache };
    }
  }

  /**
   * Delete a cloud memory item
   */
  public static async deleteMemory(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const cached: CloudMemoryEntry[] = JSON.parse(localStorage.getItem('maya_cloud_memories_cache') || '[]');
      localStorage.setItem('maya_cloud_memories_cache', JSON.stringify(cached.filter((m) => m.id !== id)));
    } catch (e) {}

    const user = auth.currentUser;
    if (!user) return { ok: true };

    try {
      const memDoc = doc(db, 'users', user.uid, 'memory', id);
      await deleteDoc(memDoc);
      return { ok: true };
    } catch (err: any) {
      console.warn('[CloudMemory] Firestore delete notice:', err?.message || err);
      return { ok: true };
    }
  }

  /**
   * Save a snapshot of Maya's dashboard state in the cloud
   */
  public static async saveDashboardSnapshot(snapshot: {
    tasksCount: number;
    completedTasksCount: number;
    remindersCount: number;
    summary: string;
  }): Promise<{ ok: boolean }> {
    try {
      const user = auth.currentUser;
      if (!user) return { ok: false };

      const dashDoc = doc(db, 'users', user.uid, 'dashboard', 'latest');
      await setDoc(dashDoc, {
        userId: user.uid,
        ...snapshot,
        updatedAt: new Date().toISOString(),
      });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }
}
