// Offline utilities exports

export {
  // Core cache functions
  setCache,
  getCache,
  clearCache,
  invalidateCache,
  fetchWithCache,
  preloadCriticalData,
  getCacheStats,
  
  // Action queue functions
  queueAction,
  getQueuedActions,
  removeQueuedAction,
  clearActionQueue,
  
  // Utility functions
  isCapacitor,
  isOnline,
} from "./cache";

export {
  OfflineProvider,
  useOffline,
} from "./provider";
