import { offlineStorage, type SyncQueueItem } from './offlineStorage';
import { apiRequest, queryClient } from './queryClient';
import { offlineState } from './offlineState';
import { debugLogger } from './debugLogger';

export type SyncStatus = 'idle' | 'syncing' | 'error';

class SyncManager {
  private syncStatus: SyncStatus = 'idle';
  private listeners: Set<(status: SyncStatus, pending: number) => void> = new Set();
  private syncInProgress = false;
  private errorCallback: ((error: string, details?: string) => void) | null = null;
  private userId: string | null = null; // CRITICAL: User ID for user-specific sync queue
  
  // In-memory cache to prevent concurrent duplicate mutations
  private recentMutations: Map<string, number> = new Map();
  
  // Retry scheduler (v4: Persistent sync retry)
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempts = 0;
  private maxRetryAttempts = 10; // Max retries before giving up

  constructor() {
    // Listen for online/offline changes using our reliable offlineState
    offlineState.subscribe((isOffline) => {
      if (!isOffline) {
        // Just went ONLINE - trigger retry scheduler
        debugLogger.info('🌐 Back online - triggering sync retry');
        this.attemptSync();
      } else {
        // Went OFFLINE - reset status and set sync state
        debugLogger.warn('📴 Went offline');
        this.updateStatus('idle');
        this.getPendingCount().then(async (count) => {
          if (count > 0) {
            await offlineStorage.setSyncState(true, 'went_offline_with_pending');
          }
        });
      }
    });

    // Listen for service worker sync messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_READY') {
          this.sync();
        }
      });
    }
  }
  
  // CRITICAL: Check for pending sync items from previous session
  // This should be called AFTER tokenProvider is set (from App.tsx)
  async checkInitialSync(): Promise<void> {
    debugLogger.info('🔍 checkInitialSync: Starting check');
    
    // Check if we have a persisted sync state from previous session
    const syncState = await offlineStorage.getSyncState();
    if (syncState?.needsSync) {
      debugLogger.info('📋 Found persistent sync state', { reason: syncState.reason, lastAttempt: new Date(syncState.lastAttempt).toISOString() });
    }
    
    if (!this.isOnline) {
      debugLogger.warn('⏸️ OFFLINE - waiting for offlineState subscription to trigger when online');
      await offlineStorage.setSyncState(true, 'offline_at_init');
      // Don't schedule retry while offline - offlineState subscription will trigger when online
      return;
    }
    
    const count = await this.getPendingCount();
    if (count > 0) {
      debugLogger.info(`🔄 Initial sync: ${count} pending changes`, { count });
      await offlineStorage.setSyncState(true, 'pending_changes');
      await this.attemptSync();
    } else {
      debugLogger.success('✅ No pending changes from previous session');
      await offlineStorage.clearSyncState();
    }
  }
  
  // Retry scheduler with exponential backoff
  private scheduleRetry(): void {
    // Clear existing timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    // Calculate backoff: 2s, 4s, 8s, 16s, 32s, 60s (max)
    // retryAttempts is incremented BEFORE calling this, so:
    // attempt=1: Math.pow(2, 1) = 2s
    // attempt=2: Math.pow(2, 2) = 4s
    // attempt=3: Math.pow(2, 3) = 8s, etc.
    const backoffMs = Math.min(
      Math.pow(2, this.retryAttempts) * 1000,
      60000 // Max 60 seconds
    );
    
    debugLogger.info(`⏰ Scheduling retry after attempt #${this.retryAttempts} in ${backoffMs}ms`);
    
    this.retryTimer = setTimeout(async () => {
      await this.attemptSync();
    }, backoffMs);
  }
  
  private stopRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryAttempts = 0;
  }
  
  // Attempt to sync with retry logic
  private async attemptSync(): Promise<void> {
    debugLogger.info('🔄 attemptSync: Checking conditions', { attempt: this.retryAttempts });
    
    if (!this.isOnline) {
      debugLogger.warn('⏸️ OFFLINE - waiting for offlineState subscription to trigger when online');
      await offlineStorage.setSyncState(true, 'offline_during_attempt');
      // DON'T schedule retry while offline - rely on offlineState subscription to trigger when online
      // This prevents battery-draining tight loops of 2s timers while offline
      return;
    }
    
    const count = await this.getPendingCount();
    if (count === 0) {
      debugLogger.success('✅ No pending changes, clearing sync state');
      await offlineStorage.clearSyncState();
      this.stopRetry();
      return;
    }
    
    // CRITICAL: Check max attempts BEFORE incrementing
    if (this.retryAttempts >= this.maxRetryAttempts) {
      debugLogger.error(`❌ Max retry attempts (${this.maxRetryAttempts}) reached, giving up`);
      this.errorCallback?.('Sync failed after maximum retries', 'Please check your connection and try again');
      await offlineStorage.clearSyncState();
      this.stopRetry();
      return;
    }
    
    // Increment AFTER max check passes (so attempt #10 actually runs)
    this.retryAttempts++;
    debugLogger.info(`🚀 Sync attempt #${this.retryAttempts} of ${this.maxRetryAttempts} (${count} items)`);
    
    try {
      await this.sync();
      
      // Check if sync was successful (no items left)
      const remainingCount = await this.getPendingCount();
      if (remainingCount === 0) {
        debugLogger.success('✅ Sync successful, clearing sync state');
        await offlineStorage.clearSyncState();
        this.stopRetry();
      } else {
        debugLogger.warn(`⚠️ ${remainingCount} items still pending, will retry`);
        await offlineStorage.setSyncState(true, 'partial_sync');
        this.scheduleRetry();
      }
    } catch (error) {
      debugLogger.error('❌ Sync failed', error);
      await offlineStorage.setSyncState(true, 'sync_error');
      this.scheduleRetry();
    }
  }
  
  // Always check current online status (don't cache it)
  private get isOnline(): boolean {
    return !offlineState.isOffline();
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

  // CRITICAL: Set userId for user-specific sync queue (call on login)
  setUserId(userId: string | null) {
    this.userId = userId;
    console.log(`🔐 SyncManager userId set: ${userId ? userId.substring(0, 10) + '...' : 'null'}`);
  }

  async getPendingCount(): Promise<number> {
    debugLogger.info('📊 getPendingCount called', { userId: this.userId?.substring(0, 20) + '...' || 'undefined' });
    const queue = await offlineStorage.getSyncQueue(this.userId || undefined);
    debugLogger.info('📊 getPendingCount result', { count: queue.length, userId: this.userId?.substring(0, 20) + '...' || 'undefined' });
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
    
    // Also check IndexedDB for persistence across page loads (user-specific queue)
    const existingQueue = await offlineStorage.getSyncQueue(this.userId || undefined);
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
    
    // CRITICAL: Must have userId set before queuing (prevents orphaned queue items)
    if (!this.userId) {
      console.error('❌ Cannot add to queue: userId not set!');
      return;
    }
    
    await offlineStorage.addToSyncQueue({
      type,
      entity: entity as any,
      endpoint,
      method,
      data,
    }, this.userId);
    
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
      const cleanup = await offlineStorage.cleanupTempIds();
      
      // If cleanup removed temp IDs, invalidate React Query cache to refresh UI
      if (cleanup.needsRefresh) {
        console.log('🔄 Invalidating React Query cache after temp ID cleanup');
        await queryClient.invalidateQueries();
      }
      
      // CRITICAL: Only get queue items for this user (prevents syncing other users' data)
      const queue = await offlineStorage.getSyncQueue(this.userId || undefined);
      
      if (queue.length === 0) {
        this.updateStatus('idle');
        this.syncInProgress = false;
        return;
      }

      console.log(`✅ ONLINE: Processing sync queue (${queue.length} items for user ${this.userId?.substring(0, 10)}...)...`);

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
      
      // CRITICAL: Fetch and cache full data to IndexedDB after sync
      // Location-specific queries don't cache, so we must fetch full queries
      console.log('🔄 Fetching full data to refresh IndexedDB...');
      try {
        await Promise.all([
          queryClient.fetchQuery({ queryKey: ['/api/products'] }),
          queryClient.fetchQuery({ queryKey: ['/api/inventory'] }),
          queryClient.fetchQuery({ queryKey: ['/api/hospitals'] }),
          queryClient.fetchQuery({ queryKey: ['/api/implant-procedures'] }),
        ]);
        console.log('✅ IndexedDB refreshed with latest server data');
      } catch (e) {
        console.error('Failed to refresh IndexedDB:', e);
      }
      
      // Invalidate all queries to show fresh data in UI
      await queryClient.invalidateQueries();
      console.log('✅ UI cache refreshed');
      
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
    if (!this.isOnline) {
      debugLogger.warn('Skipping data refresh - offline');
      return;
    }

    try {
      const headers = getAuthHeaders ? await getAuthHeaders() : {};
      
      debugLogger.info('Fetching data from server...', { hasAuthHeaders: !!getAuthHeaders });
      
      // Helper to fetch and validate response
      const fetchData = async (url: string) => {
        const response = await fetch(url, { headers, credentials: 'include' });
        if (!response.ok) {
          debugLogger.error(`Failed to fetch ${url}`, { status: response.status, statusText: response.statusText });
          throw new Error(`HTTP ${response.status}: ${url}`);
        }
        return response.json();
      };
      
      // Fetch and cache fresh data from server (only if successful)
      const [products, inventory, hospitals, procedures] = await Promise.all([
        fetchData('/api/products'),
        fetchData('/api/inventory'),
        fetchData('/api/hospitals'),
        fetchData('/api/implant-procedures'),
      ]);

      debugLogger.success(`Caching: ${products.length} products, ${inventory.length} inventory, ${hospitals.length} hospitals, ${procedures.length} procedures`);

      await Promise.all([
        offlineStorage.cacheProducts(products),
        offlineStorage.cacheInventory(inventory),
        offlineStorage.cacheHospitals(hospitals),
        offlineStorage.cacheProcedures(procedures),
      ]);
      
      debugLogger.success('Offline cache ready! You can now work offline.');
    } catch (error) {
      debugLogger.error('Failed to refresh offline data', { error: error instanceof Error ? error.message : String(error) });
      // Don't cache anything if fetch fails - preserve existing cache
    }
  }
}

export const syncManager = new SyncManager();
