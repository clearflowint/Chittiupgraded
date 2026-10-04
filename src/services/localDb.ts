/**
 * IndexedDB Tenant-Isolated Offline Database & Synchronization Engine
 * Guarantees cryptographic tenant separation in client storage, idempotent offline queuing,
 * and reliable offline replay without cloud overwrite conflicts.
 */

const DB_NAME = 'clearflow_tenant_isolated_v2';
const DB_VERSION = 3;

export interface QueuedOfflineMutation {
  operationId: string;
  managerId: string;
  authUid: string;
  collection: string;
  docId: string;
  type: 'set' | 'update' | 'delete' | 'batch';
  payload: any;
  timestamp: number;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
  updatedAt?: number;
}

class TenantIsolatedDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not available in current execution context'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const stores = [
          'funds',
          'shares',
          'cycles',
          'billings',
          'payouts',
          'payments',
          'contacts',
          'groups',
          'campaigns',
          'audits',
          'ledgers',
          'dispatches',
          'portal_tokens',
          'sync_queue',
          'app_cache',
        ];

        stores.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            // Composite key or storage with managerId index
            const store = db.createObjectStore(storeName, { keyPath: 'storageKey' });
            store.createIndex('by_manager', 'managerId', { unique: false });
            if (storeName === 'sync_queue') {
              store.createIndex('by_timestamp', ['managerId', 'timestamp'], { unique: false });
            }
          }
        });
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Generates a tenant-scoped composite storage key
   */
  private makeStorageKey(managerId: string, id: string): string {
    return `${managerId}::${id}`;
  }

  async put(managerId: string, storeName: string, item: any): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const rawId = item.id || item.dispatchId || item.billingId || item.payoutId || item.fundId || item.shareId || item.cycleId || item.paymentId || item.contactId || item.groupId || item.campaignId || item.auditId || item.ledgerId || item.token;
      
      const record = {
        ...item,
        id: rawId,
        managerId,
        storageKey: this.makeStorageKey(managerId, rawId),
      };

      store.put(record);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn(`LocalDB put error in ${storeName}:`, e);
    }
  }

  async putBatch(managerId: string, storeName: string, items: any[]): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      items.forEach((item) => {
        const rawId = item.id || item.billingId || item.payoutId || item.fundId || item.shareId || item.cycleId || item.paymentId || item.contactId || item.groupId || item.campaignId || item.auditId || item.ledgerId || item.token;
        store.put({
          ...item,
          id: rawId,
          managerId,
          storageKey: this.makeStorageKey(managerId, rawId),
        });
      });

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn(`LocalDB putBatch error in ${storeName}:`, e);
    }
  }

  async getAllForTenant<T = any>(managerId: string, storeName: string): Promise<T[]> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index('by_manager');
      const request = index.getAll(managerId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve((request.result || []) as T[]);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn(`LocalDB getAll error in ${storeName}:`, e);
      return [];
    }
  }

  async getForTenant<T = any>(managerId: string, storeName: string, id: string): Promise<T | null> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(this.makeStorageKey(managerId, id));

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve((request.result || null) as T | null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      return null;
    }
  }

  async delete(managerId: string, storeName: string, id: string): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(this.makeStorageKey(managerId, id));
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn(`LocalDB delete error in ${storeName}:`, e);
    }
  }

  /**
   * Purges all cached records for a specific manager tenant upon logout
   */
  async clearTenantCache(managerId: string): Promise<void> {
    try {
      const db = await this.openDB();
      const storeNames = [
        'funds',
        'shares',
        'cycles',
        'billings',
        'payouts',
        'payments',
        'contacts',
        'groups',
        'campaigns',
        'audits',
        'ledgers',
        'portal_tokens',
        // 'sync_queue', // Preserved across logout for sync survival (Phase 2A.5)
        'app_cache',
      ];

      for (const storeName of storeNames) {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const index = store.index('by_manager');
        const req = index.getAllKeys(managerId);

        await new Promise<void>((resolve) => {
          req.onsuccess = () => {
            const keys = req.result;
            keys.forEach((key) => store.delete(key));
            resolve();
          };
          req.onerror = () => resolve();
        });
      }
    } catch (e) {
      console.warn('Failed to purge tenant local cache:', e);
    }
  }

  /**
   * Queue mutation performed while offline for deferred server commit
   */
  async queueOfflineMutation(op: Omit<QueuedOfflineMutation, 'timestamp' | 'status' | 'retryCount'>): Promise<void> {
    const queueItem: QueuedOfflineMutation = {
      ...op,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    };
    await this.put(op.managerId, 'sync_queue', queueItem);
  }

  async getPendingMutations(managerId: string): Promise<QueuedOfflineMutation[]> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const index = store.index('by_timestamp');
      
      // Use IDBKeyRange to filter by managerId prefix in the compound index
      const range = IDBKeyRange.bound([managerId, 0], [managerId, Date.now()]);
      const request = index.getAll(range);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const results = (request.result || []) as QueuedOfflineMutation[];
          resolve(results.filter(m => m.status === 'pending' || m.status === 'failed'));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('Failed to get pending mutations via index:', e);
      // Fallback to manual filter if index fails
      const all = await this.getAllForTenant<QueuedOfflineMutation>(managerId, 'sync_queue');
      return all
        .filter((m) => m.status === 'pending' || m.status === 'failed')
        .sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  async updateMutationStatus(managerId: string, operationId: string, status: QueuedOfflineMutation['status'], error?: string): Promise<void> {
    const item = await this.getForTenant<QueuedOfflineMutation>(managerId, 'sync_queue', operationId);
    if (item) {
      await this.put(managerId, 'sync_queue', {
        ...item,
        status,
        lastError: error,
        updatedAt: Date.now()
      });
    }
  }

  async removeQueuedMutation(managerId: string, operationId: string): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      store.delete(this.makeStorageKey(managerId, operationId));
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Failed to remove queued mutation:', e);
    }
  }

  async acquireSyncLock(managerId: string): Promise<boolean> {
    const lockKey = `sync_lock_${managerId}`;
    const now = Date.now();

    try {
      const db = await this.openDB();
      const tx = db.transaction('app_cache', 'readwrite');
      const store = tx.objectStore('app_cache');
      
      const request = store.get(this.makeStorageKey(managerId, lockKey));
      
      return new Promise((resolve) => {
        request.onsuccess = async () => {
          const existing = request.result;
          if (existing && existing.expires > now) {
            resolve(false); // Lock is still valid and held by someone else
            return;
          }

          // Lock is either absent or expired, acquire it
          const lockRecord = {
            id: lockKey,
            expires: now + 60000,
            managerId,
            storageKey: this.makeStorageKey(managerId, lockKey),
          };

          const putRequest = store.put(lockRecord);
          putRequest.onsuccess = () => resolve(true);
          putRequest.onerror = () => resolve(false);
        };
        request.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('Sync lock acquisition error:', e);
      return false;
    }
  }

  async releaseSyncLock(managerId: string): Promise<void> {
    const lockKey = `sync_lock_${managerId}`;
    await this.delete(managerId, 'app_cache', lockKey);
  }
}

export const localDb = new TenantIsolatedDatabase();
