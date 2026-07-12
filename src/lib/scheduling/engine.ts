/**
 * BWL scheduling engine — pure, deterministic, transparent.
 *
 * Given each participant's availability (as absolute UTC intervals with a
 * confidence status), it finds windows where the *whole* required lineup is
 * simultaneously available for `matchDuration + buffers`, scores them with an
 * inspectable breakdown, and — when no full-lineup window exists — explains
 * why (who blocks it, best partial overlap, which substitute unlocks a slot).
 *
 * Design rules honoured from the spec:
 *  - Never proposes a slot during an explicit UNAVAILABLE / NO_RESPONSE block.
 *  - SHIFT_UNCONFIRMED is excluded unless the tournament opts in.
 *  - Scoring is a weighted sum of visible factors; no hidden penalties.
 */
import {
  type TimeRange,
  intersectMany,
  mergeRanges,
  subtractRanges,
  sortRanges,
} from "./intervals";
import {
  type AvailabilityInterval,
  type AvailabilityStatus,
  type EngineOptions,
  type EngineSide,
  type GenerateResult,
  type NoOverlapAnalysis,
  type OverlapSegment,
  type ScoredSlot,
  type SlotEligibility,
  type SlotScoreFactors,
  type SubstituteOption,
  type SubstituteSolution,
  DEFAULT_WEIGHTS,
} from "./types";

const MINUTE = 60_000;
const DAY = 86_400_000;
const DEFAULT_TZ_OFFSET = 300; // Asia/Karachi (+05:00), no DST

export interface GenerateInput {
  sides: EngineSide[];
  substitutes?: SubstituteOption[];
  options: EngineOptions;
}

// ── Resolved options ─────────────────────────────────────────

interface Resolved {
  durationMs: number;
  preMs: number;
  postMs: number;
  occupiedMs: number; // duration + buffers
  windowStart: number;
  windowEnd: number;
  deadline: number;
  busyByPlayer: Record<string, TimeRange[]>;
  tzOffset: number;
  allowShift: boolean;
  weights: Record<AvailabilityStatus, number>;
  maxSlots: number;
  stepMs: number;
  prefStart: number;
  prefEnd: number;
  lateAfter: number;
  earlyBefore: number;
}

function resolve(opts: EngineOptions): Resolved {
  const preMs = (opts.preMatchBufferMinutes ?? 0) * MINUTE;
  const postMs = (opts.postMatchBufferMinutes ?? 0) * MINUTE;
  const durationMs = opts.matchDurationMinutes * MINUTE;
  const windowStart = opts.windowStart ?? 0;
  const windowEnd = opts.windowEnd ?? Number.MAX_SAFE_INTEGER;
  return {
    durationMs,
    preMs,
    postMs,
    occupiedMs: durationMs + preMs + postMs,
    windowStart,
    windowEnd,
    deadline: opts.deadline ?? (opts.windowEnd ?? windowEnd),
    busyByPlayer: opts.busyByPlayer ?? {},
    tzOffset: opts.timezoneOffsetMinutes ?? DEFAULT_TZ_OFFSET,
    allowShift: opts.allowShiftUnconfirmed ?? false,
    weights: { ...DEFAULT_WEIGHTS, ...(opts.weights ?? {}) },
    maxSlots: opts.maxSlots ?? 6,
    stepMs: (opts.candidateStepMinutes ?? 30) * MINUTE,
    prefStart: opts.preferredHourStart ?? 16,
    prefEnd: opts.preferredHourEnd ?? 22,
    lateAfter: opts.latePenaltyAfterHour ?? 23,
    earlyBefore: opts.earlyPenaltyBeforeHour ?? 9,
  };
}

// ── Eligibility helpers ──────────────────────────────────────

function isEligible(status: AvailabilityStatus, r: Resolved): boolean {
  if (status === "UNAVAILABLE" || status === "NO_RESPONSE") return false;
  if (status === "SHIFT_UNCONFIRMED" && !r.allowShift) return false;
  return Number.isFinite(r.weights[status]);
}

/** A player's usable availability: eligible blocks, clipped to the window, minus busy time. Status preserved on each surviving piece. */
function eligibleIntervalsFor(
  playerId: string,
  intervals: AvailabilityInterval[],
  r: Resolved
): AvailabilityInterval[] {
  const busy = r.busyByPlayer[playerId] ?? [];
  const out: AvailabilityInterval[] = [];
  for (const iv of intervals) {
    if (!isEligible(iv.status, r)) continue;
    const clippedStart = Math.max(iv.start, r.windowStart);
    const clippedEnd = Math.min(iv.end, r.windowEnd);
    if (clippedEnd <= clippedStart) continue;
    // Remove busy time, preserving status on remaining pieces.
    const pieces = subtractRanges([{ start: clippedStart, end: clippedEnd }], busy);
    for (const p of pieces) out.push({ start: p.start, end: p.end, status: iv.status });
  }
  return sortRanges(out) as AvailabilityInterval[];
}

