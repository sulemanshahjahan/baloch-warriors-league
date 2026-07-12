/**
 * Pure helpers for the match scheduling state machine. No DB imports — the
 * action layer maps rows in/out, so the transition logic stays testable.
 */

export type SchedulingStatus =
  | "FIXTURE_CREATED"
  | "AWAITING_AVAILABILITY"
  | "AVAILABILITY_INCOMPLETE"
  | "CALCULATING_OVERLAP"
  | "NO_COMMON_TIME"
  | "PROPOSED"
  | "AWAITING_SELECTION"
  | "AWAITING_CONFIRMATION"
  | "PARTIALLY_CONFIRMED"
  | "FULLY_CONFIRMED"
  | "SCHEDULED"
  | "RESCHEDULE_REQUESTED"
  | "RESCHEDULE_REVIEW"
  | "RESCHEDULED"
  | "SUBSTITUTE_REQUESTED"
  | "SUBSTITUTE_PENDING"
  | "SUBSTITUTE_APPROVED"
  | "CHECK_IN_OPEN"
  | "PLAYER_LATE"
  | "NO_SHOW_REVIEW"
  | "WALKOVER_PROPOSED"
  | "ADMIN_DECISION"
  | "COMPLETED"
  | "CANCELLED";

export type ConfirmationState =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "TENTATIVE"
  | "NO_RESPONSE"
  | "SUBSTITUTE";

export interface ConfirmationLike {
  playerId: string;
  status: ConfirmationState;
  proposedSlotId: string | null;
}

export interface AggregateResult {
  status: SchedulingStatus;
  total: number;
  confirmedCount: number;
  rejectedCount: number;
  allConfirmed: boolean;
  needsAttention: boolean;
}

/**
 * Derive the schedule status from the current slots + confirmations.
 * A slot is "agreed" only when every participant has CONFIRMED the currently
 * selected slot — mixed selections never auto-schedule.
 */
export function aggregateSchedulingStatus(input: {
  hasSlots: boolean;
  selectedSlotId: string | null;
  confirmations: ConfirmationLike[];
}): AggregateResult {
  const { hasSlots, selectedSlotId } = input;
  // A SUBSTITUTE-status row marks a replaced player — they no longer count.
  const confirmations = input.confirmations.filter((c) => c.status !== "SUBSTITUTE");
  const total = confirmations.length;
  const rejectedCount = confirmations.filter((c) => c.status === "REJECTED").length;
  const confirmedForSelected = confirmations.filter(
    (c) => c.status === "CONFIRMED" && selectedSlotId != null && c.proposedSlotId === selectedSlotId
  ).length;
  const allConfirmed = total > 0 && confirmedForSelected === total;

  let status: SchedulingStatus;
  if (!hasSlots) status = "NO_COMMON_TIME";
  else if (total === 0) status = "PROPOSED";
  else if (allConfirmed) status = "FULLY_CONFIRMED";
  else if (!selectedSlotId) status = "AWAITING_SELECTION";
  else if (confirmedForSelected > 0) status = "PARTIALLY_CONFIRMED";
  else status = "AWAITING_CONFIRMATION";

  return {
    status,
    total,
    confirmedCount: confirmedForSelected,
    rejectedCount,
    allConfirmed,
    needsAttention: rejectedCount > 0 || status === "NO_COMMON_TIME",
  };
}

/** Statuses from which a match is considered locked-in (a time exists). */
export const SCHEDULED_STATUSES: ReadonlySet<SchedulingStatus> = new Set([
  "SCHEDULED",
  "CHECK_IN_OPEN",
  "COMPLETED",
]);

/** Whether an admin/system may move a schedule into `to`. Guards obvious nonsense. */
export function canTransition(from: SchedulingStatus, to: SchedulingStatus): boolean {
  if (from === to) return true;
  if (from === "COMPLETED" || from === "CANCELLED") return false; // terminal
  return true;
}
