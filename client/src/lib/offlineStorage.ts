import type { Product, Inventory, Hospital, ImplantProcedure } from '@shared/schema';

const DB_NAME = 'crm-stock-offline';
const DB_VERSION = 2;

// Store names
const STORES = {
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  HOSPITALS: 'hospitals',
  PROCEDURES: 'procedures',
  SYNC_QUEUE: 'syncQueue',
  USER: 'user',
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

      request.onerror = () => {
        console.error('IndexedDB initialization failed:', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
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

        if (!db.objectStoreNames.contains(STORES.USER)) {
          db.createObjectStore(STORES.USER, { keyPath: 'userId' });
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
    
    // Handle case where items is not an array
    if (!Array.isArray(items)) {
      console.warn('putMany called with non-array:', items);
      return;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach(item => {
        try {
          store.put(item);
        } catch (e) {
          console.error('Failed to put item in store:', storeName, item, e);
        }
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Transaction error in putMany:', storeName, transaction.error);
        reject(transaction.error);
      };
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
    // Filter out items without valid IDs
    const validItems = Array.isArray(products) 
      ? products.filter(item => item && item.id) 
      : [];
    
    if (validItems.length < products.length) {
      console.warn(`Filtered out ${products.length - validItems.length} products without valid IDs`);
    }
    
    await this.putMany(STORES.PRODUCTS, validItems);
  }

  async getProducts(): Promise<Product[]> {
    return this.getAll<Product>(STORES.PRODUCTS);
  }

  async cacheInventory(inventory: Inventory[]): Promise<void> {
    // Filter out items without valid IDs
    const validItems = Array.isArray(inventory) 
      ? inventory.filter(item => item && item.id) 
      : [];
    
    if (validItems.length < inventory.length) {
      console.warn(`Filtered out ${inventory.length - validItems.length} inventory items without valid IDs`);
    }
    
    await this.putMany(STORES.INVENTORY, validItems);
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
    // Filter out items without valid IDs
    const validItems = Array.isArray(hospitals) 
      ? hospitals.filter(item => item && item.id) 
      : [];
    
    if (validItems.length < hospitals.length) {
      console.warn(`Filtered out ${hospitals.length - validItems.length} hospitals without valid IDs`);
    }
    
    await this.putMany(STORES.HOSPITALS, validItems);
  }

  async getHospitals(): Promise<Hospital[]> {
    return this.getAll<Hospital>(STORES.HOSPITALS);
  }

  async cacheProcedures(procedures: ImplantProcedure[]): Promise<void> {
    // Ensure procedures is an array and filter out items without valid IDs
    const validItems = Array.isArray(procedures) 
      ? procedures.filter(item => item && item.id) 
      : [];
    
    if (!Array.isArray(procedures)) {
      console.warn('cacheProcedures called with non-array:', procedures);
    } else if (validItems.length < procedures.length) {
      console.warn(`Filtered out ${procedures.length - validItems.length} procedures without valid IDs`);
    }
    
    await this.putMany(STORES.PROCEDURES, validItems);
  }

  async getProcedures(): Promise<ImplantProcedure[]> {
    return this.getAll<ImplantProcedure>(STORES.PROCEDURES);
  }

  async cacheUser(user: any): Promise<void> {
    await this.put(STORES.USER, user);
  }

  async getUser(): Promise<any | undefined> {
    const users = await this.getAll<any>(STORES.USER);
    return users[0]; // Return first user (single user app)
  }
}

export const offlineStorage = new OfflineStorage();
