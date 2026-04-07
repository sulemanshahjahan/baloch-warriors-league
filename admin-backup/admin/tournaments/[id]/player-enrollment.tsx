"use client";

// Individual player enrollment for 1v1 tournaments with bulk operations
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, Loader2, User, Users, X } from "lucide-react";
import {
  enrollPlayerInTournament,
  removePlayerFromTournament,
  bulkEnrollPlayersInTournament,
  bulkRemovePlayersFromTournament,
} from "@/lib/actions/tournament";
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
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [error, setError] = useState("");

  // Bulk selection states
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);

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

  function handleBulkAdd() {
    if (selectedToAdd.length === 0) return;
    setError("");
    startTransition(async () => {
      const result = await bulkEnrollPlayersInTournament(tournamentId, selectedToAdd);
      if (result.success) {
        setBulkDialogOpen(false);
        setSelectedToAdd([]);
        router.refresh();
      } else {
        setError((result as { error?: string }).error ?? "Failed to enroll players");
      }
    });
  }

  function handleBulkRemove() {
    if (selectedToRemove.length === 0) return;
    startTransition(async () => {
      await bulkRemovePlayersFromTournament(tournamentId, selectedToRemove);
      setSelectedToRemove([]);
      router.refresh();
    });
  }

  const allAddSelected = selectedToAdd.length === availablePlayers.length && availablePlayers.length > 0;
  const someAddSelected = selectedToAdd.length > 0 && selectedToAdd.length < availablePlayers.length;

  const allRemoveSelected = selectedToRemove.length === enrolledPlayers.length && enrolledPlayers.length > 0;
  const someRemoveSelected = selectedToRemove.length > 0 && selectedToRemove.length < enrolledPlayers.length;

  return (
    <div className="space-y-4">
      {/* Enrolled Players List with Bulk Remove */}
      {enrolledPlayers.length === 0 ? (
        <div className="text-center py-6">
          <User className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No players enrolled yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Bulk Remove Toolbar */}
          {selectedToRemove.length > 0 && (
            <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg">
              <span className="text-sm text-destructive font-medium">
                {selectedToRemove.length} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkRemove}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Remove Selected
              </Button>
            </div>
          )}

          {/* Select All Checkbox */}
          {enrolledPlayers.length > 0 && (
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                checked={allRemoveSelected}
                data-state={someRemoveSelected ? "indeterminate" : allRemoveSelected ? "checked" : "unchecked"}
                onCheckedChange={() => {
                  if (allRemoveSelected) {
                    setSelectedToRemove([]);
                  } else {
                    setSelectedToRemove(enrolledPlayers.map((p) => p.id));
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">
                {selectedToRemove.length > 0 ? `${selectedToRemove.length} selected` : "Select all"}
              </span>
            </div>
          )}

          {/* Player List */}
          {enrolledPlayers.map(({ id, player }) => (
            <div
              key={id}
              className={`flex items-center gap-3 p-3 rounded-lg group transition-colors ${
                selectedToRemove.includes(id) ? "bg-primary/10" : "bg-muted/50"
              }`}
            >
              <Checkbox
                checked={selectedToRemove.includes(id)}
                onCheckedChange={() => {
                  if (selectedToRemove.includes(id)) {
                    setSelectedToRemove(selectedToRemove.filter((sid) => sid !== id));
                  } else {
                    setSelectedToRemove([...selectedToRemove, id]);
                  }
                }}
              />
              <Link
                href={`/admin/players/${player.id}`}
                className="flex items-center gap-3 hover:opacity-80 flex-1"
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

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Single Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="flex-1"
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

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availablePlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedPlayerId === player.id
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={player.photoUrl ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-medium text-sm">{player.name}</p>
                </button>
              ))}
            </div>

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

        {/* Bulk Add Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={availablePlayers.length === 0}
            >
              <Users className="w-4 h-4 mr-2" />
              Bulk Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bulk Add Players</DialogTitle>
              <DialogDescription>
                Select multiple players to enroll at once. ({availablePlayers.length} available)
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            {/* Select All */}
            <div className="flex items-center justify-between px-2 py-2 bg-muted/50 rounded">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allAddSelected}
                  data-state={someAddSelected ? "indeterminate" : allAddSelected ? "checked" : "unchecked"}
                  onCheckedChange={() => {
                    if (allAddSelected) {
                      setSelectedToAdd([]);
                    } else {
                      setSelectedToAdd(availablePlayers.map((p) => p.id));
                    }
                  }}
                />
                <span className="text-sm">
                  {selectedToAdd.length > 0 ? `${selectedToAdd.length} selected` : "Select all"}
                </span>
              </div>
              {selectedToAdd.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedToAdd([])}
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Player Selection List */}
            <div className="h-72 overflow-y-auto pr-2">
              <div className="space-y-1 pr-4">
                {availablePlayers.map((player) => (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedToAdd.includes(player.id)
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedToAdd.includes(player.id)}
                      onCheckedChange={() => {
                        if (selectedToAdd.includes(player.id)) {
                          setSelectedToAdd(selectedToAdd.filter((id) => id !== player.id));
                        } else {
                          setSelectedToAdd([...selectedToAdd, player.id]);
                        }
                      }}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={player.photoUrl ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(player.name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium text-sm">{player.name}</p>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setBulkDialogOpen(false);
                setSelectedToAdd([]);
                setError("");
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkAdd}
                disabled={selectedToAdd.length === 0 || isPending}
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add {selectedToAdd.length > 0 && `(${selectedToAdd.length})`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
