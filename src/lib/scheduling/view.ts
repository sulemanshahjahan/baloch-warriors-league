import "server-only";
import { prisma } from "@/lib/db";
import { getRoundDisplayName } from "@/lib/utils";
import { getEffectiveSettings } from "./settings";
import { resolveMatchSides, MATCH_SCHED_INCLUDE } from "./service";
import { aggregateSchedulingStatus, type SchedulingStatus } from "./status";

export interface SlotView {
  id: string;
  start: string; // ISO
  end: string; // ISO
  score: number;
  rank: number;
  eligibility: string;
  requiresSubstitute: boolean;
  isPrimary: boolean;
  isBackup: boolean;
  isSelected: boolean;
  explanation: string | null;
}

export interface ParticipantView {
  playerId: string;
  name: string;
  isCaptain: boolean;
  confirmationStatus: string;
  confirmedSlotId: string | null;
  responseReason: string | null;
  respondedAt: string | null;
}

export interface SideView {
  sideId: "home" | "away";
  teamId: string | null;
  label: string;
  players: ParticipantView[];
}

export interface ViewerContext {
  playerId: string;
  sideId: "home" | "away";
  isCaptain: boolean;
  confirmationStatus: string;
  canAct: boolean;
}

export interface MatchSchedulingView {
  matchId: string;
  tournamentName: string;
  tournamentSlug: string;
  roundLabel: string;
  isTeamMatch: boolean;
  schedulingStatus: string;
  aggregateStatus: SchedulingStatus;
  needsAttention: boolean;
  selectedSlotId: string | null;
  confirmationDeadline: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  kickoffAt: string | null;
  scheduledAt: string | null;
  captainConfirmationEnabled: boolean;
  substitutesEnabled: boolean;
  sides: SideView[];
  slots: SlotView[];
  viewer: ViewerContext | null;
  hasSchedule: boolean;
  // Reschedule
  rescheduleUsed: number;
  maxReschedules: number;
  pendingRescheduleId: string | null;
  canRequestReschedule: boolean;
  // Check-in
  checkInOpen: boolean;
  checkIns: { playerId: string; status: string }[];
  myCheckInStatus: string | null;
  // Substitutes (only populated when the viewer captains a team side)
  mySideTeamId: string | null;
  mySideCaptain: boolean;
  registeredSubs: { playerId: string; name: string }[];
  mySideLineup: { playerId: string; name: string }[];
}

/**
 * Assemble everything the match-scheduling detail screen needs. `viewerPlayerId`
 * personalises the action affordances; pass undefined for an admin/public read.
 * Private availability notes are never included here.
 */
