import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTournamentStats } from "@/lib/actions/stats";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Trophy, Target, TrendingUp, Swords, ArrowLeft } from "lucide-react";
import { getInitials, gameLabel, gameColor } from "@/lib/utils";
import { SmartAvatar } from "@/components/public/smart-avatar";

// Use ISR instead of full SSG to avoid DB connection pool exhaustion
export const revalidate = 60;
export const dynamicParams = false;

interface TournamentStatsPageProps {
  params: Promise<{ slug: string }>;
}

// Generate static pages for all tournaments at build time
export async function generateStaticParams() {
  const tournaments = await prisma.tournament.findMany({
    select: { slug: true },
  });
  return tournaments.map((t) => ({ slug: t.slug }));
}

async function getTournamentBySlug(slug: string) {
  return prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true, gameCategory: true, status: true },
  });
}

export default async function TournamentStatsPage({ params }: TournamentStatsPageProps) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) notFound();

  const stats = await getTournamentStats(tournament.id);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href={`/tournaments/${slug}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tournament
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${gameColor(tournament.gameCategory)}`}>
              {gameLabel(tournament.gameCategory)}
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Tournament Stats
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            {tournament.name}
          </h1>
          <p className="text-muted-foreground mt-2">
            {stats.totals.matches} matches played • {stats.totals.goals} goals scored
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all">All Stats</TabsTrigger>
            <TabsTrigger value="scorers">
              <Target className="w-4 h-4 mr-2" />
              Top Scorers
            </TabsTrigger>
            <TabsTrigger value="assists">
              <TrendingUp className="w-4 h-4 mr-2" />
              Assists
            </TabsTrigger>
            <TabsTrigger value="motm">
              <Trophy className="w-4 h-4 mr-2" />
              MOTM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Player Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.allStats.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No stats available yet. Matches need to be played first.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-center">Matches</TableHead>
                        <TableHead className="text-center">Goals</TableHead>
                        <TableHead className="text-center">Assists</TableHead>
                        <TableHead className="text-center">MOTM</TableHead>
                        <TableHead className="text-center">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.allStats.map((stat, i) => (
                        <TableRow key={stat.player.id}>
                          <TableCell className="font-medium">{i + 1}</TableCell>
                          <TableCell>
                            <Link
                              href={`/players/${stat.player.slug}`}
                              className="flex items-center gap-3 hover:text-primary"
                            >
                              <SmartAvatar
                                type="player"
                                id={stat.player.id}
                                name={stat.player.name}
                                className="h-8 w-8"
                                fallbackClassName="text-xs"
                              />
                              {stat.player.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">{stat.matches}</TableCell>
                          <TableCell className="text-center font-bold">{stat.goals}</TableCell>
                          <TableCell className="text-center">{stat.assists}</TableCell>
                          <TableCell className="text-center">
                            {stat.motm > 0 && <span className="text-yellow-400">{stat.motm}</span>}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {stat.points}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scorers" className="mt-0">
            <LeaderboardCard 
              title="Top Scorers" 
              data={stats.topScorers} 
              icon={Target}
              color="text-green-400"
            />
          </TabsContent>

          <TabsContent value="assists" className="mt-0">
            <LeaderboardCard 
              title="Top Assists" 
              data={stats.topAssists} 
              icon={TrendingUp}
              color="text-blue-400"
            />
          </TabsContent>

          <TabsContent value="motm" className="mt-0">
            <LeaderboardCard 
              title="Most Man of the Match" 
              data={stats.mostMOTM} 
              icon={Trophy}
              color="text-yellow-400"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LeaderboardCard({ 
  title, 
  data, 
  icon: Icon,
  color,
}: { 
  title: string; 
  data: Array<{ player: { id: string; name: string; slug: string } | undefined; count: number }>;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No data available yet.</p>
        ) : (
          <div className="space-y-3">
            {data.map((item, i) =>
              item.player ? (
                <Link
                  key={item.player.id}
                  href={`/players/${item.player.slug}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold w-6 ${i < 3 ? color : 'text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                    <SmartAvatar 
                      type="player"
                      id={item.player.id}
                      name={item.player.name}
                      className="h-10 w-10"
                      fallbackClassName="text-sm"
                    />
                    <span className="font-medium">{item.player.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xl font-bold">{item.count}</span>
                  </div>
                </Link>
              ) : null
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
