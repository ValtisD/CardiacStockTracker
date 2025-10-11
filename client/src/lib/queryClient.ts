import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { offlineStorage } from "./offlineStorage";
import { syncManager } from "./syncManager";

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
): Promise<Response> {
  const headers = await getAuthHeaders();
  
  // If offline and this is a mutation, queue it and return a mock success response
  if (!navigator.onLine && method !== 'GET') {
    console.log('Offline: Queueing mutation', method, url);
    
    // Queue the mutation for later sync
    await syncManager.addToQueue(
      data ? 'create' : 'delete',
      getEntityFromUrl(url),
      url,
      method,
      data
    );
    
    // Update local cache optimistically
    await updateLocalCache(url, method, data);
    
    // Return mock success response
    return new Response(JSON.stringify(data || {}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
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
      // Add new item to cache with temporary ID
      const tempId = `temp-${Date.now()}`;
      const itemWithId = { ...data, id: tempId };
      
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
    
    // If offline, return cached data immediately
    if (!navigator.onLine) {
      console.log('Offline: Loading from cache:', url);
      try {
        if (url.includes('/api/products')) {
          const data = await offlineStorage.getProducts();
          console.log('Offline: Loaded', data?.length, 'products from cache');
          return data;
        } else if (url.includes('/api/inventory/home')) {
          return await offlineStorage.getInventoryByLocation('home');
        } else if (url.includes('/api/inventory/car')) {
          return await offlineStorage.getInventoryByLocation('car');
        } else if (url.includes('/api/inventory')) {
          return await offlineStorage.getInventory();
        } else if (url.includes('/api/hospitals')) {
          return await offlineStorage.getHospitals();
        } else if (url.includes('/api/implant-procedures')) {
          return await offlineStorage.getProcedures();
        }
      } catch (e) {
        console.error('Failed to get offline data:', e);
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
        if (url.includes('/api/products')) {
          await offlineStorage.cacheProducts(data);
          console.log('Cached', data?.length, 'products for offline use');
        } else if (url.includes('/api/inventory')) {
          await offlineStorage.cacheInventory(data);
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
      console.log('Network error, trying cache:', url);
      try {
        if (url.includes('/api/products')) {
          return await offlineStorage.getProducts();
        } else if (url.includes('/api/inventory/home')) {
          return await offlineStorage.getInventoryByLocation('home');
        } else if (url.includes('/api/inventory/car')) {
          return await offlineStorage.getInventoryByLocation('car');
        } else if (url.includes('/api/inventory')) {
          return await offlineStorage.getInventory();
        } else if (url.includes('/api/hospitals')) {
          return await offlineStorage.getHospitals();
        } else if (url.includes('/api/implant-procedures')) {
          return await offlineStorage.getProcedures();
        }
      } catch (e) {
        console.error('Failed to get offline data after network error:', e);
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
