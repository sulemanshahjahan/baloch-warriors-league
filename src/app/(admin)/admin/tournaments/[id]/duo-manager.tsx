"use client";

// 2v2 duo pairing manager — manual pairing, skill-based auto-pairing,
// rename + delete. Shown on the tournament dashboard when eFootballMode === "2v2".
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Trash2, Loader2, Users, Sparkles, Pencil, Check, X } from "lucide-react";
import { createDuo, autoPairDuos, createDuosFromPairs, renameDuo, deleteDuo } from "@/lib/actions/duo";
import type { DuoView, DuoRatingSource } from "@/lib/actions/duo";
import { AnimatedDuoPair } from "@/components/admin/animated-duo-pair";
import { getInitials } from "@/lib/utils";

interface AvailablePlayer {
  id: string;
  name: string;
  photoUrl: string | null;
  cardRank: number;
  skillLevel: number | null;
}

interface DuoManagerProps {
  tournamentId: string;
  duos: DuoView[];
  availablePlayers: AvailablePlayer[];
}

export function DuoManager({ tournamentId, duos, availablePlayers }: DuoManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Manual pairing dialog
  const [addOpen, setAddOpen] = useState(false);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [duoName, setDuoName] = useState("");

  // Auto-pair dialog
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoSelected, setAutoSelected] = useState<string[]>([]);
  const [ratingSource, setRatingSource] = useState<DuoRatingSource>("CARD");

  // Animated auto-pair overlay
  const [animateOpen, setAnimateOpen] = useState(false);
  const [animatePlayers, setAnimatePlayers] = useState<AvailablePlayer[]>([]);
  const [animateSource, setAnimateSource] = useState<DuoRatingSource>("CARD");

  const ratingOf = (p: AvailablePlayer) => (ratingSource === "SKILL" ? p.skillLevel ?? 70 : p.cardRank);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function reset() {
    setP1("");
    setP2("");
    setDuoName("");
    setAutoSelected([]);
    setError("");
  }

  function handleCreate() {
    setError("");
    startTransition(async () => {
      const res = await createDuo(tournamentId, p1, p2, duoName.trim() || undefined);
      if (res.success) {
        setAddOpen(false);
        reset();
        setNotice(res.message ?? "Duo created");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleAutoPair() {
    setError("");
    startTransition(async () => {
      const res = await autoPairDuos(tournamentId, autoSelected, ratingSource);
      if (res.success) {
        setAutoOpen(false);
        reset();
        setNotice(res.message ?? "Duos created");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function launchAnimatedPair() {
    const selected = availablePlayers.filter((p) => autoSelected.includes(p.id));
    if (selected.length < 2) return;
    setAnimatePlayers(selected);
    setAnimateSource(ratingSource);
    setAutoOpen(false);
    setAnimateOpen(true);
  }

  async function handleAnimatedConfirm(pairs: { player1Id: string; player2Id: string }[]) {
    const res = await createDuosFromPairs(tournamentId, pairs);
    setAnimateOpen(false);
    reset();
    if (res.success) {
      setNotice(res.message ?? "Duos created");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  function handleRename(teamId: string) {
    startTransition(async () => {
      const res = await renameDuo(tournamentId, teamId, editName);
      if (res.success) {
        setEditingId(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleDelete(teamId: string) {
    startTransition(async () => {
      const res = await deleteDuo(tournamentId, teamId);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const oddSelected = autoSelected.length % 2 === 1;

  return (
    <div className="space-y-4">
      {notice && (
        <p className="text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
          {notice}
        </p>
      )}
      {error && !addOpen && !autoOpen && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Duo list */}
      {duos.length === 0 ? (
        <div className="text-center py-6">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">
            No duos yet. Pair players manually or auto-pair by skill.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {duos.map((duo) => (
            <div key={duo.teamId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group">
              {/* Members */}
              <div className="flex items-center gap-0.5 shrink-0">
                {duo.players.map((pl) => (
                  <Avatar key={pl.id} className="h-8 w-8">
                    <AvatarImage src={pl.photoUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(pl.name)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>

              <div className="flex-1 min-w-0">
                {editingId === duo.teamId ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRename(duo.teamId)} disabled={isPending}>
                      <Check className="w-4 h-4 text-emerald-500" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-sm truncate">{duo.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {duo.players.map((p) => `${p.name} (${p.cardRank})`).join(" + ")} · avg card{" "}
                      {Math.round(duo.combinedRating / Math.max(1, duo.players.length))}
                    </p>
                  </>
                )}
              </div>

              {editingId !== duo.teamId && (
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingId(duo.teamId);
                      setEditName(duo.name);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(duo.teamId)} disabled={isPending}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {/* Manual pair */}
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1" disabled={availablePlayers.length < 2}>
              <Plus className="w-4 h-4 mr-2" />
              {availablePlayers.length < 2 ? "Not enough players" : "Pair Duo"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Duo</DialogTitle>
              <DialogDescription>Pick two players. Leave the name blank to auto-generate one.</DialogDescription>
            </DialogHeader>

            {error && addOpen && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Player 1</Label>
                <Select value={p1} onValueChange={setP1}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {availablePlayers.filter((p) => p.id !== p2).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.cardRank})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Player 2</Label>
                <Select value={p2} onValueChange={setP2}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {availablePlayers.filter((p) => p.id !== p1).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.cardRank})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Duo name (optional)</Label>
              <Input
                value={duoName}
                onChange={(e) => setDuoName(e.target.value)}
                placeholder="Auto: e.g. Haroon & Suleman"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAddOpen(false); reset(); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!p1 || !p2 || isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Duo
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Auto-pair */}
        <Dialog open={autoOpen} onOpenChange={(o) => { setAutoOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={availablePlayers.length < 2}>
              <Sparkles className="w-4 h-4 mr-2" />
              Auto-pair
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Auto-pair Duos</DialogTitle>
              <DialogDescription>
                Strongest pairs with weakest for balance. Select the players to pair ({availablePlayers.length} available).
              </DialogDescription>
            </DialogHeader>

            {error && autoOpen && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
            )}

            {/* Rating source toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs">Balance by</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={ratingSource === "CARD" ? "default" : "outline"}
                  onClick={() => setRatingSource("CARD")}
                >
                  Card Rank
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={ratingSource === "SKILL" ? "default" : "outline"}
                  onClick={() => setRatingSource("SKILL")}
                >
                  Skill Level
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setAutoSelected(
                    autoSelected.length === availablePlayers.length ? [] : availablePlayers.map((p) => p.id)
                  )
                }
              >
                {autoSelected.length === availablePlayers.length ? "Clear all" : "Select all"}
              </button>
              <span className={`text-xs ${oddSelected ? "text-amber-500" : "text-muted-foreground"}`}>
                {autoSelected.length} selected{oddSelected ? " — 1 will be left unpaired" : ""}
              </span>
            </div>

            <div className="h-72 overflow-y-auto pr-2 space-y-1">
              {availablePlayers.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    autoSelected.includes(p.id) ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={autoSelected.includes(p.id)}
                    onCheckedChange={() =>
                      setAutoSelected((prev) =>
                        prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                  />
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={p.photoUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(p.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ratingSource === "SKILL" ? "skill" : "card"} {ratingOf(p)}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAutoOpen(false); reset(); }}>Cancel</Button>
              <Button variant="secondary" onClick={launchAnimatedPair} disabled={autoSelected.length < 2 || isPending}>
                <Sparkles className="w-4 h-4 mr-2" />
                Animated
              </Button>
              <Button onClick={handleAutoPair} disabled={autoSelected.length < 2 || isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Pair {Math.floor(autoSelected.length / 2)} duo(s)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Fullscreen animated auto-pair draw */}
      <AnimatedDuoPair
        open={animateOpen}
        players={animatePlayers}
        ratingSource={animateSource}
        onClose={() => setAnimateOpen(false)}
        onConfirm={handleAnimatedConfirm}
      />
    </div>
  );
}
