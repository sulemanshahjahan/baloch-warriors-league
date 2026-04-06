"use client";

import { useState, useTransition } from "react";
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
import { Loader2, Save } from "lucide-react";
import { createTournament, updateTournament } from "@/lib/actions/tournament";
import type { Tournament } from "@/generated/prisma/client";

interface TournamentFormProps {
  tournament?: Tournament;
}

const GAME_OPTIONS = [
  { value: "FOOTBALL", label: "Football" },
  { value: "EFOOTBALL", label: "eFootball" },
  { value: "PUBG", label: "PUBG" },
  { value: "SNOOKER", label: "Snooker" },
  { value: "CHECKERS", label: "Checkers" },
];

const FORMAT_OPTIONS = [
  { value: "LEAGUE", label: "League" },
  { value: "KNOCKOUT", label: "Knockout" },
  { value: "GROUP_KNOCKOUT", label: "Group + Knockout" },
];

const PARTICIPANT_OPTIONS = [
  { value: "TEAM", label: "Team" },
  { value: "INDIVIDUAL", label: "Individual" },
];

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

  const [gameCategory, setGameCategory] = useState(
    tournament?.gameCategory ?? "FOOTBALL"
  );
  const [format, setFormat] = useState(tournament?.format ?? "LEAGUE");
  const [participantType, setParticipantType] = useState(
    tournament?.participantType ?? "TEAM"
  );
  const [status, setStatus] = useState(tournament?.status ?? "DRAFT");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("gameCategory", gameCategory);
    formData.set("format", format);
    formData.set("participantType", participantType);
    formData.set("status", status);

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Game *</Label>
              <Select value={gameCategory} onValueChange={(v) => setGameCategory(v as typeof gameCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Format *</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Participants *</Label>
              <Select value={participantType} onValueChange={(v) => setParticipantType(v as typeof participantType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTICIPANT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <Label htmlFor="maxParticipants">Max Participants</Label>
              <Input
                id="maxParticipants"
                name="maxParticipants"
                type="number"
                min={2}
                placeholder="e.g. 8"
                defaultValue={tournament?.maxParticipants ?? ""}
              />
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
            placeholder="Tournament rules, format explanation, tiebreaker rules..."
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
