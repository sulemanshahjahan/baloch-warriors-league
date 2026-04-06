export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { getOverallStats } from "@/lib/actions/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Trophy, Target, TrendingUp, Swords, Users } from "lucide-react";
import { getInitials, gameLabel } from "@/lib/utils";
import { StatsGameFilter } from "./stats-game-filter";

export const metadata: Metadata = {
  title: "Stats & Leaderboards",
  description: "BWL overall leaderboards — top scorers, top assists, and Man of the Match awards.",
  openGraph: {
    title: "Stats & Leaderboards | Baloch Warriors League",
    description: "League-wide statistics including top scorers, assists, and MOTM leaders.",
    type: "website",
  },
};

const GAME_CATEGORIES = [
  { value: "all", label: "All Games" },
  { value: "FOOTBALL", label: "Football" },
  { value: "EFOOTBALL", label: "eFootball" },
  { value: "PUBG", label: "PUBG" },
  { value: "SNOOKER", label: "Snooker" },
  { value: "CHECKERS", label: "Checkers" },
];

interface StatsPageProps {
  searchParams: Promise<{ game?: string }>;
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const { game } = await searchParams;
  const gameCategory = game ?? "all";
  const stats = await getOverallStats(gameCategory);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Statistics
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            League Leaderboards
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Top performers across all BWL tournaments. Track goals, assists, awards, and more.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Game category filter */}
        <StatsGameFilter categories={GAME_CATEGORIES} current={gameCategory} />

        {/* Overall Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Matches", value: stats.totals.matches, icon: Swords },
            { label: "Goals", value: stats.totals.goals, icon: Target },
            { label: "Assists", value: stats.totals.assists, icon: TrendingUp },
            { label: "Yellow Cards", value: stats.totals.yellowCards, icon: Users },
            { label: "Red Cards", value: stats.totals.redCards, icon: Users },
            { label: "MOTM", value: stats.totals.motm, icon: Trophy },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 text-center">
                <stat.icon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="scorers" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="scorers">
              <Target className="w-4 h-4 mr-2" />
              Top Scorers
            </TabsTrigger>
            <TabsTrigger value="assists">
              <TrendingUp className="w-4 h-4 mr-2" />
              Top Assists
            </TabsTrigger>
            <TabsTrigger value="motm">
              <Trophy className="w-4 h-4 mr-2" />
              Most MOTM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scorers" className="mt-0">
            <LeaderboardCard
              title="Top Goal Scorers"
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
  data: Array<{ player: { id: string; name: string; slug: string; photoUrl: string | null } | undefined; count: number; matches: number }>;
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
                    <span className={`text-lg font-bold w-6 ${i < 3 ? color : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={item.player.photoUrl ?? undefined} />
                      <AvatarFallback className="text-sm">
                        {getInitials(item.player.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.player.name}</span>
                      <span className="text-xs text-muted-foreground">{item.matches} matches</span>
                    </div>
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
