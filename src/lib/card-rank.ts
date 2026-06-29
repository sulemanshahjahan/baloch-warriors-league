import { prisma } from "./db";

// FIFA-style card rank, [50, 99]. Default 70.
// Players with < MIN_MATCHES are kept at provisional default.
const DEFAULT_RANK = 70;
const MIN_RANK = 50;
const MAX_RANK = 99;
const MIN_MATCHES = 5;

export interface PlayerStatsSnapshot {
  matches: number;        // total leg-decisions (incl. multi-leg matches)
  wins: number;
  draws: number;
  losses: number;
  winRate: number;        // 0..1
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  cleanSheets: number;
  eloRating: number;
}

export interface RankBreakdown {
  base: number;
  eloDelta: number;
  winRateDelta: number;
  cleanSheetDelta: number;
  goalDiffDelta: number;
  rawTotal: number;
  finalRank: number;
  provisional: boolean;
  reason: string;
}

/**
 * Compute a player's card rank from their stats snapshot.
 * Returns both the rank and a human-readable + structured breakdown.
 */
export function computeCardRank(stats: PlayerStatsSnapshot): RankBreakdown {
  const provisional = stats.matches < MIN_MATCHES;

  if (provisional) {
    return {
      base: DEFAULT_RANK,
      eloDelta: 0,
      winRateDelta: 0,
      cleanSheetDelta: 0,
      goalDiffDelta: 0,
      rawTotal: DEFAULT_RANK,
      finalRank: DEFAULT_RANK,
      provisional: true,
      reason: `Provisional rank — needs ≥${MIN_MATCHES} completed matches (currently ${stats.matches}).`,
    };
  }

  const base = DEFAULT_RANK;
  const eloDelta = Math.round((stats.eloRating - 100) / 10);
  const winRateDelta = Math.round((stats.winRate - 0.5) * 16);
  const cleanSheetDelta = Math.min(5, Math.floor(stats.cleanSheets / 3));
  const goalDiffDelta = Math.max(-5, Math.min(5, Math.floor(stats.goalDiff / 10)));

  const rawTotal = base + eloDelta + winRateDelta + cleanSheetDelta + goalDiffDelta;
  const finalRank = Math.max(MIN_RANK, Math.min(MAX_RANK, rawTotal));

  const wrPct = Math.round(stats.winRate * 100);
  const reason =
    `${stats.matches} matches • ${stats.wins}W-${stats.draws}D-${stats.losses}L (${wrPct}% WR) • ELO ${stats.eloRating} • ` +
    `GF ${stats.goalsFor} GA ${stats.goalsAgainst} (GD ${stats.goalDiff >= 0 ? "+" : ""}${stats.goalDiff}) • CS ${stats.cleanSheets}\n` +
    `Base ${base} ` +
    `${eloDelta >= 0 ? "+" : ""}${eloDelta} ELO ` +
    `${winRateDelta >= 0 ? "+" : ""}${winRateDelta} WR ` +
    `${cleanSheetDelta >= 0 ? "+" : ""}${cleanSheetDelta} CS ` +
    `${goalDiffDelta >= 0 ? "+" : ""}${goalDiffDelta} GD ` +
    `= ${rawTotal}${rawTotal !== finalRank ? ` (capped at ${finalRank})` : ""}`;

  return {
    base,
    eloDelta,
    winRateDelta,
    cleanSheetDelta,
    goalDiffDelta,
    rawTotal,
    finalRank,
    provisional: false,
    reason,
  };
}

/**
 * Compute a stats snapshot for one player from their match data.
 * Counts each leg of multi-leg matches separately, matching the ELO model.
 */
