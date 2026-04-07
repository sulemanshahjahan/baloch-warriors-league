"use client";

/**
 * Offline Data Card
 * 
 * Example component showing how to display data with offline state indicators.
 * Shows a badge when data is from cache (offline mode).
 */

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OfflineDataCardProps<T> {
  title: string;
  data: T[] | null;
  isLoading: boolean;
  isError: boolean;
  isOffline: boolean;
  isCached: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  renderItem: (item: T) => React.ReactNode;
  emptyMessage?: string;
}

export function OfflineDataCard<T>({
  title,
  data,
  isLoading,
  isError,
  isOffline,
  isCached,
  error,
  refetch,
  renderItem,
  emptyMessage = "No data available",
}: OfflineDataCardProps<T>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {isOffline && (
            <Badge variant="secondary" className="text-xs">
              <WifiOff className="w-3 h-3 mr-1" />
              Offline
            </Badge>
          )}
          {!isOffline && isCached && (
            <Badge variant="outline" className="text-xs">
              Cached
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void refetch()}
          disabled={isLoading || isOffline}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && !data && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )}

        {isError && !data && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {error?.message || "Failed to load data"}
            </p>
            {isOffline && (
              <p className="text-xs text-muted-foreground mt-1">
                Connect to the internet to load fresh data.
              </p>
            )}
          </div>
        )}

        {data && data.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="space-y-2">{data.map(renderItem)}</div>
        )}
      </CardContent>
    </Card>
  );
}