/** Worst (lowest-weight) status covering the whole [start,end); null if a gap exists. */
function effectiveStatusOver(
  intervals: AvailabilityInterval[],
  start: number,
  end: number,
  r: Resolved
): AvailabilityStatus | null {
  const covering = intervals.filter((iv) => iv.start < end && iv.end > start);
  if (covering.length === 0) return null;
  const merged = mergeRanges(covering);
  if (!merged.some((m) => m.start <= start && m.end >= end)) return null;
  return covering.reduce<AvailabilityStatus>(
    (worst, iv) => (r.weights[iv.status] < r.weights[worst] ? iv.status : worst),
    covering[0].status
  );
}

function localHour(epochMs: number, tzOffsetMin: number): number {
  return new Date(epochMs + tzOffsetMin * MINUTE).getUTCHours();
}

function localDayKey(epochMs: number, tzOffsetMin: number): number {
  return Math.floor((epochMs + tzOffsetMin * MINUTE) / DAY);
}

// ── Core: build & score slots for a fixed lineup ─────────────

interface LineupPlayer {
  playerId: string;
  displayName?: string;
  eligible: AvailabilityInterval[];
  isSubstitute?: boolean;
}

function buildLineup(
  players: { playerId: string; displayName?: string; intervals: AvailabilityInterval[]; isSubstitute?: boolean }[],
  r: Resolved
): LineupPlayer[] {
  return players.map((p) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    isSubstitute: p.isSubstitute,
    eligible: eligibleIntervalsFor(p.playerId, p.intervals, r),
  }));
}

function commonRangesFor(lineup: LineupPlayer[]): TimeRange[] {
  return intersectMany(lineup.map((p) => p.eligible.map((iv) => ({ start: iv.start, end: iv.end }))));
}

function scoreSlot(
  occStart: number,
  lineup: LineupPlayer[],
  r: Resolved
): ScoredSlot {
  const occEnd = occStart + r.occupiedMs;
  const kickoff = occStart + r.preMs;
  const matchEnd = kickoff + r.durationMs;

  const perPlayerStatus: Record<string, AvailabilityStatus> = {};
  let weightSum = 0;
  let confirmedCount = 0;
  let anyLower = false;
  let usesSub = false;
  const subIds: string[] = [];

  for (const p of lineup) {
    // Evaluate status over the whole occupied range (buffers included) for safety.
    const status = effectiveStatusOver(p.eligible, occStart, occEnd, r) ?? "UNAVAILABLE";
    perPlayerStatus[p.playerId] = status;
    weightSum += r.weights[status] === Number.NEGATIVE_INFINITY ? 0 : r.weights[status];
    if (status === "CONFIRMED") confirmedCount++;
    else anyLower = true;
    if (p.isSubstitute) {
      usesSub = true;
      subIds.push(p.playerId);
    }
  }

  const n = lineup.length;
  const confirmation = weightSum / n; // 0..100
  // Earliness: earlier within the window scores higher.
  const span = Math.max(r.windowEnd - r.windowStart, 1);
  const earliness =
    r.windowEnd === Number.MAX_SAFE_INTEGER
      ? 60 // neutral when window is open-ended
      : Math.max(0, Math.min(100, (1 - (occStart - r.windowStart) / span) * 100));
  // Time-of-day preference.
  const hour = localHour(kickoff, r.tzOffset);
  let timeOfDay: number;
  if (hour >= r.prefStart && hour <= r.prefEnd) timeOfDay = 100;
  else if (hour >= r.lateAfter || hour < r.earlyBefore) timeOfDay = 25;
  else timeOfDay = 65;

  const substitutePenalty = usesSub ? 20 : 0;

  const factors: SlotScoreFactors = { confirmation, earliness, timeOfDay, substitutePenalty };
  const score = Math.max(
    0,
    Math.min(100, 0.6 * confirmation + 0.2 * earliness + 0.2 * timeOfDay - substitutePenalty)
  );

  const eligibility: SlotEligibility = usesSub
    ? "REQUIRES_SUBSTITUTE"
    : anyLower
    ? "PARTIAL"
    : "ELIGIBLE";

  return {
    start: occStart,
    end: occEnd,
    kickoff,
    matchEnd,
    score: Math.round(score * 10) / 10,
    rank: 0,
    eligibility,
    isPrimary: false,
    isBackup: false,
    requiresSubstitute: usesSub,
    substitutePlayerIds: subIds,
    confirmedCount,
    totalParticipants: n,
    perPlayerStatus,
    factors,
    explanation: buildExplanation(confirmedCount, n, hour, usesSub, r),
  };
}

