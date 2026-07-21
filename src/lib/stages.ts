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
 * Stage-scoped membership for a given stage: prefers StageParticipant rows;
 * falls back to legacy TournamentPlayer/Team.groupId when a stage has none
 * (keeps old tournaments working before/without the Phase 2 backfill).
 */
export async function getStageMembership(
  tournamentId: string,
  stageId: string | null,
  isIndividual: boolean
): Promise<{ id: string; groupId: string | null }[]> {
  if (stageId) {
    const sp = await prisma.stageParticipant.findMany({
      where: { stageId },
      select: { playerId: true, teamId: true, groupId: true },
    });
    if (sp.length) {
      return sp
        .map((x) => ({ id: (isIndividual ? x.playerId : x.teamId) ?? "", groupId: x.groupId }))
        .filter((x) => x.id);
    }
  }
  if (isIndividual) {
    const players = await prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      select: { playerId: true, groupId: true },
    });
    return players.map((p) => ({ id: p.playerId, groupId: p.groupId }));
  }
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    select: { teamId: true, groupId: true },
  });
  return teams.map((t) => ({ id: t.teamId, groupId: t.groupId }));
}

/**
 * Phase 2 backfill: mirror each tournament's current TournamentPlayer/Team
 * group assignment into StageParticipant for its single implicit stage.
 * Idempotent (upsert). Legacy reads keep working; this just adds the rows the
 * stage-scoped recompute prefers.
 */
export async function backfillStageParticipants(): Promise<number> {
  const tournaments = await prisma.tournament.findMany({ select: { id: true, participantType: true } });
  let count = 0;
  for (const t of tournaments) {
    const stageId = await getOrCreateDefaultStageId(t.id);
    if (t.participantType === "INDIVIDUAL") {
      const players = await prisma.tournamentPlayer.findMany({
        where: { tournamentId: t.id },
        select: { playerId: true, groupId: true },
      });
      for (const p of players) {
        await prisma.stageParticipant.upsert({
          where: { stageId_playerId: { stageId, playerId: p.playerId } },
          update: { groupId: p.groupId },
          create: { tournamentId: t.id, stageId, playerId: p.playerId, groupId: p.groupId },
        });
        count++;
      }
    } else {
      const teams = await prisma.tournamentTeam.findMany({
        where: { tournamentId: t.id },
        select: { teamId: true, groupId: true },
      });
      for (const tm of teams) {
        await prisma.stageParticipant.upsert({
          where: { stageId_teamId: { stageId, teamId: tm.teamId } },
          update: { groupId: tm.groupId },
          create: { tournamentId: t.id, stageId, teamId: tm.teamId, groupId: tm.groupId },
        });
        count++;
      }
    }
  }
  return count;
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
