"use server";

import { prisma } from "@/lib/db";
import { getEarnedBadges, type PlayerBadge, type PlayerMatchData } from "@/lib/badges";
import { computeTitles, type PlayerTitle, type TitleCandidate } from "@/lib/titles";
import { computeStreaks, matchToLegs, type PlayerStreaks } from "@/lib/streaks";

export interface PlayerEngagement {
  badges: PlayerBadge[];
  titles: PlayerTitle[];
  streaks: PlayerStreaks;
  data: PlayerMatchData;
}

/**
 * Compute badges + streaks + per-player match data for a single player.
 * Titles are computed separately (need all-players context) — see getAllPlayerTitles.
 */
export async function getPlayerEngagement(playerId: string): Promise<PlayerEngagement> {
  const [matches, eloHistory, tournamentWins, perfectGroupRuns] = await Promise.all([
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        OR: [{ homePlayerId: playerId }, { awayPlayerId: playerId }],
      },
      orderBy: { completedAt: "asc" },
      select: {
        id: true,
        completedAt: true,
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
    prisma.eloHistory.findMany({
      where: { playerId },
      select: { result: true, ratingBefore: true, opponentRatingBefore: true },
    }),
    prisma.award.count({
      where: { playerId, type: "TOURNAMENT_WINNER" },
    }),
    prisma.standing.findMany({
      where: { playerId, groupId: { not: null }, played: { gt: 0 } },
      select: { played: true, won: true },
    }),
  ]);

  // Build per-leg records for streaks + counting
  const allLegs = matches.flatMap((m) => matchToLegs(m, playerId));
  const totalMatches = allLegs.length;
  let totalWins = 0;
  let cleanSheets = 0;
  let totalGoals = 0;
  let hatTricks = 0;
  for (const l of allLegs) {
    if (l.result === "WIN") totalWins++;
    if (l.goalsAgainst === 0) cleanSheets++;
    totalGoals += l.goalsFor;
    if (l.goalsFor >= 3) hatTricks++;
  }

  const giantKillings = eloHistory.filter(
    (h) => h.result === "WIN" && h.opponentRatingBefore >= h.ratingBefore + 50,
  ).length;

  const perfectGroups = perfectGroupRuns.filter((s) => s.played > 0 && s.won === s.played).length;

  const streaks = computeStreaks(allLegs);

  const data: PlayerMatchData = {
    totalMatches,
    totalWins,
    totalGoals,
    cleanSheets,
    consecutiveCleanSheets: streaks.longestCleanSheetStreak,
    currentWinStreak: streaks.currentWinStreak,
    longestWinStreak: streaks.longestWinStreak,
    hatTricks,
    tournamentWins,
    giantKillings,
    perfectGroupRuns: perfectGroups,
  };

  const badges = getEarnedBadges(data);

  return {
    badges,
    titles: [], // populated by caller using getAllPlayerTitles
    streaks,
    data,
  };
}

/**
 * Compute titles across all players. Returns a map of playerId → titles.
 * Run once per page load or cache aggressively.
 */
export async function getAllPlayerTitles(): Promise<Map<string, PlayerTitle[]>> {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    select: { id: true, name: true, eloRating: true },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [allMatches, eloRecent, allEloHistory] = await Promise.all([
    prisma.match.findMany({
      where: { status: "COMPLETED", homePlayerId: { not: null }, awayPlayerId: { not: null } },
      select: {
        homePlayerId: true,
        awayPlayerId: true,
        homeScore: true,
        awayScore: true,
        leg2HomeScore: true,
        leg2AwayScore: true,
        leg3HomeScore: true,
        leg3AwayScore: true,
        completedAt: true,
      },
    }),
    prisma.eloHistory.groupBy({
      by: ["playerId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _sum: { change: true },
    }),
    prisma.eloHistory.findMany({
      select: { playerId: true, result: true, ratingBefore: true, opponentRatingBefore: true },
    }),
  ]);

  const eloGainedMap = new Map<string, number>();
  for (const g of eloRecent) eloGainedMap.set(g.playerId, g._sum.change ?? 0);

  const giantKillMap = new Map<string, number>();
  for (const h of allEloHistory) {
    if (h.result === "WIN" && h.opponentRatingBefore >= h.ratingBefore + 50) {
      giantKillMap.set(h.playerId, (giantKillMap.get(h.playerId) ?? 0) + 1);
    }
  }

  // Aggregate per-player stats from matches
  const agg = new Map<
    string,
    { goals: number; wins: number; cleanSheets: number; matches: number; streakLegs: { result: "WIN" | "LOSS" | "DRAW" }[] }
  >();

  function ensure(pid: string) {
    let a = agg.get(pid);
    if (!a) {
      a = { goals: 0, wins: 0, cleanSheets: 0, matches: 0, streakLegs: [] };
      agg.set(pid, a);
    }
    return a;
  }

  // Matches need sorting for streak calculation
  const sortedMatches = [...allMatches].sort(
    (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
  );

  for (const m of sortedMatches) {
    const hp = m.homePlayerId!;
    const ap = m.awayPlayerId!;
    const legs: Array<{ h: number; a: number }> = [];
    if (m.homeScore != null && m.awayScore != null) legs.push({ h: m.homeScore, a: m.awayScore });
    if (m.leg2HomeScore != null && m.leg2AwayScore != null) legs.push({ h: m.leg2HomeScore, a: m.leg2AwayScore });
    if (m.leg3HomeScore != null && m.leg3AwayScore != null) legs.push({ h: m.leg3HomeScore, a: m.leg3AwayScore });
    for (const leg of legs) {
      const home = ensure(hp);
      const away = ensure(ap);
      home.matches++;
      away.matches++;
      home.goals += leg.h;
      away.goals += leg.a;
      if (leg.a === 0) home.cleanSheets++;
      if (leg.h === 0) away.cleanSheets++;
      if (leg.h > leg.a) {
        home.wins++;
        home.streakLegs.push({ result: "WIN" });
        away.streakLegs.push({ result: "LOSS" });
      } else if (leg.h < leg.a) {
        away.wins++;
        home.streakLegs.push({ result: "LOSS" });
        away.streakLegs.push({ result: "WIN" });
      } else {
        home.streakLegs.push({ result: "DRAW" });
        away.streakLegs.push({ result: "DRAW" });
      }
    }
  }

  const candidates: TitleCandidate[] = players.map((p) => {
    const a = agg.get(p.id) ?? { goals: 0, wins: 0, cleanSheets: 0, matches: 0, streakLegs: [] };
    // Longest win streak
    let longestWinStreak = 0;
    let run = 0;
    for (const l of a.streakLegs) {
      if (l.result === "WIN") {
        run++;
        if (run > longestWinStreak) longestWinStreak = run;
      } else {
        run = 0;
      }
    }
    return {
      playerId: p.id,
      playerName: p.name,
      goals: a.goals,
      wins: a.wins,
      cleanSheets: a.cleanSheets,
      matches: a.matches,
      eloRating: p.eloRating,
      eloGainedLast30Days: eloGainedMap.get(p.id) ?? 0,
      giantKillings: giantKillMap.get(p.id) ?? 0,
      winRate: a.matches > 0 ? a.wins / a.matches : 0,
      longestWinStreak,
    };
  });

  return computeTitles(candidates);
}