function buildExplanation(
  confirmedCount: number,
  n: number,
  hour: number,
  usesSub: boolean,
  r: Resolved
): string {
  const parts: string[] = [];
  if (confirmedCount === n) parts.push(`all ${n} participant(s) marked this time confirmed-available`);
  else parts.push(`${confirmedCount}/${n} participant(s) confirmed (others likely / if-needed)`);
  if (hour >= r.prefStart && hour <= r.prefEnd) parts.push("falls in the preferred evening window");
  else if (hour >= r.lateAfter || hour < r.earlyBefore) parts.push("is at an unsociable hour (penalised)");
  if (usesSub) parts.push("requires a registered substitute (penalised)");
  return parts.join("; ") + ".";
}

/** Enumerate candidate slot starts inside each common window, respecting the step and window. */
function candidateStarts(common: TimeRange[], r: Resolved): number[] {
  const starts = new Set<number>();
  for (const range of common) {
    const latest = range.end - r.occupiedMs;
    if (latest < range.start) continue; // window too short
    for (let t = range.start; t <= latest; t += r.stepMs) starts.add(t);
    starts.add(latest); // always offer the latest fit
  }
  return [...starts].sort((a, b) => a - b);
}

/** Pick a diverse, ranked set of slots from scored candidates. */
function selectSlots(scored: ScoredSlot[], r: Resolved): ScoredSlot[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score || a.kickoff - b.kickoff);
  const chosen: ScoredSlot[] = [];
  for (const s of sorted) {
    if (chosen.length >= r.maxSlots) break;
    // Enforce variety: keep kickoffs at least one match-duration apart.
    if (chosen.some((c) => Math.abs(c.kickoff - s.kickoff) < r.durationMs)) continue;
    chosen.push(s);
  }
  // Assign primary / backup / ranks.
  chosen.forEach((s, i) => (s.rank = i + 1));
  if (chosen[0]) chosen[0].isPrimary = true;
  const primaryDay = chosen[0] ? localDayKey(chosen[0].kickoff, r.tzOffset) : null;
  const backup =
    chosen.find((s, i) => i > 0 && localDayKey(s.kickoff, r.tzOffset) !== primaryDay) ?? chosen[1];
  if (backup) backup.isBackup = true;
  return chosen;
}

// ── No-overlap analysis ──────────────────────────────────────

/** Sweep line producing the maximal simultaneous-coverage segments. */
function coverageSegments(lineup: LineupPlayer[]): OverlapSegment[] {
  type Ev = { t: number; delta: number; playerId: string };
  const evs: Ev[] = [];
  for (const p of lineup) {
    for (const iv of mergeRanges(p.eligible)) {
      evs.push({ t: iv.start, delta: 1, playerId: p.playerId });
      evs.push({ t: iv.end, delta: -1, playerId: p.playerId });
    }
  }
  evs.sort((a, b) => a.t - b.t || a.delta - b.delta);
  const segments: OverlapSegment[] = [];
  const active = new Set<string>();
  let prev: number | null = null;
  for (const e of evs) {
    if (prev != null && e.t > prev && active.size > 0) {
      segments.push({ start: prev, end: e.t, count: active.size, playerIds: [...active] });
    }
    if (e.delta === 1) active.add(e.playerId);
    else active.delete(e.playerId);
    prev = e.t;
  }
  return segments;
}

function analyzeNoOverlap(
  requiredLineup: LineupPlayer[],
  substitutes: SubstituteOption[],
  sides: EngineSide[],
  r: Resolved
): NoOverlapAnalysis {
  const n = requiredLineup.length;

  // Which single player, if removed, unlocks a full (n-1) overlap of `occupiedMs`?
  const blockingPlayerIds: string[] = [];
  if (n > 1) {
    for (const p of requiredLineup) {
      const rest = requiredLineup.filter((x) => x.playerId !== p.playerId);
      const common = commonRangesFor(rest);
      if (common.some((c) => c.end - c.start >= r.occupiedMs)) blockingPlayerIds.push(p.playerId);
    }
  }

  // Best simultaneous overlap (may be < n players).
  const segments = coverageSegments(requiredLineup);
  const maxCount = segments.reduce((m, s) => Math.max(m, s.count), 0);
  const topSegments = segments.filter((s) => s.count === maxCount);
  const bestPartial =
    maxCount > 0
      ? {
          count: maxCount,
          total: n,
          playerIds: [...new Set(topSegments.flatMap((s) => s.playerIds))],
          ranges: mergeRanges(topSegments),
        }
      : null;

  // Substitute solutions: replace a same-side starter with a candidate sub and re-check overlap.
  const substituteSolutions: SubstituteSolution[] = [];
  for (const sub of substitutes) {
    const side = sides.find((s) => s.sideId === sub.sideId);
    if (!side) continue;
    const targets = sub.replacesPlayerId
      ? side.players.filter((pl) => pl.playerId === sub.replacesPlayerId)
      : side.players;
    for (const target of targets) {
      const swapped = buildAlternateLineup(sides, r, [{ sideId: sub.sideId, out: target.playerId, sub }]);
      const common = commonRangesFor(swapped);
      const fits = common.filter((c) => c.end - c.start >= r.occupiedMs);
      if (fits.length > 0) {
        substituteSolutions.push({
          sideId: sub.sideId,
          substitutePlayerId: sub.participant.playerId,
          replacesPlayerId: target.playerId,
          slotCount: fits.length,
          bestSlotStart: Math.min(...fits.map((f) => f.start)),
        });
      }
    }
  }

  const reason =
    maxCount < n
      ? `No time works for all ${n} participants at once — best simultaneous overlap is ${maxCount}/${n}.`
      : `Overlap exists but no window is long enough for ${r.occupiedMs / MINUTE} min (match + buffers).`;

  return {
    blockingPlayerIds,
    bestPartial,
    substituteSolutions,
    nearestPartialSegments: topSegments.sort((a, b) => a.start - b.start).slice(0, 5),
    reason,
  };
}

