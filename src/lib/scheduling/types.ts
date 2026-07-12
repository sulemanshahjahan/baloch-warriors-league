/**
 * Engine-facing types. Deliberately decoupled from Prisma so the scheduling
 * math can be unit-tested in isolation and reused on the client. The action
 * layer maps Prisma rows → these plain shapes and back.
 */
import type { TimeRange } from "./intervals";

export type AvailabilityStatus =
  | "CONFIRMED"
  | "LIKELY"
  | "UNAVAILABLE"
  | "SHIFT_UNCONFIRMED"
  | "IF_NEEDED"
  | "NO_RESPONSE";

export type SlotEligibility =
  | "ELIGIBLE"
  | "PARTIAL"
  | "REQUIRES_SUBSTITUTE"
  | "INELIGIBLE";

/** A single availability window for one player, as absolute UTC instants. */
export interface AvailabilityInterval extends TimeRange {
  status: AvailabilityStatus;
}

export interface EngineParticipant {
  playerId: string;
  /** Groups players into sides — "home"/"away" for 1v1, or the duo teamId for 2v2. */
  sideId: string;
  displayName?: string;
  intervals: AvailabilityInterval[];
  isSubstitute?: boolean;
}

export interface EngineSide {
  sideId: string;
  teamId?: string | null;
  players: EngineParticipant[];
}

export interface SubstituteOption {
  sideId: string;
  /** Optional: which starter this sub is standing in for. If omitted, the
   *  engine tries replacing each same-side starter in turn. */
  replacesPlayerId?: string;
  participant: EngineParticipant;
}

/**
 * Default availability weights. Follows the spec ordering:
 * Confirmed > Available-if-needed > Likely; Shift-unconfirmed only when
 * explicitly allowed (weight 0); Unavailable / No-response never eligible.
 * All overridable per tournament.
 */
export const DEFAULT_WEIGHTS: Record<AvailabilityStatus, number> = {
  CONFIRMED: 100,
  IF_NEEDED: 50,
  LIKELY: 40,
  SHIFT_UNCONFIRMED: 0,
  UNAVAILABLE: Number.NEGATIVE_INFINITY,
  NO_RESPONSE: Number.NEGATIVE_INFINITY,
};

export interface EngineOptions {
  matchDurationMinutes: number;
  preMatchBufferMinutes?: number;
  postMatchBufferMinutes?: number;
  /** Overall completion window. Slots outside are never generated. */
  windowStart?: number;
  windowEnd?: number;
  /** Completion deadline used for proximity scoring (defaults to windowEnd). */
  deadline?: number;
  /** Already-scheduled matches / rest blocks per player — treated as unavailable. */
  busyByPlayer?: Record<string, TimeRange[]>;
  /** Fixed offset for local-hour scoring. PKT = +300 (no DST). */
  timezoneOffsetMinutes?: number;
  /** Whether SHIFT_UNCONFIRMED blocks may be used automatically. Default false. */
  allowShiftUnconfirmed?: boolean;
  weights?: Partial<Record<AvailabilityStatus, number>>;
  /** Max distinct slots to return (primary + backup + alternatives). Default 6. */
  maxSlots?: number;
  /** Candidate start granularity within a common window. Default 30 min. */
  candidateStepMinutes?: number;
  /** Preferred local play window (bonus). Defaults 16:00–22:00. */
  preferredHourStart?: number;
  preferredHourEnd?: number;
  /** Penalise very late / very early local kickoffs. */
  latePenaltyAfterHour?: number; // default 23
  earlyPenaltyBeforeHour?: number; // default 9
}

export interface SlotScoreFactors {
  confirmation: number; // 0..100 — avg availability weight of participants
  earliness: number; // 0..100 — earlier within the window scores higher
  timeOfDay: number; // 0..100 — preferred hours score higher
  substitutePenalty: number; // subtracted
}

export interface ScoredSlot {
  /** Occupied range including buffers. */
  start: number;
  end: number;
  /** Actual match kickoff / end (inside the occupied range). */
  kickoff: number;
  matchEnd: number;
  score: number; // 0..100
  rank: number; // 1-based, assigned after sorting
  eligibility: SlotEligibility;
  isPrimary: boolean;
  isBackup: boolean;
  requiresSubstitute: boolean;
  substitutePlayerIds: string[];
  confirmedCount: number;
  totalParticipants: number;
  perPlayerStatus: Record<string, AvailabilityStatus>;
  factors: SlotScoreFactors;
  explanation: string;
}

export interface OverlapSegment {
  start: number;
  end: number;
  count: number;
  playerIds: string[];
}

export interface SubstituteSolution {
  sideId: string;
  substitutePlayerId: string;
  replacesPlayerId: string;
  slotCount: number;
  bestSlotStart: number | null;
}

export interface NoOverlapAnalysis {
  /** Players whose availability, if removed, would unlock a full-lineup slot. */
  blockingPlayerIds: string[];
  /** Best simultaneous overlap achievable (may be fewer than all players). */
  bestPartial: {
    count: number;
    total: number;
    playerIds: string[];
    ranges: TimeRange[];
  } | null;
  /** Substitutions that create an eligible full lineup. */
  substituteSolutions: SubstituteSolution[];
  /** Nearest partial windows (max simultaneous coverage), for admin display. */
  nearestPartialSegments: OverlapSegment[];
  /** True when relaxing to LIKELY / IF_NEEDED (vs CONFIRMED only) would help. */
  reason: string;
}

export interface GenerateResult {
  slots: ScoredSlot[];
  /** True when at least one slot exists with the full required lineup. */
  eligibleFullLineup: boolean;
  totalParticipants: number;
  analysis: NoOverlapAnalysis | null;
}
