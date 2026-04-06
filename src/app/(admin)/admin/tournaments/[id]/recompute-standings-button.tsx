"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { recomputeTournamentStandings } from "@/lib/actions/match";

interface RecomputeStandingsButtonProps {
  tournamentId: string;
}

export function RecomputeStandingsButton({ tournamentId }: RecomputeStandingsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleRecompute() {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await recomputeTournamentStandings(tournamentId);
      if (res.success) {
        setResult({ success: true, message: "Standings recomputed successfully!" });
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setResult({ success: false, message: res.error || "Failed to recompute standings" });
      }
    } catch {
      setResult({ success: false, message: "An error occurred" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className={`text-sm ${result.success ? "text-green-500" : "text-destructive"}`}>
          {result.message}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRecompute}
        disabled={isLoading}
      >
        <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
        {isLoading ? "Recomputing..." : "Recompute"}
      </Button>
    </div>
  );
}
