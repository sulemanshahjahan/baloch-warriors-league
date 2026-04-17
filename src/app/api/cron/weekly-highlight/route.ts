import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Weekly highlight: pick Player of the Week (best performer in last 7 days)
 * and publish to the PlayerOfWeek table + send a push notification.
 *
 * Scoring: goals * 3 + wins * 5 + cleanSheets * 4 + eloGained * 0.5
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  // Skip if we already have an entry for this week
  const existing = await prisma.playerOfWeek.findUnique({ where: { weekStart } });
  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already computed for this week" });
  }

  const [matches, elo] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: weekStart, lte: weekEnd },
        homePlayerId: { not: null },
        awayPlayerId: { not: null },
      },
      select: {
        homePlayerId: true,
        awayPlayerId: true,
        homeScore: true,
        awayScore: true,
        leg2HomeScore: true,
        leg2AwayScore: true,
        leg3HomeScore: true,
        leg3AwayScore: true,
      },
    }),
    prisma.eloHistory.groupBy({
      by: ["playerId"],
      where: { createdAt: { gte: weekStart, lte: weekEnd } },
      _sum: { change: true },
    }),
  ]);

  if (matches.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no matches this week" });
  }

  const stats = new Map<
    string,
    { goals: number; wins: number; cleanSheets: number; matchesPlayed: number }
  >();
  function ensure(pid: string) {
    let s = stats.get(pid);
    if (!s) {
      s = { goals: 0, wins: 0, cleanSheets: 0, matchesPlayed: 0 };
      stats.set(pid, s);
    }
    return s;
  }

  for (const m of matches) {
    const hp = m.homePlayerId!;
    const ap = m.awayPlayerId!;
    const legs: Array<{ h: number; a: number }> = [];
    if (m.homeScore != null && m.awayScore != null) legs.push({ h: m.homeScore, a: m.awayScore });
    if (m.leg2HomeScore != null && m.leg2AwayScore != null) legs.push({ h: m.leg2HomeScore, a: m.leg2AwayScore });
    if (m.leg3HomeScore != null && m.leg3AwayScore != null) legs.push({ h: m.leg3HomeScore, a: m.leg3AwayScore });
    for (const leg of legs) {
      const home = ensure(hp);
      const away = ensure(ap);
      home.matchesPlayed++;
      away.matchesPlayed++;
      home.goals += leg.h;
      away.goals += leg.a;
      if (leg.a === 0) home.cleanSheets++;
      if (leg.h === 0) away.cleanSheets++;
      if (leg.h > leg.a) home.wins++;
      else if (leg.h < leg.a) away.wins++;
    }
  }

  const eloMap = new Map<string, number>();
  for (const e of elo) eloMap.set(e.playerId, e._sum.change ?? 0);

  let best: {
    playerId: string;
    score: number;
    goals: number;
    wins: number;
    matchesPlayed: number;
    eloGained: number;
  } | null = null;
  for (const [pid, s] of stats) {
    const eloGained = eloMap.get(pid) ?? 0;
    const score = Math.round(s.goals * 3 + s.wins * 5 + s.cleanSheets * 4 + eloGained * 0.5);
    if (!best || score > best.score) {
      best = { playerId: pid, score, goals: s.goals, wins: s.wins, matchesPlayed: s.matchesPlayed, eloGained };
    }
  }

  if (!best) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no player stats" });
  }

  const player = await prisma.player.findUnique({
    where: { id: best.playerId },
    select: { name: true, slug: true },
  });

  const record = await prisma.playerOfWeek.create({
    data: {
      playerId: best.playerId,
      weekStart,
      weekEnd,
      goals: best.goals,
      wins: best.wins,
      matchesPlayed: best.matchesPlayed,
      eloGained: best.eloGained,
      score: best.score,
    },
  });

  if (player) {
    await notify({
      title: "🌟 Player of the Week",
      body: `${player.name} — ${best.goals} goals, ${best.wins} wins, +${best.eloGained} ELO`,
      url: `/players/${player.slug}`,
      tag: `potw-${weekStart.toISOString().slice(0, 10)}`,
    });
  }

  return NextResponse.json({
    ok: true,
    recordId: record.id,
    playerId: best.playerId,
    playerName: player?.name,
    score: best.score,
    goals: best.goals,
    wins: best.wins,
    eloGained: best.eloGained,
  });
}
