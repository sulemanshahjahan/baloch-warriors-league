export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Matches",
  description: "View all BWL match fixtures and results — upcoming, live, and completed.",
  openGraph: {
    title: "Matches | Baloch Warriors League",
    description: "All BWL fixtures, live scores, and completed match results.",
    type: "website",
  },
};
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Swords, Calendar, ArrowRight, Trophy } from "lucide-react";
import {
  getInitials,
  formatDateTime,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
} from "@/lib/utils";

async function getMatches() {
  const matches = await prisma.match.findMany({
    orderBy: { scheduledAt: "desc" },
    include: {
      tournament: {
        select: { name: true, slug: true, gameCategory: true },
      },
      homeTeam: {
        select: { id: true, name: true, shortName: true, logoUrl: true },
      },
      awayTeam: {
        select: { id: true, name: true, shortName: true, logoUrl: true },
      },
      homePlayer: {
        select: { id: true, name: true, photoUrl: true },
      },
      awayPlayer: {
        select: { id: true, name: true, photoUrl: true },
      },
    },
  });

  const upcoming = matches.filter((m) => m.status === "SCHEDULED");
  const live = matches.filter((m) => m.status === "LIVE");
  const completed = matches.filter((m) => m.status === "COMPLETED");

  return { all: matches, upcoming, live, completed };
}

export default async function MatchesPage() {
  const { all, upcoming, live, completed } = await getMatches();

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
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            {live.length > 0 && (
              <TabsTrigger value="live" className="text-red-400">
                ● Live ({live.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="completed">Results ({completed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0 space-y-3">
            {all.length === 0 ? (
              <EmptyState />
            ) : (
              all.map((match) => <MatchCard key={match.id} match={match} />)
            )}
          </TabsContent>

          {live.length > 0 && (
            <TabsContent value="live" className="mt-0 space-y-3">
              {live.map((match) => <MatchCard key={match.id} match={match} showLive />)}
            </TabsContent>
          )}

          <TabsContent value="upcoming" className="mt-0 space-y-3">
            {upcoming.length === 0 ? (
              <EmptyState message="No upcoming fixtures scheduled." />
            ) : (
              upcoming.map((match) => <MatchCard key={match.id} match={match} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-0 space-y-3">
            {completed.length === 0 ? (
              <EmptyState message="No completed matches yet." />
            ) : (
              completed.map((match) => <MatchCard key={match.id} match={match} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  showLive = false,
}: {
  match: {
    id: string;
    round: string | null;
    homeTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
    awayTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
    homePlayer: { id: string; name: string; photoUrl: string | null } | null;
    awayPlayer: { id: string; name: string; photoUrl: string | null } | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    scheduledAt: Date | null;
    tournament: { name: string; slug: string; gameCategory: string };
  };
  showLive?: boolean;
}) {
  const isCompleted = match.status === "COMPLETED";
  const isLive = match.status === "LIVE";
  
  // Support both team and individual player matches
  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
  const homeLogo = match.homePlayer?.photoUrl ?? match.homeTeam?.logoUrl ?? undefined;
  const awayLogo = match.awayPlayer?.photoUrl ?? match.awayTeam?.logoUrl ?? undefined;

  return (
    <Link href={`/matches/${match.id}`} className="block">
    <Card className="hover:border-primary/30 transition-colors cursor-pointer">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/tournaments/${match.tournament.slug}`}
              className="text-sm font-medium hover:text-primary"
            >
              {match.tournament.name}
            </Link>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(
                match.tournament.gameCategory as never
              )}`}
            >
              {gameLabel(match.tournament.gameCategory as never)}
            </span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(
              match.status as never
            )}`}
          >
            {isLive ? "LIVE" : statusLabel(match.status as never)}
          </span>
        </div>

        {match.round && (
          <p className="text-xs text-muted-foreground mb-3">{match.round}</p>
        )}

        {/* Teams & Score */}
        <div className="flex items-center justify-between gap-4">
          {/* Home Team/Player */}
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-10 w-10">
              <AvatarImage src={homeLogo} />
              <AvatarFallback className="text-sm">
                {getInitials(homeName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium truncate">{homeName}</p>
              {match.homeTeam?.shortName && !match.homePlayer && (
                <p className="text-xs text-muted-foreground">
                  {match.homeTeam.shortName}
                </p>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="text-center min-w-[80px]">
            {isCompleted || isLive ? (
              <span className="text-2xl font-black">
                {match.homeScore ?? 0} - {match.awayScore ?? 0}
              </span>
            ) : (
              <span className="text-muted-foreground font-medium">vs</span>
            )}
          </div>

          {/* Away Team/Player */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="min-w-0 text-right">
              <p className="font-medium truncate">{awayName}</p>
              {match.awayTeam?.shortName && !match.awayPlayer && (
                <p className="text-xs text-muted-foreground">
                  {match.awayTeam.shortName}
                </p>
              )}
            </div>
            <Avatar className="h-10 w-10">
              <AvatarImage src={awayLogo} />
              <AvatarFallback className="text-sm">
                {getInitials(awayName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          {match.scheduledAt ? (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {formatDateTime(match.scheduledAt)}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Date TBD</span>
          )}
          <div className="flex items-center gap-3">
            <Link
              href={`/tournaments/${match.tournament.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {match.tournament.name}
            </Link>
            <Link
              href={`/matches/${match.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Details
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
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
