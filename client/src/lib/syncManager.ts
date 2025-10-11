import { offlineStorage, type SyncQueueItem } from './offlineStorage';
import { apiRequest, queryClient } from './queryClient';

export type SyncStatus = 'idle' | 'syncing' | 'error';

class SyncManager {
  private syncStatus: SyncStatus = 'idle';
  private listeners: Set<(status: SyncStatus, pending: number) => void> = new Set();
  private syncInProgress = false;
  private errorCallback: ((error: string, details?: string) => void) | null = null;
  
  // In-memory cache to prevent concurrent duplicate mutations
  private recentMutations: Map<string, number> = new Map();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.sync();
    });

    window.addEventListener('offline', () => {
      this.updateStatus('idle');
    });

    // Listen for service worker sync messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_READY') {
          this.sync();
        }
      });
    }

    // Initial sync if online
    if (navigator.onLine) {
      setTimeout(() => this.sync(), 1000);
    }
  }
  
  // Always check current online status (don't cache it)
  private get isOnline(): boolean {
    return navigator.onLine;
  }

  private updateStatus(status: SyncStatus) {
    this.syncStatus = status;
    this.getPendingCount().then(count => {
      this.listeners.forEach(listener => listener(status, count));
    });
  }

  onStatusChange(callback: (status: SyncStatus, pending: number) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Register a callback for sync errors (used to show toast notifications)
  onSyncError(callback: (error: string, details?: string) => void) {
    this.errorCallback = callback;
  }

  async getPendingCount(): Promise<number> {
    const queue = await offlineStorage.getSyncQueue();
    return queue.length;
  }

  async addToQueue(
    type: 'create' | 'update' | 'delete',
    entity: string,
    endpoint: string,
    method: string,
    data?: any
  ) {
    // Create a signature for this mutation (without timestamps or temp IDs)
    const signature = `${method}:${endpoint}:${JSON.stringify(data)}`;
    const now = Date.now();
    
    console.log('🔍 Checking mutation:', { method, endpoint, signature: signature.substring(0, 100) + '...' });
    
    // Check in-memory cache first (prevents concurrent race conditions)
    const lastSeen = this.recentMutations.get(signature);
    if (lastSeen && (now - lastSeen < 5000)) {
      console.warn('⚠️ Duplicate mutation detected (in-memory), skipping:', method, endpoint);
      return;
    }
    console.log('✅ Not a duplicate (in-memory check passed):', method, endpoint);
    
    // Also check IndexedDB for persistence across page loads
    const existingQueue = await offlineStorage.getSyncQueue();
    const isDuplicate = existingQueue.some(item => 
      item.endpoint === endpoint && 
      item.method === method && 
      JSON.stringify(item.data) === JSON.stringify(data) &&
      (now - item.timestamp < 5000)
    );
    
    if (isDuplicate) {
      console.warn('⚠️ Duplicate mutation detected (IndexedDB), skipping:', method, endpoint);
      return;
    }
    
    // Add to in-memory cache immediately (before async IndexedDB write)
    this.recentMutations.set(signature, now);
    
    // Clean up old entries from in-memory cache (older than 10 seconds)
    Array.from(this.recentMutations.entries()).forEach(([sig, timestamp]) => {
      if (now - timestamp > 10000) {
        this.recentMutations.delete(sig);
      }
    });
    
    await offlineStorage.addToSyncQueue({
      type,
      entity: entity as any,
      endpoint,
      method,
      data,
    });
    
    // Notify listeners of pending changes
    const count = await this.getPendingCount();
    this.listeners.forEach(listener => listener(this.syncStatus, count));

    // Try to sync immediately if online
    if (this.isOnline && !this.syncInProgress) {
      this.sync();
    }
  }

  async sync(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    this.updateStatus('syncing');

    try {
      // Clean up any leftover temp IDs before syncing
      await offlineStorage.cleanupTempIds();
      
      const queue = await offlineStorage.getSyncQueue();
      
      if (queue.length === 0) {
        this.updateStatus('idle');
        this.syncInProgress = false;
        return;
      }

      console.log(`✅ ONLINE: Processing sync queue (${queue.length} items)...`);

      // Sort by timestamp to maintain order
      const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp);

      for (let i = 0; i < sortedQueue.length; i++) {
        const item = sortedQueue[i];
        try {
          console.log(`✅ Syncing mutation ${i + 1}/${sortedQueue.length}: ${item.method} ${item.endpoint}`);
          
          // Execute the sync request with bypass flag to prevent re-queueing
          const response = await apiRequest(item.method as any, item.endpoint, item.data, { bypassOfflineCheck: true });
          
          // Remove from queue on success
          await offlineStorage.removeSyncQueueItem(item.id);
          console.log(`✅ Synced successfully: ${item.method} ${item.endpoint}`);
          
          // CRITICAL: Invalidate React Query cache to remove temp IDs and fetch fresh data
          // This prevents duplicate entries (temp ID + real ID) from showing in the UI
          await queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey[0]?.toString() || '';
              // Invalidate all queries related to this entity type
              if (item.endpoint.includes('/inventory')) {
                return queryKey.startsWith('/api/inventory');
              } else if (item.endpoint.includes('/implant-procedures')) {
                // When procedures are synced, also invalidate inventory (procedures consume inventory)
                return queryKey.startsWith('/api/implant-procedures') || 
                       queryKey.startsWith('/api/inventory');
              } else if (item.endpoint.includes('/hospitals')) {
                return queryKey.startsWith('/api/hospitals');
              } else if (item.endpoint.includes('/products')) {
                return queryKey.startsWith('/api/products');
              }
              return false;
            }
          });
          console.log(`🔄 Cache invalidated for: ${item.endpoint}`);
          
          // Clean up temp IDs from IndexedDB cache after successful sync
          if (item.method === 'POST') {
            try {
              if (item.endpoint.includes('/implant-procedures')) {
                const procedures = await offlineStorage.getProcedures();
                const cleaned = procedures.filter(p => !p.id.startsWith('temp-'));
                await offlineStorage.cacheProcedures(cleaned);
                console.log(`🧹 Cleaned temp IDs from procedures cache`);
              } else if (item.endpoint.includes('/inventory')) {
                const inventory = await offlineStorage.getInventory();
                const cleaned = inventory.filter(i => !i.id.startsWith('temp-'));
                await offlineStorage.cacheInventory(cleaned);
                console.log(`🧹 Cleaned temp IDs from inventory cache`);
              } else if (item.endpoint.includes('/hospitals')) {
                const hospitals = await offlineStorage.getHospitals();
                const cleaned = hospitals.filter(h => !h.id.startsWith('temp-'));
                await offlineStorage.cacheHospitals(cleaned);
                console.log(`🧹 Cleaned temp IDs from hospitals cache`);
              } else if (item.endpoint.includes('/products')) {
                const products = await offlineStorage.getProducts();
                const cleaned = products.filter(p => !p.id.startsWith('temp-'));
                await offlineStorage.cacheProducts(cleaned);
                console.log(`🧹 Cleaned temp IDs from products cache`);
              }
            } catch (cleanupError) {
              console.error('❌ Failed to clean temp IDs from cache:', cleanupError);
            }
          }
        } catch (error: any) {
          console.error('❌ Sync failed for item:', item, error);
          
          // Check if this is a client error (400-499) - these are permanent failures
          const errorMessage = error?.message || '';
          const isClientError = /^4\d{2}:/.test(errorMessage); // Matches "400:", "404:", etc.
          
          if (isClientError) {
            // Client errors (validation, not found, etc.) - don't retry, just remove
            console.error('❌ Client error (permanent failure), removing from queue:', errorMessage);
            await offlineStorage.removeSyncQueueItem(item.id);
            
            // Notify user of sync failure
            if (this.errorCallback) {
              // Extract the error message (after "400: " or similar status code)
              const userMessage = errorMessage.replace(/^4\d{2}:\s*/, '');
              const actionType = item.method === 'POST' ? 'create' : 
                                item.method === 'PATCH' || item.method === 'PUT' ? 'update' : 'delete';
              this.errorCallback(`Failed to ${actionType} ${item.entity}`, userMessage);
            }
          } else {
            // Network or server errors - increment retry count
            item.retryCount++;
            
            // Remove item if it has been retried too many times (5 attempts)
            if (item.retryCount >= 5) {
              console.error('❌ Max retries reached, removing item:', item);
              await offlineStorage.removeSyncQueueItem(item.id);
              
              // Notify user of sync failure after max retries
              if (this.errorCallback) {
                this.errorCallback(
                  `Failed to sync ${item.entity} after 5 attempts`,
                  'Please check your connection and try again'
                );
              }
            } else {
              console.log(`⚠️ Will retry (attempt ${item.retryCount}/5)`);
              await offlineStorage.updateSyncQueueItem(item);
            }
          }
        }
      }

      console.log('✅ All pending changes synced successfully');
      this.updateStatus('idle');
    } catch (error) {
      console.error('❌ Sync process failed:', error);
      this.updateStatus('error');
    } finally {
      this.syncInProgress = false;
    }
  }

  isOffline(): boolean {
    return !this.isOnline;
  }

  getStatus(): SyncStatus {
    return this.syncStatus;
  }

  // Force a full data refresh from server
  async refreshData(getAuthHeaders?: () => Promise<HeadersInit>) {
    if (!this.isOnline) return;

    try {
      const headers = getAuthHeaders ? await getAuthHeaders() : {};
      
      console.log('📦 Fetching data from server...');
      
      // Fetch and cache fresh data from server
      const [products, inventory, hospitals, procedures] = await Promise.all([
        fetch('/api/products', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : []),
        fetch('/api/inventory', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : []),
        fetch('/api/hospitals', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : []),
        fetch('/api/implant-procedures', { headers, credentials: 'include' }).then(r => r.ok ? r.json() : []),
      ]);

      console.log(`📦 Caching: ${products.length} products, ${inventory.length} inventory items, ${hospitals.length} hospitals, ${procedures.length} procedures`);

      await Promise.all([
        offlineStorage.cacheProducts(products),
        offlineStorage.cacheInventory(inventory),
        offlineStorage.cacheHospitals(hospitals),
        offlineStorage.cacheProcedures(procedures),
      ]);
      
      console.log('✅ Offline cache ready! You can now work offline.');
    } catch (error) {
      console.error('❌ Failed to refresh offline data:', error);
    }
  }
}

export const syncManager = new SyncManager();
