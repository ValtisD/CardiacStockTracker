import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { offlineStorage } from "./offlineStorage";
import { syncManager } from "./syncManager";
import { offlineState } from "./offlineState";
import { debugLogger } from "./debugLogger";

// Token provider - will be set by Auth0Provider wrapper
let getAccessToken: (() => Promise<string>) | null = null;

export function setTokenProvider(provider: () => Promise<string>) {
  getAccessToken = provider;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (getAccessToken) {
    try {
      const token = await getAccessToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (error) {
      console.error("Failed to get access token:", error);
    }
  }
  
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { bypassOfflineCheck?: boolean }
): Promise<Response> {
  const isOffline = offlineState.isOffline();
  console.log('apiRequest called:', method, url, 'Online:', !isOffline, 'Bypass:', options?.bypassOfflineCheck);
  
  const headers = await getAuthHeaders();
  
  // If offline and this is a mutation, queue it and return a mock success response
  // BUT: Skip offline check if this is called from sync manager (it already verified we're online)
  if (isOffline && method !== 'GET' && !options?.bypassOfflineCheck) {
    console.log('🔴 OFFLINE MODE: Queueing mutation', method, url, data);
    
    try {
      // For POST requests, generate a temp ID to return
      let responseData: any = data || {};
      if (method === 'POST' && data) {
        const tempId = `temp-${Date.now()}`;
        responseData = { ...(data as object), id: tempId };
      }
      
      // Queue the mutation for later sync
      await syncManager.addToQueue(
        data ? 'create' : 'delete',
        getEntityFromUrl(url),
        url,
        method,
        data
      );
      console.log('✅ Mutation queued successfully');
      
      // Update local cache optimistically with the same temp ID
      await updateLocalCache(url, method, responseData);
      console.log('✅ Local cache updated');
      
      // Return mock success response with temp ID for POST requests
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('❌ Failed to queue offline mutation:', error);
      throw error;
    }
  }
  
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error: any) {
    // Check if this is a client error (400-499) - these should not be queued
    const errorMessage = error?.message || '';
    const isClientError = /^4\d{2}:/.test(errorMessage);
    
    // If network error and this is a mutation, try offline queue
    // But DON'T queue client errors (validation failures, not found, etc.)
    if (method !== 'GET' && !isClientError) {
      console.log('🔴 Network error on mutation, attempting offline queue:', method, url);
      try {
        await syncManager.addToQueue(
          data ? 'create' : 'delete',
          getEntityFromUrl(url),
          url,
          method,
          data
        );
        await updateLocalCache(url, method, data);
        console.log('✅ Mutation queued after network error');
        
        return new Response(JSON.stringify(data || {}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (queueError) {
        console.error('❌ Failed to queue mutation after network error:', queueError);
      }
    }
    
    // For client errors or if queueing failed, throw the original error
    throw error;
  }
}

// Helper to extract entity type from URL
function getEntityFromUrl(url: string): string {
  if (url.includes('/products')) return 'products';
  if (url.includes('/inventory')) return 'inventory';
  if (url.includes('/hospitals')) return 'hospitals';
  if (url.includes('/implant-procedures')) return 'procedures';
  return 'unknown';
}

// Helper to update local cache optimistically
async function updateLocalCache(url: string, method: string, data: any) {
  try {
    if (method === 'POST') {
      // Data already has the temp ID from the calling function
      const itemWithId = data.id ? data : { ...data, id: `temp-${Date.now()}` };
      
      if (url.includes('/inventory')) {
        const existing = await offlineStorage.getInventory();
        await offlineStorage.cacheInventory([...existing, itemWithId]);
      } else if (url.includes('/implant-procedures')) {
        const existing = await offlineStorage.getProcedures();
        await offlineStorage.cacheProcedures([...existing, itemWithId]);
      } else if (url.includes('/hospitals')) {
        const existing = await offlineStorage.getHospitals();
        await offlineStorage.cacheHospitals([...existing, itemWithId]);
      } else if (url.includes('/products')) {
        const existing = await offlineStorage.getProducts();
        await offlineStorage.cacheProducts([...existing, itemWithId]);
      }
    } else if (method === 'PATCH' || method === 'PUT') {
      // Update existing item in cache
      if (url.includes('/inventory')) {
        const existing = await offlineStorage.getInventory();
        const id = url.split('/').pop();
        const updated = existing.map(item => item.id === id ? { ...item, ...data } : item);
        await offlineStorage.cacheInventory(updated);
      } else if (url.includes('/implant-procedures')) {
        const existing = await offlineStorage.getProcedures();
        const id = url.split('/').pop();
        const updated = existing.map(item => item.id === id ? { ...item, ...data } : item);
        await offlineStorage.cacheProcedures(updated);
      }
    } else if (method === 'DELETE') {
      // Remove item from cache
      const id = url.split('/').pop();
      if (url.includes('/inventory')) {
        const existing = await offlineStorage.getInventory();
        await offlineStorage.cacheInventory(existing.filter(item => item.id !== id));
      } else if (url.includes('/implant-procedures')) {
        const existing = await offlineStorage.getProcedures();
        await offlineStorage.cacheProcedures(existing.filter(item => item.id !== id));
      }
    }
  } catch (error) {
    console.error('Failed to update local cache:', error);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
    // DEBUG: Always log every request
    debugLogger.info('🌐 getQueryFn called', { url, isOffline: offlineState.isOffline() });
    
    // If offline, return cached data immediately
    if (offlineState.isOffline()) {
      debugLogger.info('OFFLINE MODE: Loading from cache', { url });
      try {
        // Check specific endpoints first, then generic ones
        if (url.includes('/api/user/me')) {
          const user = await offlineStorage.getUser();
          debugLogger.success('Loaded user from cache', { email: user?.email });
          return user || null;
        } else if (url.includes('/api/products')) {
          const data = await offlineStorage.getProducts();
          debugLogger.success(`Loaded ${data?.length || 0} products from cache`);
          return data;
        } else if (url.includes('/api/inventory/low-stock')) {
          // IMPORTANT: Check /low-stock BEFORE /inventory (more specific first!)
          debugLogger.warn('Low stock queries not available offline, returning []');
          return [];
        } else if (url.includes('/api/inventory/summary')) {
          // IMPORTANT: Check /summary BEFORE /inventory
          debugLogger.warn('Inventory summary not available offline, returning []');
          return [];
        } else if (url.includes('/api/inventory') && url.includes('location=home')) {
          debugLogger.info('Loading HOME inventory from IndexedDB...');
          const data = await offlineStorage.getInventoryByLocation('home');
          debugLogger.success(`✅ Loaded ${data?.length || 0} HOME inventory items from cache`, { items: data?.length });
          return data || [];
        } else if (url.includes('/api/inventory') && url.includes('location=car')) {
          debugLogger.info('Loading CAR inventory from IndexedDB...');
          const data = await offlineStorage.getInventoryByLocation('car');
          debugLogger.success(`✅ Loaded ${data?.length || 0} CAR inventory items from cache`, { items: data?.length });
          return data || [];
        } else if (url.includes('/api/inventory')) {
          debugLogger.info('Loading ALL inventory from IndexedDB...');
          const data = await offlineStorage.getInventory();
          debugLogger.success(`✅ Loaded ${data?.length || 0} ALL inventory items from cache`, { items: data?.length });
          return data || [];
        } else if (url.includes('/api/hospitals')) {
          const data = await offlineStorage.getHospitals();
          debugLogger.success(`Loaded ${data?.length || 0} hospitals from cache`);
          return data || [];
        } else if (url.includes('/api/implant-procedures')) {
          const data = await offlineStorage.getProcedures();
          debugLogger.success(`Loaded ${data?.length || 0} procedures from cache`);
          return data || [];
        } else if (url.includes('/api/user-product-settings')) {
          debugLogger.warn('User product settings not cached, returning []');
          return [];
        } else if (url.includes('/api/user/language')) {
          debugLogger.warn('User language not cached, using default');
          return { language: 'en' };
        }
        
        // If nothing matched
        debugLogger.warn('URL not matched for offline fallback', { url });
        return [] as any;
      } catch (e) {
        debugLogger.error('Failed to get offline data', { error: e instanceof Error ? e.message : String(e), url });
        // Return empty array as fallback
        return [] as any;
      }
    }
    
    // Online: fetch from server
    const headers = await getAuthHeaders();
    
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      
      // Cache data for offline use
      try {
        if (url.includes('/api/user/me')) {
          await offlineStorage.cacheUser(data);
          console.log('Cached user for offline use:', data?.email);
        } else if (url.includes('/api/products')) {
          await offlineStorage.cacheProducts(data);
          console.log('Cached', data?.length, 'products for offline use');
        } else if (url === '/api/inventory') {
          // CRITICAL: Only cache FULL inventory query (not location-specific queries)
          // Location-specific queries would clear the entire inventory store
          await offlineStorage.cacheInventory(data);
          console.log('Cached', data?.length, 'inventory items for offline use');
        } else if (url.includes('/api/hospitals')) {
          await offlineStorage.cacheHospitals(data);
        } else if (url.includes('/api/implant-procedures')) {
          await offlineStorage.cacheProcedures(data);
        }
      } catch (e) {
        console.error('Failed to cache data offline:', e);
      }
      
      return data;
    } catch (error) {
      // Network error fallback - try cache
      debugLogger.warn('Network error, trying offline cache', { url });
      try {
        if (url.includes('/api/user/me')) {
          const cachedUser = await offlineStorage.getUser();
          debugLogger.success('Loaded user from cache', { email: cachedUser?.email });
          return cachedUser;
        } else if (url.includes('/api/products')) {
          const cachedProducts = await offlineStorage.getProducts();
          debugLogger.success(`Loaded ${cachedProducts?.length || 0} products from cache`);
          return cachedProducts;
        } else if (url.includes('/api/inventory')) {
          // Parse query parameters to determine location
          const urlObj = new URL(url, window.location.origin);
          const location = urlObj.searchParams.get('location');
          
          debugLogger.info('Inventory request detected', { url, location });
          
          if (location === 'home') {
            const cachedItems = await offlineStorage.getInventoryByLocation('home');
            debugLogger.success(`Loaded ${cachedItems?.length || 0} HOME inventory items from cache`);
            return cachedItems;
          } else if (location === 'car') {
            const cachedItems = await offlineStorage.getInventoryByLocation('car');
            debugLogger.success(`Loaded ${cachedItems?.length || 0} CAR inventory items from cache`);
            return cachedItems;
          } else {
            // No location specified - return all inventory
            const cachedItems = await offlineStorage.getInventory();
            debugLogger.success(`Loaded ${cachedItems?.length || 0} ALL inventory items from cache`);
            return cachedItems;
          }
        } else if (url.includes('/api/hospitals')) {
          const cachedHospitals = await offlineStorage.getHospitals();
          debugLogger.success(`Loaded ${cachedHospitals?.length || 0} hospitals from cache`);
          return cachedHospitals;
        } else if (url.includes('/api/implant-procedures')) {
          const cachedProcedures = await offlineStorage.getProcedures();
          debugLogger.success(`Loaded ${cachedProcedures?.length || 0} procedures from cache`);
          return cachedProcedures;
        }
        
        // URL not matched
        debugLogger.error('URL not matched for offline fallback', { url });
      } catch (e) {
        debugLogger.error('Failed to get offline data', { error: e instanceof Error ? e.message : String(e), url });
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
