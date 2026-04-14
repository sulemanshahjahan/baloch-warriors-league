export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { getOverallStats } from "@/lib/actions/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Trophy, Target, TrendingUp, Swords, Users, Crosshair, Calendar, ShieldCheck, ArrowUpDown } from "lucide-react";
import { prisma } from "@/lib/db";
import { getInitials, gameLabel } from "@/lib/utils";
import { SmartAvatar } from "@/components/public/smart-avatar";
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
  searchParams: Promise<{ game?: string; season?: string }>;
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const { game, season } = await searchParams;
  const gameCategory = game ?? "all";
  const seasonId = season ?? "all";

  const [stats, seasons] = await Promise.all([
    getOverallStats(gameCategory, seasonId),
    prisma.season.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true } }),
  ]);

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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <StatsGameFilter categories={GAME_CATEGORIES} current={gameCategory} />
          {seasons.length > 0 && (
            <StatsGameFilter
              categories={[
                { value: "all", label: "All Seasons" },
                ...seasons.map((s) => ({ value: s.id, label: s.name })),
              ]}
              current={seasonId}
              paramName="season"
            />
          )}
        </div>

        {/* Stats cards — game-specific */}
        {/* Stats cards — game-specific */}
        {(() => {
          if (gameCategory === "PUBG") {
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Matches", value: stats.pubgTotals.matches, icon: "🎮" },
                  { label: "Total Kills", value: stats.pubgTotals.kills, icon: "💀" },
                  { label: "Chicken Dinners", value: stats.pubgTotals.dinners, icon: "🐔" },
                  { label: "Avg Placement", value: `#${stats.pubgTotals.avgPlacement}`, icon: "📊" },
                ].map((s) => (
                  <Card key={s.label}><CardContent className="p-4 text-center"><span className="text-lg">{s.icon}</span><div className="text-2xl font-bold mt-1">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
                ))}
              </div>
            );
          }
          if (gameCategory === "SNOOKER") {
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Matches", value: stats.totals.matches, icon: "🎱" },
                  { label: "Frame Wins", value: stats.totals.frameWins, icon: "🏆" },
                  { label: "MOTM", value: stats.totals.motm, icon: "⭐" },
                  { label: "Players", value: stats.topFrameWinners.length, icon: "👤" },
                ].map((s) => (
                  <Card key={s.label}><CardContent className="p-4 text-center"><span className="text-lg">{s.icon}</span><div className="text-2xl font-bold mt-1">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
                ))}
              </div>
            );
          }
          if (gameCategory === "CHECKERS") {
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Matches", value: stats.totals.matches, icon: "♟️" },
                  { label: "Game Wins", value: stats.totals.frameWins, icon: "🏆" },
                  { label: "MOTM", value: stats.totals.motm, icon: "⭐" },
                  { label: "Players", value: stats.topFrameWinners.length, icon: "👤" },
                ].map((s) => (
                  <Card key={s.label}><CardContent className="p-4 text-center"><span className="text-lg">{s.icon}</span><div className="text-2xl font-bold mt-1">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
                ))}
              </div>
            );
          }
          // Football / eFootball / All
          return (
            <>
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
              {gameCategory === "all" && stats.pubgTotals.matches > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "PUBG Matches", value: stats.pubgTotals.matches, icon: "🎮" },
                    { label: "Total Kills", value: stats.pubgTotals.kills, icon: "💀" },
                    { label: "Chicken Dinners", value: stats.pubgTotals.dinners, icon: "🐔" },
                    { label: "Avg Placement", value: `#${stats.pubgTotals.avgPlacement}`, icon: "📊" },
                  ].map((s) => (
                    <Card key={s.label}><CardContent className="p-4 text-center"><span className="text-lg">{s.icon}</span><div className="text-2xl font-bold mt-1">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        <Tabs key={gameCategory} defaultValue={gameCategory === "PUBG" ? "kills" : (gameCategory === "SNOOKER" || gameCategory === "CHECKERS") ? "frames" : "scorers"} className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
            <TabsTrigger value="scorers">
              <Target className="w-4 h-4 mr-2" />
              Top Scorers
            </TabsTrigger>
            {stats.topAssists.length > 0 && (
              <TabsTrigger value="assists">
                <TrendingUp className="w-4 h-4 mr-2" />
                Top Assists
              </TabsTrigger>
            )}
            {stats.mostMOTM.length > 0 && (
              <TabsTrigger value="motm">
                <Trophy className="w-4 h-4 mr-2" />
                Most MOTM
              </TabsTrigger>
            )}
            {stats.bestWinRate.length > 0 && (
              <TabsTrigger value="winrate">
                <TrendingUp className="w-4 h-4 mr-2" />
                Win Rate
              </TabsTrigger>
            )}
            {stats.topCleanSheets.length > 0 && (
              <TabsTrigger value="cleansheets">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Clean Sheets
              </TabsTrigger>
            )}
            {stats.topGoalDiff.length > 0 && (
              <TabsTrigger value="goaldiff">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Goal Diff
              </TabsTrigger>
            )}
            {stats.seasonMVP.length > 0 && (
              <TabsTrigger value="mvp">
                <BarChart3 className="w-4 h-4 mr-2" />
                Season MVP
              </TabsTrigger>
            )}
            {stats.topFrameWinners.length > 0 && (
              <TabsTrigger value="frames">
                <Trophy className="w-4 h-4 mr-2" />
                {gameCategory === "CHECKERS" ? "Game Wins" : "Frame Wins"}
              </TabsTrigger>
            )}
            {stats.topClubs.length > 0 && (
              <TabsTrigger value="clubs">
                <Swords className="w-4 h-4 mr-2" />
                Clubs
              </TabsTrigger>
            )}
            {stats.topKillers.length > 0 && (
              <TabsTrigger value="kills">
                <Crosshair className="w-4 h-4 mr-2" />
                PUBG Kills
              </TabsTrigger>
            )}
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

          {stats.bestWinRate.length > 0 && (
            <TabsContent value="winrate" className="mt-0">
              <LeaderboardCard
                title="Best Win Rate"
                data={stats.bestWinRate.map((s) => ({ ...s, count: s.count }))}
                icon={TrendingUp}
                color="text-emerald-400"
                suffix="%"
              />
            </TabsContent>
          )}

          {stats.topCleanSheets.length > 0 && (
            <TabsContent value="cleansheets" className="mt-0">
              <LeaderboardCard
                title="Most Clean Sheets"
                data={stats.topCleanSheets}
                icon={ShieldCheck}
                color="text-cyan-400"
              />
            </TabsContent>
          )}

          {stats.topGoalDiff.length > 0 && (
            <TabsContent value="goaldiff" className="mt-0">
              <LeaderboardCard
                title="Best Goal Difference"
                data={stats.topGoalDiff}
                icon={ArrowUpDown}
                color="text-amber-400"
                prefix="+"
              />
            </TabsContent>
          )}

          <TabsContent value="motm" className="mt-0">
            <LeaderboardCard
              title="Most Man of the Match"
              data={stats.mostMOTM}
              icon={Trophy}
              color="text-yellow-400"
            />
          </TabsContent>

          {stats.seasonMVP.length > 0 && (
            <TabsContent value="mvp" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Season MVP Rankings
                    <span className="text-xs text-muted-foreground font-normal ml-2">
                      Goals x3 + Assists x2 + MOTM x5
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.seasonMVP.map((item, i) =>
                      item.player ? (
                        <Link
                          key={item.player.id}
                          href={`/players/${item.player.slug}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-bold w-6 ${i === 0 ? "text-yellow-400" : i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                              {i + 1}
                            </span>
                            <SmartAvatar type="player" id={item.player.id} name={item.player.name} className="h-10 w-10" fallbackClassName="text-sm" />
                            <div>
                              <span className="font-medium">{item.player.name}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{item.goals}G</span>
                                <span>{item.assists}A</span>
                                <span>{item.motm}MOTM</span>
                                <span>· {item.matches} matches</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xl font-bold ${i === 0 ? "text-yellow-400" : "text-primary"}`}>
                              {item.score}
                            </span>
                            <p className="text-[10px] text-muted-foreground">pts</p>
                          </div>
                        </Link>
                      ) : null
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {stats.topFrameWinners.length > 0 && (
            <TabsContent value="frames" className="mt-0">
              <LeaderboardCard
                title={gameCategory === "CHECKERS" ? "Top Game Winners" : "Top Frame Winners"}
                data={stats.topFrameWinners}
                icon={Trophy}
                color="text-teal-400"
              />
            </TabsContent>
          )}

          {stats.topClubs.length > 0 && (
            <TabsContent value="clubs" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Swords className="w-4 h-4 text-purple-400" />
                    Most Used eFootball Clubs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.topClubs.map((item, i) => (
                      <div key={item.club} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold w-6 ${i < 3 ? "text-purple-400" : "text-muted-foreground"}`}>{i + 1}</span>
                          <span className="font-medium">{item.club}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{item.count} {item.count === 1 ? "pick" : "picks"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {stats.topKillers.length > 0 && (
            <TabsContent value="kills" className="mt-0">
              <PUBGKillsCard data={stats.topKillers} />
            </TabsContent>
          )}
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
  suffix,
  prefix,
}: {
  title: string;
  data: Array<{ player: { id: string; name: string; slug: string } | undefined; count: number; matches: number }>;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  suffix?: string;
  prefix?: string;
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
                    <SmartAvatar
                      type="player"
                      id={item.player.id}
                      name={item.player.name}
                      className="h-10 w-10"
                      fallbackClassName="text-sm"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{item.player.name}</span>
                      <span className="text-xs text-muted-foreground">{item.matches} matches</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xl font-bold">{prefix && item.count > 0 ? prefix : ""}{item.count}{suffix ?? ""}</span>
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

function PUBGKillsCard({
  data,
}: {
  data: Array<{ player: { id: string; name: string; slug: string } | undefined; count: number; dinners: number; matches: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-red-400" />
          PUBG Kill Leaders
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No PUBG data available yet.</p>
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
                    <span className={`text-lg font-bold w-6 ${i < 3 ? "text-red-400" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <SmartAvatar
                      type="player"
                      id={item.player.id}
                      name={item.player.name}
                      className="h-10 w-10"
                      fallbackClassName="text-sm"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{item.player.name}</span>
                      <span className="text-xs text-muted-foreground">{item.matches} matches</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {item.dinners > 0 && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <span>🐔</span>
                        <span className="font-semibold">{item.dinners}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="text-sm">💀</span>
                      <span className="text-xl font-bold text-red-400">{item.count}</span>
                    </div>
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
