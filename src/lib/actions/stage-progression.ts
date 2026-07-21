"use server";

// ─────────────────────────────────────────────────────────────
// MULTI-STAGE PROGRESSION (BWL Cup: 4×5 groups → playoff → 2×7 groups → KO)
// Individual (1v1) tournaments only. Each action guards its precondition and is
// idempotent-ish (refuses to run twice). See scripts/simulate-bwl-cup.ts.
// ─────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recomputeStandings } from "@/lib/actions/match";
import type { ActionResult } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };
async function requireAdmin(): Promise<ActionResult | null> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if ((ROLE_LEVELS[getUserRole(session)] ?? 0) < 2) return { success: false, error: "Forbidden: Admin required" };
  return null;
}

async function revalidate(tournamentId: string) {
  // No-op outside a request context (e.g. the simulation script).
  try {
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath("/admin/matches");
    if (t?.slug) revalidatePath(`/tournaments/${t.slug}`);
  } catch {
    /* not in a Next request scope — safe to ignore */
  }
}

// Standard bracket-seed order and snake are hard-coded to the target format.
const SNAKE_X_SEEDS = new Set([1, 4, 5, 8, 9, 12, 13]); // else Group Y

/** Round-robin (single) player fixtures inside one stage-scoped group. */
async function createGroupRoundRobin(
  tournamentId: string,
  stageId: string,
  groupId: string,
  groupName: string,
  playerIds: string[]
) {
  const pairs: [string, string][] = [];
  for (let i = 0; i < playerIds.length; i++)
    for (let j = i + 1; j < playerIds.length; j++) pairs.push([playerIds[i], playerIds[j]]);

  const half = Math.max(1, playerIds.length / 2);
  for (let i = 0; i < pairs.length; i++) {
    const [home, away] = pairs[i];
    const roundNum = Math.floor(i / half) + 1;
    await prisma.match.create({
      data: {
        tournamentId,
        stageId,
        groupId,
        round: `${groupName} - Round ${roundNum}`,
        roundNumber: roundNum,
        matchNumber: i + 1,
        homePlayerId: home,
        awayPlayerId: away,
        status: "SCHEDULED",
        homeToken: randomUUID(),
        awayToken: randomUUID(),
      },
    });
  }
}

// ─── STAGE 1: 4 groups × 5, single round-robin ───────────────

export async function generateStage1GroupsCore(tournamentId: string): Promise<ActionResult<{ groups: number }>> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { participantType: true, players: { select: { playerId: true }, orderBy: { registeredAt: "asc" } } },
  });
  if (!tournament) return { success: false, error: "Tournament not found" };
  if (tournament.participantType !== "INDIVIDUAL") return { success: false, error: "Multi-stage is individual-only" };
  const players = tournament.players.map((p) => p.playerId);
  if (players.length !== 20) return { success: false, error: `Need exactly 20 enrolled players (have ${players.length})` };

  // Stage 1 occupies orderIndex 0.
  let stage1 = await prisma.tournamentStage.findFirst({ where: { tournamentId, orderIndex: 0 } });
  const cfg = { directPerGroup: 3, playoffFromPosition: 4 } as Prisma.InputJsonValue;
  if (stage1) {
    const groupCount = await prisma.tournamentGroup.count({ where: { stageId: stage1.id } });
    if (groupCount > 0) return { success: false, error: "Stage 1 groups already generated" };
    stage1 = await prisma.tournamentStage.update({
      where: { id: stage1.id },
      data: { name: "Stage 1: Groups", kind: "GROUP", config: cfg },
    });
  } else {
    stage1 = await prisma.tournamentStage.create({
      data: { tournamentId, name: "Stage 1: Groups", orderIndex: 0, kind: "GROUP", config: cfg },
    });
  }

  // 4 groups, deterministic round-robin distribution (player i → group i%4).
  const groupNames = ["Group A", "Group B", "Group C", "Group D"];
  const groups = [];
  for (let g = 0; g < 4; g++) {
    groups.push(
      await prisma.tournamentGroup.create({
        data: { tournamentId, stageId: stage1.id, name: groupNames[g], orderIndex: g },
      })
    );
  }
  const membersByGroup: string[][] = [[], [], [], []];
  for (let i = 0; i < players.length; i++) {
    const g = i % 4;
    membersByGroup[g].push(players[i]);
    await prisma.stageParticipant.create({
      data: { tournamentId, stageId: stage1.id, groupId: groups[g].id, playerId: players[i], seed: i },
    });
  }

  for (let g = 0; g < 4; g++) {
    await createGroupRoundRobin(tournamentId, stage1.id, groups[g].id, groupNames[g], membersByGroup[g]);
  }

  await recomputeStandings(tournamentId, { stageId: stage1.id });
  await revalidate(tournamentId);
  return { success: true, data: { groups: 4 } };
}

