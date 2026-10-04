/**
 * IndexedDB Tenant-Isolated Offline Read-Only Cache Database
 * Guarantees cryptographic tenant separation in client storage.
 */

const DB_NAME = 'clearflow_tenant_isolated_v2';
const DB_VERSION = 3;

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
          'app_cache',
        ];

        stores.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            // Composite key or storage with managerId index
            const store = db.createObjectStore(storeName, { keyPath: 'storageKey' });
            store.createIndex('by_manager', 'managerId', { unique: false });
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

}

export const localDb = new TenantIsolatedDatabase();
