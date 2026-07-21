"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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
import { Loader2, Save, Info, Upload, X, ArrowUp, ArrowDown } from "lucide-react";
import { createTournament, updateTournament } from "@/lib/actions/tournament";
import { uploadTournamentImage } from "@/lib/actions/upload";
import { DEFAULT_TIEBREAKERS, type TiebreakKey } from "@/lib/standings/ranking";
import type { Tournament } from "@prisma/client";

const TIEBREAK_LABELS: Record<TiebreakKey, string> = {
  POINTS: "Points",
  GOAL_DIFF: "Goal difference",
  GOALS_FOR: "Goals scored",
  GOALS_AGAINST: "Goals conceded",
  HEAD_TO_HEAD: "Head-to-head",
  WINS: "Wins",
  CLEAN_SHEETS: "Clean sheets",
};

// Default league points per game — used only as input placeholders.
const POINT_DEFAULTS: Record<string, [number, number, number]> = {
  FOOTBALL: [3, 1, 0], EFOOTBALL: [3, 1, 0], PUBG: [0, 0, 0], SNOOKER: [1, 0, 0], CHECKERS: [1, 0, 0],
};

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
  const [bannerUrl, setBannerUrl] = useState(tournament?.bannerUrl ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);

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

  // ── League & table settings (Phase 0) ──
  const [doubleRoundRobin, setDoubleRoundRobin] = useState(tournament?.doubleRoundRobin ?? false);
  const [pointsWin, setPointsWin] = useState(tournament?.pointsWin?.toString() ?? "");
  const [pointsDraw, setPointsDraw] = useState(tournament?.pointsDraw?.toString() ?? "");
  const [pointsLoss, setPointsLoss] = useState(tournament?.pointsLoss?.toString() ?? "");
  const [tiebreakers, setTiebreakers] = useState<TiebreakKey[] | null>(
    Array.isArray(tournament?.tiebreakers) ? (tournament!.tiebreakers as TiebreakKey[]) : null
  );

  const moveTiebreak = (i: number, dir: -1 | 1) => {
    setTiebreakers((prev) => {
      if (!prev) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

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

  // 2v2 eFootball competitors are duos, which are stored as (TEAM) participants.
  // Force TEAM so the duo pairing system is used instead of 1v1 individual matches.
  const is2v2 = gameCategory === "EFOOTBALL" && eFootballMode === "2v2";
  useEffect(() => {
    if (is2v2) setParticipantType("TEAM");
  }, [is2v2]);

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
    // League & table settings
    formData.set("doubleRoundRobin", doubleRoundRobin ? "on" : "");
    formData.set("pointsWin", pointsWin);
    formData.set("pointsDraw", pointsDraw);
    formData.set("pointsLoss", pointsLoss);
    if (tiebreakers) formData.set("tiebreakers", JSON.stringify(tiebreakers));
    else formData.delete("tiebreakers");

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
                disabled={gameConfig.participants.length === 1 || is2v2} // single option, or locked to duos for 2v2
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
                {is2v2
                  ? "2v2 competitors are duos (2 players each). Pair players on the tournament page."
                  : gameConfig.participants.find(p => p.value === participantType)?.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* League & Table Settings — only for formats that produce a points table */}
      {(format === "LEAGUE" || format === "GROUP_KNOCKOUT") && gameCategory !== "PUBG" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">League &amp; Table Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Double round-robin */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={doubleRoundRobin}
                onChange={(e) => setDoubleRoundRobin(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="text-sm font-medium">Double round-robin</span>
                <span className="block text-xs text-muted-foreground">
                  Each pair plays twice (home &amp; away). Off = single round-robin.
                </span>
              </span>
            </label>

            {/* Points per result */}
            <div className="space-y-2">
              <Label>Points (Win / Draw / Loss)</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input type="number" min={0} inputMode="numeric" value={pointsWin}
                  onChange={(e) => setPointsWin(e.target.value)}
                  placeholder={`${POINT_DEFAULTS[gameCategory]?.[0] ?? 3} (default)`} aria-label="Points for a win" />
                <Input type="number" min={0} inputMode="numeric" value={pointsDraw}
                  onChange={(e) => setPointsDraw(e.target.value)}
                  placeholder={`${POINT_DEFAULTS[gameCategory]?.[1] ?? 1} (default)`} aria-label="Points for a draw" />
                <Input type="number" min={0} inputMode="numeric" value={pointsLoss}
                  onChange={(e) => setPointsLoss(e.target.value)}
                  placeholder={`${POINT_DEFAULTS[gameCategory]?.[2] ?? 0} (default)`} aria-label="Points for a loss" />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Leave blank to use the game default.
              </p>
            </div>

            {/* Tiebreaker order */}
            <div className="space-y-2">
              <Label>Tiebreaker order</Label>
              {!tiebreakers ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Using default: {DEFAULT_TIEBREAKERS.map((k) => TIEBREAK_LABELS[k]).join(" → ")}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setTiebreakers([...DEFAULT_TIEBREAKERS])}>
                    Customize
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ul className="space-y-1.5">
                    {tiebreakers.map((k, i) => (
                      <li key={k} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
                        <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                        <span className="flex-1">{TIEBREAK_LABELS[k]}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => moveTiebreak(i, -1)} aria-label="Move up">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={i === tiebreakers.length - 1} onClick={() => moveTiebreak(i, 1)} aria-label="Move down">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTiebreakers(null)}>
                    Reset to default
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
            <Label>Banner / Champions Poster</Label>
            <input type="hidden" name="bannerUrl" value={bannerUrl} />
            {bannerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerUrl}
                alt="Banner preview"
                className="w-full max-w-sm rounded-lg border border-border object-cover"
              />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => bannerFileRef.current?.click()}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                {bannerUrl ? "Replace image" : "Upload image"}
              </Button>
              {bannerUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setBannerUrl("")}>
                  <X className="w-4 h-4 mr-1" /> Remove
                </Button>
              )}
            </div>
            <Input
              ref={bannerFileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                if (file.size > 10 * 1024 * 1024) {
                  setError("File too large. Max 10MB.");
                  if (bannerFileRef.current) bannerFileRef.current.value = "";
                  return;
                }
                setIsUploading(true);
                try {
                  const fd = new FormData();
                  fd.append("file", file);
                  const result = await uploadTournamentImage(fd);
                  if (result.success && result.url) setBannerUrl(result.url);
                  else setError(result.error ?? "Upload failed");
                } finally {
                  setIsUploading(false);
                  if (bannerFileRef.current) bannerFileRef.current.value = "";
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              JPG/PNG/WebP up to 10MB (≈1200×600). Shown as the poster in the homepage Champions banner when this tournament&apos;s winner is the latest champion.
            </p>
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