// ─── Stage-1 qualifier computation (top 3 per group + 4th-placers) ─

type Ranked = { playerId: string; name: string; position: number; points: number; goalDiff: number; goalsFor: number };

async function stage1Tables(stage1Id: string): Promise<{ groupName: string; rows: Ranked[] }[]> {
  const groups = await prisma.tournamentGroup.findMany({
    where: { stageId: stage1Id },
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true },
  });
  const tables = [];
  for (const g of groups) {
    const standings = await prisma.standing.findMany({
      where: { stageId: stage1Id, groupId: g.id },
      orderBy: [{ rank: "asc" }, { id: "asc" }],
      include: { player: { select: { name: true } } },
    });
    tables.push({
      groupName: g.name,
      rows: standings.map((s, i) => ({
        playerId: s.playerId!,
        name: s.player?.name ?? "?",
        position: i + 1,
        points: s.points,
        goalDiff: s.goalDiff,
        goalsFor: s.goalsFor,
      })),
    });
  }
  return tables;
}

// ─── CLOSE STAGE 1 → create Playoff (A4vB4, C4vD4) ────────────

export async function closeStage1Core(tournamentId: string): Promise<ActionResult<{ playoffMatches: number }>> {
  const stage1 = await prisma.tournamentStage.findFirst({ where: { tournamentId, orderIndex: 0, kind: "GROUP" } });
  if (!stage1) return { success: false, error: "Stage 1 not found — generate it first" };

  const pending = await prisma.match.count({ where: { stageId: stage1.id, status: { not: "COMPLETED" } } });
  if (pending > 0) return { success: false, error: `Stage 1 incomplete — ${pending} match(es) left` };

  if (await prisma.tournamentStage.findFirst({ where: { tournamentId, kind: "PLAYOFF" } }))
    return { success: false, error: "Playoff already created" };

  await recomputeStandings(tournamentId, { stageId: stage1.id });
  const tables = await stage1Tables(stage1.id);
  if (tables.length !== 4 || tables.some((t) => t.rows.length < 4))
    return { success: false, error: "Stage 1 must be 4 groups of at least 4 players" };

  // 4th-placers, in group order A,B,C,D.
  const fourths = tables.map((t) => t.rows[3]);
  const pairings = [
    [fourths[0], fourths[1]], // A4 vs B4
    [fourths[2], fourths[3]], // C4 vs D4
  ];

  const playoff = await prisma.tournamentStage.create({
    data: {
      tournamentId,
      name: "Playoff",
      orderIndex: 1,
      kind: "PLAYOFF",
      config: { pairings: pairings.map(([h, a]) => [h.playerId, a.playerId]) } as Prisma.InputJsonValue,
    },
  });

  for (let i = 0; i < pairings.length; i++) {
    const [home, away] = pairings[i];
    await prisma.match.create({
      data: {
        tournamentId,
        stageId: playoff.id,
        round: "Playoff",
        roundNumber: null, // NOT a bracket round — never auto-advanced
        matchNumber: i + 1,
        homePlayerId: home.playerId,
        awayPlayerId: away.playerId,
        status: "SCHEDULED",
        homeToken: randomUUID(),
        awayToken: randomUUID(),
      },
    });
  }

  await revalidate(tournamentId);
  return { success: true, data: { playoffMatches: 2 } };
}

// ─── Snake-seed computation for Stage 2 ──────────────────────

function playoffWinner(m: {
  homeScore: number | null; awayScore: number | null;
  homeScorePens: number | null; awayScorePens: number | null;
  homePlayerId: string | null; awayPlayerId: string | null;
}): string | null {
  if (m.homeScore == null || m.awayScore == null) return null;
  if (m.homeScore > m.awayScore) return m.homePlayerId;
  if (m.awayScore > m.homeScore) return m.awayPlayerId;
  const hp = m.homeScorePens ?? 0, ap = m.awayScorePens ?? 0;
  if (hp > ap) return m.homePlayerId;
  if (ap > hp) return m.awayPlayerId;
  return null;
}

