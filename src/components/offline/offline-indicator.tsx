"use client";

/**
 * Offline Indicator Component
 * 
 * Shows a banner when the app is offline or has pending sync actions.
 */

import { useEffect, useState } from "react";
import { WifiOff, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useOffline } from "@/lib/offline/provider";
import { Button } from "@/components/ui/button";

export function OfflineIndicator() {
  const {
    isConnected,
    queuedCount,
    isSyncing,
    sync,
    lastSyncTime,
  } = useOffline();
  
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Show banner when offline or when there are queued actions
    setShowBanner(!isConnected || queuedCount > 0);
  }, [isConnected, queuedCount]);

  if (!mounted) return null;

  // Compact indicator for online state with no queued actions
  if (isConnected && queuedCount === 0) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium border border-green-500/20 cursor-help"
        title={`Last sync: ${lastSyncTime ? lastSyncTime.toLocaleTimeString() : "Never"}`}
      >
        <Cloud className="w-3.5 h-3.5" />
        <span>Online</span>
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        showBanner ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div
        className={`mx-4 mb-4 p-3 rounded-lg shadow-lg border ${
          isConnected
            ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-700"
            : "bg-red-500/10 border-red-500/20 text-red-700"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CloudOff className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {!isConnected
                ? "You're offline"
                : `${queuedCount} action${queuedCount > 1 ? "s" : ""} pending sync`}
            </span>
          </div>

          {isConnected && queuedCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void sync()}
              disabled={isSyncing}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
              Sync now
            </Button>
          )}
        </div>

        {!isConnected && (
          <p className="text-xs mt-1 opacity-80">
            Cached data is available. Your actions will sync when you're back online.
          </p>
        )}
      </div>
    </div>
  );
}
