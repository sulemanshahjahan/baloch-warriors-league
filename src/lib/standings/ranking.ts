// ─────────────────────────────────────────────────────────────
// STANDINGS RANKING — the single source of truth for table order.
//
// Ranking is computed ONCE, here, inside recomputeStandings (which already has
// every match loaded — the one place head-to-head data is free), and the result
// (`rank` + `tiebreakNote`) is persisted on each Standing row. Every read site
// then orders by the stored `rank` and carries no tiebreaker knowledge at all.
// There is deliberately NO second place that encodes standings order.
// ─────────────────────────────────────────────────────────────

export type TiebreakKey =
  | "POINTS"
  | "GOAL_DIFF"
  | "GOALS_FOR"
  | "GOALS_AGAINST" // fewer is better
  | "HEAD_TO_HEAD"
  | "WINS"
  | "CLEAN_SHEETS";

/**
 * FIFA-style default order. POINTS is the primary key; everything after it only
 * breaks a points tie. When a tournament has no stored `tiebreakers`, this order
 * is used — and it reproduces the historical order (POINTS → GOAL_DIFF →
 * GOALS_FOR → …) for the common case, adding HEAD_TO_HEAD before WINS.
 */
export const DEFAULT_TIEBREAKERS: TiebreakKey[] = [
  "POINTS",
  "GOAL_DIFF",
  "GOALS_FOR",
  "HEAD_TO_HEAD",
  "WINS",
];

/** Keys that separate rows so obviously we don't clutter the table with a note. */
const NO_NOTE_KEYS: ReadonlySet<TiebreakKey> = new Set<TiebreakKey>(["POINTS", "GOAL_DIFF"]);

const KEY_LABEL: Record<TiebreakKey, string> = {
  POINTS: "points",
  GOAL_DIFF: "goal difference",
  GOALS_FOR: "goals scored",
  GOALS_AGAINST: "goals conceded",
  HEAD_TO_HEAD: "head-to-head",
  WINS: "wins",
  CLEAN_SHEETS: "clean sheets",
};

export interface PointsRules {
  win: number;
  draw: number;
  loss: number;
}

/**
 * Per-tournament points override → rules, falling back to the game default when
 * any of the three overrides is null. PUBG/Snooker/Checkers pass their own
 * fallback and never set overrides, so their scoring is untouched.
 */
export function resolvePoints(
  cfg: { pointsWin?: number | null; pointsDraw?: number | null; pointsLoss?: number | null } | null | undefined,
  fallback: PointsRules
): PointsRules {
  if (cfg && cfg.pointsWin != null && cfg.pointsDraw != null && cfg.pointsLoss != null) {
    return { win: cfg.pointsWin, draw: cfg.pointsDraw, loss: cfg.pointsLoss };
  }
  return fallback;
}

/** One participant's accumulated table stats. `id` is the participant id (player or team). */
export interface StatRow {
  id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  cleanSheets: number;
}

/** A completed fixture between two participants (scores already aggregated across legs). */
export interface MiniMatch {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
}

export interface RankOptions {
  /** Ordered tiebreaker keys (POINTS first). Defaults to DEFAULT_TIEBREAKERS. */
  tiebreakers?: TiebreakKey[];
  /** Completed matches among the ranked participants — required for HEAD_TO_HEAD. */
  matches?: MiniMatch[];
  /** Points rules used to score the head-to-head mini-table. */
  points?: PointsRules;
  /** Resolve a participant id to a display name for the tiebreak note. */
  nameOf?: (id: string) => string;
}

export interface RankedRow extends StatRow {
  rank: number; // 1-based within this table
  tiebreakNote: string | null;
}

// ── head-to-head helpers ─────────────────────────────────────

/** Mini-table points/GD/GF for each id, using ONLY matches among the given ids. */
function h2hMiniTable(
  ids: string[],
  matches: MiniMatch[],
  points: PointsRules
): Map<string, { pts: number; gd: number; gf: number }> {
  const set = new Set(ids);
  const table = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const id of ids) table.set(id, { pts: 0, gd: 0, gf: 0 });
  for (const m of matches) {
    if (!set.has(m.homeId) || !set.has(m.awayId)) continue;
    const h = table.get(m.homeId)!;
    const a = table.get(m.awayId)!;
    h.gf += m.homeGoals;
    a.gf += m.awayGoals;
    h.gd += m.homeGoals - m.awayGoals;
    a.gd += m.awayGoals - m.homeGoals;
    if (m.homeGoals > m.awayGoals) { h.pts += points.win; a.pts += points.loss; }
    else if (m.homeGoals < m.awayGoals) { a.pts += points.win; h.pts += points.loss; }
    else { h.pts += points.draw; a.pts += points.draw; }
  }
  return table;
}

