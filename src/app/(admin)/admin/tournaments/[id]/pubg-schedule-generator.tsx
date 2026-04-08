"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Calendar, AlertTriangle, Trash2, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createPUBGMatches, deleteTournamentSchedule } from "@/lib/actions/schedule";

interface PUBGScheduleGeneratorProps {
  tournamentId: string;
  participantCount: number;
  participantType: "TEAM" | "INDIVIDUAL";
  scheduledMatchesCount?: number;
}

// Default PUBG scoring system
const DEFAULT_PLACEMENT_POINTS = [
  { placement: 1, points: 10 },
  { placement: 2, points: 6 },
  { placement: 3, points: 5 },
  { placement: 4, points: 4 },
  { placement: 5, points: 3 },
  { placement: 6, points: 2 },
  { placement: 7, points: 1 },
  { placement: 8, points: 1 },
];

export function PUBGScheduleGenerator({
  tournamentId,
  participantCount,
  participantType,
  scheduledMatchesCount = 0,
}: PUBGScheduleGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [matchCount, setMatchCount] = useState(6);
  const [pointsPerKill, setPointsPerKill] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; message?: string } | null>(null);
  const router = useRouter();

  const handleGenerate = async () => {
    setIsLoading(true);
    setResult(null);
    
    const res = await createPUBGMatches({
      tournamentId,
      matchCount,
      pointsPerKill,
      placementPoints: DEFAULT_PLACEMENT_POINTS,
    });
    
    setIsLoading(false);
    if (res.success) {
      setResult({ success: true, count: res.count, message: `${res.count} PUBG matches created!` });
      setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 1500);
    } else {
      setResult({ success: false, message: res.error || "Failed to generate schedule" });
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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-1" />
            Generate PUBG Schedule
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-yellow-400" />
              Generate PUBG Matches
            </DialogTitle>
            <DialogDescription>
              Create battle royale matches where all {participantType === "TEAM" ? "squads" : "players"} compete together.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Match Count */}
            <div className="space-y-2">
              <Label htmlFor="matchCount">Number of Matches</Label>
              <Input
                id="matchCount"
                type="number"
                min={1}
                max={20}
                value={matchCount}
                onChange={(e) => setMatchCount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 6-8 matches for a full tournament
              </p>
            </div>

            {/* Points Per Kill */}
            <div className="space-y-2">
              <Label htmlFor="pointsPerKill">Points Per Kill</Label>
              <Input
                id="pointsPerKill"
                type="number"
                min={0}
                max={5}
                value={pointsPerKill}
                onChange={(e) => setPointsPerKill(Number(e.target.value))}
              />
            </div>

            {/* Scoring System Info */}
            <div className="bg-muted p-3 rounded text-sm space-y-2">
              <p className="font-medium">Default Placement Points:</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {DEFAULT_PLACEMENT_POINTS.map((p) => (
                  <div key={p.placement} className="flex justify-between">
                    <span className="text-muted-foreground">#{p.placement}:</span>
                    <span className="font-medium">{p.points}pts</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                Total = Placement Points + (Kills × {pointsPerKill})
              </p>
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 text-blue-400 p-3 rounded text-sm">
              <p className="font-medium">All {participantType === "TEAM" ? "Squads" : "Players"} in Every Match</p>
              <p className="text-xs opacity-80">
                Unlike other games, PUBG puts all participants in the same lobby. 
                Each match is a separate game where everyone competes for placement and kills.
              </p>
            </div>

            {/* Result Message */}
            {result && (
              <div className={`p-3 rounded text-sm ${result.success ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
                {result.message}
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
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isLoading || participantCount < 2}
              >
                {isLoading ? "Generating..." : "Generate Matches"}
              </Button>
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
