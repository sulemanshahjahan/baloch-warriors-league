"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { clearOldActivityLogs } from "@/lib/actions/activity-log";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ClearLogsButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);
  const router = useRouter();

  async function handleClear() {
    setLoading(true);
    const res = await clearOldActivityLogs(90); // Keep 90 days
    setLoading(false);
    setResult(res);
    
    if (res.success) {
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1500);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="w-4 h-4 mr-2" />
        Clear Old Logs (90+ days)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Old Activity Logs</DialogTitle>
            <DialogDescription>
              This will permanently delete all activity logs older than 90 days. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className={`text-sm p-3 rounded ${result.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {result.success 
                ? `Successfully cleared ${result.count} old log entries.` 
                : result.error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear} disabled={loading}>
              {loading ? "Clearing..." : "Clear Old Logs"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
