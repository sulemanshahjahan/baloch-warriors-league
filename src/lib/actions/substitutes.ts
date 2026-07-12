"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { ActionResult } from "@/lib/utils";
import { adminActor, playerActor } from "@/lib/scheduling/authz";
import { resolveMatchSides, MATCH_SCHED_INCLUDE } from "@/lib/scheduling/service";
import { aggregateSchedulingStatus } from "@/lib/scheduling/status";

async function audit(data: { tournamentId?: string; matchId?: string; playerId?: string; actorType: "PLAYER" | "ADMIN" | "SYSTEM"; actorId?: string; eventType: string; metadata?: unknown }) {
  try {
    await prisma.schedulingAuditEvent.create({ data: { ...data, metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined } });
  } catch {
    /* ignore */
  }
}

async function isTeamCaptain(teamId: string, playerId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { captainId: true } });
  return team?.captainId === playerId;
}

// ── registration ─────────────────────────────────────────────

export async function registerSubstitute(input: { tournamentId: string; teamId: string; playerId: string }): Promise<ActionResult> {
  const admin = await adminActor("EDITOR");
  const actingPlayer = admin ? null : await playerActor();
  if (!admin && !actingPlayer) return { success: false, error: "Sign in required." };
  if (!admin && !(await isTeamCaptain(input.teamId, actingPlayer!))) {
    return { success: false, error: "Only the team captain or an admin can register a substitute." };
  }

  const enrolled = await prisma.tournamentTeam.findFirst({ where: { tournamentId: input.tournamentId, teamId: input.teamId }, select: { id: true } });
  if (!enrolled) return { success: false, error: "That team is not in this tournament." };

  await prisma.substituteRegistration.upsert({
    where: { tournamentId_teamId_playerId: { tournamentId: input.tournamentId, teamId: input.teamId, playerId: input.playerId } },
    create: { tournamentId: input.tournamentId, teamId: input.teamId, playerId: input.playerId, status: admin ? "APPROVED" : "PENDING", approvedById: admin?.id ?? null },
    update: { status: admin ? "APPROVED" : "PENDING" },
  });

  await audit({ tournamentId: input.tournamentId, playerId: input.playerId, actorType: admin ? "ADMIN" : "PLAYER", actorId: admin?.id ?? actingPlayer!, eventType: "SUBSTITUTE_REGISTERED" });
  revalidatePath(`/admin/scheduling/${input.tournamentId}`);
  return { success: true, data: undefined, message: admin ? "Substitute registered." : "Substitute registration submitted for approval." };
}

export async function setSubstituteRegistrationStatus(id: string, status: "APPROVED" | "REJECTED" | "REMOVED"): Promise<ActionResult> {
  const admin = await adminActor();
  if (!admin) return { success: false, error: "Admin access required." };
  const reg = await prisma.substituteRegistration.update({ where: { id }, data: { status, approvedById: admin.id }, select: { tournamentId: true } });
  await audit({ tournamentId: reg.tournamentId, actorType: "ADMIN", actorId: admin.id, eventType: `SUBSTITUTE_${status}` });
  revalidatePath(`/admin/scheduling/${reg.tournamentId}`);
  return { success: true, data: undefined, message: "Updated." };
}

// ── activation (per match) ───────────────────────────────────

export async function requestSubstituteActivation(input: {
  matchId: string;
  teamId: string;
  originalPlayerId: string;
  substitutePlayerId: string;
  reason?: string;
}): Promise<ActionResult> {
  const admin = await adminActor("EDITOR");
  const actingPlayer = admin ? null : await playerActor();
  if (!admin && !actingPlayer) return { success: false, error: "Sign in required." };
  if (!admin && !(await isTeamCaptain(input.teamId, actingPlayer!))) {
    return { success: false, error: "Only the captain or an admin can activate a substitute." };
  }

  const match = await prisma.match.findUnique({ where: { id: input.matchId }, select: { id: true, tournamentId: true, homeTeamId: true, awayTeamId: true, tournament: { select: { slug: true } } } });
  if (!match) return { success: false, error: "Match not found." };
  if (match.homeTeamId !== input.teamId && match.awayTeamId !== input.teamId) return { success: false, error: "That team is not in this match." };

  const reg = await prisma.substituteRegistration.findFirst({ where: { tournamentId: match.tournamentId, teamId: input.teamId, playerId: input.substitutePlayerId, status: "APPROVED" } });
  if (!reg) return { success: false, error: "That substitute is not an approved registration for this team." };

  await prisma.substituteActivation.create({
    data: {
      matchId: input.matchId,
      teamId: input.teamId,
      originalPlayerId: input.originalPlayerId,
      substitutePlayerId: input.substitutePlayerId,
      requestedById: admin?.id ?? actingPlayer!,
      status: admin ? "APPROVED" : "REQUESTED",
      approvedById: admin?.id ?? null,
      reason: input.reason ?? null,
    },
  });

  await audit({ tournamentId: match.tournamentId, matchId: input.matchId, actorType: admin ? "ADMIN" : "PLAYER", actorId: admin?.id ?? actingPlayer!, eventType: "SUBSTITUTE_ACTIVATION_REQUESTED", metadata: { substitutePlayerId: input.substitutePlayerId } });

  // Admins applying directly take effect immediately.
  if (admin) await applyActivation(input.matchId, input.teamId, input.originalPlayerId, input.substitutePlayerId);

  revalidatePath(`/player/matches/${input.matchId}`);
  revalidatePath("/admin/scheduling/conflicts");
  revalidatePath(`/admin/scheduling/${match.tournamentId}`);
  return { success: true, data: undefined, message: admin ? "Substitute activated." : "Substitute activation requested." };
}

