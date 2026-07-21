/**
 * Phase 1 gate: prove the stage-scoped recompute refactor is a functional no-op
 * on existing (single-stage) tournaments.
 *
 *   npx tsx scripts/verify-phase1-noop.ts
 *
 * Steps: snapshot current standings → backfill stages → recompute every
 * tournament with the new stage-scoped code → snapshot again → assert every
 * table's rows, order, and stats are identical, and no null stageIds remain.
 */
import { prisma } from "../src/lib/db";
import { backfillAllStages } from "../src/lib/stages";
import { recomputeStandings } from "../src/lib/actions/match";

type Snap = { key: string; rows: string[] };

async function snapshot(): Promise<Map<string, Snap>> {
  const standings = await prisma.standing.findMany({
    orderBy: [{ tournamentId: "asc" }, { groupId: "asc" }, { rank: "asc" }, { id: "asc" }],
    include: { team: { select: { name: true } }, player: { select: { name: true } } },
  });
  const map = new Map<string, Snap>();
  for (const s of standings) {
    const key = `${s.tournamentId}|${s.groupId ?? "overall"}`;
    const who = s.team?.name ?? s.player?.name ?? s.teamId ?? s.playerId ?? "?";
    // Row fingerprint: identity + all table stats + the note.
    const line = `${who} P${s.played} W${s.won} D${s.drawn} L${s.lost} GF${s.goalsFor} GA${s.goalsAgainst} GD${s.goalDiff} Pts${s.points} note=${s.tiebreakNote ?? ""}`;
    if (!map.has(key)) map.set(key, { key, rows: [] });
    map.get(key)!.rows.push(line);
  }
  return map;
}

function diff(before: Map<string, Snap>, after: Map<string, Snap>) {
  let mismatches = 0;
  const keys = new Set([...before.keys(), ...after.keys()]);
  for (const key of keys) {
    const b = before.get(key)?.rows ?? [];
    const a = after.get(key)?.rows ?? [];
    const same = b.length === a.length && b.every((r, i) => r === a[i]);
    if (!same) {
      mismatches++;
      console.log(`DIFFERS: ${key}`);
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (b[i] !== a[i]) console.log(`   before[${i}] ${b[i] ?? "—"}\n   after [${i}] ${a[i] ?? "—"}`);
      }
    }
  }
  return mismatches;
}

async function main() {
  console.log("Snapshotting BEFORE…");
  const before = await snapshot();

  console.log("Backfilling stages…");
  const stamped = await backfillAllStages();
  console.log("  stamped:", stamped);

  console.log("Recomputing every tournament (stage-scoped)…");
  const tournaments = await prisma.tournament.findMany({ select: { id: true } });
  for (const t of tournaments) await recomputeStandings(t.id);

  console.log("Snapshotting AFTER…\n");
  const after = await snapshot();

  const mismatches = diff(before, after);

  const [nullGroups, nullMatches, nullStandings] = await Promise.all([
    prisma.tournamentGroup.count({ where: { stageId: null } }),
    prisma.match.count({ where: { stageId: null } }),
    prisma.standing.count({ where: { stageId: null } }),
  ]);

  console.log(`Tables compared: ${new Set([...before.keys(), ...after.keys()]).size}`);
  console.log(`Standings mismatches: ${mismatches}`);
  console.log(`Null stageIds — groups: ${nullGroups}, matches: ${nullMatches}, standings: ${nullStandings}`);

  const pass = mismatches === 0 && nullGroups + nullMatches + nullStandings === 0;
  console.log(pass ? "\nGATE PASSED: functional no-op + zero null stageIds." : "\nGATE FAILED.");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
