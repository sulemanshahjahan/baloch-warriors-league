"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/utils";
import { fromKarachiInputValue } from "@/lib/utils";
import { generateAndPersistSlots } from "@/lib/scheduling/service";
import { getEffectiveSettings } from "@/lib/scheduling/settings";
import { formatKeyFor, getTournamentTypeDefaults } from "@/lib/scheduling/defaults";
import type { Prisma } from "@prisma/client";

const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };

async function requireAdmin(min = "ADMIN"): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session) return null;
  const level = ROLE_LEVELS[getUserRole(session)] ?? 0;
  if (level < (ROLE_LEVELS[min] ?? 0)) return null;
  const id = (session.user as { id?: string })?.id ?? "admin";
  return { id };
}

async function audit(tournamentId: string, actorId: string, eventType: string, metadata?: unknown, matchId?: string) {
  try {
    await prisma.schedulingAuditEvent.create({
      data: {
        tournamentId,
        matchId,
        actorType: "ADMIN",
        actorId,
        eventType,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    /* ignore */
  }
}

function revalidateScheduling(tournamentId: string, slug?: string) {
  revalidatePath("/admin/scheduling");
  revalidatePath(`/admin/scheduling/${tournamentId}`);
  revalidatePath("/admin/matches");
  if (slug) revalidatePath(`/tournaments/${slug}`);
}

// ── enable / disable / configure ─────────────────────────────

export async function enableTournamentScheduling(tournamentId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, slug: true, format: true, participantType: true, eFootballMode: true },
  });
  if (!tournament) return { success: false, error: "Tournament not found." };

  const d = getTournamentTypeDefaults(formatKeyFor(tournament));
  await prisma.tournamentSchedulingSettings.upsert({
    where: { tournamentId },
    create: {
      tournamentId,
      enabled: true,
      schedulingMode: d.schedulingMode,
      matchDurationMinutes: d.matchDurationMinutes,
      preMatchBufferMinutes: d.preMatchBufferMinutes,
      postMatchBufferMinutes: d.postMatchBufferMinutes,
      confirmationWindowHours: d.confirmationWindowHours,
      rescheduleCutoffHours: d.rescheduleCutoffHours,
      maxReschedules: d.maxReschedules,
      substitutesEnabled: d.substitutesEnabled,
      earlyPlayEnabled: d.earlyPlayEnabled,
      minimumAvailableSlots: d.minimumAvailableSlots ?? null,
      minimumAvailableDays: d.minimumAvailableDays ?? null,
      minimumSlotDuration: d.minimumSlotDuration ?? null,
    },
    update: { enabled: true },
  });

  await audit(tournamentId, admin.id, "SCHEDULING_ENABLED");
  revalidateScheduling(tournamentId, tournament.slug);
  return { success: true, data: undefined, message: "Scheduling enabled." };
}

export async function disableTournamentScheduling(tournamentId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };
  await prisma.tournamentSchedulingSettings.updateMany({ where: { tournamentId }, data: { enabled: false } });
  await audit(tournamentId, admin.id, "SCHEDULING_DISABLED");
  revalidateScheduling(tournamentId);
  return { success: true, data: undefined, message: "Scheduling disabled." };
}

export interface SchedulingSettingsPatch {
  schedulingMode?: string;
  matchDurationMinutes?: number;
  preMatchBufferMinutes?: number;
  postMatchBufferMinutes?: number;
  confirmationWindowHours?: number;
  rescheduleCutoffHours?: number;
  maxReschedules?: number;
  gracePeriodMinutes?: number;
  substitutesEnabled?: boolean;
  captainConfirmationEnabled?: boolean;
  earlyPlayEnabled?: boolean;
  opponentAvailabilityVisible?: boolean;
  minRequirementMode?: "HARD" | "SOFT" | "DISABLED";
  minimumAvailableSlots?: number | null;
  minimumAvailableDays?: number | null;
  minimumSlotDuration?: number | null;
  availabilityDeadline?: string | null; // datetime-local (PKT)
}

