"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { logActivity } from "./activity-log";

// Role hierarchy levels
const ROLE_LEVELS: Record<string, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR: 1,
};

function hasRole(session: { user?: { role?: string } } | null, minRole: string): boolean {
  const userRole = getUserRole(session);
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
}

const matchSchema = z.object({
  tournamentId: z.string().min(1, "Tournament is required"),
  homeTeamId: z.string().optional(),
  awayTeamId: z.string().optional(),
  homePlayerId: z.string().optional(),
  awayPlayerId: z.string().optional(),
  round: z.string().optional(),
  roundNumber: z.coerce.number().int().optional().or(z.literal("")),
  matchNumber: z.coerce.number().int().optional().or(z.literal("")),
  scheduledAt: z.string().optional(),
  venueId: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "POSTPONED"]),
});

const resultSchema = z.object({
  homeScore: z.coerce.number().int().min(0),
  awayScore: z.coerce.number().int().min(0),
  homeScorePens: z.coerce.number().int().min(0).optional().or(z.literal("")),
  awayScorePens: z.coerce.number().int().min(0).optional().or(z.literal("")),
  motmPlayerId: z.string().optional(),
  status: z.enum(["COMPLETED", "LIVE"]),
});

const matchEventSchema = z.object({
  matchId: z.string(),
  playerId: z.string().optional(),
  teamId: z.string().optional(),
  type: z.enum([
    "GOAL", "ASSIST", "YELLOW_CARD", "RED_CARD", "OWN_GOAL",
    "PENALTY_GOAL", "PENALTY_MISS", "CLEAN_SHEET", "MOTM",
    "KILL", "FRAME_WIN", "MVP", "CUSTOM",
  ]),
  minute: z.coerce.number().int().optional().or(z.literal("")),
  value: z.coerce.number().optional().or(z.literal("")),
  description: z.string().optional(),
});

