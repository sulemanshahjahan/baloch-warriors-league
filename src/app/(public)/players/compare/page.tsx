import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BarChart3, Swords } from "lucide-react";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { formatDate } from "@/lib/utils";
import { PlayerPicker } from "./player-picker";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Player Comparison",
  description: "Compare two BWL players side by side.",
};

interface ComparePageProps {
  searchParams: Promise<{ p1?: string; p2?: string }>;
}

async function getPlayerWithStats(slug: string) {
  const player = await prisma.player.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, position: true, nationality: true },
  });
  if (!player) return null;

  const [events, matchesAsHome, matchesAsAway] = await Promise.all([
    prisma.matchEvent.groupBy({
      by: ["type"],
      where: { playerId: player.id },
      _count: { type: true },
    }),
    prisma.match.findMany({
      where: { homePlayerId: player.id, status: "COMPLETED" },
      select: { homeScore: true, awayScore: true },
    }),
    prisma.match.findMany({
      where: { awayPlayerId: player.id, status: "COMPLETED" },
      select: { homeScore: true, awayScore: true },
    }),
  ]);

  const statsMap: Record<string, number> = {};
  for (const e of events) statsMap[e.type] = e._count.type;

  let wins = 0, draws = 0, losses = 0;
  for (const m of matchesAsHome) {
    if ((m.homeScore ?? 0) > (m.awayScore ?? 0)) wins++;
    else if ((m.homeScore ?? 0) < (m.awayScore ?? 0)) losses++;
    else draws++;
  }
  for (const m of matchesAsAway) {
    if ((m.awayScore ?? 0) > (m.homeScore ?? 0)) wins++;
    else if ((m.awayScore ?? 0) < (m.homeScore ?? 0)) losses++;
    else draws++;
  }

  const totalMatches = matchesAsHome.length + matchesAsAway.length;

  return {
    ...player,
    stats: {
      matches: totalMatches,
      wins,
      draws,
      losses,
      winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
      goals: statsMap["GOAL"] ?? 0,
      assists: statsMap["ASSIST"] ?? 0,
      motm: statsMap["MOTM"] ?? 0,
      yellowCards: statsMap["YELLOW_CARD"] ?? 0,
      redCards: statsMap["RED_CARD"] ?? 0,
      kills: statsMap["KILL"] ?? 0,
      frameWins: statsMap["FRAME_WIN"] ?? 0,
    },
  };
}

type PlayerStats = {
  matches: number; wins: number; draws: number; losses: number;
  winRate: number; goals: number; assists: number; motm: number;
  yellowCards: number; redCards: number; kills: number; frameWins: number;
};
type StatKey = keyof PlayerStats;

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { p1, p2 } = await searchParams;

  if (!p1 || !p2) {
    const allPlayers = await prisma.player.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    });
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
          <h1 className="text-2xl font-bold">Player Comparison</h1>
          <p className="text-muted-foreground">Select two players to compare side by side.</p>
          <div className="grid grid-cols-2 gap-8 max-w-md mx-auto">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Player 1</p>
              <PlayerPicker players={allPlayers} slot="p1" current={p1 ?? ""} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Player 2</p>
              <PlayerPicker players={allPlayers} slot="p2" current={p2 ?? ""} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (p1 === p2) redirect(`/players/${p1}`);

  const [player1, player2, allPlayers] = await Promise.all([
    getPlayerWithStats(p1),
    getPlayerWithStats(p2),
    prisma.player.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  if (!player1 || !player2) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">One or both players not found.</p>
      </div>
    );
  }

  const statRows: { label: string; key: StatKey; icon?: string }[] = [
    { label: "Matches", key: "matches" },
    { label: "Wins", key: "wins" },
    { label: "Draws", key: "draws" },
    { label: "Losses", key: "losses" },
    { label: "Win Rate", key: "winRate", icon: "%" },
    { label: "Goals", key: "goals" },
    { label: "Assists", key: "assists" },
    { label: "MOTM", key: "motm" },
    { label: "Yellow Cards", key: "yellowCards" },
    { label: "Red Cards", key: "redCards" },
    ...(player1.stats.kills > 0 || player2.stats.kills > 0
      ? [{ label: "Kills" as const, key: "kills" as StatKey }]
      : []),
    ...(player1.stats.frameWins > 0 || player2.stats.frameWins > 0
      ? [{ label: "Frame Wins" as const, key: "frameWins" as StatKey }]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/players" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> All Players
          </Link>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-center mb-8">Player Comparison</h1>

          {/* Player headers */}
          <div className="grid grid-cols-2 gap-8">
            {([["p1", player1], ["p2", player2]] as const).map(([slot, p]) => (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <Link href={`/players/${p.slug}`} className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
                  <SmartAvatar type="player" id={p.id} name={p.name} className="h-20 w-20" fallbackClassName="text-xl" />
                  <p className="font-bold text-lg text-center">{p.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {p.position && <span>{p.position}</span>}
                    {p.nationality && <span>· {p.nationality}</span>}
                  </div>
                </Link>
                <PlayerPicker players={allPlayers} slot={slot} current={p.slug} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Stats Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {statRows.map(({ label, key, icon }) => {
                const v1 = player1.stats[key];
                const v2 = player2.stats[key];
                const max = Math.max(v1, v2, 1);
                const p1Better = v1 > v2;
                const p2Better = v2 > v1;
                // For losses/cards: lower is better
                const invertedKeys: StatKey[] = ["losses", "yellowCards", "redCards"];
                const inverted = invertedKeys.includes(key);
                const highlight1 = inverted ? p2Better : p1Better;
                const highlight2 = inverted ? p1Better : p2Better;

                return (
                  <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
                    {/* P1 bar */}
                    <div className="flex items-center gap-2 justify-end">
                      <span className={`text-sm font-bold tabular-nums ${highlight1 ? "text-green-400" : ""}`}>
                        {v1}{icon}
                      </span>
                      <div className="w-24 sm:w-40 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${highlight1 ? "bg-green-500" : "bg-muted-foreground/30"}`}
                          style={{ width: `${(v1 / max) * 100}%`, marginLeft: "auto" }}
                        />
                      </div>
                    </div>

                    {/* Label */}
                    <span className="text-xs text-muted-foreground text-center w-20 shrink-0">{label}</span>

                    {/* P2 bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-24 sm:w-40 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${highlight2 ? "bg-green-500" : "bg-muted-foreground/30"}`}
                          style={{ width: `${(v2 / max) * 100}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${highlight2 ? "text-green-400" : ""}`}>
                        {v2}{icon}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* H2H link */}
        <div className="text-center mt-6">
          <Link
            href={`/players/${player1.slug}/h2h/${player2.slug}`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Swords className="w-4 h-4" />
            View Head-to-Head Match History
          </Link>
        </div>
      </div>
    </div>
  );
}
