/**
 * Recommended default scheduling settings per tournament format and stage.
 * These prefill the admin setup form (section 7–8 of the spec) — they are
 * suggestions, never enforced. Admins can override every value.
 */

export interface RecommendedSettings {
  schedulingMode:
    | "AUTOMATIC"
    | "ADMIN_ASSISTED"
    | "PLAYER_CHOICE"
    | "MANUAL"
    | "WINDOW"
    | "OFFICIAL";
  availabilityMode:
    | "MONTHLY"
    | "WEEKLY"
    | "TOURNAMENT_WIDE"
    | "ROUND_SPECIFIC"
    | "ADMIN_MANAGED"
    | "HYBRID";
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
  /** Completion window length (days) the engine should search within. */
  completionWindowDays: number;
  minimumAvailableSlots?: number;
  minimumAvailableDays?: number;
  minimumSlotDuration?: number;
  notes: string;
}

const BASE: RecommendedSettings = {
  schedulingMode: "ADMIN_ASSISTED",
  availabilityMode: "HYBRID",
  matchDurationMinutes: 60,
  preMatchBufferMinutes: 10,
  postMatchBufferMinutes: 10,
  confirmationWindowHours: 24,
  rescheduleCutoffHours: 6,
  maxReschedules: 1,
  gracePeriodMinutes: 10,
  substitutesEnabled: false,
  captainConfirmationEnabled: false,
  earlyPlayEnabled: true,
  completionWindowDays: 3,
  notes: "",
};

export type SchedulingFormatKey =
  | "1V1_KNOCKOUT"
  | "2V2_KNOCKOUT"
  | "1V1_LEAGUE"
  | "2V2_LEAGUE"
  | "GROUP_STAGE"
  | "GROUP_KNOCKOUT"
  | "ROUND_ROBIN";

/**
 * Derive a format key from BWL's tournament fields.
 * 2v2 = eFootball duo mode or TEAM participant type; 1v1 = INDIVIDUAL.
 */
export function formatKeyFor(t: {
  format: "LEAGUE" | "KNOCKOUT" | "GROUP_KNOCKOUT";
  participantType: "TEAM" | "INDIVIDUAL";
  eFootballMode?: string | null;
}): SchedulingFormatKey {
  const is2v2 = t.eFootballMode === "2v2" || t.participantType === "TEAM";
  if (t.format === "GROUP_KNOCKOUT") return "GROUP_KNOCKOUT";
  if (t.format === "LEAGUE") return is2v2 ? "2V2_LEAGUE" : "1V1_LEAGUE";
  return is2v2 ? "2V2_KNOCKOUT" : "1V1_KNOCKOUT";
}

const FORMAT_DEFAULTS: Record<SchedulingFormatKey, Partial<RecommendedSettings>> = {
  "1V1_KNOCKOUT": {
    schedulingMode: "PLAYER_CHOICE",
    completionWindowDays: 3,
    maxReschedules: 1,
    minimumAvailableSlots: 3,
    minimumAvailableDays: 2,
    notes:
      "Only two players must overlap. Offer 2–3 proposed slots over a 3-day window; require confirmation. Flag players who reject every valid option without a usable alternative.",
  },
  "2V2_KNOCKOUT": {
    schedulingMode: "PLAYER_CHOICE",
    completionWindowDays: 4,
    maxReschedules: 1,
    substitutesEnabled: true,
    minimumAvailableSlots: 4,
    minimumAvailableDays: 3,
    minimumSlotDuration: 90,
    notes:
      "Four players must overlap — the hardest case. Use primary + backup times, require all four to confirm (unless captain confirmation is enabled), allow registered substitutes, and escalate early when no four-player overlap exists.",
  },
  "1V1_LEAGUE": {
    schedulingMode: "WINDOW",
    completionWindowDays: 5,
    maxReschedules: 2,
    earlyPlayEnabled: true,
    notes:
      "Publish fixtures as round windows; confirm exact times closer to each round. Allow early play, set a hard per-round deadline, and auto-flag overdue fixtures.",
  },
  "2V2_LEAGUE": {
    schedulingMode: "WINDOW",
    completionWindowDays: 6,
    maxReschedules: 2,
    substitutesEnabled: true,
    minimumAvailableSlots: 4,
    minimumAvailableDays: 3,
    notes:
      "Wider round windows, substitute support and a team-availability view. Surface which team member repeatedly causes conflicts.",
  },
  GROUP_STAGE: {
    schedulingMode: "PLAYER_CHOICE",
    completionWindowDays: 4,
    maxReschedules: 1,
    earlyPlayEnabled: true,
    notes:
      "Flexible completion windows with early play allowed. All group matches must finish before qualification closes.",
  },
  GROUP_KNOCKOUT: {
    schedulingMode: "ADMIN_ASSISTED",
    completionWindowDays: 4,
    maxReschedules: 1,
    notes:
      "Use stage overrides: flexible windows for the group stage; fixed primary + backup times, short confirmation and strict rescheduling for the knockout.",
  },
  ROUND_ROBIN: {
    schedulingMode: "WINDOW",
    completionWindowDays: 5,
    maxReschedules: 2,
    earlyPlayEnabled: true,
    notes: "Round windows with early play; hard deadline per round.",
  },
};

const STAGE_DEFAULTS: Record<string, Partial<RecommendedSettings>> = {
  GROUP: { schedulingMode: "PLAYER_CHOICE", completionWindowDays: 4, maxReschedules: 1, earlyPlayEnabled: true },
  LEAGUE_ROUND: { schedulingMode: "WINDOW", completionWindowDays: 5, maxReschedules: 2 },
  ROUND_OF_32: { schedulingMode: "PLAYER_CHOICE", completionWindowDays: 3, maxReschedules: 1 },
  ROUND_OF_16: { schedulingMode: "PLAYER_CHOICE", completionWindowDays: 3, maxReschedules: 1 },
  QUARTER_FINAL: { schedulingMode: "ADMIN_ASSISTED", completionWindowDays: 2, confirmationWindowHours: 24, maxReschedules: 1 },
  SEMI_FINAL: {
    schedulingMode: "OFFICIAL",
    completionWindowDays: 1,
    confirmationWindowHours: 24,
    maxReschedules: 0,
    notes: "Admin-controlled official time; participant confirmation + check-in; no automatic substitution unless explicitly allowed.",
  },
  FINAL: {
    schedulingMode: "OFFICIAL",
    completionWindowDays: 1,
    confirmationWindowHours: 24,
    maxReschedules: 0,
    notes: "Exact official time, stream/venue info, strong reminders. Any change requires admin approval.",
  },
  THIRD_PLACE: { schedulingMode: "ADMIN_ASSISTED", completionWindowDays: 1, maxReschedules: 0 },
  CUSTOM: {},
};

export function getTournamentTypeDefaults(key: SchedulingFormatKey): RecommendedSettings {
  return { ...BASE, ...FORMAT_DEFAULTS[key] };
}

export function getStageDefaults(stageType: string): Partial<RecommendedSettings> {
  return STAGE_DEFAULTS[stageType] ?? {};
}

/** Merge tournament defaults with a stage override. */
export function getStageResolvedDefaults(
  key: SchedulingFormatKey,
  stageType?: string
): RecommendedSettings {
  const base = getTournamentTypeDefaults(key);
  return stageType ? { ...base, ...getStageDefaults(stageType) } : base;
}
