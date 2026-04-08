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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, Loader2, Award, Trophy } from "lucide-react";
import { createAward, deleteAward } from "@/lib/actions/award";
import { getInitials } from "@/lib/utils";

const AWARD_TYPES = [
  { value: "GOLDEN_BOOT", label: "Golden Boot (Top Scorer)" },
  { value: "TOP_ASSISTS", label: "Top Assists" },
  { value: "BEST_PLAYER", label: "Best Player" },
  { value: "BEST_GOALKEEPER", label: "Best Goalkeeper" },
  { value: "FAIR_PLAY", label: "Fair Play Award" },
  { value: "TOURNAMENT_MVP", label: "Tournament MVP" },
  { value: "TOURNAMENT_WINNER", label: "Tournament Winner" },
  { value: "CUSTOM", label: "Custom Award" },
];

interface AwardsManagerProps {
  tournamentId: string;
  awards: Array<{
    id: string;
    type: string;
    customName: string | null;
    description: string | null;
    player: { id: string; name: string; photoUrl: string | null } | null;
    team: { id: string; name: string; logoUrl: string | null } | null;
  }>;
  teams: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
  }>;
  players: Array<{
    id: string;
    name: string;
    photoUrl: string | null;
  }>;
}

export function AwardsManager({
  tournamentId,
  awards,
  teams,
  players,
}: AwardsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [awardType, setAwardType] = useState("");
  const [recipientType, setRecipientType] = useState<"player" | "team" | "">("");
  const [recipientId, setRecipientId] = useState("");
  const [customName, setCustomName] = useState("");
  const [description, setDescription] = useState("");

  function resetForm() {
    setAwardType("");
    setRecipientType("");
    setRecipientId("");
    setCustomName("");
    setDescription("");
    setError("");
  }

  function handleCreate() {
    setError("");

    const formData = new FormData();
    formData.append("tournamentId", tournamentId);
    formData.append("type", awardType);
    if (awardType === "CUSTOM" && customName) {
      formData.append("customName", customName);
    }
    if (description) {
      formData.append("description", description);
    }
    if (recipientId) {
      if (recipientType === "player") {
        formData.append("playerId", recipientId);
      } else if (recipientType === "team") {
        formData.append("teamId", recipientId);
      }
    }

    startTransition(async () => {
      const result = await createAward(formData);
      if (result.success) {
        setDialogOpen(false);
        resetForm();
        router.refresh();
      } else {
        setError(result.error ?? "Failed to create award");
      }
    });
  }

  function handleDelete(awardId: string) {
    startTransition(async () => {
      const result = await deleteAward(awardId, tournamentId);
      if (result.success) {
        router.refresh();
      }
    });
  }

  function getAwardLabel(type: string, customName: string | null) {
    if (type === "CUSTOM" && customName) return customName;
    const awardType = AWARD_TYPES.find((a) => a.value === type);
    return awardType?.label ?? type;
  }

  const recipients = recipientType === "player" ? players : teams;

  return (
    <div className="space-y-4">
      {/* Awards List */}
      {awards.length === 0 ? (
        <div className="text-center py-6">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">No awards created yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {awards.map((award) => (
            <div
              key={award.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20">
                  <Award className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {getAwardLabel(award.type, award.customName)}
                  </p>
                  {(award.player || award.team) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Winner:</span>
                      {award.player && (
                        <Link
                          href={`/admin/players/${award.player.id}`}
                          className="hover:text-primary hover:underline flex items-center gap-1"
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={award.player.photoUrl ?? undefined} />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(award.player.name)}
                            </AvatarFallback>
                          </Avatar>
                          {award.player.name}
                        </Link>
                      )}
                      {award.team && (
                        <Link
                          href={`/admin/teams/${award.team.id}`}
                          className="hover:text-primary hover:underline flex items-center gap-1"
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={award.team.logoUrl ?? undefined} />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(award.team.name)}
                            </AvatarFallback>
                          </Avatar>
                          {award.team.name}
                        </Link>
                      )}
                    </div>
                  )}
                  {award.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {award.description}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(award.id)}
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

      {/* Add Award Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Award
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Award</DialogTitle>
            <DialogDescription>
              Create a new award for this tournament.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Award Type</Label>
              <Select value={awardType} onValueChange={setAwardType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select award type..." />
                </SelectTrigger>
                <SelectContent>
                  {AWARD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {awardType === "CUSTOM" && (
              <div className="space-y-2">
                <Label>Custom Award Name</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Best Young Player"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Recipient Type</Label>
              <Select
                value={recipientType}
                onValueChange={(v) => {
                  setRecipientType(v as "player" | "team");
                  setRecipientId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recipientType && (
              <div className="space-y-2">
                <Label>Recipient</Label>
                <Select value={recipientId} onValueChange={setRecipientId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={`Select ${recipientType}...`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage
                              src={
                                ("photoUrl" in r
                                  ? r.photoUrl
                                  : r.logoUrl) ?? undefined
                              }
                            />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                          {r.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Award description or notes..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!awardType || isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Award
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
