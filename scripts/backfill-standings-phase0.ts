/**
 * Phase 0 backfill: recompute every tournament's standings so the new `rank` /
 * `tiebreakNote` columns are populated. Also proves the change is order-preserving
 * by diffing the LEGACY order (points→gd→gf→won→id) against the NEW rank order for
 * a representative tournament.
 *
 *   npx tsx scripts/backfill-standings-phase0.ts
 */
import { prisma } from "../src/lib/db";
import { recomputeStandings } from "../src/lib/actions/match";

const LEGACY_ORDER = [
  { points: "desc" as const },
  { goalDiff: "desc" as const },
  { goalsFor: "desc" as const },
  { won: "desc" as const },
  { id: "asc" as const },
];

const NAME_INCLUDE = {
  team: { select: { name: true } },
  player: { select: { name: true } },
  group: { select: { name: true } },
};

function label(s: { team?: { name: string } | null; player?: { name: string } | null; group?: { name: string } | null }) {
  const who = s.team?.name ?? s.player?.name ?? "(unknown)";
  return s.group ? `${s.group.name}: ${who}` : who;
}

async function orderSnapshot(tournamentId: string, byLegacy: boolean) {
  return prisma.standing.findMany({
    where: { tournamentId },
    orderBy: byLegacy ? LEGACY_ORDER : [{ groupId: "asc" }, { rank: "asc" }, { id: "asc" }],
    include: NAME_INCLUDE,
  });
}

async function main() {
  const tournaments = await prisma.tournament.findMany({
    where: { standings: { some: {} } },
    select: { id: true, name: true, _count: { select: { standings: true } } },
  });

  if (tournaments.length === 0) {
    console.log("No tournaments with standings found.");
    return;
  }

  // Representative sample = the tournament with the most standing rows.
  const sample = [...tournaments].sort((a, b) => b._count.standings - a._count.standings)[0];

  // BEFORE — legacy order, grouped so per-group tables compare cleanly.
  const beforeRows = await orderSnapshot(sample.id, true);
  const before = new Map<string, string[]>(); // groupKey -> ordered names
  for (const s of beforeRows) {
    const key = s.groupId ?? "__overall__";
    (before.get(key) ?? before.set(key, []).get(key)!).push(label(s));
  }

  console.log(`Backfilling ${tournaments.length} tournament(s)…`);
  for (const t of tournaments) {
    await recomputeStandings(t.id);
  }
  console.log("Backfill complete.\n");

  // AFTER — new rank order.
  const afterRows = await orderSnapshot(sample.id, false);
  const after = new Map<string, string[]>();
  for (const s of afterRows) {
    const key = s.groupId ?? "__overall__";
    (after.get(key) ?? after.set(key, []).get(key)!).push(label(s));
  }

  console.log(`Sample tournament: "${sample.name}" (${sample._count.standings} rows)\n`);
  let identical = true;
  const keys = new Set([...before.keys(), ...after.keys()]);
  for (const key of keys) {
    const b = before.get(key) ?? [];
    const a = after.get(key) ?? [];
    const same = b.length === a.length && b.every((n, i) => n === a[i]);
    if (!same) identical = false;
    console.log(`— ${key === "__overall__" ? "Overall table" : "Group " + key} — ${same ? "IDENTICAL" : "DIFFERS"}`);
    const rows = Math.max(b.length, a.length);
    for (let i = 0; i < rows; i++) {
      const bn = b[i] ?? "—";
      const an = a[i] ?? "—";
      const flag = bn === an ? "  " : ">>";
      console.log(`   ${flag} ${String(i + 1).padStart(2)}. ${bn.padEnd(28)} | ${an}`);
    }
    console.log("");
  }

  console.log(identical ? "RESULT: order is IDENTICAL before vs after." : "RESULT: order DIFFERS — inspect rows marked >>.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
