"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { ActionResult } from "@/lib/utils";
import { fromKarachiInputValue } from "@/lib/utils";
import { adminActor, playerActor } from "@/lib/scheduling/authz";
import { resolveMatchSides, MATCH_SCHED_INCLUDE } from "@/lib/scheduling/service";
import { getEffectiveSettings } from "@/lib/scheduling/settings";
import { notifySchedulingAdminAlert, notifyMatchScheduled } from "@/lib/scheduling/notify";

const REASONS = ["DUTY_SHIFT_CHANGED", "WORK_EMERGENCY", "MEDICAL_FAMILY", "TECHNICAL", "TRAVEL", "OPPONENT_REQUEST", "OTHER"];

async function auditEvent(data: {
  tournamentId?: string;
  matchId?: string;
  playerId?: string;
  actorType: "PLAYER" | "ADMIN" | "SYSTEM";
  actorId?: string;
  eventType: string;
  metadata?: unknown;
}) {
  try {
    await prisma.schedulingAuditEvent.create({
      data: { ...data, metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  } catch {
    /* ignore */
  }
}

function revalidateMatch(matchId: string, tournamentId: string, slug?: string) {
  revalidatePath(`/player/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/admin/scheduling/conflicts");
  revalidatePath(`/admin/scheduling/${tournamentId}`);
  if (slug) revalidatePath(`/tournaments/${slug}`);
}

// ── player: request a reschedule ─────────────────────────────

export interface RescheduleInput {
  matchId: string;
  reasonCategory: string;
  reasonText: string;
  requestedSlotId?: string;
  requestedStart?: string; // datetime-local PKT
  isEmergency?: boolean;
}

export async function createRescheduleRequest(input: RescheduleInput): Promise<ActionResult> {
  const playerId = await playerActor();
  if (!playerId) return { success: false, error: "Please sign in." };
  if (!REASONS.includes(input.reasonCategory)) return { success: false, error: "Choose a valid reason." };
  if (!input.reasonText?.trim()) return { success: false, error: "Please explain the reason." };

  const match = await prisma.match.findUnique({ where: { id: input.matchId }, include: MATCH_SCHED_INCLUDE });
  if (!match) return { success: false, error: "Match not found." };
  const sides = resolveMatchSides(match);
  const mySide = sides.find((s) => s.players.some((p) => p.playerId === playerId));
  if (!mySide) return { success: false, error: "You are not a participant in this match." };

  const schedule = await prisma.matchSchedule.findUnique({ where: { matchId: input.matchId } });
  const kickoff = schedule?.kickoffAt ?? match.scheduledAt;
  if (!schedule || !kickoff) return { success: false, error: "This match has no scheduled time to change yet." };

  const settings = await getEffectiveSettings(match.tournamentId, match.groupId ? "GROUP" : undefined);
  const cutoffMs = (settings?.rescheduleCutoffHours ?? 6) * 3_600_000;
  if (!input.isEmergency && kickoff.getTime() - Date.now() < cutoffMs) {
    return { success: false, error: `Reschedules must be requested at least ${settings?.rescheduleCutoffHours ?? 6}h before kickoff.` };
  }

  const maxReschedules = settings?.maxReschedules ?? 1;
  const usedApproved = await prisma.rescheduleRequest.count({ where: { matchId: input.matchId, status: "APPROVED" } });
  if (usedApproved >= maxReschedules) {
    return { success: false, error: `This match has already used its ${maxReschedules} allowed reschedule(s).` };
  }
  const pending = await prisma.rescheduleRequest.findFirst({ where: { matchId: input.matchId, status: { in: ["PENDING", "OPPONENT_REVIEW"] } } });
  if (pending) return { success: false, error: "A reschedule request is already awaiting a decision." };

  // Resolve requested new time (from a proposed slot or a typed time).
  let requestedStart: Date | null = null;
  if (input.requestedSlotId) {
    const slot = await prisma.proposedMatchSlot.findFirst({ where: { id: input.requestedSlotId, matchScheduleId: schedule.id }, select: { startDateTime: true } });
    requestedStart = slot?.startDateTime ?? null;
  } else if (input.requestedStart) {
    requestedStart = fromKarachiInputValue(input.requestedStart);
  }

  await prisma.$transaction([
    prisma.rescheduleRequest.create({
      data: {
        matchId: input.matchId,
        requestedById: playerId,
        requestingTeamId: mySide.teamId,
        reasonCategory: input.reasonCategory as never,
        reasonText: input.reasonText.trim(),
        requestedStart,
        status: "PENDING",
        isEmergency: !!input.isEmergency,
      },
    }),
    prisma.matchSchedule.update({ where: { id: schedule.id }, data: { schedulingStatus: "RESCHEDULE_REQUESTED" } }),
  ]);

  await auditEvent({ tournamentId: match.tournamentId, matchId: input.matchId, playerId, actorType: "PLAYER", actorId: playerId, eventType: "RESCHEDULE_REQUESTED", metadata: { reasonCategory: input.reasonCategory, isEmergency: !!input.isEmergency } });
  await notifySchedulingAdminAlert({
    matchId: input.matchId,
    tournamentId: match.tournamentId,
    homeName: sides[0]?.label ?? "Home",
    awayName: sides[1]?.label ?? "Away",
    reason: "Reschedule requested",
  });
  revalidateMatch(input.matchId, match.tournamentId, match.tournament.slug);
  return { success: true, data: undefined, message: "Reschedule request submitted." };
}

export async function cancelRescheduleRequest(requestId: string): Promise<ActionResult> {
  const playerId = await playerActor();
  if (!playerId) return { success: false, error: "Please sign in." };
  const reqRow = await prisma.rescheduleRequest.findUnique({ where: { id: requestId }, include: { match: { select: { id: true, tournamentId: true, scheduledAt: true, tournament: { select: { slug: true } } } } } });
  if (!reqRow || reqRow.requestedById !== playerId) return { success: false, error: "Request not found." };
  if (reqRow.status !== "PENDING") return { success: false, error: "This request can no longer be cancelled." };

  await prisma.$transaction([
    prisma.rescheduleRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } }),
    prisma.matchSchedule.updateMany({ where: { matchId: reqRow.matchId }, data: { schedulingStatus: reqRow.match.scheduledAt ? "SCHEDULED" : "AWAITING_CONFIRMATION" } }),
  ]);
  revalidateMatch(reqRow.matchId, reqRow.match.tournamentId, reqRow.match.tournament.slug);
  return { success: true, data: undefined, message: "Request cancelled." };
}

// ── admin: decide a reschedule ───────────────────────────────

export async function adminDecideReschedule(
  requestId: string,
  decision: "APPROVE" | "REJECT",
  opts: { adminNote?: string; newStart?: string } = {}
): Promise<ActionResult> {
  const admin = await adminActor();
  if (!admin) return { success: false, error: "Admin access required." };

  const reqRow = await prisma.rescheduleRequest.findUnique({
    where: { id: requestId },
    include: { match: { include: MATCH_SCHED_INCLUDE } },
  });
  if (!reqRow) return { success: false, error: "Request not found." };
  if (reqRow.status !== "PENDING" && reqRow.status !== "OPPONENT_REVIEW") return { success: false, error: "Already decided." };

  const match = reqRow.match;
  const sides = resolveMatchSides(match);
  const schedule = await prisma.matchSchedule.findUnique({ where: { matchId: match.id }, select: { id: true, rescheduleCount: true } });

  if (decision === "REJECT") {
    await prisma.$transaction([
      prisma.rescheduleRequest.update({ where: { id: requestId }, data: { status: "REJECTED", adminDecision: "REJECT", adminNote: opts.adminNote ?? null, decidedById: admin.id, decidedAt: new Date() } }),
      ...(schedule ? [prisma.matchSchedule.update({ where: { id: schedule.id }, data: { schedulingStatus: match.scheduledAt ? "SCHEDULED" : "AWAITING_CONFIRMATION" } })] : []),
    ]);
    await auditEvent({ tournamentId: match.tournamentId, matchId: match.id, actorType: "ADMIN", actorId: admin.id, eventType: "RESCHEDULE_REJECTED", metadata: { requestId } });
    revalidateMatch(match.id, match.tournamentId, match.tournament.slug);
    return { success: true, data: undefined, message: "Reschedule rejected." };
  }

  // APPROVE — need a concrete new time.
  const newStart = opts.newStart ? fromKarachiInputValue(opts.newStart) : reqRow.requestedStart;
  if (!newStart) return { success: false, error: "Provide a new date/time to approve the reschedule." };

  await prisma.$transaction([
    prisma.rescheduleRequest.update({ where: { id: requestId }, data: { status: "APPROVED", adminDecision: "APPROVE", adminNote: opts.adminNote ?? null, decidedById: admin.id, decidedAt: new Date() } }),
    prisma.match.update({ where: { id: match.id }, data: { scheduledAt: newStart } }),
    ...(schedule
      ? [
          prisma.matchSchedule.update({
            where: { id: schedule.id },
            data: { schedulingStatus: "SCHEDULED", kickoffAt: newStart, primaryStart: newStart, rescheduleCount: (schedule.rescheduleCount ?? 0) + 1, adminOverride: true, overrideReason: `Reschedule approved: ${reqRow.reasonCategory}` },
          }),
        ]
      : []),
  ]);

  await auditEvent({ tournamentId: match.tournamentId, matchId: match.id, actorType: "ADMIN", actorId: admin.id, eventType: "RESCHEDULE_APPROVED", metadata: { requestId, newStart: newStart.toISOString() } });
  await notifyMatchScheduled({ id: match.id, homeName: sides[0]?.label ?? "Home", awayName: sides[1]?.label ?? "Away", kickoff: newStart });
  revalidateMatch(match.id, match.tournamentId, match.tournament.slug);
  return { success: true, data: undefined, message: "Reschedule approved and match moved." };
}
