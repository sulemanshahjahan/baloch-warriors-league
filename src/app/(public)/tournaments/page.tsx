export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tournaments",
  description: "Browse all BWL tournaments — football, eFootball, PUBG, snooker, and checkers competitions.",
  openGraph: {
    title: "Tournaments | Baloch Warriors League",
    description: "Browse all BWL tournaments across multiple game categories.",
    type: "website",
  },
};
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Calendar,
  Users,
  Swords,
  ChevronRight,
} from "lucide-react";
import {
  formatDate,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
  formatLabel,
} from "@/lib/utils";

async function getTournaments() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ isFeatured: "desc" }, { startDate: "desc" }],
    include: {
      _count: {
        select: { teams: true, players: true, matches: true },
      },
    },
  });

  const active = tournaments.filter((t) => t.status === "ACTIVE");
  const upcoming = tournaments.filter((t) => t.status === "UPCOMING");
  const completed = tournaments.filter((t) => t.status === "COMPLETED");
  const draft = tournaments.filter((t) => t.status === "DRAFT");

  return { all: tournaments, active, upcoming, completed, draft };
}

function TournamentCard({
  tournament,
}: {
  tournament: {
    id: string;
    name: string;
    slug: string;
    gameCategory: string;
    format: string;
    status: string;
    participantType: string;
    startDate: Date | null;
    endDate: Date | null;
    isFeatured: boolean;
    _count: { teams: number; players: number; matches: number };
  };
}) {
  const isIndividual = tournament.participantType === "INDIVIDUAL";
  const participantCount = isIndividual 
    ? tournament._count.players 
    : tournament._count.teams;
  const participantLabel = isIndividual ? "players" : "teams";

  return (
    <Link href={`/tournaments/${tournament.slug}`}>
      <Card className="hover:border-primary/50 transition-all hover:-translate-y-0.5 cursor-pointer h-full group">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(
                  tournament.gameCategory as never
                )}`}
              >
                {gameLabel(tournament.gameCategory as never)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(
                  tournament.status as never
                )}`}
              >
                {statusLabel(tournament.status as never)}
              </span>
            </div>
            {tournament.isFeatured && (
              <Badge variant="secondary" className="text-xs">
                Featured
              </Badge>
            )}
          </div>

          <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">
            {tournament.name}
          </h3>

          <p className="text-sm text-muted-foreground mb-4">
            {formatLabel(tournament.format as never)}
          </p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>
                {tournament.startDate
                  ? formatDate(tournament.startDate)
                  : "Date TBD"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-1 text-sm">
              <Users className="w-4 h-4 text-blue-400" />
              <span>{participantCount} {participantLabel}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Swords className="w-4 h-4 text-orange-400" />
              <span>{tournament._count.matches} matches</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function TournamentsPage() {
  const { all, active, upcoming, completed } = await getTournaments();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Tournaments
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            All Competitions
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Browse all tournaments across Football, eFootball, PUBG, Snooker, and
            Checkers. View standings, matches, and awards.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all">
              All ({all.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active ({active.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            {all.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {all.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-0">
            {active.length === 0 ? (
              <EmptyState message="No active tournaments at the moment." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-0">
            {upcoming.length === 0 ? (
              <EmptyState message="No upcoming tournaments scheduled." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-0">
            {completed.length === 0 ? (
              <EmptyState message="No completed tournaments yet." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completed.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyState({ message = "No tournaments found." }: { message?: string }) {
  return (
    <div className="text-center py-16">
      <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
