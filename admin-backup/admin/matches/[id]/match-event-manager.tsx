"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addMatchEvent, deleteMatchEvent } from "@/lib/actions/match";

interface Player {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

interface MatchEvent {
  id: string;
  type: string;
  minute: number | null;
  value: number | null;
  description: string | null;
  player: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
}

const FOOTBALL_EVENTS = [
  { value: "GOAL", label: "⚽ Goal" },
  { value: "ASSIST", label: "🅰️ Assist" },
  { value: "YELLOW_CARD", label: "🟨 Yellow Card" },
  { value: "RED_CARD", label: "🟥 Red Card" },
  { value: "OWN_GOAL", label: "😬 Own Goal" },
  { value: "PENALTY_GOAL", label: "⚽ Penalty Goal" },
  { value: "PENALTY_MISS", label: "❌ Penalty Miss" },
  { value: "CLEAN_SHEET", label: "🧤 Clean Sheet" },
  { value: "MOTM", label: "⭐ Man of the Match" },
];

const PUBG_EVENTS = [
  { value: "KILL", label: "💀 Kill" },
  { value: "MVP", label: "⭐ MVP" },
];

const GENERIC_EVENTS = [
  { value: "FRAME_WIN", label: "🏆 Frame Win" },
  { value: "MVP", label: "⭐ MVP" },
  { value: "CUSTOM", label: "📝 Custom" },
];

function getEventOptions(gameCategory: string) {
  if (gameCategory === "PUBG") return PUBG_EVENTS;
  if (gameCategory === "SNOOKER" || gameCategory === "CHECKERS") return GENERIC_EVENTS;
  return FOOTBALL_EVENTS;
}

function eventLabel(type: string): string {
  const all = [...FOOTBALL_EVENTS, ...PUBG_EVENTS, ...GENERIC_EVENTS];
  return all.find((e) => e.value === type)?.label ?? type;
}

interface MatchEventManagerProps {
  matchId: string;
  events: MatchEvent[];
  homeTeam: Team | null;
  awayTeam: Team | null;
  players: Player[];
  gameCategory: string;
}

export function MatchEventManager({
  matchId,
  events,
  homeTeam,
  awayTeam,
  players,
  gameCategory,
}: MatchEventManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [eventType, setEventType] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState("");

  const eventOptions = getEventOptions(gameCategory);
  const teams = [homeTeam, awayTeam].filter(Boolean) as Team[];

  function handleAddEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("matchId", matchId);
    formData.set("type", eventType);
    formData.set("playerId", playerId);
    formData.set("teamId", teamId);

    startTransition(async () => {
      const result = await addMatchEvent(formData);
      if (result.success) {
        setEventType("");
        setPlayerId("");
        setTeamId("");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } else {
        setError((result as any).error ?? '');
      }
    });
  }

  async function handleDelete(eventId: string) {
    setIsDeleting(eventId);
    await deleteMatchEvent(eventId, matchId);
    router.refresh();
    setIsDeleting(null);
  }

  return (
    <div className="space-y-4">
      {/* Add Event Form */}
      <form onSubmit={handleAddEvent} className="space-y-3 pb-4 border-b border-border">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Event Type *</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select event..." />
              </SelectTrigger>
              <SelectContent>
                {eventOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Team</Label>
            <Select value={teamId || "none"} onValueChange={(v) => setTeamId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select team..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Player</Label>
            <Select value={playerId || "none"} onValueChange={(v) => setPlayerId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select player..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Minute / Value</Label>
            <Input
              name="minute"
              type="number"
              min={1}
              placeholder="e.g. 45"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Description (optional)</Label>
          <Input
            name="description"
            placeholder="Brief description..."
            className="h-8 text-xs"
          />
        </div>

        <Button type="submit" size="sm" disabled={isPending || !eventType} className="w-full">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          <Plus className="w-3 h-3" />
          Add Event
        </Button>
      </form>

      {/* Events List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No events recorded yet.
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-2.5 rounded-md bg-muted/50 text-sm"
            >
              <div className="flex items-center gap-2">
                {event.minute && (
                  <span className="text-xs font-mono text-muted-foreground w-10">
                    {event.minute}&apos;
                  </span>
                )}
                <span className="font-medium">{eventLabel(event.type)}</span>
                {event.player && (
                  <span className="text-muted-foreground text-xs">
                    {event.player.name}
                  </span>
                )}
                {event.team && (
                  <span className="text-muted-foreground text-xs">
                    ({event.team.name})
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(event.id)}
                disabled={isDeleting === event.id}
              >
                {isDeleting === event.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
