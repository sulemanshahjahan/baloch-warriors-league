import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import slugifyLib from "slugify";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return slugifyLib(text, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export type GameCategory =
  | "FOOTBALL"
  | "EFOOTBALL"
  | "PUBG"
  | "SNOOKER"
  | "CHECKERS";

export type TournamentStatus =
  | "DRAFT"
  | "UPCOMING"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export type MatchStatus = "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";

const GAME_LABELS: Record<GameCategory, string> = {
  FOOTBALL: "Football",
  EFOOTBALL: "eFootball",
  PUBG: "PUBG",
  SNOOKER: "Snooker",
  CHECKERS: "Checkers",
};

const STATUS_LABELS: Record<TournamentStatus | MatchStatus, string> = {
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  REGISTRATION_OPEN: "Registration Open",
  REGISTRATION_CLOSED: "Registration Closed",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  POSTPONED: "Postponed",
};

const GAME_COLORS: Record<GameCategory, string> = {
  FOOTBALL: "bg-green-500/10 text-green-500",
  EFOOTBALL: "bg-blue-500/10 text-blue-500",
  PUBG: "bg-orange-500/10 text-orange-500",
  SNOOKER: "bg-red-500/10 text-red-500",
  CHECKERS: "bg-gray-500/10 text-gray-500",
};

const STATUS_COLORS: Record<TournamentStatus | MatchStatus, string> = {
  DRAFT: "bg-gray-500/10 text-gray-500",
  UPCOMING: "bg-blue-500/10 text-blue-500",
  REGISTRATION_OPEN: "bg-green-500/10 text-green-500",
  REGISTRATION_CLOSED: "bg-yellow-500/10 text-yellow-500",
  ACTIVE: "bg-green-500/10 text-green-500",
  COMPLETED: "bg-gray-500/10 text-gray-500",
  CANCELLED: "bg-red-500/10 text-red-500",
  SCHEDULED: "bg-yellow-500/10 text-yellow-500",
  LIVE: "bg-red-500/10 text-red-500 animate-pulse",
  POSTPONED: "bg-orange-500/10 text-orange-500",
};

export function gameLabel(game: GameCategory): string {
  return GAME_LABELS[game] ?? game;
}

export function statusLabel(status: TournamentStatus | MatchStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function gameColor(game: GameCategory): string {
  return GAME_COLORS[game] ?? "bg-gray-500/10 text-gray-500";
}

export function statusColor(status: TournamentStatus | MatchStatus): string {
  return STATUS_COLORS[status] ?? "bg-gray-500/10 text-gray-500";
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(
  date: Date | string | null | undefined
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLabel(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get display name for a knockout round based on stored round name and round number.
 * Handles proper labeling for all knockout stages with match numbers.
 * 
 * Round number mapping for typical tournaments:
 * - Round 1: Round of 16 (16 players) OR Quarter-finals (8 players)
 * - Round 2: Quarter-finals (16 players) OR Semi-finals (8 players) OR Final (4 players)
 * - Round 3: Semi-finals (16 players) OR Final (8 players)
 * - Round 4: Final (16 players)
 * 
 * For small tournaments (4 players in knockout):
 * - Round 1: Semi-finals
 * - Round 2: Final
 */
export function getRoundDisplayName(
  round: string | null | undefined,
  roundNumber: number | null | undefined,
  matchNumber: number | null | undefined = null,
  totalRounds: number | null | undefined = null,
  isOnlyMatchInRound: boolean = false
): string {
  // Normalize inputs - handle undefined
  const safeRound = round ?? null;
  const safeRoundNumber = roundNumber ?? null;
  const safeMatchNumber = matchNumber ?? null;
  const safeTotalRounds = totalRounds ?? null;
  
  // If round already has a proper descriptive name, use it and add match number
  if (safeRound) {
    const lowerRound = safeRound.toLowerCase();
    
    // Check for already descriptive round names
    if (lowerRound.includes("final")) {
      // Could be "Final", "Semi Final", "Quarter Final", etc.
      return formatRoundWithMatchNumber(round, matchNumber);
    }
    
    if (lowerRound.includes("semi")) {
      return formatRoundWithMatchNumber("Semi Final", matchNumber);
    }
    
    if (lowerRound.includes("quarter")) {
      return formatRoundWithMatchNumber("Quarter Final", matchNumber);
    }
    
    if (lowerRound.includes("round of 16") || lowerRound.includes("16")) {
      return formatRoundWithMatchNumber("Round of 16", matchNumber);
    }
    
    // Group stage matches - keep as is
    if (lowerRound.includes("group")) {
      return safeRound;
    }
    
    // If it's "Round X" format, try to determine based on context
    const roundMatch = safeRound.match(/^round\s*(\d+)$/i);
    if (roundMatch) {
      const num = parseInt(roundMatch[1], 10);
      
      // HEURISTIC: In many tournaments, the Final is incorrectly stored as "Round 2" or "Round 3"
      // with matchNumber=1, while earlier rounds have matchNumber > 1 or descriptive names.
      // If we see "Round X" with matchNumber=1 and no descriptive name, and the roundNumber
      // is reasonably high (2+), it's likely the Final.
      // This fixes data inconsistency where finals weren't properly labeled.
      if (safeMatchNumber === 1 && num >= 2) {
        // Likely a final - this is an educated guess for mislabeled data
        return "Final";
      }
      
      // Try to infer based on total rounds if available
      if (safeTotalRounds) {
        return inferRoundNameFromTotalRounds(num, safeTotalRounds, safeMatchNumber);
      }
      
      // Otherwise use the simple heuristic based on round number alone
      return inferRoundNameFromNumber(num, safeMatchNumber);
    }
    
    // Any other round name, return as-is with match number if provided
    return formatRoundWithMatchNumber(safeRound, safeMatchNumber);
  }
  
  // No round name, try to infer from roundNumber
  if (safeRoundNumber) {
    if (safeTotalRounds) {
      return inferRoundNameFromTotalRounds(safeRoundNumber, safeTotalRounds, safeMatchNumber);
    }
    return inferRoundNameFromNumber(safeRoundNumber, safeMatchNumber);
  }
  
  // Default fallback
  return safeMatchNumber ? `Match ${safeMatchNumber}` : "Match";
}

/**
 * Format a round name with optional match number
 */
function formatRoundWithMatchNumber(roundName: string, matchNumber: number | null): string {
  if (!matchNumber) return roundName;
  return `${roundName} ${matchNumber}`;
}

/**
 * Infer round name from round number when we know the total rounds in tournament.
 * This gives us accurate names (Final, Semi-final, etc.)
 */
function inferRoundNameFromTotalRounds(currentRound: number, totalRounds: number, matchNumber: number | null): string {
  // The final is always the highest round number
  const roundsFromFinal = totalRounds - currentRound;
  
  switch (roundsFromFinal) {
    case 0: // Final round
      return "Final";
    case 1: // One round before final = Semi-finals
      return formatRoundWithMatchNumber("Semi Final", matchNumber);
    case 2: // Two rounds before final = Quarter-finals
      return formatRoundWithMatchNumber("Quarter Final", matchNumber);
    case 3: // Three rounds before final = Round of 16
      return formatRoundWithMatchNumber("Round of 16", matchNumber);
    default:
      return formatRoundWithMatchNumber(`Round ${currentRound}`, matchNumber);
  }
}

/**
 * Infer round name from round number based on typical tournament structures.
 * This is a best guess when we don't have total rounds context.
 * 
 * Heuristic: Lower round numbers with higher match numbers often indicate earlier rounds.
 * But this is imperfect - use inferRoundNameFromTotalRounds when possible.
 */
function inferRoundNameFromNumber(roundNum: number, matchNumber: number | null): string {
  // Simple heuristic: assume common tournament sizes
  // If we see Round 2 with match numbers 1-4, it's likely Quarter-finals
  // If we see Round 2 with match numbers 1-2, it's likely Semi-finals
  // If we see Round 3 with match number 1, it's likely the Final
  
  switch (roundNum) {
    case 1:
      // Could be Round of 16 or Quarter-finals
      return formatRoundWithMatchNumber("Round 1", matchNumber);
    case 2:
      // Most common: Quarter-finals (4 matches) or Semi-finals (2 matches) or Final (1 match)
      // Without match context, default to generic
      return formatRoundWithMatchNumber("Round 2", matchNumber);
    case 3:
      // Likely Semi-finals or Final
      return formatRoundWithMatchNumber("Round 3", matchNumber);
    case 4:
      // Almost certainly the Final
      return "Final";
    default:
      return formatRoundWithMatchNumber(`Round ${roundNum}`, matchNumber);
  }
}

export type ActionResult<T = void> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };
