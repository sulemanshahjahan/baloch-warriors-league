"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, X, CheckSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface BulkDeleteBarProps {
  selectedIds: string[];
  entityName: string;
  onClear: () => void;
  onDelete: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
}

export function BulkDeleteBar({ selectedIds, entityName, onClear, onDelete }: BulkDeleteBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  if (selectedIds.length === 0) return null;

  function handleDelete() {
    setError("");
    startTransition(async () => {
      const result = await onDelete(selectedIds);
      if (result.success) {
        setConfirmOpen(false);
        onClear();
        router.refresh();
      } else {
        setError(result.error ?? "Delete failed");
      }
    });
  }

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border shadow-2xl shadow-black/50">
        <CheckSquare className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">
          {selectedIds.length} {entityName}{selectedIds.length > 1 ? "s" : ""} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="w-3 h-3" />
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="w-3 h-3" />
          Delete
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.length} {entityName}{selectedIds.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedIds.length} {entityName}{selectedIds.length > 1 ? "s" : ""} and all related data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete {selectedIds.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
