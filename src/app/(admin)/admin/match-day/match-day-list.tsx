"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  MessageCircle,
  Save,
  Swords,
  Zap,
} from "lucide-react";
import { updateMatchResult } from "@/lib/actions/match";
import { sendMatchLinksViaWhatsApp } from "@/lib/actions/score-report";
import { gameLabel } from "@/lib/utils";
import Link from "next/link";

type MatchWithDetails = {
  id: string;
  round: string | null;
  matchNumber: number | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledAt: Date | null;
  deadline: Date | null;
  isOverdue: boolean;
  homeToken: string | null;
  awayToken: string | null;
  tournament: { id: string; name: string; gameCategory: string };
  homePlayer: { id: string; name: string; phone: string | null } | null;
  awayPlayer: { id: string; name: string; phone: string | null } | null;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  availabilities: { side: string; isAvailable: boolean; preferredTime: Date | null }[];
};

interface MatchDayListProps {
  todayMatches: MatchWithDetails[];
  tomorrowMatches: MatchWithDetails[];
  overdueMatches: MatchWithDetails[];
  liveMatches: MatchWithDetails[];
}

function MatchCard({ match }: { match: MatchWithDetails }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [waStatus, setWaStatus] = useState<string | null>(null);
  const [waSending, setWaSending] = useState(false);

  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
  const homeAvail = match.availabilities.find((a) => a.side === "home");
  const awayAvail = match.availabilities.find((a) => a.side === "away");

  function handleQuickScore() {
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError("Enter valid scores");
      return;
    }
    setError("");
    setSaved(false);

    const fd = new FormData();
    fd.set("homeScore", homeScore);
    fd.set("awayScore", awayScore);
    fd.set("status", "COMPLETED");

    startTransition(async () => {
      const result = await updateMatchResult(match.id, fd);
      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setError((result as { error?: string }).error ?? "Failed");
      }
    });
  }

  async function handleRemind() {
    setWaSending(true);
    setWaStatus(null);
    const res = await sendMatchLinksViaWhatsApp(match.id);
    setWaSending(false);
    if (res.success && res.data) {
      const d = res.data as { sent: number; skipped?: number; errors: string[] };
      const parts: string[] = [];
      if (d.sent > 0) parts.push(`Sent ${d.sent}`);
      if (d.skipped && d.skipped > 0) parts.push(`${d.skipped} skipped (already sent)`);
      if (d.errors.length > 0) parts.push(`issues: ${d.errors[0]}`);
      setWaStatus(parts.join(" · ") || "No action");
    } else {
      setWaStatus(res.error ?? "Failed");
    }
  }

  if (saved) {
    return (
      <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <Check className="w-4 h-4" />
          <span className="font-medium">{homeName} {homeScore} - {awayScore} {awayName}</span>
          <span className="text-xs text-muted-foreground">— Saved! Standings updated.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-3">
      {/* Match header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/admin/matches/${match.id}`} className="hover:text-primary transition-colors">
            <span className="font-semibold text-sm">{homeName}</span>
            <span className="text-muted-foreground mx-2">vs</span>
            <span className="font-semibold text-sm">{awayName}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {gameLabel(match.tournament.gameCategory)}
          </Badge>
          {match.isOverdue && (
            <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
              OVERDUE
            </Badge>
          )}
        </div>
      </div>

      {/* Tournament + round */}
      <p className="text-xs text-muted-foreground">
        {match.tournament.name}
        {match.round ? ` — ${match.round}` : ""}
        {match.deadline && (
          <span className="ml-2 text-amber-400">
            Deadline: {new Date(match.deadline).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })} PKT
          </span>
        )}
      </p>

      {/* Availability status */}
      <div className="flex items-center gap-4 text-xs">
        <span className={homeAvail?.isAvailable ? "text-emerald-400" : "text-muted-foreground"}>
          {homeAvail?.isAvailable ? <><Check className="w-3 h-3 inline" /> {homeName} ready</> : <><Clock className="w-3 h-3 inline" /> {homeName} not ready</>}
        </span>
        <span className={awayAvail?.isAvailable ? "text-emerald-400" : "text-muted-foreground"}>
          {awayAvail?.isAvailable ? <><Check className="w-3 h-3 inline" /> {awayName} ready</> : <><Clock className="w-3 h-3 inline" /> {awayName} not ready</>}
        </span>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Quick score entry */}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            placeholder="H"
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            className="w-14 h-8 text-center text-sm"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <Input
            type="number"
            min={0}
            placeholder="A"
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            className="w-14 h-8 text-center text-sm"
          />
          <Button
            size="sm"
            onClick={handleQuickScore}
            disabled={isPending || !homeScore || !awayScore}
            className="h-8 px-3"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          </Button>
        </div>

        {/* Remind via WhatsApp */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleRemind}
          disabled={waSending}
          className="h-8 text-xs"
        >
          <MessageCircle className={`w-3 h-3 ${waSending ? "animate-pulse" : ""}`} />
          {waSending ? "Sending..." : "Remind"}
        </Button>

        {error && <span className="text-xs text-destructive">{error}</span>}
        {waStatus && <span className="text-xs text-muted-foreground">{waStatus}</span>}
      </div>
    </div>
  );
}

export function MatchDayList({ todayMatches, tomorrowMatches, overdueMatches, liveMatches }: MatchDayListProps) {
  const totalActive = todayMatches.length + overdueMatches.length + liveMatches.length;

  if (totalActive === 0 && tomorrowMatches.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Swords className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No matches scheduled for today or tomorrow.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Overdue */}
      {overdueMatches.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Overdue ({overdueMatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueMatches.map((m) => <MatchCard key={m.id} match={m} />)}
          </CardContent>
        </Card>
      )}

      {/* Live */}
      {liveMatches.length > 0 && (
        <Card className="border-green-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-400">
              <Zap className="w-4 h-4" />
              Live Now ({liveMatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveMatches.map((m) => <MatchCard key={m.id} match={m} />)}
          </CardContent>
        </Card>
      )}

      {/* Today */}
      {todayMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="w-4 h-4 text-blue-400" />
              Today ({todayMatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayMatches.map((m) => <MatchCard key={m.id} match={m} />)}
          </CardContent>
        </Card>
      )}

      {/* Tomorrow */}
      {tomorrowMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Tomorrow ({tomorrowMatches.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tomorrowMatches.map((m) => <MatchCard key={m.id} match={m} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
