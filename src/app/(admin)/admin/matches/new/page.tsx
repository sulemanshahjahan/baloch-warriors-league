"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Users, User } from "lucide-react";
import { createMatch } from "@/lib/actions/match";
import { toKarachiInputValue } from "@/lib/utils";

interface Tournament {
  id: string;
  name: string;
  gameCategory: string;
  teams: { team: { id: string; name: string } }[];
  players: { player: { id: string; name: string } }[];
}

type MatchType = "TEAM" | "PLAYER";

export default function NewMatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTournamentId = searchParams.get("tournamentId") ?? "";

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState(defaultTournamentId);
  const [matchType, setMatchType] = useState<MatchType>("TEAM");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homePlayerId, setHomePlayerId] = useState("");
  const [awayPlayerId, setAwayPlayerId] = useState("");
  const [status, setStatus] = useState("SCHEDULED");

  const selectedTournament = tournaments.find((t) => t.id === tournamentId);
  const teams = selectedTournament?.teams.map((tt) => tt.team) ?? [];
  const players = selectedTournament?.players.map((tp) => tp.player) ?? [];

  useEffect(() => {
    fetch("/api/admin/tournaments")
      .then((r) => r.json())
      .then(setTournaments)
      .catch(() => {});
  }, []);

  function handleTournamentChange(id: string) {
    setTournamentId(id);
    setHomeTeamId("");
    setAwayTeamId("");
    setHomePlayerId("");
    setAwayPlayerId("");
  }

  function handleMatchTypeChange(type: MatchType) {
    setMatchType(type);
    setHomeTeamId("");
    setAwayTeamId("");
    setHomePlayerId("");
    setAwayPlayerId("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("tournamentId", tournamentId);
    formData.set("status", status);

    if (matchType === "TEAM") {
      formData.set("homeTeamId", homeTeamId);
      formData.set("awayTeamId", awayTeamId);
    } else {
      formData.set("homePlayerId", homePlayerId);
      formData.set("awayPlayerId", awayPlayerId);
    }

    startTransition(async () => {
      const result = await createMatch(formData);
      if (result.success) {
        router.push(
          tournamentId
            ? `/admin/tournaments/${tournamentId}`
            : "/admin/matches"
        );
        router.refresh();
      } else {
        setError((result as { error?: string }).error ?? "");
      }
    });
  }

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="New Match" description="Schedule a match" />
      <main className="flex-1 p-6">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tournament *</Label>
                <Select value={tournamentId} onValueChange={handleTournamentChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tournament..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Match type toggle */}
              <div className="space-y-2">
                <Label>Match Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={matchType === "TEAM" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleMatchTypeChange("TEAM")}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Team vs Team
                  </Button>
                  <Button
                    type="button"
                    variant={matchType === "PLAYER" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleMatchTypeChange("PLAYER")}
                  >
                    <User className="w-4 h-4 mr-1" />
                    Player vs Player
                  </Button>
                </div>
              </div>

              {matchType === "TEAM" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Home Team</Label>
                    <Select
                      value={homeTeamId}
                      onValueChange={setHomeTeamId}
                      disabled={!tournamentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teams
                          .filter((t) => t.id !== awayTeamId)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Away Team</Label>
                    <Select
                      value={awayTeamId}
                      onValueChange={setAwayTeamId}
                      disabled={!tournamentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teams
                          .filter((t) => t.id !== homeTeamId)
                          .map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Home Player</Label>
                    <Select
                      value={homePlayerId}
                      onValueChange={setHomePlayerId}
                      disabled={!tournamentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select player..." />
                      </SelectTrigger>
                      <SelectContent>
                        {players
                          .filter((p) => p.id !== awayPlayerId)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {tournamentId && players.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No individual players enrolled in this tournament yet.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Away Player</Label>
                    <Select
                      value={awayPlayerId}
                      onValueChange={setAwayPlayerId}
                      disabled={!tournamentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select player..." />
                      </SelectTrigger>
                      <SelectContent>
                        {players
                          .filter((p) => p.id !== homePlayerId)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="round">Round Label</Label>
                  <Input id="round" name="round" placeholder="e.g. Matchday 1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roundNumber">Round #</Label>
                  <Input id="roundNumber" name="roundNumber" type="number" min={1} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matchNumber">Match #</Label>
                  <Input id="matchNumber" name="matchNumber" type="number" min={1} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Date & Time <span className="text-muted-foreground text-[10px]">(PKT)</span></Label>
                  <Input
                    id="scheduledAt"
                    name="scheduledAt"
                    type="datetime-local"
                    defaultValue={toKarachiInputValue(new Date())}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="LIVE">Live</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="POSTPONED">Postponed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline <span className="text-muted-foreground text-[10px]">(PKT)</span></Label>
                <Input
                  id="deadline"
                  name="deadline"
                  type="datetime-local"
                />
                <p className="text-xs text-muted-foreground">
                  When must this match be completed? Auto-reminders will be sent at 24h, 2h, and 30min before.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" placeholder="Optional match notes..." />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending || !tournamentId}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              Schedule Match
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