/** Rebuild the full lineup with specified substitutions applied. */
function buildAlternateLineup(
  sides: EngineSide[],
  r: Resolved,
  swaps: { sideId: string; out: string; sub: SubstituteOption }[]
): LineupPlayer[] {
  const players: { playerId: string; displayName?: string; intervals: AvailabilityInterval[]; isSubstitute?: boolean }[] = [];
  for (const side of sides) {
    for (const pl of side.players) {
      const swap = swaps.find((s) => s.sideId === side.sideId && s.out === pl.playerId);
      if (swap) {
        players.push({
          playerId: swap.sub.participant.playerId,
          displayName: swap.sub.participant.displayName,
          intervals: swap.sub.participant.intervals,
          isSubstitute: true,
        });
      } else {
        players.push({ playerId: pl.playerId, displayName: pl.displayName, intervals: pl.intervals });
      }
    }
  }
  return buildLineup(players, r);
}

// ── Public entry point ───────────────────────────────────────

/**
 * Generate ranked, scored proposed slots for a match.
 * Returns full-lineup slots when possible; otherwise attempts substitute-based
 * lineups and always returns a `NoOverlapAnalysis` for the admin.
 */
export function generateProposedSlots(input: GenerateInput): GenerateResult {
  const r = resolve(input.options);
  const substitutes = input.substitutes ?? [];
  const allPlayers = input.sides.flatMap((s) => s.players);
  const requiredLineup = buildLineup(allPlayers, r);
  const totalParticipants = requiredLineup.length;

  if (totalParticipants === 0) {
    return { slots: [], eligibleFullLineup: false, totalParticipants: 0, analysis: null };
  }

  // 1) Full required lineup.
  const common = commonRangesFor(requiredLineup);
  const starts = candidateStarts(common, r);
  if (starts.length > 0) {
    const scored = starts.map((t) => scoreSlot(t, requiredLineup, r));
    return {
      slots: selectSlots(scored, r),
      eligibleFullLineup: true,
      totalParticipants,
      analysis: null,
    };
  }

  // 2) No full-lineup overlap — analyse and try substitutes.
  const analysis = analyzeNoOverlap(requiredLineup, substitutes, input.sides, r);

  const subSlots: ScoredSlot[] = [];
  for (const sol of analysis.substituteSolutions) {
    const sub = substitutes.find(
      (s) => s.participant.playerId === sol.substitutePlayerId && s.sideId === sol.sideId
    );
    if (!sub) continue;
    const swapped = buildAlternateLineup(input.sides, r, [
      { sideId: sol.sideId, out: sol.replacesPlayerId, sub },
    ]);
    const subCommon = commonRangesFor(swapped);
    for (const t of candidateStarts(subCommon, r)) subSlots.push(scoreSlot(t, swapped, r));
  }

  return {
    slots: subSlots.length > 0 ? selectSlots(subSlots, r) : [],
    eligibleFullLineup: false,
    totalParticipants,
    analysis,
  };
}

/**
 * Convenience: does a fixed set of participants share any window long enough?
 * Used for quick "any overlap?" checks (e.g. dashboards) without full scoring.
 */
export function hasCommonSlot(sides: EngineSide[], options: EngineOptions): boolean {
  const r = resolve(options);
  const lineup = buildLineup(
    sides.flatMap((s) => s.players),
    r
  );
  return commonRangesFor(lineup).some((c) => c.end - c.start >= r.occupiedMs);
}
