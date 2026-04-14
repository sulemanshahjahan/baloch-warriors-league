"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateSchedule, generateKnockoutFromGroups, deleteTournamentSchedule } from "@/lib/actions/schedule";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, Shuffle, Trophy, Users, AlertTriangle, Trash2, MessageCircle } from "lucide-react";
import { sendScheduleNotifications } from "@/lib/actions/schedule-notify";
import { Badge } from "@/components/ui/badge";

interface ScheduleGeneratorProps {
  tournamentId: string;
  participantCount: number;
  hasGroups: boolean;
  participantType: "TEAM" | "INDIVIDUAL";
  groupCount?: number;
  scheduledMatchesCount?: number;
}

export function ScheduleGenerator({
  tournamentId,
  participantCount,
  hasGroups,
  participantType,
  groupCount: existingGroupCount = 0,
  scheduledMatchesCount = 0,
}: ScheduleGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [format, setFormat] = useState<"ROUND_ROBIN" | "KNOCKOUT" | "GROUP_KNOCKOUT">("ROUND_ROBIN");
  const [seeding, setSeeding] = useState<"RANDOM" | "MANUAL" | "BY_SKILL">("RANDOM");
  const [advanceCount, setAdvanceCount] = useState(2);
  const [deadlineMode, setDeadlineMode] = useState<"none" | "per_round" | "global">("none");
  const [daysPerRound, setDaysPerRound] = useState(3);
  const [globalDeadline, setGlobalDeadline] = useState("");
  const [maxMatchesPerDay, setMaxMatchesPerDay] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingWA, setIsSendingWA] = useState(false);
  const [waResult, setWaResult] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; count?: number; message?: string } | null>(null);
  const router = useRouter();

  const handleGenerate = async () => {
    setIsLoading(true);
    setResult(null);
    
    const res = await generateSchedule({
      tournamentId,
      format,
      seedingMethod: seeding,
      groupCount: existingGroupCount,
      advanceCount,
      deadlineMode,
      daysPerRound: deadlineMode === "per_round" ? daysPerRound : undefined,
      globalDeadline: deadlineMode === "global" ? globalDeadline : undefined,
      maxMatchesPerDay,
    });
    
    setIsLoading(false);
    if (res.success) {
      setResult({ success: true, count: res.count, message: `${res.count} matches created! Dates & deadlines auto-assigned.` });
      router.refresh();
      // Don't auto-close — let admin send WhatsApp notifications first
    } else {
      setResult({ success: false, message: res.error || "Failed to generate schedule" });
    }
  };

  const handleGenerateKnockout = async () => {
    setIsLoading(true);
    const res = await generateKnockoutFromGroups(tournamentId, advanceCount);
    setIsLoading(false);
    if (res.success) {
      setResult({ success: true, count: res.count, message: `${res.count} knockout matches created!` });
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1500);
    } else {
      setResult({ success: false, message: res.error || "Failed to generate knockout" });
    }
  };

  const handleDeleteSchedule = async () => {
    setIsDeleting(true);
    const res = await deleteTournamentSchedule(tournamentId);
    setIsDeleting(false);
    if (res.success) {
      setDeleteDialogOpen(false);
      router.refresh();
    }
  };

  const estimatedMatches = () => {
    if (format === "ROUND_ROBIN") {
      return (participantCount * (participantCount - 1)) / 2;
    } else if (format === "KNOCKOUT") {
      return Math.ceil(participantCount / 2);
    } else if (format === "GROUP_KNOCKOUT") {
      // For existing groups, estimate based on group sizes
      const avgPerGroup = existingGroupCount > 0 ? Math.ceil(participantCount / existingGroupCount) : 0;
      const groupMatches = existingGroupCount > 0 
        ? (avgPerGroup * (avgPerGroup - 1)) / 2 * existingGroupCount 
        : 0;
      return groupMatches;
    }
    return 0;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-1" />
            Generate Schedule
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Tournament Schedule</DialogTitle>
          <DialogDescription>
            Automatically create matches based on enrolled participants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Tournament Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROUND_ROBIN">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Round Robin (League)
                  </div>
                </SelectItem>
                <SelectItem value="KNOCKOUT">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Knockout (Bracket)
                  </div>
                </SelectItem>
                <SelectItem value="GROUP_KNOCKOUT">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Groups + Knockout
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seeding Method */}
          <div className="space-y-2">
            <Label>Seeding Method</Label>
            <Select value={seeding} onValueChange={(v) => setSeeding(v as typeof seeding)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RANDOM">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4" />
                    Random
                  </div>
                </SelectItem>
                <SelectItem value="MANUAL">Manual (Current Order)</SelectItem>
                {participantType === "INDIVIDUAL" && (
                  <SelectItem value="BY_SKILL">By Skill Level (High to Low)</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Deadline Settings */}
          <div className="space-y-2">
            <Label>Match Deadlines</Label>
            <Select value={deadlineMode} onValueChange={(v) => setDeadlineMode(v as typeof deadlineMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No deadlines</SelectItem>
                <SelectItem value="per_round">Per round (days after start)</SelectItem>
                <SelectItem value="global">Global deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {deadlineMode === "per_round" && (
            <div className="space-y-2">
              <Label>Days per round</Label>
              <Input
                type="number"
                min={1}
                value={daysPerRound}
                onChange={(e) => setDaysPerRound(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Round 1 deadline = tournament start + N days, Round 2 = start + 2N days, etc.
              </p>
            </div>
          )}

          {deadlineMode === "global" && (
            <div className="space-y-2">
              <Label>All matches due by</Label>
              <Input
                type="datetime-local"
                value={globalDeadline}
                onChange={(e) => setGlobalDeadline(e.target.value)}
              />
            </div>
          )}

          {/* Max matches per player per day */}
          <div className="space-y-2">
            <Label>Max matches per player per day</Label>
            <Input
              type="number"
              min={1}
              max={4}
              value={maxMatchesPerDay}
              onChange={(e) => setMaxMatchesPerDay(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Dates auto-assigned from tournament start date. Each player gets at most this many matches per day.
            </p>
          </div>

          {/* Group Settings */}
          {format === "GROUP_KNOCKOUT" && (
            <>
              <div className="bg-blue-500/10 text-blue-400 p-3 rounded text-sm">
                <p className="font-medium">Using existing groups</p>
                <p className="text-xs opacity-80">
                  {existingGroupCount} group{existingGroupCount !== 1 ? "s" : ""} found. 
                  Matches will be created within each group.
                </p>
              </div>
              {!hasGroups && (
                <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                  <p className="font-medium">No groups found</p>
                  <p className="text-xs">Please create groups and assign players first.</p>
                </div>
              )}
            </>
          )}

          {/* Info */}
          <div className="bg-muted p-3 rounded text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Participants:</span>
              <span className="font-medium">{participantCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Matches:</span>
              <span className="font-medium">~{estimatedMatches()}</span>
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div className={`p-3 rounded text-sm space-y-2 ${result.success ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
              <p>{result.message}</p>
              {result.success && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setIsSendingWA(true);
                    setWaResult(null);
                    const res = await sendScheduleNotifications(tournamentId);
                    setIsSendingWA(false);
                    if (res.success) {
                      setWaResult(
                        res.errors.length > 0
                          ? `Sent ${res.sent} messages. Issues: ${res.errors.slice(0, 3).join(", ")}`
                          : `Sent ${res.sent} fixture notifications!`
                      );
                    } else {
                      setWaResult("Failed to send notifications");
                    }
                  }}
                  disabled={isSendingWA}
                  className="text-xs"
                >
                  <MessageCircle className={`w-3 h-3 ${isSendingWA ? "animate-pulse" : ""}`} />
                  {isSendingWA ? "Sending fixtures..." : "Send Fixtures via WhatsApp"}
                </Button>
              )}
              {waResult && (
                <p className="text-xs text-muted-foreground">{waResult}</p>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 text-xs text-amber-500">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>This will delete any existing scheduled matches for this tournament.</p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          {scheduledMatchesCount > 0 && (
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
                setDeleteDialogOpen(true);
              }}
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Schedule ({scheduledMatchesCount})
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => { setOpen(false); setResult(null); setWaResult(null); }}>
              {result?.success ? "Done" : "Cancel"}
            </Button>
            {!result?.success && (
              <Button
                onClick={handleGenerate}
                disabled={isLoading || participantCount < 2 || (format === "GROUP_KNOCKOUT" && !hasGroups)}
              >
                {isLoading ? "Generating..." : "Generate Schedule"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete Schedule?
          </DialogTitle>
          <DialogDescription>
            This will permanently delete all {scheduledMatchesCount} scheduled matches for this tournament.
            <span className="block mt-2 text-destructive font-medium">
              Completed matches will NOT be deleted.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteSchedule}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

export function GenerateKnockoutButton({
  tournamentId,
  groupCount,
}: {
  tournamentId: string;
  groupCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [advanceCount, setAdvanceCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [koResult, setKoResult] = useState<{ success: boolean; count?: number; message?: string } | null>(null);
  const [isSendingKoWA, setIsSendingKoWA] = useState(false);
  const [koWaResult, setKoWaResult] = useState<string | null>(null);
  const router = useRouter();

  const handleGenerate = async () => {
    setIsLoading(true);
    setKoResult(null);
    const res = await generateKnockoutFromGroups(tournamentId, advanceCount);
    setIsLoading(false);
    if (res.success) {
      setKoResult({ success: true, count: res.count, message: `${res.count} knockout matches created! Dates auto-assigned.` });
      router.refresh();
    } else {
      setKoResult({ success: false, message: res.error || "Failed" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trophy className="w-4 h-4 mr-1" />
          Generate Knockout
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Knockout Stage</DialogTitle>
          <DialogDescription>
            Generate knockout bracket from group standings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {koResult && (
            <div className={`p-3 rounded text-sm space-y-2 ${koResult.success ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
              <p>{koResult.message}</p>
              {koResult.success && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setIsSendingKoWA(true);
                    setKoWaResult(null);
                    const res = await sendScheduleNotifications(tournamentId);
                    setIsSendingKoWA(false);
                    if (res.success) {
                      setKoWaResult(res.errors.length > 0
                        ? `Sent ${res.sent} messages. Issues: ${res.errors.slice(0, 3).join(", ")}`
                        : `Sent ${res.sent} fixture notifications!`);
                    } else {
                      setKoWaResult("Failed to send");
                    }
                  }}
                  disabled={isSendingKoWA}
                  className="text-xs"
                >
                  <MessageCircle className={`w-3 h-3 ${isSendingKoWA ? "animate-pulse" : ""}`} />
                  {isSendingKoWA ? "Sending..." : "Send Fixtures via WhatsApp"}
                </Button>
              )}
              {koWaResult && <p className="text-xs text-muted-foreground">{koWaResult}</p>}
            </div>
          )}
          <div className="space-y-2">
            <Label>Players advancing per group</Label>
            <Input
              type="number"
              min={1}
              max={8}
              value={advanceCount}
              onChange={(e) => setAdvanceCount(Number(e.target.value))}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {groupCount} groups × {advanceCount} teams = {groupCount * advanceCount} teams in knockout
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); setKoResult(null); setKoWaResult(null); }}>
            {koResult?.success ? "Done" : "Cancel"}
          </Button>
          {!koResult?.success && (
            <Button onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Knockout"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
