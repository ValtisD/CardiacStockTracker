import type { Product, Inventory, Hospital, ImplantProcedure } from '@shared/schema';

const DB_NAME = 'crm-stock-offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  HOSPITALS: 'hospitals',
  PROCEDURES: 'procedures',
  SYNC_QUEUE: 'syncQueue',
} as const;

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: keyof typeof STORES;
  data: any;
  endpoint: string;
  method: string;
  timestamp: number;
  retryCount: number;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          productStore.createIndex('gtin', 'gtin', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.INVENTORY)) {
          const inventoryStore = db.createObjectStore(STORES.INVENTORY, { keyPath: 'id' });
          inventoryStore.createIndex('location', 'location', { unique: false });
          inventoryStore.createIndex('productId', 'productId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.HOSPITALS)) {
          db.createObjectStore(STORES.HOSPITALS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.PROCEDURES)) {
          const procedureStore = db.createObjectStore(STORES.PROCEDURES, { keyPath: 'id' });
          procedureStore.createIndex('date', 'procedureDate', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Generic CRUD operations
  async getAll<T>(storeName: string): Promise<T[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: string, data: T): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async putMany<T>(storeName: string, items: T[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach(item => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue operations
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    await this.put(STORES.SYNC_QUEUE, queueItem);
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return this.getAll<SyncQueueItem>(STORES.SYNC_QUEUE);
  }

  async removeSyncQueueItem(id: string): Promise<void> {
    await this.delete(STORES.SYNC_QUEUE, id);
  }

  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    await this.put(STORES.SYNC_QUEUE, item);
  }

  // Entity-specific operations
  async cacheProducts(products: Product[]): Promise<void> {
    await this.putMany(STORES.PRODUCTS, products);
  }

  async getProducts(): Promise<Product[]> {
    return this.getAll<Product>(STORES.PRODUCTS);
  }

  async cacheInventory(inventory: Inventory[]): Promise<void> {
    await this.putMany(STORES.INVENTORY, inventory);
  }

  async getInventory(): Promise<Inventory[]> {
    return this.getAll<Inventory>(STORES.INVENTORY);
  }

  async getInventoryByLocation(location: string): Promise<Inventory[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.INVENTORY, 'readonly');
      const store = transaction.objectStore(STORES.INVENTORY);
      const index = store.index('location');
      const request = index.getAll(location);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async cacheHospitals(hospitals: Hospital[]): Promise<void> {
    await this.putMany(STORES.HOSPITALS, hospitals);
  }

  async getHospitals(): Promise<Hospital[]> {
    return this.getAll<Hospital>(STORES.HOSPITALS);
  }

  async cacheProcedures(procedures: ImplantProcedure[]): Promise<void> {
    await this.putMany(STORES.PROCEDURES, procedures);
  }

  async getProcedures(): Promise<ImplantProcedure[]> {
    return this.getAll<ImplantProcedure>(STORES.PROCEDURES);
  }
}

export const offlineStorage = new OfflineStorage();
