export interface GhostRecord {
  key: string; // `${trackId}_${type}`
  trackId: string;
  type: 'pb' | 'previous';
  lapTimeMs: number;
  recordedAt: number;
  sampleCount: number;
  sampleRateHz: number; // 30
  frameData: ArrayBuffer;
}

/**
 * A lap replaces the stored personal best only if it is strictly faster (P15-06).
 * The lap timer's own "best" resets every session, so it cannot decide this.
 */
export function isNewPersonalBest(lapTimeMs: number, storedPbMs: number | null): boolean {
  return storedPbMs === null || lapTimeMs < storedPbMs;
}

export class GhostStorage {
  private static readonly DB_NAME = 'ApexSlipstreamDB';
  private static readonly STORE_NAME = 'ghost_replays';
  // Version 2: the circuits were reshaped (U-02), so ghosts recorded on the old roads are dropped
  private static readonly DB_VERSION = 3; // 3: Coastal redesigned (R5); ghosts from old roads are dropped

  private dbPromise: Promise<IDBDatabase | null>;
  private memoryFallback: Map<string, GhostRecord> = new Map();

  constructor() {
    this.dbPromise = this.initIndexedDB();
  }

  private async initIndexedDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('GhostStorage: IndexedDB unavailable, using volatile memory fallback');
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(GhostStorage.DB_NAME, GhostStorage.DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (db.objectStoreNames.contains(GhostStorage.STORE_NAME)) {
            db.deleteObjectStore(GhostStorage.STORE_NAME);
          }
          db.createObjectStore(GhostStorage.STORE_NAME, { keyPath: 'key' });
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = (err) => {
          console.warn('GhostStorage: IndexedDB open failed, using memory fallback', err);
          resolve(null);
        };
      } catch (e) {
        console.warn('GhostStorage: IndexedDB exception, using memory fallback', e);
        resolve(null);
      }
    });
  }

  public async saveGhost(
    trackId: string,
    type: 'pb' | 'previous',
    lapTimeMs: number,
    data: Float32Array,
    sampleCount: number
  ): Promise<boolean> {
    const key = `${trackId}_${type}`;
    // Create an ArrayBuffer copy of exact sample length
    const copy = new Float32Array(sampleCount * 5);
    copy.set(data.subarray(0, sampleCount * 5));
    const buffer = copy.buffer;

    const record: GhostRecord = {
      key,
      trackId,
      type,
      lapTimeMs,
      recordedAt: Date.now(),
      sampleCount,
      sampleRateHz: 30,
      frameData: buffer
    };

    // Always keep in memory fallback
    this.memoryFallback.set(key, record);

    const db = await this.dbPromise;
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(GhostStorage.STORE_NAME, 'readwrite');
        const store = tx.objectStore(GhostStorage.STORE_NAME);
        const req = store.put(record);

        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          console.warn('GhostStorage: failed to persist ghost to IndexedDB');
          resolve(true); // Graceful in-memory fallback succeeded
        };
      } catch (e) {
        console.warn('GhostStorage: transaction failed', e);
        resolve(true);
      }
    });
  }

  public async getGhost(
    trackId: string,
    type: 'pb' | 'previous' = 'pb'
  ): Promise<GhostRecord | null> {
    const key = `${trackId}_${type}`;

    const db = await this.dbPromise;
    if (!db) {
      return this.memoryFallback.get(key) ?? null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(GhostStorage.STORE_NAME, 'readonly');
        const store = tx.objectStore(GhostStorage.STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          const result = req.result as GhostRecord | undefined;
          if (result) {
            resolve(result);
          } else {
            resolve(this.memoryFallback.get(key) ?? null);
          }
        };

        req.onerror = () => {
          resolve(this.memoryFallback.get(key) ?? null);
        };
      } catch (e) {
        console.warn('GhostStorage: getGhost transaction failed', e);
        resolve(this.memoryFallback.get(key) ?? null);
      }
    });
  }

  public async clearGhost(trackId: string, type: 'pb' | 'previous'): Promise<void> {
    const key = `${trackId}_${type}`;
    this.memoryFallback.delete(key);

    const db = await this.dbPromise;
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(GhostStorage.STORE_NAME, 'readwrite');
        const store = tx.objectStore(GhostStorage.STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
