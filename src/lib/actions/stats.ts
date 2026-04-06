"use server";

import { prisma } from "@/lib/db";

// Overall stats across all tournaments
export async function getOverallStats() {
  const [
    topScorers,
    topAssists,
    mostMOTM,
    mostMatches,
    totalStats,
  ] = await Promise.all([
    // Top scorers overall
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "GOAL", playerId: { not: null } },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    // Top assists overall
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "ASSIST", playerId: { not: null } },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    // Most MOTM
    prisma.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "MOTM", playerId: { not: null } },
      _count: { type: true },
      orderBy: { _count: { type: "desc" } },
      take: 20,
    }),
    // Most matches played (from individual matches + events)
    prisma.match.groupBy({
      by: ["homePlayerId"],
      where: { status: "COMPLETED", homePlayerId: { not: null } },
      _count: { homePlayerId: true },
      orderBy: { _count: { homePlayerId: "desc" } },
      take: 10,
    }),
    // Total counts
    Promise.all([
      prisma.match.count({ where: { status: "COMPLETED" } }),
      prisma.matchEvent.count({ where: { type: "GOAL" } }),
      prisma.matchEvent.count({ where: { type: "ASSIST" } }),
      prisma.matchEvent.count({ where: { type: "YELLOW_CARD" } }),
      prisma.matchEvent.count({ where: { type: "RED_CARD" } }),
      prisma.matchEvent.count({ where: { type: "MOTM" } }),
    ]),
  ]);

  // Get player details for top scorers
  const playerIds = [...new Set([
    ...topScorers.map(s => s.playerId!),
    ...topAssists.map(s => s.playerId!),
    ...mostMOTM.map(s => s.playerId!),
    ...mostMatches.map(s => s.homePlayerId!),
  ])];

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, name: true, slug: true, photoUrl: true },
  });

  const playerMap = new Map(players.map(p => [p.id, p]));

  return {
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
    totals: {
      matches: totalStats[0],
      goals: totalStats[1],
      assists: totalStats[2],
      yellowCards: totalStats[3],
      redCards: totalStats[4],
      motm: totalStats[5],
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
    select: { id: true, name: true, slug: true, photoUrl: true },
  });

  const playerMap = new Map(players.map(p => [p.id, p]));

  // Build comprehensive player stats
  const playerStats = new Map();
  
  for (const player of players) {
    playerStats.set(player.id, {
      player,
      matches: matchCounts.get(player.id) || 0,
      goals: 0,
      assists: 0,
      motm: 0,
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