export async function buildStatsSnapshot(playerId: string): Promise<PlayerStatsSnapshot> {
  // The player's team ids (incl. 2v2 duos) so duo matches count toward the card.
  const teamRows = await prisma.teamPlayer.findMany({
    where: { playerId, isActive: true },
    select: { teamId: true },
  });
  const teamIds = teamRows.map((t) => t.teamId);
  const teamIdSet = new Set(teamIds);

  const [player, homeMatches, awayMatches, duoMatches] = await Promise.all([
    prisma.player.findUnique({
      where: { id: playerId },
      select: { eloRating: true },
    }),
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        homePlayerId: playerId,
        awayPlayerId: { not: null },
        tournament: { gameCategory: { not: "PUBG" }, participantType: "INDIVIDUAL" },
      },
      select: {
        homeScore: true, awayScore: true,
        leg2HomeScore: true, leg2AwayScore: true,
        leg3HomeScore: true, leg3AwayScore: true,
      },
    }),
    prisma.match.findMany({
      where: {
        status: "COMPLETED",
        awayPlayerId: playerId,
        homePlayerId: { not: null },
        tournament: { gameCategory: { not: "PUBG" }, participantType: "INDIVIDUAL" },
      },
      select: {
        homeScore: true, awayScore: true,
        leg2HomeScore: true, leg2AwayScore: true,
        leg3HomeScore: true, leg3AwayScore: true,
      },
    }),
    // 2v2 duo matches the player took part in (both sides are duos).
    teamIds.length > 0
      ? prisma.match.findMany({
          where: {
            status: "COMPLETED",
            homeTeam: { isDuo: true },
            tournament: { gameCategory: { not: "PUBG" } },
            OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
          },
          select: {
            homeTeamId: true,
            homeScore: true, awayScore: true,
            leg2HomeScore: true, leg2AwayScore: true,
            leg3HomeScore: true, leg3AwayScore: true,
          },
        })
      : Promise.resolve([] as { homeTeamId: string | null; homeScore: number | null; awayScore: number | null; leg2HomeScore: number | null; leg2AwayScore: number | null; leg3HomeScore: number | null; leg3AwayScore: number | null }[]),
  ]);

  let wins = 0, draws = 0, losses = 0;
  let goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;

  // Per-leg accumulators feed into per-leg W/D/L counts and goal totals (matches the ELO model);
  // clean-sheet count is per-fixture (opponent aggregate across all legs == 0).
  const tally = (
    legs: Array<{ playerScore: number; opponentScore: number }>,
    fixtureOppAgg: number,
  ) => {
    for (const l of legs) {
      goalsFor += l.playerScore;
      goalsAgainst += l.opponentScore;
      if (l.playerScore > l.opponentScore) wins++;
      else if (l.playerScore < l.opponentScore) losses++;
      else draws++;
    }
    if (fixtureOppAgg === 0) cleanSheets++;
  };

  for (const m of homeMatches) {
    const legs: Array<{ playerScore: number; opponentScore: number }> = [
      { playerScore: m.homeScore ?? 0, opponentScore: m.awayScore ?? 0 },
    ];
    if (m.leg2HomeScore != null) legs.push({ playerScore: m.leg2HomeScore ?? 0, opponentScore: m.leg2AwayScore ?? 0 });
    if (m.leg3HomeScore != null) legs.push({ playerScore: m.leg3HomeScore ?? 0, opponentScore: m.leg3AwayScore ?? 0 });
    const oppAgg = (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0);
    tally(legs, oppAgg);
  }

  for (const m of awayMatches) {
    const legs: Array<{ playerScore: number; opponentScore: number }> = [
      { playerScore: m.awayScore ?? 0, opponentScore: m.homeScore ?? 0 },
    ];
    if (m.leg2HomeScore != null) legs.push({ playerScore: m.leg2AwayScore ?? 0, opponentScore: m.leg2HomeScore ?? 0 });
    if (m.leg3HomeScore != null) legs.push({ playerScore: m.leg3AwayScore ?? 0, opponentScore: m.leg3HomeScore ?? 0 });
    const oppAgg = (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
    tally(legs, oppAgg);
  }

  // 2v2 duo matches — the duo's scoreline from the player's side.
  for (const m of duoMatches) {
    const isHome = m.homeTeamId != null && teamIdSet.has(m.homeTeamId);
    const ps = (h: number | null, a: number | null) => (isHome ? h ?? 0 : a ?? 0);
    const os = (h: number | null, a: number | null) => (isHome ? a ?? 0 : h ?? 0);
    const legs: Array<{ playerScore: number; opponentScore: number }> = [
      { playerScore: ps(m.homeScore, m.awayScore), opponentScore: os(m.homeScore, m.awayScore) },
    ];
    if (m.leg2HomeScore != null) legs.push({ playerScore: ps(m.leg2HomeScore, m.leg2AwayScore), opponentScore: os(m.leg2HomeScore, m.leg2AwayScore) });
    if (m.leg3HomeScore != null) legs.push({ playerScore: ps(m.leg3HomeScore, m.leg3AwayScore), opponentScore: os(m.leg3HomeScore, m.leg3AwayScore) });
    const oppAgg = isHome
      ? (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) + (m.leg3AwayScore ?? 0)
      : (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) + (m.leg3HomeScore ?? 0);
    tally(legs, oppAgg);
  }

  const matches = wins + draws + losses;
  const winRate = matches > 0 ? wins / matches : 0;
  const goalDiff = goalsFor - goalsAgainst;

  return {
    matches,
    wins,
    draws,
    losses,
    winRate,
    goalsFor,
    goalsAgainst,
    goalDiff,
    cleanSheets,
    eloRating: player?.eloRating ?? 100,
  };
}
