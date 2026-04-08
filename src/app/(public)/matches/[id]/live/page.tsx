"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Radio } from "lucide-react";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { formatDateTime } from "@/lib/utils";

interface LiveMatch {
  id: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeScorePens: number | null;
  awayScorePens: number | null;
  round: string | null;
  scheduledAt: string | null;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homePlayer: { id: string; name: string } | null;
  awayPlayer: { id: string; name: string } | null;
  tournament: { name: string; slug: string };
  events: Array<{
    id: string;
    type: string;
    minute: number | null;
    player: { name: string } | null;
    description: string | null;
  }>;
}

export default function LiveMatchPage() {
  const params = useParams();
  const id = params.id as string;
  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${id}/live`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMatch(data);
      setLastUpdated(new Date());
      setError(false);
    } catch {
      setError(true);
    }
  }, [id]);

  useEffect(() => {
    fetchMatch();
    const interval = setInterval(fetchMatch, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [fetchMatch]);

  if (error && !match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Failed to load match. <Link href={`/matches/${id}`} className="text-primary hover:underline">View static page</Link></p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading live match...</div>
      </div>
    );
  }

  const isLive = match.status === "LIVE";
  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
  const homeId = match.homePlayer?.id ?? match.homeTeam?.id;
  const awayId = match.awayPlayer?.id ?? match.awayTeam?.id;
  const homeType = match.homePlayer ? "player" : "team";
  const awayType = match.awayPlayer ? "player" : "team";

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link href={`/matches/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Match Details
          </Link>
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
              <Radio className="w-3 h-3 animate-pulse" /> LIVE
            </span>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">{match.tournament.name}</p>

        {/* Score */}
        <div className="flex items-center justify-between gap-4 py-8">
          <div className="flex-1 flex flex-col items-center gap-2">
            {homeId && <SmartAvatar type={homeType} id={homeId} name={homeName} className="h-16 w-16" fallbackClassName="text-lg" />}
            <p className="font-bold text-center">{homeName}</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-black tabular-nums">
              {match.homeScore ?? 0}
              <span className="text-muted-foreground mx-2 text-3xl font-light">–</span>
              {match.awayScore ?? 0}
            </div>
            {match.homeScorePens != null && match.awayScorePens != null && (
              <p className="text-xs text-muted-foreground mt-1">({match.homeScorePens}–{match.awayScorePens} pens)</p>
            )}
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            {awayId && <SmartAvatar type={awayType} id={awayId} name={awayName} className="h-16 w-16" fallbackClassName="text-lg" />}
            <p className="font-bold text-center">{awayName}</p>
          </div>
        </div>

        {/* Events */}
        {match.events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {match.events.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 text-sm">
                    {e.minute != null && <span className="text-xs text-muted-foreground w-8 shrink-0">{e.minute}&apos;</span>}
                    <span className="font-medium">{e.player?.name}</span>
                    <span className="text-muted-foreground">{e.type.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {lastUpdated && (
          <p className="text-center text-xs text-muted-foreground">
            Last updated: {formatDateTime(lastUpdated)} · Auto-refreshes every 30s
          </p>
        )}
      </div>
    </div>
  );
}