export async function respondSubstituteActivation(id: string, accept: boolean): Promise<ActionResult> {
  const playerId = await playerActor();
  if (!playerId) return { success: false, error: "Please sign in." };
  const act = await prisma.substituteActivation.findUnique({ where: { id } });
  if (!act || act.substitutePlayerId !== playerId) return { success: false, error: "Request not found." };
  if (act.status !== "REQUESTED") return { success: false, error: "Already responded." };
  await prisma.substituteActivation.update({ where: { id }, data: { status: accept ? "ACCEPTED" : "DECLINED" } });
  revalidatePath(`/player/matches/${act.matchId}`);
  revalidatePath("/admin/scheduling/conflicts");
  return { success: true, data: undefined, message: accept ? "Accepted." : "Declined." };
}

export async function adminDecideActivation(id: string, approve: boolean, note?: string): Promise<ActionResult> {
  const admin = await adminActor();
  if (!admin) return { success: false, error: "Admin access required." };
  const act = await prisma.substituteActivation.findUnique({ where: { id }, include: { match: { select: { tournamentId: true, tournament: { select: { slug: true } } } } } });
  if (!act) return { success: false, error: "Activation not found." };

  if (!approve) {
    await prisma.substituteActivation.update({ where: { id }, data: { status: "REJECTED", approvedById: admin.id, reason: note ?? act.reason } });
  } else {
    await prisma.substituteActivation.update({ where: { id }, data: { status: "APPROVED", approvedById: admin.id } });
    await applyActivation(act.matchId, act.teamId, act.originalPlayerId, act.substitutePlayerId);
  }

  await audit({ tournamentId: act.match.tournamentId, matchId: act.matchId, actorType: "ADMIN", actorId: admin.id, eventType: approve ? "SUBSTITUTE_ACTIVATION_APPROVED" : "SUBSTITUTE_ACTIVATION_REJECTED" });
  revalidatePath(`/player/matches/${act.matchId}`);
  revalidatePath("/admin/scheduling/conflicts");
  revalidatePath(`/admin/scheduling/${act.match.tournamentId}`);
  return { success: true, data: undefined, message: approve ? "Substitute approved." : "Rejected." };
}

/** Swap the lineup on the match schedule: mark the original replaced, add the sub as a participant. */
async function applyActivation(matchId: string, teamId: string, originalPlayerId: string, substitutePlayerId: string) {
  const schedule = await prisma.matchSchedule.findUnique({ where: { matchId }, select: { id: true, selectedSlotId: true } });
  if (!schedule) return;
  await prisma.$transaction(async (tx) => {
    // Original player is replaced (won't count toward confirmations).
    await tx.matchParticipantConfirmation.updateMany({
      where: { matchScheduleId: schedule.id, playerId: originalPlayerId },
      data: { status: "SUBSTITUTE" },
    });
    // Add the substitute as a pending participant.
    await tx.matchParticipantConfirmation.upsert({
      where: { matchScheduleId_playerId: { matchScheduleId: schedule.id, playerId: substitutePlayerId } },
      create: { matchScheduleId: schedule.id, playerId: substitutePlayerId, teamId, status: "PENDING" },
      update: { status: "PENDING", teamId },
    });
    // Re-aggregate.
    const confs = await tx.matchParticipantConfirmation.findMany({ where: { matchScheduleId: schedule.id }, select: { playerId: true, status: true, proposedSlotId: true } });
    const agg = aggregateSchedulingStatus({ hasSlots: true, selectedSlotId: schedule.selectedSlotId, confirmations: confs.map((c) => ({ playerId: c.playerId, status: c.status as never, proposedSlotId: c.proposedSlotId })) });
    await tx.matchSchedule.update({ where: { id: schedule.id }, data: { schedulingStatus: agg.status as never } });
  });
}
