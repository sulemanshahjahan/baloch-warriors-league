"use client";

/**
 * Offline Cache Utilities
 * 
 * Provides localStorage-based caching for API responses
 * and offline queue for actions performed while offline.
 */

const CACHE_PREFIX = "bwl_cache_";
const CACHE_VERSION = "v1";
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  url: string;
}

interface QueuedAction {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retries: number;
}

// Check if running in Capacitor
export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error Capacitor is injected by native bridge
  return !!(window.Capacitor?.isNativePlatform?.());
}

// Check online status
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

// Generate cache key
function getCacheKey(url: string): string {
  return `${CACHE_PREFIX}${CACHE_VERSION}_${url}`;
}

// Set cached data
export function setCache<T>(url: string, data: T, ttl: number = DEFAULT_TTL): void {
  if (typeof window === "undefined") return;
  
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
    url,
  };
  
  try {
    localStorage.setItem(getCacheKey(url), JSON.stringify(entry));
  } catch (e) {
    console.warn("Failed to cache data:", e);
  }
}

// Get cached data
export function getCache<T>(url: string): T | null {
  if (typeof window === "undefined") return null;
  
  try {
    const raw = localStorage.getItem(getCacheKey(url));
    if (!raw) return null;
    
    const entry: CacheEntry<T> = JSON.parse(raw);
    const now = Date.now();
    
    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(getCacheKey(url));
      return null;
    }
    
    return entry.data;
  } catch (e) {
    console.warn("Failed to read cache:", e);
    return null;
  }
}

// Clear all cached data
export function clearCache(): void {
  if (typeof window === "undefined") return;
  
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn("Failed to clear cache:", e);
  }
}

// Invalidate specific cache entries by pattern
export function invalidateCache(pattern: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX) && key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.warn("Failed to invalidate cache:", e);
  }
}

// Queue an action for later sync
export function queueAction(type: string, payload: unknown): string {
  if (typeof window === "undefined") return "";
  
  const action: QueuedAction = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };
  
  try {
    const queueKey = `${CACHE_PREFIX}action_queue`;
    const existing = localStorage.getItem(queueKey);
    const queue: QueuedAction[] = existing ? JSON.parse(existing) : [];
    queue.push(action);
    localStorage.setItem(queueKey, JSON.stringify(queue));
    return action.id;
  } catch (e) {
    console.warn("Failed to queue action:", e);
    return "";
  }
}

// Get queued actions
export function getQueuedActions(): QueuedAction[] {
  if (typeof window === "undefined") return [];
  
  try {
    const queueKey = `${CACHE_PREFIX}action_queue`;
    const raw = localStorage.getItem(queueKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Failed to get queued actions:", e);
    return [];
  }
}

// Remove action from queue
export function removeQueuedAction(id: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const queueKey = `${CACHE_PREFIX}action_queue`;
    const existing = localStorage.getItem(queueKey);
    if (!existing) return;
    
    const queue: QueuedAction[] = JSON.parse(existing);
    const filtered = queue.filter((a) => a.id !== id);
    localStorage.setItem(queueKey, JSON.stringify(filtered));
  } catch (e) {
    console.warn("Failed to remove queued action:", e);
  }
}

// Clear all queued actions
export function clearActionQueue(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(`${CACHE_PREFIX}action_queue`);
  } catch (e) {
    console.warn("Failed to clear action queue:", e);
  }
}

// Fetch with caching
export async function fetchWithCache<T>(
  url: string,
  options?: RequestInit & { ttl?: number }
): Promise<T> {
  const ttl = options?.ttl ?? DEFAULT_TTL;
  
  // Try cache first when offline
  if (!isOnline()) {
    const cached = getCache<T>(url);
    if (cached) {
      return cached;
    }
    throw new Error("No internet connection and no cached data available");
  }
  
  // Online: fetch and cache
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    setCache(url, data, ttl);
    return data;
  } catch (error) {
    // On fetch error, try to return cached data as fallback
    const cached = getCache<T>(url);
    if (cached) {
      console.warn("Fetch failed, returning cached data:", error);
      return cached;
    }
    throw error;
  }
}

// Preload critical data for offline use
export async function preloadCriticalData(): Promise<void> {
  if (!isOnline()) return;
  
  const criticalEndpoints = [
    "/api/tournaments",
    "/api/matches",
    "/api/teams",
    "/api/players",
  ];
  
  for (const endpoint of criticalEndpoints) {
    try {
      await fetchWithCache(endpoint, { ttl: 7 * 24 * 60 * 60 * 1000 }); // 7 days
    } catch (e) {
      console.warn(`Failed to preload ${endpoint}:`, e);
    }
  }
}

// Get cache stats
export function getCacheStats(): { entries: number; size: number } {
  if (typeof window === "undefined") return { entries: 0, size: 0 };
  
  try {
    let size = 0;
    let entries = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        const value = localStorage.getItem(key) ?? "";
        size += key.length + value.length;
        entries++;
      }
    }
    
    return { entries, size };
  } catch (e) {
    return { entries: 0, size: 0 };
  }
}
