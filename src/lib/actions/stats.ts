"use server";

import { prisma } from "@/lib/db";

// Overall stats across all tournaments
export async function getOverallStats(gameCategory?: string, seasonId?: string) {
  const tournamentFilter: Record<string, unknown> = {};
  if (gameCategory && gameCategory !== "all") tournamentFilter.gameCategory = gameCategory;
  if (seasonId && seasonId !== "all") tournamentFilter.seasonId = seasonId;
  const hasTournamentFilter = Object.keys(tournamentFilter).length > 0;
  const gameCategoryFilter = hasTournamentFilter ? { match: { tournament: tournamentFilter } } : {};

  // PUBG filter — kills leaderboard queries PUBG tournaments regardless of game filter
  const pubgFilter = gameCategory === "all" || gameCategory === "PUBG";

  const [
    topScorers,
    topAssists,
    mostMOTM,
    totalStats,
    allMatches,
    topFrameWinners,
    clubMatches,
    pubgKillStandings,
  ] = await Promise.all([
    // Top scorers overall
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "GOAL", playerId: { not: null }, ...gameCategoryFilter },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    // Top assists overall
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "ASSIST", playerId: { not: null }, ...gameCategoryFilter },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    // Most MOTM
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "MOTM", playerId: { not: null }, ...gameCategoryFilter },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    // Total counts
    Promise.all([
      prisma.match.count({ where: { status: "COMPLETED", ...(hasTournamentFilter ? { tournament: tournamentFilter } : {}) } }),
      prisma.matchEvent.count({ where: { type: "GOAL", ...gameCategoryFilter } }),
      prisma.matchEvent.count({ where: { type: "ASSIST", ...gameCategoryFilter } }),
      prisma.matchEvent.count({ where: { type: "YELLOW_CARD", ...gameCategoryFilter } }),
      prisma.matchEvent.count({ where: { type: "RED_CARD", ...gameCategoryFilter } }),
      prisma.matchEvent.count({ where: { type: "MOTM", ...gameCategoryFilter } }),
    ]),
    // All completed individual matches for calculating matches played
    prisma.match.findMany({
      where: { status: "COMPLETED", homePlayerId: { not: null }, ...(hasTournamentFilter ? { tournament: tournamentFilter } : {}) },
      select: {
        homePlayerId: true,
        awayPlayerId: true,
      },
    }),
    // Top frame winners (Snooker/Checkers)
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "FRAME_WIN", playerId: { not: null }, ...gameCategoryFilter },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    // Most used eFootball clubs
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        tournament: { gameCategory: "EFOOTBALL" },
        OR: [{ homeClub: { not: null } }, { awayClub: { not: null } }],
      },
      select: { homeClub: true, awayClub: true },
    }),
    // PUBG kill leaders from standings (goalsFor = total kills, won = chicken dinners)
    pubgFilter
      ? prisma.standing.findMany({
          where: {
            groupId: null,
            playerId: { not: null },
            goalsFor: { gt: 0 },
            tournament: { gameCategory: "PUBG" },
          },
          select: { playerId: true, goalsFor: true, won: true, played: true },
        })
      : Promise.resolve([]),
  ]);

  // Calculate matches played per player
  const matchCounts = new Map<string, number>();
  for (const match of allMatches) {
    if (match.homePlayerId) {
      matchCounts.set(match.homePlayerId, (matchCounts.get(match.homePlayerId) || 0) + 1);
    }
    if (match.awayPlayerId) {
      matchCounts.set(match.awayPlayerId, (matchCounts.get(match.awayPlayerId) || 0) + 1);
    }
  }

  // Aggregate PUBG kills per player
  const killsMap = new Map<string, { kills: number; dinners: number; matches: number }>();
  for (const s of pubgKillStandings) {
    if (!s.playerId) continue;
    const existing = killsMap.get(s.playerId) ?? { kills: 0, dinners: 0, matches: 0 };
    existing.kills += s.goalsFor;
    existing.dinners += s.won;
    existing.matches += s.played;
    killsMap.set(s.playerId, existing);
  }
  const topKillerIds = [...killsMap.entries()]
    .sort((a, b) => b[1].kills - a[1].kills)
    .slice(0, 20);

  // PUBG aggregate totals
  const pubgTotalKills = [...killsMap.values()].reduce((s, v) => s + v.kills, 0);
  const pubgTotalDinners = [...killsMap.values()].reduce((s, v) => s + v.dinners, 0);
  const pubgTotalMatches = pubgFilter
    ? await prisma.match.count({ where: { status: "COMPLETED", tournament: { gameCategory: "PUBG" } } })
    : 0;
  const pubgAvgPlacement = pubgFilter && pubgTotalMatches > 0
    ? await prisma.matchParticipant.aggregate({
        where: { placement: { not: null }, match: { status: "COMPLETED", tournament: { gameCategory: "PUBG" } } },
        _avg: { placement: true },
      }).then((r) => Math.round((r._avg.placement ?? 0) * 10) / 10)
    : 0;

  // Get player details for all leaderboards
  const playerIds = [...new Set([
    ...topScorers.map(s => s.playerId!),
    ...topAssists.map(s => s.playerId!),
    ...mostMOTM.map(s => s.playerId!),
    ...matchCounts.keys(),
    ...topFrameWinners.map(s => s.playerId!),
    ...killsMap.keys(),
  ])];

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, name: true, slug: true },
  });

  const playerMap = new Map(players.map(p => [p.id, p]));

  return {
    topScorers: topScorers.map(s => ({
      player: playerMap.get(s.playerId!),
      count: s._count.type,
      matches: matchCounts.get(s.playerId!) || 0,
    })).filter(s => s.player),
    topAssists: topAssists.map(s => ({
      player: playerMap.get(s.playerId!),
      count: s._count.type,
      matches: matchCounts.get(s.playerId!) || 0,
    })).filter(s => s.player),
    mostMOTM: mostMOTM.map(s => ({
      player: playerMap.get(s.playerId!),
      count: s._count.type,
      matches: matchCounts.get(s.playerId!) || 0,
    })).filter(s => s.player),
    topFrameWinners: topFrameWinners.map(s => ({
      player: playerMap.get(s.playerId!),
      count: s._count.type,
      matches: matchCounts.get(s.playerId!) || 0,
    })).filter(s => s.player),
    seasonMVP: (() => {
      // Score = (goals * 3) + (assists * 2) + (MOTM * 5)
      const scoreMap = new Map<string, number>();
      for (const s of topScorers) {
        if (s.playerId) scoreMap.set(s.playerId, (scoreMap.get(s.playerId) ?? 0) + s._count.type * 3);
      }
      for (const s of topAssists) {
        if (s.playerId) scoreMap.set(s.playerId, (scoreMap.get(s.playerId) ?? 0) + s._count.type * 2);
      }
      for (const s of mostMOTM) {
        if (s.playerId) scoreMap.set(s.playerId, (scoreMap.get(s.playerId) ?? 0) + s._count.type * 5);
      }
      return [...scoreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([playerId, score]) => {
          const goals = topScorers.find((s) => s.playerId === playerId)?._count.type ?? 0;
          const assists = topAssists.find((s) => s.playerId === playerId)?._count.type ?? 0;
          const motm = mostMOTM.find((s) => s.playerId === playerId)?._count.type ?? 0;
          return {
            player: playerMap.get(playerId),
            score,
            goals,
            assists,
            motm,
            matches: matchCounts.get(playerId) ?? 0,
          };
        })
        .filter((s) => s.player);
    })(),
    topClubs: (() => {
      const clubCounts = new Map<string, number>();
      for (const m of clubMatches) {
        if (m.homeClub) clubCounts.set(m.homeClub, (clubCounts.get(m.homeClub) ?? 0) + 1);
        if (m.awayClub) clubCounts.set(m.awayClub, (clubCounts.get(m.awayClub) ?? 0) + 1);
      }
      return [...clubCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([club, count]) => ({ club, count }));
    })(),
    topKillers: topKillerIds.map(([playerId, data]) => ({
      player: playerMap.get(playerId),
      count: data.kills,
      dinners: data.dinners,
      matches: data.matches,
    })).filter(s => s.player),
    pubgTotals: {
      kills: pubgTotalKills,
      dinners: pubgTotalDinners,
      matches: pubgTotalMatches,
      avgPlacement: pubgAvgPlacement,
    },
    totals: {
      matches: totalStats[0],
      goals: totalStats[1],
      assists: totalStats[2],
      yellowCards: totalStats[3],
      redCards: totalStats[4],
      motm: totalStats[5],
      frameWins: topFrameWinners.reduce((s, e) => s + e._count.type, 0),
    },
  };
}

