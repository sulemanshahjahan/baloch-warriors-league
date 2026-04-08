import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

// Use ISR instead of full SSG to avoid DB connection pool exhaustion
export const revalidate = 60;
export const dynamicParams = true;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SmartAvatar } from "@/components/public/smart-avatar";
import {
  Shield,
  Users,
  Trophy,
  ArrowLeft,
  User,
  Swords,
  Award,
} from "lucide-react";
import {
  getInitials,
  formatDate,
  gameLabel,
  statusColor,
  statusLabel,
} from "@/lib/utils";

interface TeamPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!team) return { title: "Team Not Found" };
  return {
    title: team.name,
    description: `View ${team.name}'s roster, match history, and tournament record in BWL.`,
    openGraph: {
      title: `${team.name} | BWL`,
      description: `${team.name} — roster, results, and stats in the Baloch Warriors League.`,
      type: "website",
    },
  };
}

async function getTeamBySlug(slug: string) {
  return prisma.team.findUnique({
    where: { slug },
    include: {
      players: {
        where: { isActive: true },
        include: {
          player: {
            select: {
              id: true,
              slug: true,
              name: true,
              position: true,
              nationality: true,
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      },
      captain: { select: { id: true, slug: true, name: true } },
      tournaments: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              slug: true,
              gameCategory: true,
              status: true,
            },
          },
        },
        orderBy: { registeredAt: "desc" },
      },
      awards: {
        include: {
          tournament: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

const AWARD_TYPE_LABELS: Record<string, string> = {
  GOLDEN_BOOT: "Golden Boot",
  TOP_ASSISTS: "Top Assists",
  BEST_PLAYER: "Best Player",
  BEST_GOALKEEPER: "Best Goalkeeper",
  FAIR_PLAY: "Fair Play",
  TOURNAMENT_MVP: "Tournament MVP",
  TOURNAMENT_WINNER: "Tournament Winner",
  CUSTOM: "Custom",
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);

  if (!team) notFound();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section
        className="border-b border-border/50 bg-card/30"
        style={team.primaryColor ? { borderBottomColor: team.primaryColor + "40" } : undefined}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/teams"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            All Teams
          </Link>

          <div className="flex items-start gap-4">
            <div
              className="rounded-full p-0.5 shrink-0"
              style={team.primaryColor ? { background: `linear-gradient(135deg, ${team.primaryColor}, ${team.primaryColor}88)` } : undefined}
            >
              <SmartAvatar
                type="team"
                id={team.id}
                name={team.name}
                className="h-20 w-20 sm:h-24 sm:w-24"
                fallbackClassName="text-2xl sm:text-3xl"
                primaryColor={team.primaryColor}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                {team.name}
              </h1>
              {team.shortName && (
                <p className="text-base sm:text-lg text-muted-foreground truncate">
                  {team.shortName}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {team.captain && (
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                    <User className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">C:</span>
                    <Link
                      href={`/players/${team.captain.slug}`}
                      className="font-medium hover:text-primary truncate"
                    >
                      {team.captain.name}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main - Squad */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Squad ({team.players.length} players)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {team.players.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No players in the squad yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Player</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead className="text-center">Jersey #</TableHead>
                        <TableHead>Nationality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team.players.map(({ player, jerseyNumber }) => (
                        <TableRow key={player.id}>
                          <TableCell>
                            <Link
                              href={`/players/${player.slug}`}
                              className="flex items-center gap-3 hover:text-primary"
                            >
                              <SmartAvatar
                                type="player"
                                id={player.id}
                                name={player.name}
                                className="h-8 w-8"
                                fallbackClassName="text-xs"
                              />
                              <span className="font-medium">{player.name}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {player.position ?? "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {jerseyNumber ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {player.nationality ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Tournaments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Tournament History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {team.tournaments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Not enrolled in any tournaments yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {team.tournaments.map(({ tournament }) => (
                      <Link
                        key={tournament.id}
                        href={`/tournaments/${tournament.slug}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="font-medium">{tournament.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {gameLabel(tournament.gameCategory)}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(
                            tournament.status
                          )}`}
                        >
                          {statusLabel(tournament.status)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Awards */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" />
                  Awards ({team.awards.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {team.awards.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No awards yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {team.awards.map((award) => (
                      <div
                        key={award.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 shrink-0">
                          <Award className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {AWARD_TYPE_LABELS[award.type] ?? award.type}
                          </p>
                          {award.tournament && (
                            <Link
                              href={`/tournaments/${award.tournament.slug}`}
                              className="text-xs text-muted-foreground hover:text-primary"
                            >
                              {award.tournament.name}
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
