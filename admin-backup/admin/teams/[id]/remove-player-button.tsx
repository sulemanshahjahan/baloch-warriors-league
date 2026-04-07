"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { removePlayerFromTeam } from "@/lib/actions/team";
import { useRouter } from "next/navigation";

export function RemovePlayerButton({
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
  const [error, setError] = useState<string | undefined>(undefined);
  const router = useRouter();

  async function handleRemove() {
    setLoading(true);
    setError(undefined);
    const result = await removePlayerFromTeam(teamPlayerId, teamId);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive h-7 w-7 p-0"
        title={`Remove ${playerName} from team`}
      >
        <UserMinus className="w-3.5 h-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Player</DialogTitle>
            <DialogDescription>
              Remove <strong>{playerName}</strong> from this team? They will be marked as left but their match history will be preserved.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={loading}>
              {loading ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
