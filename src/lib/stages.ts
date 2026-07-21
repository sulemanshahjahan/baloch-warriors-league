// ─────────────────────────────────────────────────────────────
// TOURNAMENT STAGES (Phase 1)
// Every tournament has exactly one implicit stage in Phase 1. This helper
// returns that stage's id, creating it on demand, so match/group creation can
// always stamp a non-null stageId. Multi-stage tournaments arrive in later
// phases; until then callers never pass an explicit stage.
// ─────────────────────────────────────────────────────────────
import { prisma } from "@/lib/db";
import type { StageKind } from "@prisma/client";

const KIND_BY_FORMAT: Record<string, StageKind> = {
  LEAGUE: "LEAGUE",
  KNOCKOUT: "KNOCKOUT",
  GROUP_KNOCKOUT: "GROUP",
};

const NAME_BY_FORMAT: Record<string, string> = {
  LEAGUE: "League",
  KNOCKOUT: "Knockout",
  GROUP_KNOCKOUT: "Group + Knockout",
};

/** The tournament's single (implicit) stage id, creating it if absent. */
export async function getOrCreateDefaultStageId(tournamentId: string): Promise<string> {
  const existing = await prisma.tournamentStage.findFirst({
    where: { tournamentId },
    orderBy: { orderIndex: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  const fmt = t?.format ?? "LEAGUE";
  const stage = await prisma.tournamentStage.create({
    data: {
      tournamentId,
      name: NAME_BY_FORMAT[fmt] ?? "Stage 1",
      orderIndex: 0,
      kind: KIND_BY_FORMAT[fmt] ?? "LEAGUE",
    },
  });
  return stage.id;
}

/**
 * Phase 1 backfill: ensure every tournament has its single implicit stage and
 * stamp its groups/matches/standings with that stageId. Idempotent — only rows
 * with a null stageId are touched, so it is safe to re-run.
 */
export async function backfillAllStages(): Promise<{ groups: number; matches: number; standings: number }> {
  const tournaments = await prisma.tournament.findMany({ select: { id: true } });
  const stamped = { groups: 0, matches: 0, standings: 0 };
  for (const t of tournaments) {
    const stageId = await getOrCreateDefaultStageId(t.id);
    const [g, m, s] = await Promise.all([
      prisma.tournamentGroup.updateMany({ where: { tournamentId: t.id, stageId: null }, data: { stageId } }),
      prisma.match.updateMany({ where: { tournamentId: t.id, stageId: null }, data: { stageId } }),
      prisma.standing.updateMany({ where: { tournamentId: t.id, stageId: null }, data: { stageId } }),
    ]);
    stamped.groups += g.count;
    stamped.matches += m.count;
    stamped.standings += s.count;
  }
  return stamped;
}
