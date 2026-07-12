"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getPlayerSession } from "@/lib/player-session";
import type { ActionResult } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import { resolveMatchSides, MATCH_SCHED_INCLUDE, type ResolvedSide } from "@/lib/scheduling/service";
import { getEffectiveSettings } from "@/lib/scheduling/settings";
import { aggregateSchedulingStatus } from "@/lib/scheduling/status";

interface Ctx {
  match: { id: string; tournamentId: string; slug: string };
  scheduleId: string;
  selectedSlotId: string | null;
  schedulingStatus: string;
  sides: ResolvedSide[];
  mySide: ResolvedSide;
  isCaptain: boolean;
  captainConfirmationEnabled: boolean;
}

async function getContext(matchId: string): Promise<{ ctx?: Ctx; error?: string; playerId?: string }> {
  const session = await getPlayerSession();
  if (!session) return { error: "Please sign in." };
  const playerId = session.playerId;

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_SCHED_INCLUDE });
  if (!match) return { error: "Match not found." };

  const sides = resolveMatchSides(match);
  const mySide = sides.find((s) => s.players.some((p) => p.playerId === playerId));
  if (!mySide) return { error: "You are not a participant in this match." };
  const me = mySide.players.find((p) => p.playerId === playerId)!;

  const schedule = await prisma.matchSchedule.findUnique({
    where: { matchId },
    select: { id: true, selectedSlotId: true, schedulingStatus: true },
  });
  if (!schedule) return { error: "This match has no proposed times yet." };
  if (schedule.schedulingStatus === "SCHEDULED")
    return { error: "This match is already scheduled. Request a reschedule to change it." };

  const settings = await getEffectiveSettings(match.tournamentId, match.groupId ? "GROUP" : undefined);

  return {
    playerId,
    ctx: {
      match: { id: match.id, tournamentId: match.tournamentId, slug: match.tournament.slug },
      scheduleId: schedule.id,
      selectedSlotId: schedule.selectedSlotId,
      schedulingStatus: schedule.schedulingStatus,
      sides,
      mySide,
      isCaptain: me.isCaptain,
      captainConfirmationEnabled: settings?.captainConfirmationEnabled ?? false,
    },
  };
}

/** Which players this actor may set confirmations for (self, or the whole side if a confirming captain). */
function targetPlayers(ctx: Ctx, actingPlayerId: string): string[] {
  if (ctx.captainConfirmationEnabled && ctx.isCaptain && ctx.mySide.teamId) {
    return ctx.mySide.players.map((p) => p.playerId);
  }
  return [actingPlayerId];
}

/** Recompute schedule status; when everyone has confirmed the selected slot, lock in the match time. */
async function recompute(tx: Prisma.TransactionClient, scheduleId: string, matchId: string) {
  const [confirmations, schedule, slotCount] = await Promise.all([
    tx.matchParticipantConfirmation.findMany({ where: { matchScheduleId: scheduleId }, select: { playerId: true, status: true, proposedSlotId: true } }),
    tx.matchSchedule.findUnique({ where: { id: scheduleId }, select: { selectedSlotId: true } }),
    tx.proposedMatchSlot.count({ where: { matchScheduleId: scheduleId } }),
  ]);

  const agg = aggregateSchedulingStatus({
    hasSlots: slotCount > 0,
    selectedSlotId: schedule?.selectedSlotId ?? null,
    confirmations: confirmations.map((c) => ({ playerId: c.playerId, status: c.status as never, proposedSlotId: c.proposedSlotId })),
  });

  if (agg.allConfirmed && schedule?.selectedSlotId) {
    const slot = await tx.proposedMatchSlot.findUnique({ where: { id: schedule.selectedSlotId }, select: { startDateTime: true } });
    await tx.matchSchedule.update({
      where: { id: scheduleId },
      data: { schedulingStatus: "SCHEDULED", kickoffAt: slot?.startDateTime ?? null },
    });
    if (slot?.startDateTime) await tx.match.update({ where: { id: matchId }, data: { scheduledAt: slot.startDateTime } });
  } else {
    await tx.matchSchedule.update({ where: { id: scheduleId }, data: { schedulingStatus: agg.status as never } });
  }
  return agg;
}

