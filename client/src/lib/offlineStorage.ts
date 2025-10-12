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
    
    // All callers validate array before calling, but double-check for safety
    if (!Array.isArray(items) || items.length === 0) {
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
    if (!Array.isArray(products)) {
      console.warn('cacheProducts called with non-array:', products);
      return;
    }
    
    const validItems = products.filter(item => item && item.id);
    
    if (validItems.length < products.length) {
      console.warn(`Filtered out ${products.length - validItems.length} products without valid IDs`);
    }
    
    // CRITICAL: Clear store first, then add items (handles empty arrays correctly)
    await this.clear(STORES.PRODUCTS);
    if (validItems.length > 0) {
      await this.putMany(STORES.PRODUCTS, validItems);
    }
  }

  async getProducts(): Promise<Product[]> {
    return this.getAll<Product>(STORES.PRODUCTS);
  }

  async cacheInventory(inventory: Inventory[]): Promise<void> {
    if (!Array.isArray(inventory)) {
      console.warn('cacheInventory called with non-array:', inventory);
      return;
    }
    
    const validItems = inventory.filter(item => item && item.id);
    
    if (validItems.length < inventory.length) {
      console.warn(`Filtered out ${inventory.length - validItems.length} inventory items without valid IDs`);
    }
    
    // CRITICAL: Clear store first, then add items (handles empty arrays correctly)
    console.log(`📦 Caching inventory: clearing store, then adding ${validItems.length} items`);
    await this.clear(STORES.INVENTORY);
    if (validItems.length > 0) {
      await this.putMany(STORES.INVENTORY, validItems);
      console.log(`✅ Cached ${validItems.length} inventory items to IndexedDB`);
    } else {
      console.log(`✅ Cleared inventory store (received empty array)`);
    }
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
    if (!Array.isArray(hospitals)) {
      console.warn('cacheHospitals called with non-array:', hospitals);
      return;
    }
    
    const validItems = hospitals.filter(item => item && item.id);
    
    if (validItems.length < hospitals.length) {
      console.warn(`Filtered out ${hospitals.length - validItems.length} hospitals without valid IDs`);
    }
    
    // CRITICAL: Clear store first, then add items (handles empty arrays correctly)
    await this.clear(STORES.HOSPITALS);
    if (validItems.length > 0) {
      await this.putMany(STORES.HOSPITALS, validItems);
    }
  }

  async getHospitals(): Promise<Hospital[]> {
    return this.getAll<Hospital>(STORES.HOSPITALS);
  }

  async cacheProcedures(procedures: ImplantProcedure[]): Promise<void> {
    if (!Array.isArray(procedures)) {
      console.warn('cacheProcedures called with non-array:', procedures);
      return;
    }
    
    const validItems = procedures.filter(item => item && item.id);
    
    if (validItems.length < procedures.length) {
      console.warn(`Filtered out ${procedures.length - validItems.length} procedures without valid IDs`);
    }
    
    // CRITICAL: Clear store first, then add items (handles empty arrays correctly)
    await this.clear(STORES.PROCEDURES);
    if (validItems.length > 0) {
      await this.putMany(STORES.PROCEDURES, validItems);
    }
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

  // Cleanup method to remove all temp IDs from cache
  async cleanupTempIds(): Promise<{ needsRefresh: boolean }> {
    console.log('🧹 Cleaning up temp IDs from cache...');
    let needsRefresh = false;
    
    try {
      // Clean procedures
      const procedures = await this.getProcedures();
      const cleanProcedures = procedures.filter(p => !p.id.startsWith('temp-'));
      if (cleanProcedures.length < procedures.length) {
        await this.cacheProcedures(cleanProcedures);
        console.log(`🧹 Removed ${procedures.length - cleanProcedures.length} temp procedures`);
        needsRefresh = true;
      }
      
      // Clean inventory
      const inventory = await this.getInventory();
      const cleanInventory = inventory.filter(i => !i.id.startsWith('temp-'));
      if (cleanInventory.length < inventory.length) {
        await this.cacheInventory(cleanInventory);
        console.log(`🧹 Removed ${inventory.length - cleanInventory.length} temp inventory items`);
        needsRefresh = true;
      }
      
      // Clean hospitals
      const hospitals = await this.getHospitals();
      const cleanHospitals = hospitals.filter(h => !h.id.startsWith('temp-'));
      if (cleanHospitals.length < hospitals.length) {
        await this.cacheHospitals(cleanHospitals);
        console.log(`🧹 Removed ${hospitals.length - cleanHospitals.length} temp hospitals`);
        needsRefresh = true;
      }
      
      // Clean products
      const products = await this.getProducts();
      const cleanProducts = products.filter(p => !p.id.startsWith('temp-'));
      if (cleanProducts.length < products.length) {
        await this.cacheProducts(cleanProducts);
        console.log(`🧹 Removed ${products.length - cleanProducts.length} temp products`);
        needsRefresh = true;
      }
      
      console.log('✅ Temp ID cleanup complete');
      return { needsRefresh };
    } catch (error) {
      console.error('❌ Failed to cleanup temp IDs:', error);
      return { needsRefresh: false };
    }
  }
}

export const offlineStorage = new OfflineStorage();
