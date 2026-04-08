"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

export function ReactivatePlayerButton({
  teamPlayerId,
  teamId,
  playerName,
}: {
  teamPlayerId: string;
  teamId: string;
  playerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleReactivate() {
    setLoading(true);
    const { reactivatePlayerOnTeam } = await import("@/lib/actions/team");
    const result = await reactivatePlayerOnTeam(teamPlayerId, teamId);
    setLoading(false);
    if (result.success) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-green-400 hover:text-green-400 h-7 w-7 p-0"
        title={`Re-add ${playerName}`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivate Player</DialogTitle>
            <DialogDescription>
              Re-add <strong>{playerName}</strong> to the active squad?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleReactivate} disabled={loading}>
              {loading ? "Reactivating…" : "Reactivate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
