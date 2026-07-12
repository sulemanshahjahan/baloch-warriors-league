import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateProposedSlots } from "./engine";
import type { EngineSide, SubstituteOption, GenerateResult } from "./types";
import { blocksToIntervals, type BlockLike } from "./blocks";
import { getEffectiveSettings, type EffectiveSettings } from "./settings";

const MINUTE = 60_000;
const DAY = 86_400_000;

export interface SideParticipant {
  playerId: string;
  name: string;
  isCaptain: boolean;
}
export interface ResolvedSide {
  sideId: "home" | "away";
  teamId: string | null;
  label: string;
  players: SideParticipant[];
}

type MatchWithRels = Prisma.MatchGetPayload<{
  include: {
    tournament: { select: { id: true; name: true; format: true; participantType: true; eFootballMode: true; slug: true } };
    homePlayer: { select: { id: true; name: true } };
    awayPlayer: { select: { id: true; name: true } };
    homeTeam: { select: { id: true; name: true; captainId: true; players: { select: { player: { select: { id: true; name: true } } } } } };
    awayTeam: { select: { id: true; name: true; captainId: true; players: { select: { player: { select: { id: true; name: true } } } } } };
  };
}>;

export const MATCH_SCHED_INCLUDE = {
  tournament: { select: { id: true, name: true, format: true, participantType: true, eFootballMode: true, slug: true } },
  homePlayer: { select: { id: true, name: true } },
  awayPlayer: { select: { id: true, name: true } },
  homeTeam: {
    select: {
      id: true,
      name: true,
      captainId: true,
      players: { where: { isActive: true }, select: { player: { select: { id: true, name: true } } } },
    },
  },
  awayTeam: {
    select: {
      id: true,
      name: true,
      captainId: true,
      players: { where: { isActive: true }, select: { player: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.MatchInclude;

/** Resolve the two sides (players per side, captain flag) for a match. */
export function resolveMatchSides(match: MatchWithRels): ResolvedSide[] {
  const sideOf = (
    sideId: "home" | "away",
    player: { id: string; name: string } | null,
    team: MatchWithRels["homeTeam"]
  ): ResolvedSide => {
    if (team) {
      return {
        sideId,
        teamId: team.id,
        label: team.name,
        players: team.players.map((tp) => ({
          playerId: tp.player.id,
          name: tp.player.name,
          isCaptain: team.captainId === tp.player.id,
        })),
      };
    }
    return {
      sideId,
      teamId: null,
      label: player?.name ?? (sideId === "home" ? "Home" : "Away"),
      players: player ? [{ playerId: player.id, name: player.name, isCaptain: true }] : [],
    };
  };
  return [sideOf("home", match.homePlayer, match.homeTeam), sideOf("away", match.awayPlayer, match.awayTeam)];
}

/** Best-effort stage classification from a match's round label. */
export function stageTypeForMatch(round: string | null, groupId: string | null): string | undefined {
  if (groupId) return "GROUP";
  const r = (round ?? "").toLowerCase();
  if (r.includes("semi")) return "SEMI_FINAL";
  if (r.includes("quarter")) return "QUARTER_FINAL";
  if (r.includes("final")) return "FINAL";
  if (r.includes("16")) return "ROUND_OF_16";
  if (r.includes("32")) return "ROUND_OF_32";
  return undefined;
}

async function loadAvailabilityByPlayer(
  playerIds: string[],
  windowStart: Date,
  windowEnd: Date
): Promise<Record<string, ReturnType<typeof blocksToIntervals>>> {
  if (playerIds.length === 0) return {};
  const startDate = new Date(windowStart.toISOString().slice(0, 10) + "T00:00:00Z");
  const endDate = new Date(windowEnd.toISOString().slice(0, 10) + "T00:00:00Z");
  const blocks = await prisma.availabilityBlock.findMany({
    where: { playerId: { in: playerIds }, date: { gte: startDate, lte: endDate } },
  });
  const byPlayer: Record<string, BlockLike[]> = {};
  for (const b of blocks) {
    (byPlayer[b.playerId] ??= []).push({
      date: b.date.toISOString().slice(0, 10),
      startDateTime: b.startDateTime,
      endDateTime: b.endDateTime,
      status: b.status as BlockLike["status"],
      isAllDay: b.isAllDay,
      isOvernight: b.isOvernight,
    });
  }
  const out: Record<string, ReturnType<typeof blocksToIntervals>> = {};
  for (const [pid, bs] of Object.entries(byPlayer)) out[pid] = blocksToIntervals(bs);
  return out;
}

async function loadBusyByPlayer(
  playerIds: string[],
  excludeMatchId: string,
  settings: EffectiveSettings
): Promise<Record<string, { start: number; end: number }[]>> {
  if (playerIds.length === 0) return {};
  const teamIds = (
    await prisma.teamPlayer.findMany({ where: { playerId: { in: playerIds }, isActive: true }, select: { teamId: true, playerId: true } })
  );
  const teamToPlayers: Record<string, string[]> = {};
  for (const t of teamIds) (teamToPlayers[t.teamId] ??= []).push(t.playerId);

  const others = await prisma.match.findMany({
    where: {
      id: { not: excludeMatchId },
      status: { in: ["SCHEDULED", "LIVE"] },
      scheduledAt: { not: null },
      OR: [
        { homePlayerId: { in: playerIds } },
        { awayPlayerId: { in: playerIds } },
        { homeTeamId: { in: Object.keys(teamToPlayers) } },
        { awayTeamId: { in: Object.keys(teamToPlayers) } },
      ],
    },
    select: { scheduledAt: true, homePlayerId: true, awayPlayerId: true, homeTeamId: true, awayTeamId: true },
  });

  const pad = settings.preMatchBufferMinutes * MINUTE;
  const span = (settings.matchDurationMinutes + settings.postMatchBufferMinutes) * MINUTE;
  const busy: Record<string, { start: number; end: number }[]> = {};
  const addBusy = (pid: string, at: Date) => {
    (busy[pid] ??= []).push({ start: at.getTime() - pad, end: at.getTime() + span });
  };
  for (const m of others) {
    const at = m.scheduledAt!;
    const involved = new Set<string>();
    if (m.homePlayerId) involved.add(m.homePlayerId);
    if (m.awayPlayerId) involved.add(m.awayPlayerId);
    for (const tid of [m.homeTeamId, m.awayTeamId]) if (tid && teamToPlayers[tid]) teamToPlayers[tid].forEach((p) => involved.add(p));
    for (const pid of involved) if (playerIds.includes(pid)) addBusy(pid, at);
  }
  return busy;
}

async function loadSubstitutes(
  sides: ResolvedSide[],
  settings: EffectiveSettings,
  windowStart: Date,
  windowEnd: Date
): Promise<SubstituteOption[]> {
  if (!settings.substitutesEnabled) return [];
  const teamIds = sides.map((s) => s.teamId).filter((x): x is string => !!x);
  if (teamIds.length === 0) return [];
  const regs = await prisma.substituteRegistration.findMany({
    where: { tournamentId: settings.tournamentId, teamId: { in: teamIds }, status: "APPROVED" },
    select: { teamId: true, playerId: true, player: { select: { name: true } } },
  });
  if (regs.length === 0) return [];
  const avail = await loadAvailabilityByPlayer(regs.map((r) => r.playerId), windowStart, windowEnd);
  const subs: SubstituteOption[] = [];
  for (const r of regs) {
    const side = sides.find((s) => s.teamId === r.teamId);
    if (!side) continue;
    subs.push({
      sideId: side.sideId,
      participant: { playerId: r.playerId, sideId: side.sideId, displayName: r.player.name, isSubstitute: true, intervals: avail[r.playerId] ?? [] },
    });
  }
  return subs;
}

export interface GenerateOutcome {
  matchId: string;
  scheduleId: string;
  status: string;
  slotCount: number;
  eligibleFullLineup: boolean;
  analysis: GenerateResult["analysis"];
}

/**
 * Run the engine for one match and persist MatchSchedule + ProposedMatchSlot +
 * per-participant confirmations (reset to PENDING). Transactional.
 */
export async function generateAndPersistSlots(matchId: string, actorId?: string): Promise<GenerateOutcome> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_SCHED_INCLUDE });
  if (!match) throw new Error("Match not found.");
  if (match.status === "COMPLETED" || match.status === "CANCELLED") throw new Error("Match is already finished.");

  const stageType = stageTypeForMatch(match.round, match.groupId);
  const settings = await getEffectiveSettings(match.tournamentId, stageType);
  if (!settings) throw new Error("Tournament not found.");

  const sides = resolveMatchSides(match);
  const players = sides.flatMap((s) => s.players);
  if (players.length < 2) throw new Error("Both participants must be assigned before generating a schedule.");

  // Completion window: now → now + completionWindowDays, respecting an existing deadline.
  const now = Date.now();
  const windowStart = new Date(now);
  const defaultEnd = now + settings.completionWindowDays * DAY;
  const windowEnd = new Date(
    match.deadline && match.deadline.getTime() > now ? match.deadline.getTime() : defaultEnd
  );

  const playerIds = players.map((p) => p.playerId);
  const [availByPlayer, busyByPlayer, substitutes] = await Promise.all([
    loadAvailabilityByPlayer(playerIds, windowStart, windowEnd),
    loadBusyByPlayer(playerIds, matchId, settings),
    loadSubstitutes(sides, settings, windowStart, windowEnd),
  ]);

  const engineSides: EngineSide[] = sides.map((s) => ({
    sideId: s.sideId,
    teamId: s.teamId,
    players: s.players.map((p) => ({
      playerId: p.playerId,
      sideId: s.sideId,
      displayName: p.name,
      intervals: availByPlayer[p.playerId] ?? [],
    })),
  }));

  const result = generateProposedSlots({
    sides: engineSides,
    substitutes,
    options: {
      matchDurationMinutes: settings.matchDurationMinutes,
      preMatchBufferMinutes: settings.preMatchBufferMinutes,
      postMatchBufferMinutes: settings.postMatchBufferMinutes,
      windowStart: windowStart.getTime(),
      windowEnd: windowEnd.getTime(),
      deadline: windowEnd.getTime(),
      busyByPlayer,
      timezoneOffsetMinutes: 300,
      allowShiftUnconfirmed: false,
      maxSlots: 6,
    },
  });

  const primary = result.slots.find((s) => s.isPrimary) ?? result.slots[0] ?? null;
  const backup = result.slots.find((s) => s.isBackup) ?? null;
  const confirmationDeadline = new Date(now + settings.confirmationWindowHours * 3_600_000);
  const status = result.slots.length === 0 ? "NO_COMMON_TIME" : "AWAITING_CONFIRMATION";

  const scheduleId = await prisma.$transaction(async (tx) => {
    const schedule = await tx.matchSchedule.upsert({
      where: { matchId },
      create: {
        matchId,
        schedulingMode: settings.schedulingMode as never,
        timezone: settings.timezone,
        schedulingStatus: status as never,
        windowStart,
        windowEnd,
        confirmationDeadline,
        autoGenerated: true,
        schedulingConfidence: primary?.score ?? null,
      },
      update: {
        schedulingMode: settings.schedulingMode as never,
        schedulingStatus: status as never,
        windowStart,
        windowEnd,
        confirmationDeadline,
        autoGenerated: true,
        adminOverride: false,
        schedulingConfidence: primary?.score ?? null,
      },
    });

    await tx.proposedMatchSlot.deleteMany({ where: { matchScheduleId: schedule.id } });

    let primarySlotId: string | null = null;
    let primaryS: Date | null = null;
    let primaryE: Date | null = null;
    let backupS: Date | null = null;
    let backupE: Date | null = null;

    for (const slot of result.slots) {
      const created = await tx.proposedMatchSlot.create({
        data: {
          matchScheduleId: schedule.id,
          startDateTime: new Date(slot.kickoff),
          endDateTime: new Date(slot.matchEnd),
          score: slot.score,
          rank: slot.rank,
          eligibility: slot.eligibility as never,
          requiresSubstitute: slot.requiresSubstitute,
          isPrimary: slot.isPrimary,
          isBackup: slot.isBackup,
          scoringExplanation: slot.explanation,
          conflictDetails: slot.requiresSubstitute
            ? ({ substitutePlayerIds: slot.substitutePlayerIds } as Prisma.InputJsonValue)
            : undefined,
        },
      });
      if (slot.isPrimary || (primarySlotId === null && slot.rank === 1)) {
        primarySlotId = created.id;
        primaryS = new Date(slot.kickoff);
        primaryE = new Date(slot.matchEnd);
      }
      if (slot.isBackup) {
        backupS = new Date(slot.kickoff);
        backupE = new Date(slot.matchEnd);
      }
    }

    await tx.matchSchedule.update({
      where: { id: schedule.id },
      data: {
        selectedSlotId: primarySlotId,
        primaryStart: primaryS,
        primaryEnd: primaryE,
        backupStart: backupS,
        backupEnd: backupE,
      },
    });

    // Reset participant confirmations to PENDING.
    for (const s of sides) {
      for (const p of s.players) {
        await tx.matchParticipantConfirmation.upsert({
          where: { matchScheduleId_playerId: { matchScheduleId: schedule.id, playerId: p.playerId } },
          create: { matchScheduleId: schedule.id, playerId: p.playerId, teamId: s.teamId, status: "PENDING" },
          update: { status: "PENDING", proposedSlotId: null, responseReason: null, responseNote: null, respondedAt: null, confirmedById: null },
        });
      }
    }

    return schedule.id;
  });

  // Audit (best-effort).
  try {
    await prisma.schedulingAuditEvent.create({
      data: {
        tournamentId: match.tournamentId,
        matchId,
        actorType: actorId ? "ADMIN" : "SYSTEM",
        actorId: actorId ?? null,
        eventType: "SLOTS_GENERATED",
        metadata: { slotCount: result.slots.length, status, eligibleFullLineup: result.eligibleFullLineup } as Prisma.InputJsonValue,
      },
    });
  } catch {
    /* ignore */
  }

  return {
    matchId,
    scheduleId,
    status,
    slotCount: result.slots.length,
    eligibleFullLineup: result.eligibleFullLineup,
    analysis: result.analysis,
  };
}
