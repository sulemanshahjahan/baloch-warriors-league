"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Swords, Calendar, ArrowRight } from "lucide-react";
import {
  formatDateTime,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
} from "@/lib/utils";
import { SmartAvatar } from "@/components/public/smart-avatar";

type Match = {
  id: string;
  status: string;
  scheduledAt: string | null;
  round: string | null;
  homeScore: number | null;
  awayScore: number | null;
  tournament: { name: string; slug: string; gameCategory: string };
  homeTeam: { id: string; name: string; shortName: string | null } | null;
  awayTeam: { id: string; name: string; shortName: string | null } | null;
  homePlayer: { id: string; name: string } | null;
  awayPlayer: { id: string; name: string } | null;
};

function MatchSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-28 rounded-lg bg-muted/50 animate-pulse" />
      ))}
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const isCompleted = match.status === "COMPLETED";
  const isLive = match.status === "LIVE";

  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";

  return (
    <Link href={`/matches/${match.id}`} className="block">
      <Card className="hover:border-primary/30 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate max-w-[160px]">
                {match.tournament.name}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${gameColor(match.tournament.gameCategory as never)}`}>
                {gameLabel(match.tournament.gameCategory as never)}
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor(match.status as never)}`}>
              {isLive ? "LIVE" : statusLabel(match.status as never)}
            </span>
          </div>

          {match.round && (
            <p className="text-xs text-muted-foreground mb-3">{match.round}</p>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              {match.homePlayer ? (
                <SmartAvatar type="player" id={match.homePlayer.id} name={homeName} className="h-10 w-10 shrink-0" fallbackClassName="text-sm" />
              ) : match.homeTeam ? (
                <SmartAvatar type="team" id={match.homeTeam.id} name={homeName} className="h-10 w-10 shrink-0" fallbackClassName="text-sm" />
              ) : null}
              <div className="min-w-0">
                <p className="font-medium truncate">{homeName}</p>
                {match.homeTeam?.shortName && !match.homePlayer && (
                  <p className="text-xs text-muted-foreground">{match.homeTeam.shortName}</p>
                )}
              </div>
            </div>

            <div className="text-center min-w-[80px] shrink-0">
              {isCompleted || isLive ? (
                <span className="text-2xl font-black">
                  {match.homeScore ?? 0} - {match.awayScore ?? 0}
                </span>
              ) : (
                <span className="text-muted-foreground font-medium">vs</span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="min-w-0 text-right">
                <p className="font-medium truncate">{awayName}</p>
                {match.awayTeam?.shortName && !match.awayPlayer && (
                  <p className="text-xs text-muted-foreground">{match.awayTeam.shortName}</p>
                )}
              </div>
              {match.awayPlayer ? (
                <SmartAvatar type="player" id={match.awayPlayer.id} name={awayName} className="h-10 w-10 shrink-0" fallbackClassName="text-sm" />
              ) : match.awayTeam ? (
                <SmartAvatar type="team" id={match.awayTeam.id} name={awayName} className="h-10 w-10 shrink-0" fallbackClassName="text-sm" />
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
            {match.scheduledAt ? (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {formatDateTime(new Date(match.scheduledAt))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Date TBD</span>
            )}
            <span className="text-sm text-primary flex items-center gap-1">
              Details <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ message = "No matches found." }: { message?: string }) {
  return (
    <div className="text-center py-16">
      <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

function MatchList({ matches, loading, message }: { matches: Match[]; loading: boolean; message?: string }) {
  if (loading) return <MatchSkeleton />;
  if (matches.length === 0) return <EmptyState message={message} />;
  return (
    <>
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </>
  );
}

export function MatchesClient() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMatches(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const upcoming = matches.filter((m) => m.status === "SCHEDULED");
  const live = matches.filter((m) => m.status === "LIVE");
  const completed = matches.filter((m) => m.status === "COMPLETED");

  return (
    <div className="min-h-screen">
        {/* Hero */}
        <section className="border-b border-border/50 bg-card/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <Swords className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary tracking-widest uppercase">
                Matches
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              All Fixtures & Results
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              View upcoming fixtures and match results from all BWL tournaments.
            </p>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Failed to load matches. Please refresh.</p>
            </div>
          ) : (
            <Tabs defaultValue="all" className="space-y-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all">
                  All {!loading && `(${matches.length})`}
                </TabsTrigger>
                {live.length > 0 && (
                  <TabsTrigger value="live" className="text-red-400">
                    ● Live ({live.length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="upcoming">
                  Upcoming {!loading && `(${upcoming.length})`}
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Results {!loading && `(${completed.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-0 space-y-3">
                <MatchList matches={matches} loading={loading} />
              </TabsContent>

              {live.length > 0 && (
                <TabsContent value="live" className="mt-0 space-y-3">
                  <MatchList matches={live} loading={false} />
                </TabsContent>
              )}

              <TabsContent value="upcoming" className="mt-0 space-y-3">
                <MatchList matches={upcoming} loading={loading} message="No upcoming fixtures scheduled." />
              </TabsContent>

              <TabsContent value="completed" className="mt-0 space-y-3">
                <MatchList matches={completed} loading={loading} message="No completed matches yet." />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
  );
}
