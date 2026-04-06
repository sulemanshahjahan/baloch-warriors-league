"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const matchSchema = z.object({
  tournamentId: z.string().min(1, "Tournament is required"),
  homeTeamId: z.string().optional(),
  awayTeamId: z.string().optional(),
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

// ─── STANDINGS ENGINE ───────────────────────────────────────

async function recomputeStandings(tournamentId: string) {
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