/** Compare two rows on a single key. Returns >0 if `a` ranks ABOVE `b`. */
function compareKey(
  a: StatRow,
  b: StatRow,
  key: TiebreakKey,
  ctx: { rows: StatRow[]; matches: MiniMatch[]; points: PointsRules }
): number {
  switch (key) {
    case "POINTS": return a.points - b.points;
    case "GOAL_DIFF": return a.goalDiff - b.goalDiff;
    case "GOALS_FOR": return a.goalsFor - b.goalsFor;
    case "GOALS_AGAINST": return b.goalsAgainst - a.goalsAgainst; // fewer conceded is better
    case "WINS": return a.won - b.won;
    case "CLEAN_SHEETS": return a.cleanSheets - b.cleanSheets;
    case "HEAD_TO_HEAD": {
      // H2H is only meaningful within the currently-tied subset (ctx.rows).
      const mini = h2hMiniTable(ctx.rows.map((r) => r.id), ctx.matches, ctx.points);
      const ax = mini.get(a.id)!;
      const bx = mini.get(b.id)!;
      if (ax.pts !== bx.pts) return ax.pts - bx.pts;
      if (ax.gd !== bx.gd) return ax.gd - bx.gd;
      return ax.gf - bx.gf;
    }
  }
}

// ── segmented ranking ────────────────────────────────────────

/**
 * Order `rows` by the key list. Ties on a key are recursively broken by the
 * remaining keys. HEAD_TO_HEAD is evaluated within the tied subset only, so a
 * group of players that never met each other falls straight through to the next
 * key — exactly the FIFA mini-league semantics.
 */
function orderByKeys(
  rows: StatRow[],
  keys: TiebreakKey[],
  matches: MiniMatch[],
  points: PointsRules
): StatRow[] {
  if (rows.length <= 1) return rows;
  if (keys.length === 0) {
    // Deterministic, recompute-stable final fallback: participant id.
    return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  const [key, ...rest] = keys;
  // Group rows by equal value on `key`, ordered best-first.
  const sorted = [...rows].sort((a, b) => compareKey(b, a, key, { rows, matches, points }));
  const out: StatRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (
      j < sorted.length &&
      compareKey(sorted[i], sorted[j], key, { rows, matches, points }) === 0
    ) {
      j++;
    }
    const tied = sorted.slice(i, j);
    out.push(...(tied.length === 1 ? tied : orderByKeys(tied, rest, matches, points)));
    i = j;
  }
  return out;
}

/** Explain why `above` is ranked directly above `row` (both tied on points). */
function explainAdjacent(
  above: StatRow,
  row: StatRow,
  keys: TiebreakKey[],
  matches: MiniMatch[],
  points: PointsRules,
  nameOf?: (id: string) => string
): string | null {
  if (above.points !== row.points) return null; // clear points gap — obvious
  // Points are already equal (guard above); the note explains what broke that tie.
  const equalBefore: TiebreakKey[] = ["POINTS"];
  for (const key of keys) {
    // For every key (incl. H2H) an adjacent pair is compared using just the two
    // participants and their mutual result.
    const d = compareKey(above, row, key, { rows: [above, row], matches, points });
    if (d === 0) { equalBefore.push(key); continue; }
    if (NO_NOTE_KEYS.has(key)) return null; // separated by an obvious key — no note
    const name = nameOf ? nameOf(above.id) : "The row above";
    const preamble = `Level on ${joinLabels(equalBefore)} — `;
    if (key === "HEAD_TO_HEAD") {
      return `${preamble}${name} ranked higher on the head-to-head.`;
    }
    const av = statValue(above, key);
    const bv = statValue(row, key);
    return `${preamble}${name} ranked higher on ${KEY_LABEL[key]} (${av} vs ${bv}).`;
  }
  return null; // fully level — separated only by the stable fallback
}

function statValue(r: StatRow, key: TiebreakKey): number {
  switch (key) {
    case "POINTS": return r.points;
    case "GOAL_DIFF": return r.goalDiff;
    case "GOALS_FOR": return r.goalsFor;
    case "GOALS_AGAINST": return r.goalsAgainst;
    case "WINS": return r.won;
    case "CLEAN_SHEETS": return r.cleanSheets;
    case "HEAD_TO_HEAD": return 0;
  }
}

function joinLabels(keys: TiebreakKey[]): string {
  const labels = keys.map((k) => KEY_LABEL[k]);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

/**
 * Rank a single table. Returns the rows in finished order, each stamped with a
 * 1-based `rank` and a `tiebreakNote` (non-null only for the non-obvious ties).
 */
export function rankTable(rows: StatRow[], opts: RankOptions = {}): RankedRow[] {
  const tiebreakers = opts.tiebreakers && opts.tiebreakers.length ? opts.tiebreakers : DEFAULT_TIEBREAKERS;
  const matches = opts.matches ?? [];
  const points = opts.points ?? { win: 3, draw: 1, loss: 0 };
  const keys: TiebreakKey[] = tiebreakers.includes("POINTS") ? tiebreakers : ["POINTS", ...tiebreakers];

  const ordered = orderByKeys(rows, keys, matches, points);
  const noteKeys = keys.filter((k) => k !== "POINTS"); // notes only explain points ties

  return ordered.map((row, i) => {
    const above = i > 0 ? ordered[i - 1] : null;
    const tiebreakNote = above
      ? explainAdjacent(above, row, noteKeys, matches, points, opts.nameOf)
      : null;
    return { ...row, rank: i + 1, tiebreakNote };
  });
}