export type Seed = { seed: number; playerId: string; name: string; source: string };

/** The 14 qualifiers as an ordered seed list (1 = strongest). */
export async function computeStage2Seeds(tournamentId: string): Promise<{ ok: true; seeds: Seed[] } | { ok: false; error: string }> {
  const stage1 = await prisma.tournamentStage.findFirst({ where: { tournamentId, orderIndex: 0, kind: "GROUP" } });
  const playoff = await prisma.tournamentStage.findFirst({ where: { tournamentId, kind: "PLAYOFF" } });
  if (!stage1 || !playoff) return { ok: false, error: "Stage 1 + Playoff required" };

  const playoffPending = await prisma.match.count({ where: { stageId: playoff.id, status: { not: "COMPLETED" } } });
  if (playoffPending > 0) return { ok: false, error: `Playoff incomplete — ${playoffPending} match(es) left` };

  const tables = await stage1Tables(stage1.id);
  const byPosition = (pos: number) =>
    tables
      .map((t) => t.rows[pos - 1])
      .filter(Boolean)
      .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);

  const ordered: Ranked[] = [...byPosition(1), ...byPosition(2), ...byPosition(3)]; // 12 direct

  // Playoff winners in match order → seeds 13, 14.
  const playoffMatches = await prisma.match.findMany({
    where: { stageId: playoff.id },
    orderBy: { matchNumber: "asc" },
    select: { homeScore: true, awayScore: true, homeScorePens: true, awayScorePens: true, homePlayerId: true, awayPlayerId: true },
  });
  const winnerIds = playoffMatches.map(playoffWinner);
  if (winnerIds.some((w) => !w)) return { ok: false, error: "Playoff winner undetermined (check penalties)" };
  const winnerPlayers = await prisma.player.findMany({
    where: { id: { in: winnerIds as string[] } },
    select: { id: true, name: true },
  });
  const nameOf = (id: string) => winnerPlayers.find((p) => p.id === id)?.name ?? "?";

  const seeds: Seed[] = ordered.map((r, i) => ({
    seed: i + 1,
    playerId: r.playerId,
    name: r.name,
    source: `Group pos ${r.position}`,
  }));
  winnerIds.forEach((id, i) => {
    seeds.push({ seed: 13 + i, playerId: id as string, name: nameOf(id as string), source: `Playoff ${i + 1} winner` });
  });
  return { ok: true, seeds };
}

// ─── GENERATE STAGE 2 DRAW (snake into Group X / Group Y) ──────