// Stats for a specific tournament
export async function getTournamentStats(tournamentId: string) {
  const [
    topScorers,
    topAssists,
    mostMOTM,
    matches,
    tournament,
  ] = await Promise.all([
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { 
        type: "GOAL", 
        playerId: { not: null },
        match: { tournamentId },
      },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { 
        type: "ASSIST", 
        playerId: { not: null },
        match: { tournamentId },
      },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { 
        type: "MOTM", 
        playerId: { not: null },
        match: { tournamentId },
      },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    prisma.match.findMany({
      where: { tournamentId, status: "COMPLETED" },
      select: {
        id: true,
        homePlayerId: true,
        awayPlayerId: true,
        homeScore: true,
        awayScore: true,
      },
    }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true, gameCategory: true, status: true },
    }),
  ]);

  // Calculate matches played per player in this tournament
  const matchCounts = new Map<string, number>();
  for (const match of matches) {
    if (match.homePlayerId) {
      matchCounts.set(match.homePlayerId, (matchCounts.get(match.homePlayerId) || 0) + 1);
    }
    if (match.awayPlayerId) {
      matchCounts.set(match.awayPlayerId, (matchCounts.get(match.awayPlayerId) || 0) + 1);
    }
  }

  // Get player details
  const playerIds = [...new Set([
    ...topScorers.map(s => s.playerId!),
    ...topAssists.map(s => s.playerId!),
    ...mostMOTM.map(s => s.playerId!),
    ...matchCounts.keys(),
  ])];

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, name: true, slug: true },
  });

  const playerMap = new Map(players.map(p => [p.id, p]));

  // Get tournament points from standings (overall standings, not group-specific)
  const standings = await prisma.standing.findMany({
    where: { 
      tournamentId,
      playerId: { in: playerIds },
      groupId: null, // Overall standings only
    },
    select: { playerId: true, points: true },
  });

  const standingPoints = new Map(standings.map(s => [s.playerId!, s.points]));

  // Build comprehensive player stats
  const playerStats = new Map();
  
  for (const player of players) {
    playerStats.set(player.id, {
      player,
      matches: matchCounts.get(player.id) || 0,
      goals: 0,
      assists: 0,
      motm: 0,
      points: standingPoints.get(player.id) || 0,
    });
  }

  for (const s of topScorers) {
    const stat = playerStats.get(s.playerId!);
    if (stat) stat.goals = s._count.type;
  }
  for (const s of topAssists) {
    const stat = playerStats.get(s.playerId!);
    if (stat) stat.assists = s._count.type;
  }
  for (const s of mostMOTM) {
    const stat = playerStats.get(s.playerId!);
    if (stat) stat.motm = s._count.type;
  }

  return {
    tournament,
    topScorers: topScorers.map(s => ({
      player: playerMap.get(s.playerId!),
      count: s._count.type,
    })).filter(s => s.player),
    topAssists: topAssists.map(s => ({
      player: playerMap.get(s.playerId!),
      count: s._count.type,
    })).filter(s => s.player),
    mostMOTM: mostMOTM.map(s => ({
      player: playerMap.get(s.playerId!),
      count: s._count.type,
    })).filter(s => s.player),
    allStats: Array.from(playerStats.values())
      .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists)),
    totals: {
      matches: matches.length,
      goals: matches.reduce((sum, m) => sum + (m.homeScore || 0) + (m.awayScore || 0), 0),
    },
  };
}

// Get player detailed stats breakdown
export async function getPlayerTournamentBreakdown(playerId: string) {
  const events = await prisma.matchEvent.findMany({
    where: { playerId },
    include: {
      match: {
        select: {
          tournamentId: true,
          tournament: { select: { name: true, gameCategory: true } },
        },
      },
    },
  });

  const tournamentMap = new Map();
  
  for (const event of events) {
    const tId = event.match.tournamentId;
    if (!tournamentMap.has(tId)) {
      tournamentMap.set(tId, {
        tournament: event.match.tournament,
        goals: 0,
        assists: 0,
        motm: 0,
        yellowCards: 0,
        redCards: 0,
      });
    }
    const stats = tournamentMap.get(tId);
    if (event.type === "GOAL") stats.goals++;
    if (event.type === "ASSIST") stats.assists++;
    if (event.type === "MOTM") stats.motm++;
    if (event.type === "YELLOW_CARD") stats.yellowCards++;
    if (event.type === "RED_CARD") stats.redCards++;
  }

  return Array.from(tournamentMap.values());
}
