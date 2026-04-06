// Helper functions for activity log formatting
// This is NOT a server actions file - just regular utilities

export function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE: "Created",
    UPDATE: "Updated",
    DELETE: "Deleted",
    LOGIN: "Logged in",
    LOGOUT: "Logged out",
    PUBLISH: "Published",
    UNPUBLISH: "Unpublished",
    ENROLL: "Enrolled",
    UNENROLL: "Unenrolled",
    SCHEDULE: "Scheduled",
    RESCHEDULE: "Rescheduled",
    COMPLETE: "Completed",
    START: "Started",
    CANCEL: "Cancelled",
    POSTPONE: "Postponed",
    ASSIGN_AWARD: "Assigned award",
    REMOVE_AWARD: "Removed award",
    ADD_EVENT: "Added event",
    REMOVE_EVENT: "Removed event",
    ACTIVATE: "Activated",
    DEACTIVATE: "Deactivated",
  };
  return labels[action] ?? action;
}

export function formatEntityLabel(type: string): string {
  const labels: Record<string, string> = {
    TOURNAMENT: "Tournament",
    MATCH: "Match",
    TEAM: "Team",
    PLAYER: "Player",
    NEWS: "News Post",
    VENUE: "Venue",
    SEASON: "Season",
    ADMIN_USER: "Admin User",
    AWARD: "Award",
    STANDING: "Standing",
    GROUP: "Group",
  };
  return labels[type] ?? type;
}
