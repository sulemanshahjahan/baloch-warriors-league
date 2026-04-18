"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GitBranch } from "lucide-react";
import { backfillKnockoutAdvancement } from "@/lib/actions/match";

export function BackfillBracketButton({ tournamentId }: { tournamentId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function run() {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await backfillKnockoutAdvancement(tournamentId);
      if (res.success) {
        setResult({ success: true, message: `Advanced ${res.processed} match(es)` });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setResult({ success: false, message: res.error || "Failed" });
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
      <Button variant="outline" size="sm" onClick={run} disabled={isLoading}>
        <GitBranch className={`w-4 h-4 mr-1 ${isLoading ? "animate-pulse" : ""}`} />
        {isLoading ? "Rebuilding..." : "Rebuild Bracket"}
      </Button>
    </div>
  );
}
