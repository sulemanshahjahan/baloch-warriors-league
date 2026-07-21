/**
 * Phase 1 migration: wrap every existing tournament in one implicit stage and
 * stamp its groups / matches / standings with that stageId.
 *
 *   npx tsx scripts/backfill-stages-phase1.ts
 *
 * Idempotent — safe to re-run. Exits non-zero if any null stageId remains.
 */
import { prisma } from "../src/lib/db";
import { backfillAllStages } from "../src/lib/stages";

async function main() {
  const stamped = await backfillAllStages();
  console.log("Stamped:", stamped);

  const [nullGroups, nullMatches, nullStandings, stageCount] = await Promise.all([
    prisma.tournamentGroup.count({ where: { stageId: null } }),
    prisma.match.count({ where: { stageId: null } }),
    prisma.standing.count({ where: { stageId: null } }),
    prisma.tournamentStage.count(),
  ]);

  console.log(`Stages: ${stageCount}`);
  console.log(`Remaining null stageIds — groups: ${nullGroups}, matches: ${nullMatches}, standings: ${nullStandings}`);

  const clean = nullGroups + nullMatches + nullStandings === 0;
  console.log(clean ? "\nOK: zero null stageIds." : "\nFAIL: null stageIds remain.");
  process.exit(clean ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