export async function getMatchSchedulingView(
  matchId: string,
  viewerPlayerId?: string
): Promise<MatchSchedulingView | null> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: MATCH_SCHED_INCLUDE });
  if (!match) return null;

  const schedule = await prisma.matchSchedule.findUnique({
    where: { matchId },
    include: {
      slots: { orderBy: { rank: "asc" } },
      confirmations: true,
    },
  });

  const stageType = match.groupId ? "GROUP" : undefined;
  const settings = await getEffectiveSettings(match.tournamentId, stageType);
  const sidesResolved = resolveMatchSides(match);

  const confByPlayer = new Map((schedule?.confirmations ?? []).map((c) => [c.playerId, c]));
  const sides: SideView[] = sidesResolved.map((s) => ({
    sideId: s.sideId,
    teamId: s.teamId,
    label: s.label,
    players: s.players.map((p) => {
      const c = confByPlayer.get(p.playerId);
      return {
        playerId: p.playerId,
        name: p.name,
        isCaptain: p.isCaptain,
        confirmationStatus: c?.status ?? "PENDING",
        confirmedSlotId: c?.proposedSlotId ?? null,
        responseReason: c?.responseReason ?? null,
        respondedAt: c?.respondedAt ? c.respondedAt.toISOString() : null,
      };
    }),
  }));

  const slots: SlotView[] = (schedule?.slots ?? []).map((s) => ({
    id: s.id,
    start: s.startDateTime.toISOString(),
    end: s.endDateTime.toISOString(),
    score: s.score,
    rank: s.rank,
    eligibility: s.eligibility,
    requiresSubstitute: s.requiresSubstitute,
    isPrimary: s.isPrimary,
    isBackup: s.isBackup,
    isSelected: schedule?.selectedSlotId === s.id,
    explanation: s.scoringExplanation,
  }));

  const agg = aggregateSchedulingStatus({
    hasSlots: slots.length > 0,
    selectedSlotId: schedule?.selectedSlotId ?? null,
    confirmations: (schedule?.confirmations ?? []).map((c) => ({
      playerId: c.playerId,
      status: c.status as never,
      proposedSlotId: c.proposedSlotId,
    })),
  });

  const scheduled = schedule?.schedulingStatus === "SCHEDULED" || !!match.scheduledAt;
  const kickoff = schedule?.kickoffAt ?? match.scheduledAt ?? null;

  let viewer: ViewerContext | null = null;
  let mySide: (typeof sidesResolved)[number] | null = null;
  if (viewerPlayerId) {
    for (const s of sidesResolved) {
      const me = s.players.find((p) => p.playerId === viewerPlayerId);
      if (me) {
        mySide = s;
        const c = confByPlayer.get(viewerPlayerId);
        viewer = {
          playerId: viewerPlayerId,
          sideId: s.sideId,
          isCaptain: me.isCaptain,
          confirmationStatus: c?.status ?? "PENDING",
          canAct: !!schedule && slots.length > 0 && !scheduled,
        };
        break;
      }
    }
  }

  // Reschedule / check-in / substitute context.
  const [approvedReschedules, pendingReschedule, checkInRows] = await Promise.all([
    prisma.rescheduleRequest.count({ where: { matchId, status: "APPROVED" } }),
    prisma.rescheduleRequest.findFirst({ where: { matchId, status: { in: ["PENDING", "OPPONENT_REVIEW"] } }, select: { id: true } }),
    prisma.matchCheckIn.findMany({ where: { matchId }, select: { playerId: true, status: true } }),
  ]);

  const grace = (settings?.gracePeriodMinutes ?? 10) * 60_000;
  const nowMs = Date.now();
  const checkInOpen =
    scheduled && !!kickoff && nowMs >= kickoff.getTime() - 30 * 60_000 && nowMs <= kickoff.getTime() + grace + 30 * 60_000;

  const maxReschedules = settings?.maxReschedules ?? 1;
  const canRequestReschedule = !!viewer && scheduled && approvedReschedules < maxReschedules && !pendingReschedule;

  const substitutesEnabled = settings?.substitutesEnabled ?? false;
  const mySideCaptain = !!viewer?.isCaptain && !!mySide?.teamId;
  let registeredSubs: { playerId: string; name: string }[] = [];
  if (mySideCaptain && substitutesEnabled && mySide?.teamId) {
    const regs = await prisma.substituteRegistration.findMany({
      where: { tournamentId: match.tournamentId, teamId: mySide.teamId, status: "APPROVED" },
      select: { playerId: true, player: { select: { name: true } } },
    });
    registeredSubs = regs.map((r) => ({ playerId: r.playerId, name: r.player.name }));
  }

  return {
    substitutesEnabled,
    rescheduleUsed: approvedReschedules,
    maxReschedules,
    pendingRescheduleId: pendingReschedule?.id ?? null,
    canRequestReschedule,
    checkInOpen,
    checkIns: checkInRows.map((c) => ({ playerId: c.playerId, status: c.status })),
    myCheckInStatus: viewerPlayerId ? checkInRows.find((c) => c.playerId === viewerPlayerId)?.status ?? null : null,
    mySideTeamId: mySide?.teamId ?? null,
    mySideCaptain,
    registeredSubs,
    mySideLineup: mySide?.players.map((p) => ({ playerId: p.playerId, name: p.name })) ?? [],
    matchId,
    tournamentName: match.tournament.name,
    tournamentSlug: match.tournament.slug,
    roundLabel: getRoundDisplayName(match.round, match.roundNumber, match.matchNumber),
    isTeamMatch: !!(match.homeTeamId || match.awayTeamId),
    schedulingStatus: schedule?.schedulingStatus ?? (match.scheduledAt ? "SCHEDULED" : "FIXTURE_CREATED"),
    aggregateStatus: scheduled ? "SCHEDULED" : agg.status,
    needsAttention: agg.needsAttention,
    selectedSlotId: schedule?.selectedSlotId ?? null,
    confirmationDeadline: schedule?.confirmationDeadline?.toISOString() ?? null,
    windowStart: schedule?.windowStart?.toISOString() ?? null,
    windowEnd: schedule?.windowEnd?.toISOString() ?? null,
    kickoffAt: schedule?.kickoffAt?.toISOString() ?? null,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    captainConfirmationEnabled: settings?.captainConfirmationEnabled ?? false,
    sides,
    slots,
    viewer,
    hasSchedule: !!schedule,
  };
}
