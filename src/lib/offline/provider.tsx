"use client";

/**
 * Offline Provider Context
 * 
 * Manages online/offline state, syncs queued actions when back online,
 * and provides offline-aware utilities to the app.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  isOnline,
  isCapacitor,
  getQueuedActions,
  removeQueuedAction,
  preloadCriticalData,
} from "./cache";

interface OfflineContextType {
  isConnected: boolean;
  isCapacitorApp: boolean;
  queuedCount: number;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  sync: () => Promise<void>;
  preloadData: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return ctx;
}

interface OfflineProviderProps {
  children: React.ReactNode;
  onSync?: (type: string, payload: unknown) => Promise<boolean>;
}

export function OfflineProvider({ children, onSync }: OfflineProviderProps) {
  const [isConnected, setIsConnected] = useState(true);
  const [isCapacitorApp, setIsCapacitorApp] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize state
  useEffect(() => {
    setIsConnected(isOnline());
    setIsCapacitorApp(isCapacitor());
    setQueuedCount(getQueuedActions().length);
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsConnected(true);
      // Auto-sync when coming back online
      if (onSync) {
        void sync();
      }
    };

    const handleOffline = () => {
      setIsConnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [onSync]);

  // Sync queued actions
  const sync = useCallback(async () => {
    if (!onSync || isSyncing) return;

    setIsSyncing(true);
    const queue = getQueuedActions();
    let successCount = 0;

    for (const action of queue) {
      try {
        const success = await onSync(action.type, action.payload);
        if (success) {
          removeQueuedAction(action.id);
          successCount++;
        }
      } catch (e) {
        console.error(`Failed to sync action ${action.id}:`, e);
      }
    }

    setQueuedCount(getQueuedActions().length);
    setLastSyncTime(new Date());
    setIsSyncing(false);

    console.log(`Synced ${successCount}/${queue.length} queued actions`);
  }, [onSync, isSyncing]);

  // Preload critical data
  const preloadData = useCallback(async () => {
    await preloadCriticalData();
  }, []);

  const value: OfflineContextType = {
    isConnected,
    isCapacitorApp,
    queuedCount,
    lastSyncTime,
    isSyncing,
    sync,
    preloadData,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}