export async function updateSchedulingSettings(
  tournamentId: string,
  patch: SchedulingSettingsPatch
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };

  const data: Prisma.TournamentSchedulingSettingsUncheckedUpdateInput = {};
  const num = (v: number | undefined, min: number, max: number) =>
    v == null ? undefined : Math.max(min, Math.min(max, Math.round(v)));

  if (patch.schedulingMode) data.schedulingMode = patch.schedulingMode as never;
  data.matchDurationMinutes = num(patch.matchDurationMinutes, 5, 600);
  data.preMatchBufferMinutes = num(patch.preMatchBufferMinutes, 0, 240);
  data.postMatchBufferMinutes = num(patch.postMatchBufferMinutes, 0, 240);
  data.confirmationWindowHours = num(patch.confirmationWindowHours, 1, 720);
  data.rescheduleCutoffHours = num(patch.rescheduleCutoffHours, 0, 720);
  data.maxReschedules = num(patch.maxReschedules, 0, 10);
  data.gracePeriodMinutes = num(patch.gracePeriodMinutes, 0, 120);
  if (patch.substitutesEnabled != null) data.substitutesEnabled = patch.substitutesEnabled;
  if (patch.captainConfirmationEnabled != null) data.captainConfirmationEnabled = patch.captainConfirmationEnabled;
  if (patch.earlyPlayEnabled != null) data.earlyPlayEnabled = patch.earlyPlayEnabled;
  if (patch.opponentAvailabilityVisible != null) data.opponentAvailabilityVisible = patch.opponentAvailabilityVisible;
  if (patch.minRequirementMode) data.minRequirementMode = patch.minRequirementMode as never;
  if (patch.minimumAvailableSlots !== undefined) data.minimumAvailableSlots = patch.minimumAvailableSlots;
  if (patch.minimumAvailableDays !== undefined) data.minimumAvailableDays = patch.minimumAvailableDays;
  if (patch.minimumSlotDuration !== undefined) data.minimumSlotDuration = patch.minimumSlotDuration;
  if (patch.availabilityDeadline !== undefined)
    data.availabilityDeadline = patch.availabilityDeadline ? fromKarachiInputValue(patch.availabilityDeadline) : null;

  // Remove undefined so we don't overwrite with nulls.
  Object.keys(data).forEach((k) => (data as Record<string, unknown>)[k] === undefined && delete (data as Record<string, unknown>)[k]);

  await prisma.tournamentSchedulingSettings.upsert({
    where: { tournamentId },
    create: {
      tournamentId,
      enabled: true,
      ...(data as Omit<Prisma.TournamentSchedulingSettingsUncheckedCreateInput, "tournamentId">),
    },
    update: data,
  });
  await audit(tournamentId, admin.id, "SCHEDULING_SETTINGS_UPDATED", patch);
  revalidateScheduling(tournamentId);
  return { success: true, data: undefined, message: "Settings saved." };
}

// ── generate proposed slots ──────────────────────────────────

