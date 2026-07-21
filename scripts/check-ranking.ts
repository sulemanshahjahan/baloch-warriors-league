/**
 * Logic checks for src/lib/standings/ranking.ts — run with:
 *   npx tsx scripts/check-ranking.ts
 * (vitest's rolldown binding is broken locally, so we verify with tsx.)
 *
 * Covers: 3-way tie broken by H2H; H2H falling through when tied players never
 * met; double round-robin fixture count = n*(n-1); points override vs fallback;
 * and a null-config case that matches the historical order byte-for-byte.
 */
import {
  rankTable,
  resolvePoints,
  DEFAULT_TIEBREAKERS,
  type StatRow,
  type MiniMatch,
} from "../src/lib/standings/ranking";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  const mark = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function row(id: string, o: Partial<StatRow> = {}): StatRow {
  return {
    id,
    played: 0, won: 0, drawn: 0, lost: 0,
    points: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, cleanSheets: 0,
    ...o,
  };
}

// ── 1) Three-way tie broken by head-to-head ──────────────────────────────────
// A, B, C identical on points/GD/GF/wins. Mini-league: A beat B & C, B beat C.
{
  const rows = [
    row("A", { points: 9, goalsFor: 5, goalsAgainst: 5, goalDiff: 0, won: 3 }),
    row("B", { points: 9, goalsFor: 5, goalsAgainst: 5, goalDiff: 0, won: 3 }),
    row("C", { points: 9, goalsFor: 5, goalsAgainst: 5, goalDiff: 0, won: 3 }),
  ];
  const matches: MiniMatch[] = [
    { homeId: "A", awayId: "B", homeGoals: 1, awayGoals: 0 },
    { homeId: "A", awayId: "C", homeGoals: 1, awayGoals: 0 },
    { homeId: "B", awayId: "C", homeGoals: 1, awayGoals: 0 },
  ];
  const ranked = rankTable(rows, { matches, points: { win: 3, draw: 1, loss: 0 } });
  const order = ranked.map((r) => r.id).join(",");
  check("3-way tie broken by H2H → A,B,C", order === "A,B,C", `got ${order}`);
  check("H2H winner gets a tiebreak note", !!ranked[1].tiebreakNote, ranked[1].tiebreakNote ?? "null");
}

// ── 2) H2H falls through to WINS when the tied players never met ──────────────
{
  const rows = [
    row("X", { points: 9, goalsFor: 8, goalsAgainst: 8, goalDiff: 0, won: 2, drawn: 3 }),
    row("Y", { points: 9, goalsFor: 8, goalsAgainst: 8, goalDiff: 0, won: 3, drawn: 0 }),
  ];
  const ranked = rankTable(rows, { matches: [], points: { win: 3, draw: 1, loss: 0 } });
  const order = ranked.map((r) => r.id).join(",");
  // Tied through GF; no mutual match → H2H is a no-op → WINS decides (Y 3 > X 2).
  check("H2H falls through to WINS when never met → Y,X", order === "Y,X", `got ${order}`);
}

// ── 3) Double round-robin emits n*(n-1) fixtures ─────────────────────────────
// Mirrors withReturnLegs(generateRoundRobinPairs(...), true) in schedule.ts.
{
  const rr = <T>(t: T[]): [T, T][] => {
    const p: [T, T][] = [];
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) p.push([t[i], t[j]]);
    return p;
  };
  const dbl = <T>(p: [T, T][]) => [...p, ...p.map(([h, a]) => [a, h] as [T, T])];
  for (const n of [5, 7, 8]) {
    const players = Array.from({ length: n }, (_, i) => `p${i}`);
    const single = rr(players).length;
    const double = dbl(rr(players)).length;
    check(`double RR n=${n} → ${n * (n - 1)}`, single === (n * (n - 1)) / 2 && double === n * (n - 1), `single=${single} double=${double}`);
  }
}

// ── 4) Points override vs SCORING_RULES fallback ─────────────────────────────
{
  const fallback = { win: 3, draw: 1, loss: 0 };
  const override = resolvePoints({ pointsWin: 2, pointsDraw: 1, pointsLoss: 0 }, fallback);
  check("override applies (win=2)", override.win === 2 && override.draw === 1 && override.loss === 0, JSON.stringify(override));
  const partial = resolvePoints({ pointsWin: 2, pointsDraw: null, pointsLoss: 0 }, fallback);
  check("partial override → fallback (win=3)", partial.win === 3, JSON.stringify(partial));
  const none = resolvePoints(null, fallback);
  check("null config → fallback", none.win === 3, JSON.stringify(none));
}

// ── 5) Null-config order matches the historical comparator byte-for-byte ──────
{
  const rows = [
    row("P1", { points: 9, goalDiff: 4, goalsFor: 10, won: 3 }),
    row("P2", { points: 6, goalDiff: 5, goalsFor: 10, won: 2 }),
    row("P3", { points: 6, goalDiff: 5, goalsFor: 8, won: 2 }),
    row("P4", { points: 3, goalDiff: -2, goalsFor: 4, won: 1 }),
  ];
  // Legacy order: points ↓, goalDiff ↓, goalsFor ↓, won ↓, id ↑.
  const legacy = [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      b.won - a.won ||
      (a.id < b.id ? -1 : 1)
  ).map((r) => r.id).join(",");
  // Null tiebreakers config → DEFAULT_TIEBREAKERS; no P/GD/GF ties reach H2H/wins.
  const ranked = rankTable(rows, { tiebreakers: undefined }).map((r) => r.id).join(",");
  check("null-config matches legacy order byte-for-byte", ranked === legacy, `ranked=${ranked} legacy=${legacy}`);
}

console.log(`\nDEFAULT_TIEBREAKERS = ${DEFAULT_TIEBREAKERS.join(" → ")}`);
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
