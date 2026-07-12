// Pure label + colour maps for scheduling statuses. No server/Prisma imports,
// safe on the client. Colours pair with text so status is never colour-only.

export interface Meta {
  label: string;
  cls: string;
}

export const SCHEDULING_STATUS_META: Record<string, Meta> = {
  FIXTURE_CREATED: { label: "Not started", cls: "bg-muted text-muted-foreground" },
  AWAITING_AVAILABILITY: { label: "Awaiting availability", cls: "bg-muted text-muted-foreground" },
  AVAILABILITY_INCOMPLETE: { label: "Availability incomplete", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  CALCULATING_OVERLAP: { label: "Calculating", cls: "bg-muted text-muted-foreground" },
  NO_COMMON_TIME: { label: "No common time", cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
  PROPOSED: { label: "Times proposed", cls: "bg-sky-500/15 text-sky-300 border border-sky-500/30" },
  AWAITING_SELECTION: { label: "Awaiting selection", cls: "bg-sky-500/15 text-sky-300 border border-sky-500/30" },
  AWAITING_CONFIRMATION: { label: "Awaiting confirmation", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  PARTIALLY_CONFIRMED: { label: "Partially confirmed", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  FULLY_CONFIRMED: { label: "All confirmed", cls: "bg-green-500/15 text-green-300 border border-green-500/30" },
  SCHEDULED: { label: "Scheduled", cls: "bg-green-500/15 text-green-300 border border-green-500/30" },
  RESCHEDULE_REQUESTED: { label: "Reschedule requested", cls: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
  RESCHEDULE_REVIEW: { label: "Reschedule review", cls: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
  RESCHEDULED: { label: "Rescheduled", cls: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
  SUBSTITUTE_REQUESTED: { label: "Substitute requested", cls: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
  SUBSTITUTE_PENDING: { label: "Substitute pending", cls: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
  SUBSTITUTE_APPROVED: { label: "Substitute approved", cls: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
  CHECK_IN_OPEN: { label: "Check-in open", cls: "bg-sky-500/15 text-sky-300 border border-sky-500/30" },
  PLAYER_LATE: { label: "Player late", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  NO_SHOW_REVIEW: { label: "No-show review", cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
  WALKOVER_PROPOSED: { label: "Walkover proposed", cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
  ADMIN_DECISION: { label: "Needs admin", cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
  COMPLETED: { label: "Completed", cls: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

export function schedulingStatusMeta(status: string | null | undefined): Meta {
  return SCHEDULING_STATUS_META[status ?? "FIXTURE_CREATED"] ?? { label: status ?? "—", cls: "bg-muted text-muted-foreground" };
}

export const CONFIRMATION_META: Record<string, Meta> = {
  PENDING: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  CONFIRMED: { label: "Confirmed", cls: "bg-green-500/15 text-green-300 border border-green-500/30" },
  REJECTED: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
  TENTATIVE: { label: "Tentative", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  NO_RESPONSE: { label: "No response", cls: "bg-muted text-muted-foreground" },
  SUBSTITUTE: { label: "Substitute", cls: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
};

export function confirmationMeta(status: string | null | undefined): Meta {
  return CONFIRMATION_META[status ?? "PENDING"] ?? { label: status ?? "—", cls: "bg-muted text-muted-foreground" };
}

export const REJECT_REASONS: { value: string; label: string }[] = [
  { value: "CANNOT_ATTEND", label: "Can't attend this time" },
  { value: "DUTY_CHANGED", label: "Duty / shift changed" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "SUGGEST_OTHER", label: "Prefer another proposed time" },
  { value: "OTHER", label: "Other" },
];
