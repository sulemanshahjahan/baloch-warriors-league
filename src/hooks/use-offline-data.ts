"use client";

/**
 * useOfflineData Hook
 * 
 * A hook for fetching data with offline caching support.
 * Returns cached data immediately if available, then refreshes when online.
 */

import { useState, useEffect, useCallback } from "react";
import { fetchWithCache, getCache, isOnline } from "@/lib/offline/cache";

interface UseOfflineDataOptions<T> {
  url: string | null;
  ttl?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseOfflineDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isOffline: boolean;
  isCached: boolean;
  refetch: () => Promise<void>;
}

export function useOfflineData<T>(
  options: UseOfflineDataOptions<T>
): UseOfflineDataResult<T> {
  const { url, ttl, enabled = true, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isCached, setIsCached] = useState(false);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return;

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      // Check for cached data first
      const cached = getCache<T>(url);
      if (cached) {
        setData(cached);
        setIsCached(true);
      }

      // Fetch fresh data if online
      if (isOnline()) {
        const fresh = await fetchWithCache<T>(url, { ttl });
        setData(fresh);
        setIsCached(false);
        onSuccess?.(fresh);
      } else if (!cached) {
        throw new Error("No internet connection and no cached data available");
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setIsError(true);
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [url, ttl, enabled, onSuccess, onError]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Listen for online events to auto-refresh
  useEffect(() => {
    const handleOnline = () => {
      if (isCached) {
        void fetchData();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchData, isCached]);

  return {
    data,
    isLoading,
    isError,
    error,
    isOffline: !isOnline(),
    isCached,
    refetch: fetchData,
  };
}

// Hook for prefetching data
export function usePrefetch() {
  const prefetch = useCallback(async (url: string, ttl?: number) => {
    try {
      await fetchWithCache(url, { ttl });
      return true;
    } catch {
      return false;
    }
  }, []);

  return prefetch;
}

// Hook for checking if data is available offline
export function useIsCached(url: string | null): boolean {
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    if (!url) {
      setIsCached(false);
      return;
    }
    setIsCached(!!getCache(url));
  }, [url]);

  return isCached;
}