export async function generateStage2DrawCore(tournamentId: string): Promise<ActionResult<{ x: string[]; y: string[] }>> {
  if (await prisma.tournamentStage.findFirst({ where: { tournamentId, orderIndex: 2 } }))
    return { success: false, error: "Stage 2 already generated" };

  const seedResult = await computeStage2Seeds(tournamentId);
  if (!seedResult.ok) return { success: false, error: seedResult.error };
  const seeds = seedResult.seeds;

  const stage2 = await prisma.tournamentStage.create({
    data: {
      tournamentId,
      name: "Stage 2: Groups",
      orderIndex: 2,
      kind: "GROUP",
      config: { advancePerGroup: 4 } as Prisma.InputJsonValue,
    },
  });
  const groupX = await prisma.tournamentGroup.create({ data: { tournamentId, stageId: stage2.id, name: "Group X", orderIndex: 0 } });
  const groupY = await prisma.tournamentGroup.create({ data: { tournamentId, stageId: stage2.id, name: "Group Y", orderIndex: 1 } });

  const xIds: string[] = [], yIds: string[] = [];
  for (const s of seeds) {
    const toX = SNAKE_X_SEEDS.has(s.seed);
    const group = toX ? groupX : groupY;
    (toX ? xIds : yIds).push(s.playerId);
    await prisma.stageParticipant.create({
      data: { tournamentId, stageId: stage2.id, groupId: group.id, playerId: s.playerId, seed: s.seed },
    });
  }

  await createGroupRoundRobin(tournamentId, stage2.id, groupX.id, "Group X", xIds);
  await createGroupRoundRobin(tournamentId, stage2.id, groupY.id, "Group Y", yIds);

  await recomputeStandings(tournamentId, { stageId: stage2.id });
  await revalidate(tournamentId);

  const nameById = new Map((await prisma.player.findMany({ where: { id: { in: seeds.map((s) => s.playerId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  return { success: true, data: { x: xIds.map((id) => nameById.get(id) ?? id), y: yIds.map((id) => nameById.get(id) ?? id) } };
}

// ─── GENERATE KNOCKOUT (QF pairings X1-Y4, X2-Y3, Y1-X4, Y2-X3) ─

export async function generateStage2KnockoutCore(tournamentId: string): Promise<ActionResult<{ qf: number }>> {
  const stage2 = await prisma.tournamentStage.findFirst({ where: { tournamentId, orderIndex: 2, kind: "GROUP" } });
  if (!stage2) return { success: false, error: "Stage 2 not found" };
  const pending = await prisma.match.count({ where: { stageId: stage2.id, status: { not: "COMPLETED" } } });
  if (pending > 0) return { success: false, error: `Stage 2 incomplete — ${pending} match(es) left` };
  if (await prisma.tournamentStage.findFirst({ where: { tournamentId, orderIndex: 3 } }))
    return { success: false, error: "Knockout already generated" };

  await recomputeStandings(tournamentId, { stageId: stage2.id });
  const groups = await prisma.tournamentGroup.findMany({ where: { stageId: stage2.id }, orderBy: { orderIndex: "asc" }, select: { id: true, name: true } });
  const groupX = groups.find((g) => g.name === "Group X")!;
  const groupY = groups.find((g) => g.name === "Group Y")!;

  const top4 = async (groupId: string) => {
    const rows = await prisma.standing.findMany({
      where: { stageId: stage2.id, groupId },
      orderBy: [{ rank: "asc" }, { id: "asc" }],
      take: 4,
      select: { playerId: true },
    });
    return rows.map((r) => r.playerId!);
  };
  const X = await top4(groupX.id); // X[0]=X1 … X[3]=X4
  const Y = await top4(groupY.id);
  if (X.length < 4 || Y.length < 4) return { success: false, error: "Each Stage 2 group needs 4 qualifiers" };

  const knockout = await prisma.tournamentStage.create({
    data: { tournamentId, name: "Knockout", orderIndex: 3, kind: "KNOCKOUT" },
  });

  // QF1 X1-Y4, QF2 X2-Y3 (top half) ; QF3 Y1-X4, QF4 Y2-X3 (bottom half)
  const qfs: [string, string][] = [
    [X[0], Y[3]],
    [X[1], Y[2]],
    [Y[0], X[3]],
    [Y[1], X[2]],
  ];
  for (let i = 0; i < qfs.length; i++) {
    const [home, away] = qfs[i];
    await prisma.match.create({
      data: {
        tournamentId,
        stageId: knockout.id,
        round: "Quarter-finals",
        roundNumber: 1,
        matchNumber: i + 1,
        homePlayerId: home,
        awayPlayerId: away,
        status: "SCHEDULED",
        homeToken: randomUUID(),
        awayToken: randomUUID(),
      },
    });
  }

  await revalidate(tournamentId);
  return { success: true, data: { qf: 4 } };
}

// ─── Authed action wrappers (admin UI entry points) ───────────

export async function generateStage1Groups(tournamentId: string): Promise<ActionResult<{ groups: number }>> {
  const denied = await requireAdmin();
  if (denied) return denied as ActionResult<{ groups: number }>;
  return generateStage1GroupsCore(tournamentId);
}

export async function closeStage1(tournamentId: string): Promise<ActionResult<{ playoffMatches: number }>> {
  const denied = await requireAdmin();
  if (denied) return denied as ActionResult<{ playoffMatches: number }>;
  return closeStage1Core(tournamentId);
}

export async function generateStage2Draw(tournamentId: string): Promise<ActionResult<{ x: string[]; y: string[] }>> {
  const denied = await requireAdmin();
  if (denied) return denied as ActionResult<{ x: string[]; y: string[] }>;
  return generateStage2DrawCore(tournamentId);
}

export async function generateStage2Knockout(tournamentId: string): Promise<ActionResult<{ qf: number }>> {
  const denied = await requireAdmin();
  if (denied) return denied as ActionResult<{ qf: number }>;
  return generateStage2KnockoutCore(tournamentId);
}
