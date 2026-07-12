"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { ActionResult } from "@/lib/utils";
import { adminActor, playerActor } from "@/lib/scheduling/authz";
import { resolveMatchSides, MATCH_SCHED_INCLUDE } from "@/lib/scheduling/service";
import { getEffectiveSettings } from "@/lib/scheduling/settings";

const MINUTE = 60_000;

async function audit(data: { tournamentId?: string; matchId?: string; playerId?: string; actorType: "PLAYER" | "ADMIN" | "SYSTEM"; actorId?: string; eventType: string; metadata?: unknown }) {
  try {
    await prisma.schedulingAuditEvent.create({ data: { ...data, metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined } });
  } catch {
    /* ignore */
  }
}

// ── player check-in ──────────────────────────────────────────

export async function playerCheckIn(matchId: string): Promise<ActionResult<{ status: string }>> {
  const playerId = await playerActor();
  if (!playerId) return { success: false, error: "Please sign in." };

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_SCHED_INCLUDE });
  if (!match) return { success: false, error: "Match not found." };
  const sides = resolveMatchSides(match);
  if (!sides.some((s) => s.players.some((p) => p.playerId === playerId))) return { success: false, error: "You are not in this match." };

  const schedule = await prisma.matchSchedule.findUnique({ where: { matchId }, select: { kickoffAt: true } });
  const kickoff = schedule?.kickoffAt ?? match.scheduledAt;
  if (!kickoff) return { success: false, error: "This match has no scheduled time yet." };

  const settings = await getEffectiveSettings(match.tournamentId, match.groupId ? "GROUP" : undefined);
  const grace = (settings?.gracePeriodMinutes ?? 10) * MINUTE;
  const now = Date.now();
  if (now < kickoff.getTime() - 30 * MINUTE) return { success: false, error: "Check-in opens 30 minutes before kickoff." };
  if (now > kickoff.getTime() + grace + 30 * MINUTE) return { success: false, error: "Check-in has closed for this match." };

  const status = now > kickoff.getTime() + grace ? "LATE" : "CHECKED_IN";
  await prisma.matchCheckIn.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId, status: status as never, checkedInAt: new Date(), source: "PLAYER" },
    update: { status: status as never, checkedInAt: new Date(), source: "PLAYER" },
  });
  await audit({ tournamentId: match.tournamentId, matchId, playerId, actorType: "PLAYER", actorId: playerId, eventType: "CHECKED_IN", metadata: { status } });
  revalidatePath(`/player/matches/${matchId}`);
  return { success: true, data: { status } };
}

export async function adminSetCheckIn(matchId: string, playerId: string, status: "CHECKED_IN" | "LATE" | "EXCUSED" | "NO_SHOW"): Promise<ActionResult> {
  const admin = await adminActor();
  if (!admin) return { success: false, error: "Admin access required." };
  await prisma.matchCheckIn.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId, status: status as never, checkedInAt: status === "CHECKED_IN" || status === "LATE" ? new Date() : null, source: "ADMIN" },
    update: { status: status as never, source: "ADMIN" },
  });
  const m = await prisma.match.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
  await audit({ tournamentId: m?.tournamentId, matchId, playerId, actorType: "ADMIN", actorId: admin.id, eventType: "ADMIN_CHECK_IN", metadata: { status } });
  revalidatePath(`/player/matches/${matchId}`);
  revalidatePath("/admin/scheduling/conflicts");
  return { success: true, data: undefined, message: "Check-in updated." };
}

// ── no-show / walkover review ────────────────────────────────

export type NoShowResolution = "WALKOVER_HOME" | "WALKOVER_AWAY" | "RESCHEDULE" | "WARNING" | "DISMISS";

export async function adminResolveNoShow(matchId: string, resolution: NoShowResolution, note?: string): Promise<ActionResult> {
  const admin = await adminActor();
  if (!admin) return { success: false, error: "Admin access required." };

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, tournamentId: true, status: true, tournament: { select: { slug: true } } } });
  if (!match) return { success: false, error: "Match not found." };

  if (resolution === "WALKOVER_HOME" || resolution === "WALKOVER_AWAY") {
    if (match.status === "COMPLETED") return { success: false, error: "Match is already completed." };
    const { executeMatchCompletion } = await import("@/lib/actions/match");
    const [h, a] = resolution === "WALKOVER_HOME" ? [3, 0] : [0, 3];
    await executeMatchCompletion(matchId, h, a);
    await prisma.matchSchedule.updateMany({ where: { matchId }, data: { schedulingStatus: "COMPLETED" } });
  } else if (resolution === "RESCHEDULE") {
    await prisma.matchSchedule.updateMany({ where: { matchId }, data: { schedulingStatus: "AWAITING_CONFIRMATION" } });
  } else if (resolution === "DISMISS") {
    await prisma.matchSchedule.updateMany({ where: { matchId }, data: { schedulingStatus: match.status === "COMPLETED" ? "COMPLETED" : "SCHEDULED" } });
  }
  // WARNING falls through to audit only.

  await audit({ tournamentId: match.tournamentId, matchId, actorType: "ADMIN", actorId: admin.id, eventType: `NOSHOW_${resolution}`, metadata: { note } });
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/admin/scheduling/conflicts");
  revalidatePath(`/admin/scheduling/${match.tournamentId}`);
  if (match.tournament.slug) revalidatePath(`/tournaments/${match.tournament.slug}`);
  return { success: true, data: undefined, message: "Resolved." };
}
