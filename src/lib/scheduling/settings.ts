import "server-only";
import { prisma } from "@/lib/db";
import { formatKeyFor, getStageResolvedDefaults, type SchedulingFormatKey } from "./defaults";

/**
 * The flat, resolved scheduling configuration the service + engine consume.
 * Merges the tournament's stored settings over the recommended format/stage
 * defaults, so unset fields still have sensible values.
 */
export interface EffectiveSettings {
  tournamentId: string;
  enabled: boolean;
  timezone: string;
  schedulingMode: string;
  availabilityMode: string;
  matchDurationMinutes: number;
  preMatchBufferMinutes: number;
  postMatchBufferMinutes: number;
  confirmationWindowHours: number;
  rescheduleCutoffHours: number;
  maxReschedules: number;
  gracePeriodMinutes: number;
  substitutesEnabled: boolean;
  captainConfirmationEnabled: boolean;
  earlyPlayEnabled: boolean;
  opponentAvailabilityVisible: boolean;
  /** Completion-window length (days) the engine searches within. From defaults. */
  completionWindowDays: number;
  formatKey: SchedulingFormatKey;
}

type TournamentLike = {
  id: string;
  format: "LEAGUE" | "KNOCKOUT" | "GROUP_KNOCKOUT";
  participantType: "TEAM" | "INDIVIDUAL";
  eFootballMode: string | null;
};

export function resolveEffectiveSettings(
  tournament: TournamentLike,
  settings: {
    enabled: boolean;
    timezone: string;
    schedulingMode: string;
    availabilityMode: string;
    matchDurationMinutes: number;
    preMatchBufferMinutes: number;
    postMatchBufferMinutes: number;
    confirmationWindowHours: number;
    rescheduleCutoffHours: number;
    maxReschedules: number;
    gracePeriodMinutes: number;
    substitutesEnabled: boolean;
    captainConfirmationEnabled: boolean;
    earlyPlayEnabled: boolean;
    opponentAvailabilityVisible: boolean;
  } | null,
  stageType?: string
): EffectiveSettings {
  const formatKey = formatKeyFor(tournament);
  const defaults = getStageResolvedDefaults(formatKey, stageType);

  return {
    tournamentId: tournament.id,
    enabled: settings?.enabled ?? false,
    timezone: settings?.timezone ?? "Asia/Karachi",
    schedulingMode: settings?.schedulingMode ?? defaults.schedulingMode,
    availabilityMode: settings?.availabilityMode ?? defaults.availabilityMode,
    matchDurationMinutes: settings?.matchDurationMinutes ?? defaults.matchDurationMinutes,
    preMatchBufferMinutes: settings?.preMatchBufferMinutes ?? defaults.preMatchBufferMinutes,
    postMatchBufferMinutes: settings?.postMatchBufferMinutes ?? defaults.postMatchBufferMinutes,
    confirmationWindowHours: settings?.confirmationWindowHours ?? defaults.confirmationWindowHours,
    rescheduleCutoffHours: settings?.rescheduleCutoffHours ?? defaults.rescheduleCutoffHours,
    maxReschedules: settings?.maxReschedules ?? defaults.maxReschedules,
    gracePeriodMinutes: settings?.gracePeriodMinutes ?? defaults.gracePeriodMinutes,
    substitutesEnabled: settings?.substitutesEnabled ?? defaults.substitutesEnabled,
    captainConfirmationEnabled: settings?.captainConfirmationEnabled ?? defaults.captainConfirmationEnabled,
    earlyPlayEnabled: settings?.earlyPlayEnabled ?? defaults.earlyPlayEnabled,
    opponentAvailabilityVisible: settings?.opponentAvailabilityVisible ?? true,
    completionWindowDays: defaults.completionWindowDays,
    formatKey,
  };
}

/** Load + resolve effective settings for a tournament (defaults when unset). */
export async function getEffectiveSettings(
  tournamentId: string,
  stageType?: string
): Promise<EffectiveSettings | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, format: true, participantType: true, eFootballMode: true, schedulingSettings: true },
  });
  if (!tournament) return null;
  return resolveEffectiveSettings(tournament, tournament.schedulingSettings, stageType);
}
