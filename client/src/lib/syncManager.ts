import { offlineStorage, type SyncQueueItem } from './offlineStorage';
import { apiRequest } from './queryClient';

export type SyncStatus = 'idle' | 'syncing' | 'error';

class SyncManager {
  private syncStatus: SyncStatus = 'idle';
  private listeners: Set<(status: SyncStatus, pending: number) => void> = new Set();
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.sync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
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
    if (this.isOnline) {
      setTimeout(() => this.sync(), 1000);
    }
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
    // Check for duplicate entries to prevent the same mutation from being queued multiple times
    const existingQueue = await offlineStorage.getSyncQueue();
    const isDuplicate = existingQueue.some(item => 
      item.endpoint === endpoint && 
      item.method === method && 
      JSON.stringify(item.data) === JSON.stringify(data) &&
      // Only check duplicates added within last 5 seconds to allow intentional duplicates later
      (Date.now() - item.timestamp < 5000)
    );
    
    if (isDuplicate) {
      console.warn('⚠️ Duplicate mutation detected, skipping queue addition:', method, endpoint);
      return;
    }
    
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
          
          // Execute the sync request
          await apiRequest(item.method as any, item.endpoint, item.data);
          
          // Remove from queue on success
          await offlineStorage.removeSyncQueueItem(item.id);
          console.log(`✅ Synced successfully: ${item.method} ${item.endpoint}`);
        } catch (error) {
          console.error('❌ Sync failed for item:', item, error);
          
          // Increment retry count
          item.retryCount++;
          
          // Remove item if it has been retried too many times (5 attempts)
          if (item.retryCount >= 5) {
            console.error('❌ Max retries reached, removing item:', item);
            await offlineStorage.removeSyncQueueItem(item.id);
          } else {
            await offlineStorage.updateSyncQueueItem(item);
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
