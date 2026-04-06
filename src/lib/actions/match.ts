"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

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
  }

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${match.tournamentId}`);
  revalidatePath("/admin/matches");
  return { success: true, data: undefined };
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

  await prisma.matchEvent.create({
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

  revalidatePath(`/admin/matches/${data.matchId}`);
  return { success: true, data: undefined };
}

export async function deleteMatchEvent(eventId: string, matchId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  await prisma.matchEvent.delete({ where: { id: eventId } });
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

  revalidatePath("/admin/matches");
  revalidatePath(`/admin/tournaments/${match.tournamentId}`);
  return { success: true, data: undefined };
}

// ─── STANDINGS ENGINE ───────────────────────────────────────

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

  // Get all enrolled teams
  const enrolled = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    select: { teamId: true },
  });

  const teamIds = enrolled.map((e: { teamId: string }) => e.teamId);

  // Build stats map
  const stats: Record<
    string,
    {
      played: number; won: number; drawn: number; lost: number;
      points: number; goalsFor: number; goalsAgainst: number;
      goalDiff: number; cleanSheets: number;
    }
  > = {};

  for (const teamId of teamIds) {
    stats[teamId] = {
      played: 0, won: 0, drawn: 0, lost: 0,
      points: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, cleanSheets: 0,
    };
  }

  for (const match of matches) {
    const homeId = match.homeTeamId!;
    const awayId = match.awayTeamId!;
    const hg = match.homeScore ?? 0;
    const ag = match.awayScore ?? 0;

    if (!stats[homeId] || !stats[awayId]) continue;

    stats[homeId].played++;
    stats[awayId].played++;
    stats[homeId].goalsFor += hg;
    stats[homeId].goalsAgainst += ag;
    stats[awayId].goalsFor += ag;
    stats[awayId].goalsAgainst += hg;

    if (ag === 0) stats[homeId].cleanSheets++;
    if (hg === 0) stats[awayId].cleanSheets++;

    if (hg > ag) {
      stats[homeId].won++;
      stats[awayId].lost++;
      stats[homeId].points += 3;
    } else if (hg < ag) {
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

  // Delete existing standings for this tournament, then recreate
  await prisma.standing.deleteMany({ where: { tournamentId } });

  for (const [teamId, s] of Object.entries(stats)) {
    s.goalDiff = s.goalsFor - s.goalsAgainst;
    await prisma.standing.create({
      data: { tournamentId, teamId, ...s },
    });
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

  // Get all enrolled individual players
  const enrolled = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    select: { playerId: true },
  });

  // Build stats map - include enrolled players plus any players from matches
  const stats: Record<
    string,
    {
      played: number; won: number; drawn: number; lost: number;
      points: number; goalsFor: number; goalsAgainst: number;
      goalDiff: number; cleanSheets: number;
    }
  > = {};

  // Initialize enrolled players with 0 stats
  for (const { playerId } of enrolled) {
    stats[playerId] = {
      played: 0, won: 0, drawn: 0, lost: 0,
      points: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, cleanSheets: 0,
    };
  }

  // Ensure all match players are in stats (even if not formally enrolled)
  for (const match of matches) {
    const homeId = match.homePlayerId!;
    const awayId = match.awayPlayerId!;
    if (!stats[homeId]) {
      stats[homeId] = {
        played: 0, won: 0, drawn: 0, lost: 0,
        points: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, cleanSheets: 0,
      };
    }
    if (!stats[awayId]) {
      stats[awayId] = {
        played: 0, won: 0, drawn: 0, lost: 0,
        points: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, cleanSheets: 0,
      };
    }
  }

  for (const match of matches) {
    const homeId = match.homePlayerId!;
    const awayId = match.awayPlayerId!;
    const hg = match.homeScore ?? 0;
    const ag = match.awayScore ?? 0;

    // Skip if players aren't in stats (shouldn't happen now)
    if (!stats[homeId] || !stats[awayId]) continue;

    stats[homeId].played++;
    stats[awayId].played++;
    stats[homeId].goalsFor += hg;
    stats[homeId].goalsAgainst += ag;
    stats[awayId].goalsFor += ag;
    stats[awayId].goalsAgainst += hg;

    if (ag === 0) stats[homeId].cleanSheets++;
    if (hg === 0) stats[awayId].cleanSheets++;

    if (hg > ag) {
      stats[homeId].won++;
      stats[awayId].lost++;
      stats[homeId].points += 3;
    } else if (hg < ag) {
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

  // Delete existing standings for this tournament, then recreate
  await prisma.standing.deleteMany({ where: { tournamentId } });

  for (const [playerId, s] of Object.entries(stats)) {
    s.goalDiff = s.goalsFor - s.goalsAgainst;
    await prisma.standing.create({
      data: { tournamentId, playerId, ...s },
    });
  }
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
