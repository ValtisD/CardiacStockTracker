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
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = await getAuthHeaders();
    const url = queryKey.join("/") as string;
    
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
      if (navigator.onLine) {
        try {
          if (url.includes('/api/products')) {
            await offlineStorage.cacheProducts(data);
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
      }
      
      return data;
    } catch (error) {
      // If offline, try to get data from cache
      if (!navigator.onLine) {
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
          console.error('Failed to get offline data:', e);
        }
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