async function auditPlayer(playerId: string, matchId: string, tournamentId: string, eventType: string, metadata?: unknown) {
  try {
    await prisma.schedulingAuditEvent.create({
      data: { tournamentId, matchId, playerId, actorType: "PLAYER", actorId: playerId, eventType, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  } catch {
    /* ignore */
  }
}

function revalidate(ctx: Ctx) {
  revalidatePath(`/player/matches/${ctx.match.id}`);
  revalidatePath("/player/schedule");
  revalidatePath(`/matches/${ctx.match.id}`);
  revalidatePath(`/admin/scheduling/${ctx.match.tournamentId}`);
  if (ctx.match.slug) revalidatePath(`/tournaments/${ctx.match.slug}`);
}

// ── confirm the currently selected slot ──────────────────────

export async function confirmSelectedSlot(matchId: string): Promise<ActionResult<{ status: string }>> {
  const { ctx, error, playerId } = await getContext(matchId);
  if (!ctx || !playerId) return { success: false, error: error ?? "Unauthorized" };
  if (!ctx.selectedSlotId) return { success: false, error: "No time is selected to confirm. Pick a proposed slot first." };

  const targets = targetPlayers(ctx, playerId);
  const agg = await prisma.$transaction(async (tx) => {
    for (const pid of targets) {
      await tx.matchParticipantConfirmation.update({
        where: { matchScheduleId_playerId: { matchScheduleId: ctx.scheduleId, playerId: pid } },
        data: { status: "CONFIRMED", proposedSlotId: ctx.selectedSlotId, respondedAt: new Date(), confirmedById: pid === playerId ? null : playerId, responseReason: null, responseNote: null },
      });
    }
    return recompute(tx, ctx.scheduleId, matchId);
  });

  await auditPlayer(playerId, matchId, ctx.match.tournamentId, "SLOT_CONFIRMED", { slotId: ctx.selectedSlotId, byCaptain: targets.length > 1 });
  revalidate(ctx);
  return { success: true, data: { status: agg.allConfirmed ? "SCHEDULED" : agg.status } };
}

// ── switch the agreed slot to a different proposed one ───────

export async function switchSelectedSlot(matchId: string, slotId: string): Promise<ActionResult<{ status: string }>> {
  const { ctx, error, playerId } = await getContext(matchId);
  if (!ctx || !playerId) return { success: false, error: error ?? "Unauthorized" };

  const slot = await prisma.proposedMatchSlot.findFirst({ where: { id: slotId, matchScheduleId: ctx.scheduleId }, select: { id: true } });
  if (!slot) return { success: false, error: "That slot doesn't belong to this match." };

  const targets = targetPlayers(ctx, playerId);
  const agg = await prisma.$transaction(async (tx) => {
    // Changing the agreed time invalidates everyone's confirmation.
    await tx.matchParticipantConfirmation.updateMany({
      where: { matchScheduleId: ctx.scheduleId },
      data: { status: "PENDING", proposedSlotId: null, respondedAt: null, confirmedById: null, responseReason: null, responseNote: null },
    });
    await tx.matchSchedule.update({ where: { id: ctx.scheduleId }, data: { selectedSlotId: slotId } });
    // The switcher (and their side, if a confirming captain) implicitly confirms their choice.
    for (const pid of targets) {
      await tx.matchParticipantConfirmation.update({
        where: { matchScheduleId_playerId: { matchScheduleId: ctx.scheduleId, playerId: pid } },
        data: { status: "CONFIRMED", proposedSlotId: slotId, respondedAt: new Date(), confirmedById: pid === playerId ? null : playerId },
      });
    }
    return recompute(tx, ctx.scheduleId, matchId);
  });

  await auditPlayer(playerId, matchId, ctx.match.tournamentId, "SLOT_SWITCHED", { slotId });
  revalidate(ctx);
  return { success: true, data: { status: agg.status } };
}

// ── reject the current time ──────────────────────────────────

export async function rejectMatchTime(
  matchId: string,
  reasonCategory: string,
  note?: string
): Promise<ActionResult<{ status: string }>> {
  const { ctx, error, playerId } = await getContext(matchId);
  if (!ctx || !playerId) return { success: false, error: error ?? "Unauthorized" };
  if (!reasonCategory) return { success: false, error: "Please choose a reason." };

  const agg = await prisma.$transaction(async (tx) => {
    await tx.matchParticipantConfirmation.update({
      where: { matchScheduleId_playerId: { matchScheduleId: ctx.scheduleId, playerId } },
      data: { status: "REJECTED", proposedSlotId: null, responseReason: reasonCategory, responseNote: note ?? null, respondedAt: new Date() },
    });
    return recompute(tx, ctx.scheduleId, matchId);
  });

  await auditPlayer(playerId, matchId, ctx.match.tournamentId, "SLOT_REJECTED", { reasonCategory });
  revalidate(ctx);
  return { success: true, data: { status: agg.status } };
}
