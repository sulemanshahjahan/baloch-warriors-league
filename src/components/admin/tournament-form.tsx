"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Info } from "lucide-react";
import { createTournament, updateTournament } from "@/lib/actions/tournament";
import type { Tournament } from "@prisma/client";

interface TournamentFormProps {
  tournament?: Tournament;
}

type GameCategory = "FOOTBALL" | "EFOOTBALL" | "PUBG" | "SNOOKER" | "CHECKERS";
type TournamentFormat = "LEAGUE" | "KNOCKOUT" | "GROUP_KNOCKOUT";
type ParticipantType = "TEAM" | "INDIVIDUAL";

interface GameConfig {
  formats: { value: TournamentFormat; label: string; description: string }[];
  participants: { value: ParticipantType; label: string; description: string }[];
  defaultFormat: TournamentFormat;
  defaultParticipant: ParticipantType;
  description: string;
}

// Game-specific configurations based on real tournament structures
const GAME_CONFIGS: Record<GameCategory, GameConfig> = {
  FOOTBALL: {
    formats: [
      { value: "LEAGUE", label: "League", description: "Round-robin: each team plays every other team" },
      { value: "KNOCKOUT", label: "Knockout", description: "Single elimination cup format" },
      { value: "GROUP_KNOCKOUT", label: "Group + Knockout", description: "Group stage followed by knockout rounds (World Cup style)" },
    ],
    participants: [
      { value: "TEAM", label: "Team", description: "11-a-side football squads" },
    ],
    defaultFormat: "LEAGUE",
    defaultParticipant: "TEAM",
    description: "Traditional 11-a-side football",
  },
  EFOOTBALL: {
    formats: [
      { value: "LEAGUE", label: "League", description: "Round-robin league format" },
      { value: "KNOCKOUT", label: "Knockout", description: "Single elimination bracket" },
      { value: "GROUP_KNOCKOUT", label: "Group + Knockout", description: "Groups followed by knockout stage" },
    ],
    participants: [
      { value: "INDIVIDUAL", label: "Individual", description: "1v1 player matches" },
      { value: "TEAM", label: "Team", description: "Pro Clubs (3-11 players per team)" },
    ],
    defaultFormat: "LEAGUE",
    defaultParticipant: "INDIVIDUAL",
    description: "FIFA/efootball video game",
  },
  PUBG: {
    formats: [
      { value: "LEAGUE", label: "League", description: "Multiple matches with points for kills and placement" },
      { value: "KNOCKOUT", label: "Grand Finals", description: "Final matches with top teams" },
    ],
    participants: [
      { value: "INDIVIDUAL", label: "Solo", description: "Individual players (everyone for themselves)" },
      { value: "TEAM", label: "Squad", description: "4-player squads" },
    ],
    defaultFormat: "LEAGUE",
    defaultParticipant: "TEAM",
    description: "Battle royale - points based on placement and kills",
  },
  SNOOKER: {
    formats: [
      { value: "KNOCKOUT", label: "Knockout", description: "Single elimination (best of X frames)" },
      { value: "LEAGUE", label: "League", description: "Round-robin (most frames won)" },
      { value: "GROUP_KNOCKOUT", label: "Group + Knockout", description: "Round-robin groups then knockout" },
    ],
    participants: [
      { value: "INDIVIDUAL", label: "Individual", description: "1v1 frame-based matches" },
    ],
    defaultFormat: "KNOCKOUT",
    defaultParticipant: "INDIVIDUAL",
    description: "Frame-based individual matches",
  },
  CHECKERS: {
    formats: [
      { value: "KNOCKOUT", label: "Knockout", description: "Single elimination bracket" },
      { value: "LEAGUE", label: "League", description: "Round-robin (most games won)" },
      { value: "GROUP_KNOCKOUT", label: "Group + Knockout", description: "Groups followed by knockout" },
    ],
    participants: [
      { value: "INDIVIDUAL", label: "Individual", description: "1v1 matches" },
    ],
    defaultFormat: "KNOCKOUT",
    defaultParticipant: "INDIVIDUAL",
    description: "1v1 board game matches",
  },
};

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function TournamentForm({ tournament }: TournamentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [gameCategory, setGameCategory] = useState<GameCategory>(
    (tournament?.gameCategory as GameCategory) ?? "FOOTBALL"
  );
  const [format, setFormat] = useState<TournamentFormat>(
    (tournament?.format as TournamentFormat) ?? "LEAGUE"
  );
  const [participantType, setParticipantType] = useState<ParticipantType>(
    (tournament?.participantType as ParticipantType) ?? "TEAM"
  );
  const [status, setStatus] = useState(tournament?.status ?? "DRAFT");
  const [eFootballMode, setEFootballMode] = useState(tournament?.eFootballMode ?? "1v1");
  const [eFootballType, setEFootballType] = useState(tournament?.eFootballType ?? "DREAM");

  // Get current game config
  const gameConfig = GAME_CONFIGS[gameCategory];

  // Reset format and participant when game changes
  useEffect(() => {
    // Only auto-reset if creating new tournament (not editing)
    if (!tournament) {
      setFormat(gameConfig.defaultFormat);
      setParticipantType(gameConfig.defaultParticipant);
    }
  }, [gameCategory, gameConfig, tournament]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("gameCategory", gameCategory);
    formData.set("format", format);
    formData.set("participantType", participantType);
    formData.set("status", status);
    if (gameCategory === "EFOOTBALL") {
      formData.set("eFootballMode", eFootballMode);
      formData.set("eFootballType", eFootballType);
    }

    startTransition(async () => {
      const result = tournament
        ? await updateTournament(tournament.id, formData)
        : await createTournament(formData);

      if (result.success) {
        router.push("/admin/tournaments");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function formatDateForInput(date: Date | null): string {
    if (!date) return "";
    return new Date(date).toISOString().split("T")[0];
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tournament Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. BWL Football Championship 2025"
              defaultValue={tournament?.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Brief description of the tournament..."
              defaultValue={tournament?.description ?? ""}
              className="min-h-[100px]"
            />
          </div>

          {/* Game Selection */}
          <div className="space-y-2">
            <Label>Game *</Label>
            <Select 
              value={gameCategory} 
              onValueChange={(v) => setGameCategory(v as GameCategory)}
              disabled={!!tournament} // Disable when editing
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GAME_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {key === "FOOTBALL" ? "Football" : 
                     key === "EFOOTBALL" ? "eFootball" : 
                     key.charAt(0) + key.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" />
              {gameConfig.description}
            </p>
          </div>

          {/* Format Selection - Dynamic based on game */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Format *</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as TournamentFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gameConfig.formats.map((fmt) => (
                    <SelectItem key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {gameConfig.formats.find(f => f.value === format)?.description}
              </p>
            </div>

            {/* Participant Selection - Dynamic based on game */}
            <div className="space-y-2">
              <Label>Participants *</Label>
              <Select 
                value={participantType} 
                onValueChange={(v) => setParticipantType(v as ParticipantType)}
                disabled={gameConfig.participants.length === 1} // Disable if only one option
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gameConfig.participants.map((part) => (
                    <SelectItem key={part.value} value={part.value}>
                      {part.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {gameConfig.participants.find(p => p.value === participantType)?.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* eFootball Options */}
      {gameCategory === "EFOOTBALL" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">eFootball Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Match Mode</Label>
                <Select value={eFootballMode} onValueChange={setEFootballMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1v1">1v1 (Solo)</SelectItem>
                    <SelectItem value="2v2">2v2 (Co-op)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {eFootballMode === "2v2" ? "2 players per side — assists & MOTM tracked" : "1 player per side — individual stats only"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Tournament Type</Label>
                <Select value={eFootballType} onValueChange={setEFootballType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DREAM">Dream Team</SelectItem>
                    <SelectItem value="AUTHENTIC">Authentic Team</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {eFootballType === "DREAM" ? "Custom-built team from player market" : "Real club teams — must select a club"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dates & Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dates & Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={formatDateForInput(tournament?.startDate ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={formatDateForInput(tournament?.endDate ?? null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxParticipants">
                {participantType === "TEAM" ? "Max Teams" : "Max Players"}
              </Label>
              <Input
                id="maxParticipants"
                name="maxParticipants"
                type="number"
                min={2}
                max={gameCategory === "PUBG" ? 100 : 64}
                placeholder={gameCategory === "PUBG" ? "e.g. 16, 32, 64" : "e.g. 8, 16, 32"}
                defaultValue={tournament?.maxParticipants ?? ""}
              />
              {gameCategory === "PUBG" && (
                <p className="text-xs text-muted-foreground">
                  PUBG supports larger lobbies (up to 100)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prizeInfo">Prize / Reward Info</Label>
              <Input
                id="prizeInfo"
                name="prizeInfo"
                placeholder="e.g. Trophy + Certificate"
                defaultValue={tournament?.prizeInfo ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bannerUrl">Banner Image URL</Label>
            <Input
              id="bannerUrl"
              name="bannerUrl"
              type="url"
              placeholder="https://..."
              defaultValue={tournament?.bannerUrl ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo Image URL</Label>
            <Input
              id="logoUrl"
              name="logoUrl"
              type="url"
              placeholder="https://..."
              defaultValue={tournament?.logoUrl ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rules (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            name="rules"
            placeholder={`Tournament rules for ${gameCategory}...

Example for ${gameCategory}:
${gameCategory === "PUBG" 
  ? "- Points: 1 per kill + placement points (10 for 1st, 6 for 2nd, etc.)\n- 6 matches total, best 4 count"
  : gameCategory === "SNOOKER" 
  ? "- Best of 5 frames in group stage\n- Best of 9 frames in knockout"
  : gameCategory === "CHECKERS"
  ? "- Standard 8x8 board\n- 20 minute time limit per game"
  : "- Standard FIFA rules apply\n- 90 minute matches\n- Extra time and penalties in knockout"}`}
            defaultValue={tournament?.rules ?? ""}
            className="min-h-[150px]"
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" />
          {tournament ? "Save Changes" : "Create Tournament"}
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
  );
}
