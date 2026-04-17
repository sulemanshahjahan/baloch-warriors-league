/**
 * Streak calculations from a player's completed matches.
 * Works per-leg for 2-legged matches to keep consistent with stats counting.
 */

export interface StreakMatch {
  matchId: string;
  completedAt: Date;
  result: "WIN" | "LOSS" | "DRAW";
  goalsFor: number;
  goalsAgainst: number;
}

export interface PlayerStreaks {
  currentWinStreak: number;
  currentUnbeatenStreak: number;
  currentLossStreak: number;
  currentScoringStreak: number;
  longestWinStreak: number;
  longestUnbeatenStreak: number;
  longestScoringStreak: number;
  longestCleanSheetStreak: number;
  isHot: boolean; // 3+ wins in a row
  isCold: boolean; // 3+ losses in a row
  form: string; // last 5 as "WWLDW" (newest first)
}

/**
 * legs: per-leg records for a player, sorted from OLDEST to NEWEST.
 */
export function computeStreaks(legs: StreakMatch[]): PlayerStreaks {
  let curWin = 0,
    curUnbeaten = 0,
    curLoss = 0,
    curScoring = 0;
  let longestWin = 0,
    longestUnbeaten = 0,
    longestScoring = 0,
    longestCleanSheet = 0;
  let runWin = 0,
    runUnbeaten = 0,
    runScoring = 0,
    runCleanSheet = 0;

  for (const l of legs) {
    if (l.result === "WIN") {
      runWin++;
      runUnbeaten++;
    } else if (l.result === "DRAW") {
      runWin = 0;
      runUnbeaten++;
    } else {
      runWin = 0;
      runUnbeaten = 0;
    }
    if (l.goalsFor > 0) runScoring++;
    else runScoring = 0;
    if (l.goalsAgainst === 0) runCleanSheet++;
    else runCleanSheet = 0;

    longestWin = Math.max(longestWin, runWin);
    longestUnbeaten = Math.max(longestUnbeaten, runUnbeaten);
    longestScoring = Math.max(longestScoring, runScoring);
    longestCleanSheet = Math.max(longestCleanSheet, runCleanSheet);
  }

  curWin = runWin;
  curUnbeaten = runUnbeaten;
  curScoring = runScoring;

  // Current loss streak from the end
  for (let i = legs.length - 1; i >= 0; i--) {
    if (legs[i].result === "LOSS") curLoss++;
    else break;
  }

  const recent = legs.slice(-5).reverse();
  const form = recent
    .map((l) => (l.result === "WIN" ? "W" : l.result === "DRAW" ? "D" : "L"))
    .join("");

  return {
    currentWinStreak: curWin,
    currentUnbeatenStreak: curUnbeaten,
    currentLossStreak: curLoss,
    currentScoringStreak: curScoring,
    longestWinStreak: longestWin,
    longestUnbeatenStreak: longestUnbeaten,
    longestScoringStreak: longestScoring,
    longestCleanSheetStreak: longestCleanSheet,
    isHot: curWin >= 3,
    isCold: curLoss >= 3,
    form,
  };
}

/**
 * Convert a completed match (with all legs) into per-leg StreakMatch entries
 * for a specific player.
 */
export function matchToLegs(
  match: {
    id: string;
    completedAt: Date | null;
    homePlayerId: string | null;
    awayPlayerId: string | null;
    homeScore: number | null;
    awayScore: number | null;
    leg2HomeScore: number | null;
    leg2AwayScore: number | null;
    leg3HomeScore: number | null;
    leg3AwayScore: number | null;
  },
  playerId: string
): StreakMatch[] {
  if (!match.completedAt) return [];
  const isHome = match.homePlayerId === playerId;
  if (!isHome && match.awayPlayerId !== playerId) return [];

  const legs: Array<{ gf: number | null; ga: number | null }> = [
    { gf: isHome ? match.homeScore : match.awayScore, ga: isHome ? match.awayScore : match.homeScore },
    { gf: isHome ? match.leg2HomeScore : match.leg2AwayScore, ga: isHome ? match.leg2AwayScore : match.leg2HomeScore },
    { gf: isHome ? match.leg3HomeScore : match.leg3AwayScore, ga: isHome ? match.leg3AwayScore : match.leg3HomeScore },
  ];

  const out: StreakMatch[] = [];
  for (const leg of legs) {
    if (leg.gf == null || leg.ga == null) continue;
    let result: "WIN" | "LOSS" | "DRAW";
    if (leg.gf > leg.ga) result = "WIN";
    else if (leg.gf < leg.ga) result = "LOSS";
    else result = "DRAW";
    out.push({
      matchId: match.id,
      completedAt: match.completedAt,
      result,
      goalsFor: leg.gf,
      goalsAgainst: leg.ga,
    });
  }
  return out;
}