export async function generateScheduleForMatch(matchId: string): Promise<ActionResult<{ status: string; slotCount: number }>> {
  const admin = await requireAdmin("EDITOR");
  if (!admin) return { success: false, error: "Admin access required." };
  try {
    const out = await generateAndPersistSlots(matchId, admin.id);
    const m = await prisma.match.findUnique({ where: { id: matchId }, select: { tournamentId: true, tournament: { select: { slug: true } } } });
    if (m) revalidateScheduling(m.tournamentId, m.tournament.slug);
    revalidatePath(`/player/matches/${matchId}`);
    return { success: true, data: { status: out.status, slotCount: out.slotCount } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not generate slots." };
  }
}

export async function generateSchedulesForTournament(
  tournamentId: string
): Promise<ActionResult<{ generated: number; noOverlap: number; skipped: number }>> {
  const admin = await requireAdmin("EDITOR");
  if (!admin) return { success: false, error: "Admin access required." };

  const settings = await getEffectiveSettings(tournamentId);
  if (!settings?.enabled) return { success: false, error: "Enable scheduling for this tournament first." };

  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: { in: ["SCHEDULED", "POSTPONED"] },
      OR: [
        { AND: [{ homePlayerId: { not: null } }, { awayPlayerId: { not: null } }] },
        { AND: [{ homeTeamId: { not: null } }, { awayTeamId: { not: null } }] },
      ],
    },
    select: { id: true },
  });

  let generated = 0;
  let noOverlap = 0;
  let skipped = 0;
  for (const m of matches) {
    try {
      const out = await generateAndPersistSlots(m.id, admin.id);
      if (out.status === "NO_COMMON_TIME") noOverlap++;
      else generated++;
    } catch {
      skipped++;
    }
  }

  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
  await audit(tournamentId, admin.id, "SCHEDULES_GENERATED", { generated, noOverlap, skipped });
  revalidateScheduling(tournamentId, t?.slug);
  return { success: true, data: { generated, noOverlap, skipped } };
}

// ── admin overrides ──────────────────────────────────────────

export async function adminForceSchedule(matchId: string, slotId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };
  if (!reason?.trim()) return { success: false, error: "A reason is required for an override." };

  const slot = await prisma.proposedMatchSlot.findUnique({
    where: { id: slotId },
    include: { matchSchedule: { select: { id: true, matchId: true } } },
  });
  if (!slot || slot.matchSchedule.matchId !== matchId) return { success: false, error: "Slot not found for this match." };

  await prisma.$transaction([
    prisma.matchSchedule.update({
      where: { id: slot.matchSchedule.id },
      data: {
        selectedSlotId: slotId,
        schedulingStatus: "SCHEDULED",
        kickoffAt: slot.startDateTime,
        adminOverride: true,
        overrideReason: reason,
        primaryStart: slot.startDateTime,
        primaryEnd: slot.endDateTime,
      },
    }),
    prisma.match.update({ where: { id: matchId }, data: { scheduledAt: slot.startDateTime } }),
  ]);

  const m = await prisma.match.findUnique({ where: { id: matchId }, select: { tournamentId: true, tournament: { select: { slug: true } } } });
  if (m) {
    await audit(m.tournamentId, admin.id, "ADMIN_FORCE_SCHEDULE", { slotId, reason }, matchId);
    revalidateScheduling(m.tournamentId, m.tournament.slug);
  }
  revalidatePath(`/player/matches/${matchId}`);
  return { success: true, data: undefined, message: "Match scheduled." };
}

export async function adminSetManualTime(matchId: string, startInput: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admin access required." };
  const start = fromKarachiInputValue(startInput);
  if (!start) return { success: false, error: "Invalid date/time." };
  if (!reason?.trim()) return { success: false, error: "A reason is required." };

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, tournamentId: true, tournament: { select: { slug: true } } } });
  if (!match) return { success: false, error: "Match not found." };

  await prisma.matchSchedule.upsert({
    where: { matchId },
    create: {
      matchId,
      schedulingMode: "MANUAL",
      schedulingStatus: "SCHEDULED",
      kickoffAt: start,
      primaryStart: start,
      adminOverride: true,
      overrideReason: reason,
    },
    update: {
      schedulingMode: "MANUAL",
      schedulingStatus: "SCHEDULED",
      kickoffAt: start,
      primaryStart: start,
      adminOverride: true,
      overrideReason: reason,
    },
  });
  await prisma.match.update({ where: { id: matchId }, data: { scheduledAt: start } });
  await audit(match.tournamentId, admin.id, "ADMIN_MANUAL_TIME", { start: start.toISOString(), reason }, matchId);
  revalidateScheduling(match.tournamentId, match.tournament.slug);
  revalidatePath(`/player/matches/${matchId}`);
  return { success: true, data: undefined, message: "Match time set." };
}