export async function createMatch(formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;

  const match = await prisma.match.create({
    data: {
      tournamentId: data.tournamentId,
      homeTeamId: data.homeTeamId || null,
      awayTeamId: data.awayTeamId || null,
      homePlayerId: data.homePlayerId || null,
      awayPlayerId: data.awayPlayerId || null,
      round: data.round || null,
      roundNumber: data.roundNumber ? Number(data.roundNumber) : null,
      matchNumber: data.matchNumber ? Number(data.matchNumber) : null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      venueId: data.venueId || null,
      notes: data.notes || null,
      status: data.status,
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "MATCH",
    entityId: match.id,
    details: { 
      tournamentId: data.tournamentId,
      round: data.round,
      status: data.status,
    },
  });

  revalidatePath("/admin/matches");
  revalidatePath(`/admin/tournaments/${data.tournamentId}`);
  return { success: true, data: { id: match.id } };
}

export async function updateMatchResult(
  matchId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = resultSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;

  // Get current match data to check tournament type
  const currentMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });

  if (!currentMatch) {
    return { success: false, error: "Match not found" };
  }

  const match = await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      homeScorePens: data.homeScorePens ? Number(data.homeScorePens) : null,
      awayScorePens: data.awayScorePens ? Number(data.awayScorePens) : null,
      motmPlayerId: data.motmPlayerId || null,
      status: data.status,
      completedAt: data.status === "COMPLETED" ? new Date() : null,
    },
    include: { tournament: true },
  });

  // For individual player tournaments (eFootball 1v1), auto-create goal events
  if (currentMatch.tournament.participantType === "INDIVIDUAL" && data.status === "COMPLETED") {
    // Delete existing auto-generated goal events for this match to avoid duplicates
    await prisma.matchEvent.deleteMany({
      where: {
        matchId,
        type: "GOAL",
        description: { equals: "Auto-generated from match result" },
      },
    });

    // Create goal events for home player
    if (currentMatch.homePlayerId && data.homeScore > 0) {
      for (let i = 0; i < data.homeScore; i++) {
        await prisma.matchEvent.create({
          data: {
            matchId,
            playerId: currentMatch.homePlayerId,
            type: "GOAL",
            description: "Auto-generated from match result",
          },
        });
      }
    }

    // Create goal events for away player
    if (currentMatch.awayPlayerId && data.awayScore > 0) {
      for (let i = 0; i < data.awayScore; i++) {
        await prisma.matchEvent.create({
          data: {
            matchId,
            playerId: currentMatch.awayPlayerId,
            type: "GOAL",
            description: "Auto-generated from match result",
          },
        });
      }
    }
  }

  // Recompute standings if match is completed
  if (data.status === "COMPLETED") {
    await recomputeStandings(match.tournamentId);
    
    // Advance winner to next round for knockout matches
    await advanceKnockoutWinner(matchId, match.tournamentId);
  }

  await logActivity({
    action: data.status === "COMPLETED" ? "COMPLETE" : "UPDATE",
    entityType: "MATCH",
    entityId: matchId,
    details: {
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      status: data.status,
      tournamentId: match.tournamentId,
    },
  });

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${match.tournamentId}`);
  revalidatePath("/admin/matches");
  return { success: true, data: undefined };
}

// ─── KNOCKOUT BRACKET PROGRESSION ─────────────────────────────

async function advanceKnockoutWinner(matchId: string, tournamentId: string) {
  // Get the completed match with its round info
  const completedMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });

  if (!completedMatch || !completedMatch.homeScore || !completedMatch.awayScore) return;
  
  // Only process knockout matches (have round numbers > 0 and proper round names)
  const roundName = completedMatch.round || "";
  const isKnockoutMatch = completedMatch.roundNumber && completedMatch.roundNumber > 0 && 
    !roundName.match(/Group\s+[A-Z]/i);
  
  if (!isKnockoutMatch) return;

  // Determine winner
  let winnerId: string | null = null;
  let isWinnerHomePlayer = false;
  
  const homeScore = completedMatch.homeScorePens ?? completedMatch.homeScore;
  const awayScore = completedMatch.awayScorePens ?? completedMatch.awayScore;
  
  if (homeScore > awayScore) {
    winnerId = completedMatch.homePlayerId || completedMatch.homeTeamId;
    isWinnerHomePlayer = !!completedMatch.homePlayerId;
  } else if (awayScore > homeScore) {
    winnerId = completedMatch.awayPlayerId || completedMatch.awayTeamId;
    isWinnerHomePlayer = !!completedMatch.awayPlayerId;
  } else {
    // Draw - no winner to advance
    return;
  }
  
  if (!winnerId) return;

  const isIndividual = completedMatch.tournament.participantType === "INDIVIDUAL";
  const currentRound = completedMatch.roundNumber || 1;
  const nextRound = currentRound + 1;
  
  // Count matches in current round to determine next round name
  const matchesInCurrentRound = await prisma.match.count({
    where: { 
      tournamentId, 
      roundNumber: currentRound,
      status: { not: "CANCELLED" }
    },
  });
  
  // Map match count to next round name
  // 2 matches (semi-finals) -> Final
  // 4 matches (quarter-finals) -> Semi-finals
  // 8 matches (round of 16) -> Quarter-finals
  let nextRoundName: string;
  switch (matchesInCurrentRound) {
    case 2:
      nextRoundName = "Final";
      break;
    case 4:
      nextRoundName = "Semi-finals";
      break;
    case 8:
      nextRoundName = "Quarter-finals";
      break;
    case 16:
      nextRoundName = "Round of 16";
      break;
    default:
      nextRoundName = `Round ${nextRound}`;
  }
  
  // Find existing next round match for this bracket position
  // Match number determines which next match (1&2 -> 1, 3&4 -> 2, etc.)
  // Handle null/undefined matchNumber gracefully - use ID-based fallback
  let matchNumber = completedMatch.matchNumber;
  let nextMatchNumber: number;
  let isHomeSlot: boolean;
  
  if (matchNumber == null) {
    // If matchNumber is null, derive a stable position from match ID
    // Use last 4 hex chars of UUID as a number (0-65535)
    const idSuffix = parseInt(matchId.slice(-4), 16) || 0;
    // Determine slot based on hash of match ID for consistency
    isHomeSlot = (idSuffix % 2) === 0;
    // Create a synthetic match number for calculation
    matchNumber = (idSuffix % 8) + 1; // 1-8 range
    nextMatchNumber = Math.ceil(matchNumber / 2);
    console.warn(`Match ${matchId} has no matchNumber, using derived position ${matchNumber} -> next slot ${nextMatchNumber} (${isHomeSlot ? 'home' : 'away'})`);
  } else {
    nextMatchNumber = Math.ceil(matchNumber / 2);
    isHomeSlot = matchNumber % 2 === 1; // Odd matches go to home, even to away
  }
  
  const existingNextMatch = await prisma.match.findFirst({
    where: {
      tournamentId,
      roundNumber: nextRound,
      matchNumber: nextMatchNumber,
    },
  });
  
  if (existingNextMatch) {
    // Update existing match with winner
    await prisma.match.update({
      where: { id: existingNextMatch.id },
      data: isIndividual
        ? (isHomeSlot ? { homePlayerId: winnerId } : { awayPlayerId: winnerId })
        : (isHomeSlot ? { homeTeamId: winnerId } : { awayTeamId: winnerId }),
    });
  } else {
    // Create new match for next round (including Final)
    await prisma.match.create({
      data: {
        tournamentId,
        round: nextRoundName,
        roundNumber: nextRound,
        matchNumber: nextMatchNumber,
        status: "SCHEDULED",
        ...(isIndividual
          ? (isHomeSlot ? { homePlayerId: winnerId } : { awayPlayerId: winnerId })
          : (isHomeSlot ? { homeTeamId: winnerId } : { awayTeamId: winnerId })),
      },
    });
  }
}

export async function addMatchEvent(formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = matchEventSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const data = parsed.data;

  const event = await prisma.matchEvent.create({
    data: {
      matchId: data.matchId,
      playerId: data.playerId || null,
      teamId: data.teamId || null,
      type: data.type,
      minute: data.minute ? Number(data.minute) : null,
      value: data.value ? Number(data.value) : null,
      description: data.description || null,
    },
  });

  await logActivity({
    action: "ADD_EVENT",
    entityType: "MATCH",
    entityId: data.matchId,
    details: {
      eventId: event.id,
      type: data.type,
      playerId: data.playerId,
      teamId: data.teamId,
    },
  });

  revalidatePath(`/admin/matches/${data.matchId}`);
  return { success: true, data: undefined };
}

export async function deleteMatchEvent(eventId: string, matchId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  await prisma.matchEvent.delete({ where: { id: eventId } });

  await logActivity({
    action: "REMOVE_EVENT",
    entityType: "MATCH",
    entityId: matchId,
    details: { eventId },
  });

  revalidatePath(`/admin/matches/${matchId}`);
  return { success: true, data: undefined };
}

export async function deleteMatch(matchId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  // Get match to find tournament for standings recompute
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { tournamentId: true, status: true },
  });

  if (!match) return { success: false, error: "Match not found" };

  // Delete related data first (events, participants)
  await prisma.matchEvent.deleteMany({ where: { matchId } });
  await prisma.matchParticipant.deleteMany({ where: { matchId } });

  // Delete the match
  await prisma.match.delete({ where: { id: matchId } });

  // Recompute standings if match was completed
  if (match.status === "COMPLETED") {
    await recomputeStandings(match.tournamentId);
  }

  await logActivity({
    action: "DELETE",
    entityType: "MATCH",
    entityId: matchId,
    details: { tournamentId: match.tournamentId },
  });

  revalidatePath("/admin/matches");
  revalidatePath(`/admin/tournaments/${match.tournamentId}`);
  return { success: true, data: undefined };
}

// ─── STANDINGS ENGINE ───────────────────────────────────────

export async function recomputeTournamentStandings(tournamentId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  
  // Only ADMIN and above can recompute standings
  const userRole = (session.user as { role?: string })?.role ?? "EDITOR";
  if (userRole === "EDITOR") {
    return { success: false, error: "Forbidden" };
  }

  // Get tournament type
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { participantType: true, name: true },
  });

  if (!tournament) return { success: false, error: "Tournament not found" };

  if (tournament.participantType === "INDIVIDUAL") {
    await recomputeIndividualStandings(tournamentId);
  } else {
    await recomputeTeamStandings(tournamentId);
  }

  await logActivity({
    action: "UPDATE",
    entityType: "TOURNAMENT",
    entityId: tournamentId,
    details: { action: "RECOMPUTE_STANDINGS", tournamentName: tournament.name },
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true, data: undefined };
}

async function recomputeStandings(tournamentId: string) {
  // Get tournament type
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { participantType: true },
  });

  if (!tournament) return;

  if (tournament.participantType === "INDIVIDUAL") {
    await recomputeIndividualStandings(tournamentId);
  } else {
    await recomputeTeamStandings(tournamentId);
  }
}

async function recomputeTeamStandings(tournamentId: string) {
  // Get all completed matches for this tournament
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: "COMPLETED",
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
  });

  // Get all enrolled teams with their group assignments
  const enrolled = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    select: { teamId: true, groupId: true },
  });

  // Initialize stats for overall and per-group
  const overallStats: Record<string, PlayerStats> = {};
  const groupStats: Record<string, Record<string, PlayerStats>> = {}; // groupId -> teamId -> stats

  // Initialize enrolled teams with 0 stats
  for (const { teamId, groupId } of enrolled) {
    overallStats[teamId] = createEmptyStats();
    if (groupId) {
      if (!groupStats[groupId]) groupStats[groupId] = {};
      groupStats[groupId][teamId] = createEmptyStats();
    }
  }

  // Process matches
  for (const match of matches) {
    const homeId = match.homeTeamId!;
    const awayId = match.awayTeamId!;
    const hg = match.homeScore ?? 0;
    const ag = match.awayScore ?? 0;

    // Add to overall stats
    addMatchToStats(overallStats, homeId, awayId, hg, ag);

    // Add to group stats if match belongs to a group
    if (match.groupId) {
      if (!groupStats[match.groupId]) groupStats[match.groupId] = {};
      if (!groupStats[match.groupId][homeId]) groupStats[match.groupId][homeId] = createEmptyStats();
      if (!groupStats[match.groupId][awayId]) groupStats[match.groupId][awayId] = createEmptyStats();
      addMatchToStats(groupStats[match.groupId], homeId, awayId, hg, ag);
    }
  }

  // Delete existing standings for this tournament, then recreate
  await prisma.standing.deleteMany({ where: { tournamentId } });

  // Create overall standings (no groupId)
  for (const [teamId, s] of Object.entries(overallStats)) {
    s.goalDiff = s.goalsFor - s.goalsAgainst;
    await prisma.standing.create({
      data: { tournamentId, teamId, ...s },
    });
  }

  // Create per-group standings
  for (const [groupId, teams] of Object.entries(groupStats)) {
    for (const [teamId, s] of Object.entries(teams)) {
      s.goalDiff = s.goalsFor - s.goalsAgainst;
      await prisma.standing.create({
        data: { tournamentId, groupId, teamId, ...s },
      });
    }
  }
}

interface PlayerStats {
  played: number; won: number; drawn: number; lost: number;
  points: number; goalsFor: number; goalsAgainst: number;
  goalDiff: number; cleanSheets: number;
}

function createEmptyStats(): PlayerStats {
  return {
    played: 0, won: 0, drawn: 0, lost: 0,
    points: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, cleanSheets: 0,
  };
}

function addMatchToStats(
  stats: Record<string, PlayerStats>,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number
) {
  if (!stats[homeId] || !stats[awayId]) return;

  stats[homeId].played++;
  stats[awayId].played++;
  stats[homeId].goalsFor += homeScore;
  stats[homeId].goalsAgainst += awayScore;
  stats[awayId].goalsFor += awayScore;
  stats[awayId].goalsAgainst += homeScore;

  if (awayScore === 0) stats[homeId].cleanSheets++;
  if (homeScore === 0) stats[awayId].cleanSheets++;

  if (homeScore > awayScore) {
    stats[homeId].won++;
    stats[awayId].lost++;
    stats[homeId].points += 3;
  } else if (homeScore < awayScore) {
    stats[awayId].won++;
    stats[homeId].lost++;
    stats[awayId].points += 3;
  } else {
    stats[homeId].drawn++;
    stats[awayId].drawn++;
    stats[homeId].points++;
    stats[awayId].points++;
  }
}

async function recomputeIndividualStandings(tournamentId: string) {
  // Get all completed matches for individual players
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: "COMPLETED",
      homePlayerId: { not: null },
      awayPlayerId: { not: null },
    },
  });

  // Get all enrolled individual players with their group assignments
  const enrolled = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    select: { playerId: true, groupId: true },
  });

  // Build a map of player -> groupId
  const playerGroups = new Map<string, string | null>();
  for (const { playerId, groupId } of enrolled) {
    playerGroups.set(playerId, groupId);
  }

  // Initialize stats for overall and per-group
  const overallStats: Record<string, PlayerStats> = {};
  const groupStats: Record<string, Record<string, PlayerStats>> = {}; // groupId -> playerId -> stats

  // Initialize enrolled players with 0 stats
  for (const { playerId, groupId } of enrolled) {
    overallStats[playerId] = createEmptyStats();
    if (groupId) {
      if (!groupStats[groupId]) groupStats[groupId] = {};
      groupStats[groupId][playerId] = createEmptyStats();
    }
  }

  // Ensure all match players are in stats (even if not formally enrolled)
  for (const match of matches) {
    const homeId = match.homePlayerId!;
    const awayId = match.awayPlayerId!;
    if (!overallStats[homeId]) overallStats[homeId] = createEmptyStats();
    if (!overallStats[awayId]) overallStats[awayId] = createEmptyStats();
  }

  // Process matches
  for (const match of matches) {
    const homeId = match.homePlayerId!;
    const awayId = match.awayPlayerId!;
    const hg = match.homeScore ?? 0;
    const ag = match.awayScore ?? 0;

    // Add to overall stats
    addMatchToStats(overallStats, homeId, awayId, hg, ag);

    // Add to group stats if match belongs to a group
    if (match.groupId) {
      if (!groupStats[match.groupId]) groupStats[match.groupId] = {};
      if (!groupStats[match.groupId][homeId]) groupStats[match.groupId][homeId] = createEmptyStats();
      if (!groupStats[match.groupId][awayId]) groupStats[match.groupId][awayId] = createEmptyStats();
      addMatchToStats(groupStats[match.groupId], homeId, awayId, hg, ag);
    }
  }

  // Delete existing standings for this tournament, then recreate
  await prisma.standing.deleteMany({ where: { tournamentId } });

  // Create overall standings (no groupId)
  for (const [playerId, s] of Object.entries(overallStats)) {
    s.goalDiff = s.goalsFor - s.goalsAgainst;
    await prisma.standing.create({
      data: { tournamentId, playerId, ...s },
    });
  }

  // Create per-group standings
  for (const [groupId, players] of Object.entries(groupStats)) {
    for (const [playerId, s] of Object.entries(players)) {
      s.goalDiff = s.goalsFor - s.goalsAgainst;
      await prisma.standing.create({
        data: { tournamentId, groupId, playerId, ...s },
      });
    }
  }
}

export async function rescheduleMatch(matchId: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const scheduledAt = formData.get("scheduledAt") as string;
  const status = formData.get("status") as string;
  const notes = formData.get("notes") as string;

  const allowedStatuses = ["SCHEDULED", "POSTPONED", "CANCELLED"];
  if (status && !allowedStatuses.includes(status)) {
    return { success: false, error: "Invalid status for rescheduling" };
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      status: (status as never) || undefined,
      notes: notes || null,
    },
  });

  await logActivity({
    action: status === "POSTPONED" ? "POSTPONE" : "RESCHEDULE",
    entityType: "MATCH",
    entityId: matchId,
    details: { scheduledAt, status, notes },
  });

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath("/admin/matches");
  return { success: true, data: undefined };
}

export async function getMatches(params?: { status?: string; tournamentId?: string }) {
  return prisma.match.findMany({
    where: {
      ...(params?.status && { status: params.status as never }),
      ...(params?.tournamentId && { tournamentId: params.tournamentId }),
    },
    orderBy: [{ scheduledAt: "desc" }],
    include: {
      tournament: { select: { id: true, name: true, gameCategory: true } },
      homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      homePlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
      awayPlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
      motmPlayer: { select: { id: true, name: true } },
    },
  });
}

export async function getMatchesPaginated(options?: {
  status?: string;
  tournamentId?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.max(1, Math.min(100, options?.limit ?? 25));
  const skip = (page - 1) * limit;

  const where = {
    ...(options?.status && { status: options.status as never }),
    ...(options?.tournamentId && { tournamentId: options.tournamentId }),
  };

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: [{ scheduledAt: "desc" }],
      skip,
      take: limit,
      include: {
        tournament: { select: { id: true, name: true, gameCategory: true } },
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        homePlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
        awayPlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
        motmPlayer: { select: { id: true, name: true } },
      },
    }),
    prisma.match.count({ where }),
  ]);

  return { matches, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getMatchById(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      tournament: { select: { id: true, name: true, gameCategory: true } },
      homeTeam: {
        include: {
          players: {
            where: { isActive: true },
            include: { player: { select: { id: true, name: true, position: true } } },
          },
        },
      },
      awayTeam: {
        include: {
          players: {
            where: { isActive: true },
            include: { player: { select: { id: true, name: true, position: true } } },
          },
        },
      },
      homePlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
      awayPlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
      motmPlayer: { select: { id: true, name: true } },
      events: {
        orderBy: { minute: "asc" },
        include: {
          player: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
      },
    },
  });
}
