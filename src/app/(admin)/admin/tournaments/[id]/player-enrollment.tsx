"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, Loader2, User } from "lucide-react";
import { enrollPlayerInTournament, removePlayerFromTournament } from "@/lib/actions/tournament";
import { getInitials } from "@/lib/utils";

interface PlayerEnrollmentProps {
  tournamentId: string;
  enrolledPlayers: Array<{
    id: string;
    player: { id: string; name: string; photoUrl: string | null };
  }>;
  availablePlayers: Array<{ id: string; name: string; photoUrl: string | null }>;
}

export function PlayerEnrollment({
  tournamentId,
  enrolledPlayers,
  availablePlayers,
}: PlayerEnrollmentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");

  function handleEnroll() {
    if (!selectedPlayerId) return;
    setError("");
    startTransition(async () => {
      const result = await enrollPlayerInTournament(tournamentId, selectedPlayerId);
      if (result.success) {
        setDialogOpen(false);
        setSelectedPlayerId("");
        router.refresh();
      } else {
        setError((result as { error?: string }).error ?? "Failed to enroll player");
      }
    });
  }

  function handleRemove(tournamentPlayerId: string) {
    startTransition(async () => {
      await removePlayerFromTournament(tournamentId, tournamentPlayerId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {enrolledPlayers.length === 0 ? (
        <div className="text-center py-6">
          <User className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No players enrolled yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {enrolledPlayers.map(({ id, player }) => (
            <div
              key={id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group"
            >
              <Link
                href={`/admin/players/${player.id}`}
                className="flex items-center gap-3 hover:opacity-80"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={player.photoUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(player.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-medium text-sm">{player.name}</p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(id)}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-destructive" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full"
            disabled={availablePlayers.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            {availablePlayers.length === 0 ? "All players enrolled" : "Add Player"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Player</DialogTitle>
            <DialogDescription>
              Select a player to enroll individually in this tournament.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a player..." />
            </SelectTrigger>
            <SelectContent>
              {availablePlayers.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={player.photoUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(player.name)}
                      </AvatarFallback>
                    </Avatar>
                    {player.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEnroll} disabled={!selectedPlayerId || isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Player
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
