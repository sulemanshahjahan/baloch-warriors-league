/**
 * Phase 2 backfill: mirror each tournament's group assignment into
 * StageParticipant for its single implicit stage.
 *   npx tsx scripts/backfill-stage-participants-phase2.ts
 * Idempotent (upsert).
 */
import { prisma } from "../src/lib/db";
import { backfillStageParticipants } from "../src/lib/stages";

async function main() {
  const count = await backfillStageParticipants();
  const total = await prisma.stageParticipant.count();
  console.log(`Upserted stage participants: ${count}. Total rows: ${total}.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
