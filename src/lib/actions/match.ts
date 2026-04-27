"use server";

import { revalidatePath } from "next/cache";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { MatchStatus } from "@prisma/client";
import { logActivity } from "./activity-log";
import { invalidateCache } from "@/lib/redis";
import { randomUUID } from "crypto";
import { fromKarachiInputValue } from "@/lib/utils";

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
  deadline: z.string().optional(),
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
      scheduledAt: fromKarachiInputValue(data.scheduledAt ?? null),
      deadline: fromKarachiInputValue(data.deadline ?? null),
      venueId: data.venueId || null,
      notes: data.notes || null,
      status: data.status,
      homeToken: randomUUID(),
      awayToken: randomUUID(),
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

// ─── MATCH COMPLETION CASCADE ────────────────────────────────
// Core function that handles all post-score updates.
// Used by both admin updateMatchResult() and player self-reporting.

export async function executeMatchCompletion(
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<{ success: boolean; error?: string }> {
  const currentMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });

  if (!currentMatch) return { success: false, error: "Match not found" };

  const match = await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore,
      awayScore,
      status: "COMPLETED",
      completedAt: new Date(),
    },
    include: { tournament: true },
  });

  // Auto-create goal events for individual tournaments (ALL legs)
  if (currentMatch.tournament.participantType === "INDIVIDUAL") {
    await prisma.matchEvent.deleteMany({
      where: { matchId, type: "GOAL", description: { equals: "Auto-generated from match result" } },
    });

    // Refetch match to get leg scores
    const fullMatch = await prisma.match.findUnique({
      where: { id: matchId },
      select: { homeScore: true, awayScore: true, leg2HomeScore: true, leg2AwayScore: true, leg3HomeScore: true, leg3AwayScore: true },
    });

    // Collect all goals across all legs
    const homeGoals = (fullMatch?.homeScore ?? 0) + (fullMatch?.leg2HomeScore ?? 0) + (fullMatch?.leg3HomeScore ?? 0);
    const awayGoals = (fullMatch?.awayScore ?? 0) + (fullMatch?.leg2AwayScore ?? 0) + (fullMatch?.leg3AwayScore ?? 0);

    if (currentMatch.homePlayerId && homeGoals > 0) {
      for (let i = 0; i < homeGoals; i++) {
        await prisma.matchEvent.create({
          data: { matchId, playerId: currentMatch.homePlayerId, type: "GOAL", description: "Auto-generated from match result" },
        });
      }
    }
    if (currentMatch.awayPlayerId && awayGoals > 0) {
      for (let i = 0; i < awayGoals; i++) {
        await prisma.matchEvent.create({
          data: { matchId, playerId: currentMatch.awayPlayerId, type: "GOAL", description: "Auto-generated from match result" },
        });
      }
    }
  }

  // Recompute standings, advance knockout, update ELO
  await recomputeStandings(match.tournamentId);
  await advanceKnockoutWinner(matchId, match.tournamentId);
  const { updateEloAfterMatch } = await import("@/lib/elo");
  await updateEloAfterMatch(matchId);

  // Push notification
  const homeName = currentMatch.homePlayerId
    ? (await prisma.player.findUnique({ where: { id: currentMatch.homePlayerId }, select: { name: true } }))?.name
    : (await prisma.team.findUnique({ where: { id: currentMatch.homeTeamId! }, select: { name: true } }))?.name;
  const awayName = currentMatch.awayPlayerId
    ? (await prisma.player.findUnique({ where: { id: currentMatch.awayPlayerId }, select: { name: true } }))?.name
    : (await prisma.team.findUnique({ where: { id: currentMatch.awayTeamId! }, select: { name: true } }))?.name;
  // Build notification body with leg scores if 2-legged
  const updatedMatch = await prisma.match.findUnique({
    where: { id: matchId },
    select: { leg2HomeScore: true, leg2AwayScore: true, leg3HomeScore: true, leg3AwayScore: true, leg3HomePens: true, leg3AwayPens: true, groupId: true },
  });
  let notifBody = `${homeName ?? "Home"} ${homeScore} - ${awayScore} ${awayName ?? "Away"}`;
  if (updatedMatch?.leg2HomeScore != null) {
    const aggH = homeScore + (updatedMatch.leg2HomeScore ?? 0);
    const aggA = awayScore + (updatedMatch.leg2AwayScore ?? 0);
    notifBody = `Leg 1: ${homeScore}-${awayScore} | Leg 2: ${updatedMatch.leg2HomeScore}-${updatedMatch.leg2AwayScore ?? 0} | Agg: ${aggH}-${aggA}`;
    if (updatedMatch.leg3HomeScore != null) {
      notifBody += ` | Decider: ${updatedMatch.leg3HomeScore}-${updatedMatch.leg3AwayScore ?? 0}`;
      if (updatedMatch.leg3HomePens != null) notifBody += ` (${updatedMatch.leg3HomePens}-${updatedMatch.leg3AwayPens ?? 0} pens)`;
    }
    notifBody = `${homeName ?? "Home"} vs ${awayName ?? "Away"} — ${notifBody}`;
  }

  import("@/lib/push").then(({ sendPushToAll }) =>
    sendPushToAll({
      title: `${match.tournament.name} — Result`,
      body: notifBody,
      url: `/matches/${matchId}`,
      tag: `match-result-${matchId}`,
    })
  ).catch(() => {});

  // Cache invalidation
  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${match.tournamentId}`);
  revalidatePath("/admin/matches");
  revalidatePath(`/matches/${matchId}`);
  await invalidateCache(`standings:${match.tournamentId}`);
  await invalidateCache(`tstats:${match.tournamentId}`);
  await invalidateCache("leaderboard:");
  await invalidateCache("rankings:");

  return { success: true };
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

  // Extract extra fields (not in zod schema — optional raw fields)
  const homeClub = (raw.homeClub as string) || null;
  const awayClub = (raw.awayClub as string) || null;
  const homeFormation = (raw.homeFormation as string) || null;
  const awayFormation = (raw.awayFormation as string) || null;
  const isDerby = raw.isDerby === "true";
  const rivalNote = (raw.rivalNote as string) || null;
  const highlights = (raw.highlights as string) || null;

  // Leg scores for knockout matches
  const leg2HomeScore = raw.leg2HomeScore ? Number(raw.leg2HomeScore) : null;
  const leg2AwayScore = raw.leg2AwayScore ? Number(raw.leg2AwayScore) : null;
  const leg3HomeScore = raw.leg3HomeScore ? Number(raw.leg3HomeScore) : null;
  const leg3AwayScore = raw.leg3AwayScore ? Number(raw.leg3AwayScore) : null;
  const leg3HomePens = raw.leg3HomePens ? Number(raw.leg3HomePens) : null;
  const leg3AwayPens = raw.leg3AwayPens ? Number(raw.leg3AwayPens) : null;

  // If status is COMPLETED, use the shared cascade
  if (data.status === "COMPLETED") {
    // First update the extra fields that executeMatchCompletion doesn't handle
    await prisma.match.update({
      where: { id: matchId },
      data: {
        homeScorePens: data.homeScorePens ? Number(data.homeScorePens) : null,
        awayScorePens: data.awayScorePens ? Number(data.awayScorePens) : null,
        leg2HomeScore, leg2AwayScore,
        leg3HomeScore, leg3AwayScore,
        leg3HomePens, leg3AwayPens,
        homeClub, awayClub, homeFormation, awayFormation,
        isDerby, rivalNote, highlights,
        motmPlayerId: data.motmPlayerId || null,
      },
    });

    // Save player ratings (eFootball)
    for (const [key, val] of Object.entries(raw)) {
      if (key.startsWith("rating_") && val) {
        const ratingPlayerId = key.replace("rating_", "");
        const ratingValue = parseFloat(val as string);
        if (ratingValue >= 1 && ratingValue <= 10) {
          await prisma.matchEvent.deleteMany({
            where: { matchId, playerId: ratingPlayerId, type: "CUSTOM", description: "PLAYER_RATING" },
          });
          await prisma.matchEvent.create({
            data: { matchId, playerId: ratingPlayerId, type: "CUSTOM", value: ratingValue, description: "PLAYER_RATING" },
          });
        }
      }
    }

    // Run the full cascade
    const result = await executeMatchCompletion(matchId, data.homeScore, data.awayScore);
    if (!result.success) return result;

    await logActivity({
      action: "COMPLETE",
      entityType: "MATCH",
      entityId: matchId,
      details: { homeScore: data.homeScore, awayScore: data.awayScore, status: "COMPLETED", tournamentId: currentMatch.tournamentId },
    });

    return { success: true, data: undefined };
  }

  // Non-COMPLETED status updates (LIVE, SCHEDULED, etc.)
  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore: data.homeScore,
      awayScore: data.awayScore,
      homeScorePens: data.homeScorePens ? Number(data.homeScorePens) : null,
      awayScorePens: data.awayScorePens ? Number(data.awayScorePens) : null,
      leg2HomeScore, leg2AwayScore,
      leg3HomeScore, leg3AwayScore,
      leg3HomePens, leg3AwayPens,
      homeClub, awayClub, homeFormation, awayFormation,
      isDerby, rivalNote, highlights,
      motmPlayerId: data.motmPlayerId || null,
      status: data.status,
    },
  });

  // Save player ratings (eFootball)
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith("rating_") && val) {
      const ratingPlayerId = key.replace("rating_", "");
      const ratingValue = parseFloat(val as string);
      if (ratingValue >= 1 && ratingValue <= 10) {
        await prisma.matchEvent.deleteMany({
          where: { matchId, playerId: ratingPlayerId, type: "CUSTOM", description: "PLAYER_RATING" },
        });
        await prisma.matchEvent.create({
          data: { matchId, playerId: ratingPlayerId, type: "CUSTOM", value: ratingValue, description: "PLAYER_RATING" },
        });
      }
    }
  }

  await logActivity({
    action: "UPDATE",
    entityType: "MATCH",
    entityId: matchId,
    details: { homeScore: data.homeScore, awayScore: data.awayScore, status: data.status, tournamentId: currentMatch.tournamentId },
  });

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${currentMatch.tournamentId}`);
  revalidatePath("/admin/matches");
  return { success: true, data: undefined };
}

// ─── KNOCKOUT BRACKET PROGRESSION ─────────────────────────────

export async function advanceKnockoutWinner(matchId: string, tournamentId: string) {
  // Get the completed match with its round info
  const completedMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournament: true },
  });

  if (!completedMatch || completedMatch.homeScore == null || completedMatch.awayScore == null) return;
  
  // Only process knockout matches — skip LEAGUE format entirely
  if (completedMatch.tournament.format === "LEAGUE") return;

  const roundName = completedMatch.round || "";
  const isKnockoutMatch = completedMatch.roundNumber && completedMatch.roundNumber > 0 &&
    !roundName.match(/Group\s+[A-Z]/i);
  
  if (!isKnockoutMatch) return;

  // Determine winner — use aggregate for 2-legged knockout ties
  let winnerId: string | null = null;
  let isWinnerHomePlayer = false;

  const leg1Home = completedMatch.homeScore ?? 0;
  const leg1Away = completedMatch.awayScore ?? 0;
  const leg2Home = completedMatch.leg2HomeScore ?? 0;
  const leg2Away = completedMatch.leg2AwayScore ?? 0;
  const has2Legs = completedMatch.leg2HomeScore != null;

  if (has2Legs) {
    // 2-legged tie — aggregate scores
    const aggHome = leg1Home + leg2Home;
    const aggAway = leg1Away + leg2Away;

    if (aggHome !== aggAway) {
      // Aggregate decides
      winnerId = aggHome > aggAway
        ? (completedMatch.homePlayerId || completedMatch.homeTeamId)
        : (completedMatch.awayPlayerId || completedMatch.awayTeamId);
    } else if (completedMatch.leg3HomeScore != null) {
      // Decider match played
      const dec3Home = completedMatch.leg3HomeScore ?? 0;
      const dec3Away = completedMatch.leg3AwayScore ?? 0;

      if (dec3Home !== dec3Away) {
        winnerId = dec3Home > dec3Away
          ? (completedMatch.homePlayerId || completedMatch.homeTeamId)
          : (completedMatch.awayPlayerId || completedMatch.awayTeamId);
      } else if (completedMatch.leg3HomePens != null) {
        // Decider penalties
        winnerId = (completedMatch.leg3HomePens ?? 0) > (completedMatch.leg3AwayPens ?? 0)
          ? (completedMatch.homePlayerId || completedMatch.homeTeamId)
          : (completedMatch.awayPlayerId || completedMatch.awayTeamId);
      } else {
        return; // No winner determined yet
      }
    } else {
      return; // Aggregate tied, no decider yet
    }
  } else {
    // Single match — use pens if drawn
    const homeScore = completedMatch.homeScorePens ?? leg1Home;
    const awayScore = completedMatch.awayScorePens ?? leg1Away;

    if (homeScore > awayScore) {
      winnerId = completedMatch.homePlayerId || completedMatch.homeTeamId;
    } else if (awayScore > homeScore) {
      winnerId = completedMatch.awayPlayerId || completedMatch.awayTeamId;
    } else {
      return; // Draw - no winner
    }
  }

  isWinnerHomePlayer = winnerId === completedMatch.homePlayerId || winnerId === completedMatch.homeTeamId;
  
  if (!winnerId) return;

  const isIndividual = completedMatch.tournament.participantType === "INDIVIDUAL";
  const currentRound = completedMatch.roundNumber || 1;
  const nextRound = currentRound + 1;

  // Get ALL knockout matches in the current round, deterministically ordered.
  // Position within this list (not raw matchNumber) determines bracket slot.
  const currentRoundMatches = await prisma.match.findMany({
    where: {
      tournamentId,
      roundNumber: currentRound,
      status: { not: "CANCELLED" },
      NOT: { round: { contains: "Group" } },
    },
    orderBy: [{ matchNumber: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const matchesInCurrentRound = currentRoundMatches.length;
  const myIdx = currentRoundMatches.findIndex((m) => m.id === matchId);
  if (myIdx < 0) return;

  const pairIdx = Math.floor(myIdx / 2);
  const isHomeSlot = myIdx % 2 === 0;
  const nextMatchNumber = pairIdx + 1;

  // Map count to round name
  let nextRoundName: string;
  switch (matchesInCurrentRound) {
    case 2:  nextRoundName = "Final"; break;
    case 4:  nextRoundName = "Semi-finals"; break;
    case 8:  nextRoundName = "Quarter-finals"; break;
    case 16: nextRoundName = "Round of 16"; break;
    default: nextRoundName = `Round ${nextRound}`;
  }

  // Look for existing next-round match. Prefer matchNumber match; fall back to
  // position-in-sorted-order if matchNumber is null/mismatched on legacy rows.
  const nextRoundMatches = await prisma.match.findMany({
    where: {
      tournamentId,
      roundNumber: nextRound,
      status: { not: "CANCELLED" },
      NOT: { round: { contains: "Group" } },
    },
    orderBy: [{ matchNumber: "asc" }, { createdAt: "asc" }],
  });

  const existingNextMatch =
    nextRoundMatches.find((m) => m.matchNumber === nextMatchNumber) ??
    nextRoundMatches[pairIdx] ?? null;

  if (existingNextMatch) {
    await prisma.match.update({
      where: { id: existingNextMatch.id },
      data: isIndividual
        ? (isHomeSlot ? { homePlayerId: winnerId } : { awayPlayerId: winnerId })
        : (isHomeSlot ? { homeTeamId: winnerId } : { awayTeamId: winnerId }),
    });
  } else {
    await prisma.match.create({
      data: {
        tournamentId,
        round: nextRoundName,
        roundNumber: nextRound,
        matchNumber: nextMatchNumber,
        status: "SCHEDULED",
        homeToken: randomUUID(),
        awayToken: randomUUID(),
        ...(isIndividual
          ? (isHomeSlot ? { homePlayerId: winnerId } : { awayPlayerId: winnerId })
          : (isHomeSlot ? { homeTeamId: winnerId } : { awayTeamId: winnerId })),
      },
    });
  }

  // Auto-send WhatsApp to both players when next match has both assigned
  const nextMatch = await prisma.match.findFirst({
    where: { tournamentId, roundNumber: nextRound, matchNumber: nextMatchNumber },
    include: {
      tournament: { select: { name: true } },
      homePlayer: { select: { name: true, phone: true } },
      awayPlayer: { select: { name: true, phone: true } },
    },
  });

  // Don't announce a schedule for a match that's already been played or cancelled
  const nextIsPlayable = nextMatch?.status === "SCHEDULED" || nextMatch?.status === "POSTPONED";

  if (nextIsPlayable && nextMatch?.homePlayerId && nextMatch?.awayPlayerId && nextMatch.homePlayer?.phone && nextMatch.awayPlayer?.phone) {
    const homeName = nextMatch.homePlayer.name;
    const awayName = nextMatch.awayPlayer.name;
    const deadlineStr = nextMatch.deadline
      ? nextMatch.deadline.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }) + " PKT"
      : "To be confirmed";

    import("@/lib/whatsapp-log").then(async ({ sendWithLog }) => {
      // Notify home player
      await sendWithLog({
        to: nextMatch.homePlayer!.phone!,
        templateName: "match_schedule",
        parameters: [
          homeName,
          awayName,
          nextMatch.awayPlayer!.phone!.replace(/[+\s\-()]/g, ""),
          deadlineStr,
        ],
        dedupKey: `schedule:${nextMatch.id}:home`,
        category: "SCHEDULE",
        matchId: nextMatch.id,
        tournamentId: nextMatch.tournamentId,
      });
      // Notify away player
      await sendWithLog({
        to: nextMatch.awayPlayer!.phone!,
        templateName: "match_schedule",
        parameters: [
          awayName,
          homeName,
          nextMatch.homePlayer!.phone!.replace(/[+\s\-()]/g, ""),
          deadlineStr,
        ],
        dedupKey: `schedule:${nextMatch.id}:away`,
        category: "SCHEDULE",
        matchId: nextMatch.id,
        tournamentId: nextMatch.tournamentId,
      });
    }).catch(() => {});
  }
}

/**
 * Rebuild knockout advancement from scratch.
 * 1. Clear home/away player/team on all non-first-round SCHEDULED knockout matches
 *    (preserves COMPLETED matches — no data loss)
 * 2. Replay advanceKnockoutWinner for every completed knockout match in round order
 */
export async function backfillKnockoutAdvancement(tournamentId: string) {
  const session = await auth();
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Unauthorized" };

  // Find the minimum roundNumber for knockout matches — that's the first bracket round.
  const firstKo = await prisma.match.findFirst({
    where: { tournamentId, NOT: { round: { contains: "Group" } } },
    orderBy: { roundNumber: "asc" },
    select: { roundNumber: true },
  });
  const firstRound = firstKo?.roundNumber ?? 1;

  // Wipe slots on SCHEDULED matches in rounds AFTER the first (these are advancement-populated)
  await prisma.match.updateMany({
    where: {
      tournamentId,
      status: "SCHEDULED",
      roundNumber: { gt: firstRound },
      NOT: { round: { contains: "Group" } },
    },
    data: {
      homePlayerId: null,
      awayPlayerId: null,
      homeTeamId: null,
      awayTeamId: null,
    },
  });

  const completed = await prisma.match.findMany({
    where: {
      tournamentId,
      status: "COMPLETED",
      NOT: { round: { contains: "Group" } },
    },
    select: { id: true, roundNumber: true, matchNumber: true },
    orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }, { createdAt: "asc" }],
  });

  let processed = 0;
  for (const m of completed) {
    try {
      await advanceKnockoutWinner(m.id, tournamentId);
      processed++;
    } catch (err) {
      console.error("[backfillKnockoutAdvancement] failed for", m.id, err);
    }
  }

  revalidatePath(`/tournaments`);
  revalidatePath(`/admin/tournaments/${tournamentId}`);

  return { success: true, processed };
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

export async function bulkDeleteMatches(matchIds: string[]) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden" };

  // Collect tournament IDs for revalidation
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, tournamentId: true, status: true },
  });

  // Delete related data
  await prisma.eloHistory.deleteMany({ where: { matchId: { in: matchIds } } });
  await prisma.matchEvent.deleteMany({ where: { matchId: { in: matchIds } } });
  await prisma.matchParticipant.deleteMany({ where: { matchId: { in: matchIds } } });
  await prisma.match.deleteMany({ where: { id: { in: matchIds } } });

  // Recompute standings for affected tournaments
  const tournamentIds = [...new Set(matches.map((m) => m.tournamentId))];
  for (const tid of tournamentIds) {
    await recomputeStandings(tid);
  }

  await logActivity({
    action: "BULK_DELETE",
    entityType: "MATCH",
    entityId: matchIds.join(","),
    details: { count: matchIds.length },
  });

  revalidatePath("/admin/matches");
  revalidatePath("/admin/tournaments");
  return { success: true, data: { count: matchIds.length } };
}

// ─── STANDINGS ENGINE ───────────────────────────────────────

// Scoring rules per game category
const SCORING_RULES: Record<string, { win: number; draw: number; loss: number }> = {
  FOOTBALL: { win: 3, draw: 1, loss: 0 },
  EFOOTBALL: { win: 3, draw: 1, loss: 0 },
  PUBG: { win: 0, draw: 0, loss: 0 }, // Uses totalScore from MatchParticipant
  SNOOKER: { win: 1, draw: 0, loss: 0 }, // Points = frames won
  CHECKERS: { win: 1, draw: 0, loss: 0 }, // Points = games won
};

export async function recomputeTournamentStandings(tournamentId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  
  // Only ADMIN and above can recompute standings
  const userRole = (session.user as { role?: string })?.role ?? "EDITOR";
  if (userRole === "EDITOR") {
    return { success: false, error: "Forbidden" };
  }

  // Get tournament info
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { participantType: true, name: true, gameCategory: true },
  });

  if (!tournament) return { success: false, error: "Tournament not found" };

  if (tournament.participantType === "INDIVIDUAL") {
    await recomputeIndividualStandings(tournamentId, tournament.gameCategory);
  } else {
    await recomputeTeamStandings(tournamentId, tournament.gameCategory);
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
  // Get tournament info
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { participantType: true, gameCategory: true },
  });

  if (!tournament) return;

  if (tournament.participantType === "INDIVIDUAL") {
    await recomputeIndividualStandings(tournamentId, tournament.gameCategory);
  } else {
    await recomputeTeamStandings(tournamentId, tournament.gameCategory);
  }
}

async function recomputeTeamStandings(tournamentId: string, gameCategory: string) {
  // Get scoring rules for this game
  const rules = SCORING_RULES[gameCategory] ?? SCORING_RULES.FOOTBALL;
  const isPUBG = gameCategory === "PUBG";

  // Fetch only GROUP STAGE matches for standings (exclude knockout)
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: "COMPLETED",
      ...(isPUBG ? {} : { homeTeamId: { not: null }, awayTeamId: { not: null } }),
      OR: [
        { groupId: { not: null } },
        { round: { not: { in: ["Round of 16", "Round of 32", "Quarter-finals", "Semi-finals", "Final"] } }, groupId: null },
      ],
    },
    select: {
      id: true,
      notes: true,
      groupId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      leg2HomeScore: true,
      leg2AwayScore: true,
      leg3HomeScore: true,
      leg3AwayScore: true,
      participants: true,
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
    // Aggregate scores across all legs (1 fixture = 1 match played in standings)
    const hg = (match.homeScore ?? 0) + (match.leg2HomeScore ?? 0) + (match.leg3HomeScore ?? 0);
    const ag = (match.awayScore ?? 0) + (match.leg2AwayScore ?? 0) + (match.leg3AwayScore ?? 0);

    // For PUBG, use totalScore from MatchParticipant
    if (isPUBG && match.participants && match.participants.length > 0) {
      let matchPpk = 1;
      let matchPlacementPts: { placement: number; points: number }[] = [];
      try {
        const cfg = JSON.parse(match.notes || "{}");
        matchPpk = cfg.pointsPerKill || 1;
        matchPlacementPts = cfg.placementPoints || [];
      } catch { /* use defaults */ }
      const getPlacePts = (pl: number) => matchPlacementPts.find((p) => p.placement === pl)?.points ?? 0;

      for (const participant of match.participants) {
        if (participant.teamId) {
          if (!overallStats[participant.teamId]) overallStats[participant.teamId] = createEmptyStats();
          const placePts = getPlacePts(participant.placement ?? 99);
          const kills = Math.max(0, Math.round(((participant.score ?? 0) - placePts) / matchPpk));
          overallStats[participant.teamId].points += participant.score ?? 0;
          overallStats[participant.teamId].goalsFor += kills;           // total kills
          overallStats[participant.teamId].played++;
          if (participant.placement === 1) overallStats[participant.teamId].won++; // chicken dinners
        }
      }
    } else {
      // Add to overall stats with game-specific scoring
      addMatchToStats(overallStats, homeId, awayId, hg, ag, rules);

      // Add to group stats if match belongs to a group
      if (match.groupId) {
        if (!groupStats[match.groupId]) groupStats[match.groupId] = {};
        if (!groupStats[match.groupId][homeId]) groupStats[match.groupId][homeId] = createEmptyStats();
        if (!groupStats[match.groupId][awayId]) groupStats[match.groupId][awayId] = createEmptyStats();
        addMatchToStats(groupStats[match.groupId], homeId, awayId, hg, ag, rules);
      }
    }
  }

  // Delete existing standings for this tournament, then recreate
  await prisma.standing.deleteMany({ where: { tournamentId } });

  // Create overall standings (no groupId)
  for (const [teamId, s] of Object.entries(overallStats)) {
    if (!teamId) continue; // Skip invalid entries
    s.goalDiff = s.goalsFor - s.goalsAgainst;
    await prisma.standing.create({
      data: { tournamentId, teamId, ...s },
    });
  }

  // Create per-group standings
  for (const [groupId, teams] of Object.entries(groupStats)) {
    for (const [teamId, s] of Object.entries(teams)) {
      if (!teamId) continue; // Skip invalid entries
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
  awayScore: number,
  rules: { win: number; draw: number; loss: number }
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
    stats[homeId].points += rules.win;
  } else if (homeScore < awayScore) {
    stats[awayId].won++;
    stats[homeId].lost++;
    stats[awayId].points += rules.win;
  } else {
    stats[homeId].drawn++;
    stats[awayId].drawn++;
    stats[homeId].points += rules.draw;
    stats[awayId].points += rules.draw;
  }
}

async function recomputeIndividualStandings(tournamentId: string, gameCategory: string) {
  // Get scoring rules for this game
  const rules = SCORING_RULES[gameCategory] ?? SCORING_RULES.FOOTBALL;
  const isPUBG = gameCategory === "PUBG";

  // Fetch only GROUP STAGE matches for standings (exclude knockout)
  // Knockout matches (no groupId + round like "Round of 16") don't count in standings
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: "COMPLETED",
      ...(isPUBG ? {} : { homePlayerId: { not: null }, awayPlayerId: { not: null } }),
      // Exclude knockout: only include matches that have a groupId OR are from round-robin (no groupId but part of league)
      OR: [
        { groupId: { not: null } }, // Group stage matches
        { round: { not: { in: ["Round of 16", "Round of 32", "Quarter-finals", "Semi-finals", "Final"] } }, groupId: null }, // League/round-robin without groups
      ],
    },
    select: {
      id: true,
      notes: true,
      groupId: true,
      homePlayerId: true,
      awayPlayerId: true,
      homeScore: true,
      awayScore: true,
      leg2HomeScore: true,
      leg2AwayScore: true,
      leg3HomeScore: true,
      leg3AwayScore: true,
      participants: true,
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
    // Aggregate scores across all legs (1 fixture = 1 match played in standings)
    const hg = (match.homeScore ?? 0) + (match.leg2HomeScore ?? 0) + (match.leg3HomeScore ?? 0);
    const ag = (match.awayScore ?? 0) + (match.leg2AwayScore ?? 0) + (match.leg3AwayScore ?? 0);

    // For PUBG, use totalScore from MatchParticipant
    if (isPUBG && match.participants && match.participants.length > 0) {
      let matchPpk = 1;
      let matchPlacementPts: { placement: number; points: number }[] = [];
      try {
        const cfg = JSON.parse(match.notes || "{}");
        matchPpk = cfg.pointsPerKill || 1;
        matchPlacementPts = cfg.placementPoints || [];
      } catch { /* use defaults */ }
      const getPlacePts = (pl: number) => matchPlacementPts.find((p) => p.placement === pl)?.points ?? 0;

      for (const participant of match.participants) {
        if (participant.playerId) {
          if (!overallStats[participant.playerId]) overallStats[participant.playerId] = createEmptyStats();
          const placePts = getPlacePts(participant.placement ?? 99);
          const kills = Math.max(0, Math.round(((participant.score ?? 0) - placePts) / matchPpk));
          overallStats[participant.playerId].points += participant.score ?? 0;
          overallStats[participant.playerId].goalsFor += kills;           // total kills
          overallStats[participant.playerId].played++;
          if (participant.placement === 1) overallStats[participant.playerId].won++; // chicken dinners
        }
      }
    } else {
      // Add to overall stats with game-specific scoring
      addMatchToStats(overallStats, homeId, awayId, hg, ag, rules);

      // Add to group stats if match belongs to a group
      if (match.groupId) {
        if (!groupStats[match.groupId]) groupStats[match.groupId] = {};
        if (!groupStats[match.groupId][homeId]) groupStats[match.groupId][homeId] = createEmptyStats();
        if (!groupStats[match.groupId][awayId]) groupStats[match.groupId][awayId] = createEmptyStats();
        addMatchToStats(groupStats[match.groupId], homeId, awayId, hg, ag, rules);
      }
    }
  }

  // Delete existing standings for this tournament, then recreate
  await prisma.standing.deleteMany({ where: { tournamentId } });

  // Create overall standings (no groupId)
  for (const [playerId, s] of Object.entries(overallStats)) {
    if (!playerId || playerId === "null" || playerId === "undefined") continue;
    s.goalDiff = s.goalsFor - s.goalsAgainst;
    await prisma.standing.create({
      data: { tournamentId, playerId, ...s },
    });
  }

  // Create per-group standings
  for (const [groupId, players] of Object.entries(groupStats)) {
    for (const [playerId, s] of Object.entries(players)) {
      if (!playerId || playerId === "null" || playerId === "undefined") continue;
      s.goalDiff = s.goalsFor - s.goalsAgainst;
      await prisma.standing.create({
        data: { tournamentId, groupId, playerId, ...s },
      });
    }
  }
}

export async function setRoomId(matchId: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden: Insufficient permissions" };

  const roomId = (formData.get("roomId") as string)?.trim() || null;
  const roomPassword = (formData.get("roomPassword") as string)?.trim() || null;

  const match = await prisma.match.update({
    where: { id: matchId },
    data: { roomId, roomPassword },
    include: {
      tournament: { select: { name: true, gameCategory: true } },
      homePlayer: { select: { name: true } },
      awayPlayer: { select: { name: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  // Send push notification when room ID is set
  if (roomId) {
    const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "Home";
    const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "Away";
    import("@/lib/push").then(({ sendPushToAll }) =>
      sendPushToAll({
        title: "Room ID Ready!",
        body: `${homeName} vs ${awayName} — Room ID has been shared. Join now!`,
        url: `/matches/${matchId}`,
        tag: `room-id-${matchId}`,
      })
    ).catch(() => {});
  }

  await logActivity({
    action: "UPDATE",
    entityType: "MATCH",
    entityId: matchId,
    details: { roomId: roomId ? "set" : "cleared" },
  });

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}`);
  return { success: true, data: undefined };
}

export async function rescheduleMatch(matchId: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const scheduledAt = formData.get("scheduledAt") as string;
  const deadline = formData.get("deadline") as string;
  const status = formData.get("status") as string;
  const notes = formData.get("notes") as string;

  const allowedStatuses = ["SCHEDULED", "POSTPONED", "CANCELLED"];
  if (status && !allowedStatuses.includes(status)) {
    return { success: false, error: "Invalid status for rescheduling" };
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      scheduledAt: scheduledAt ? fromKarachiInputValue(scheduledAt) : undefined,
      deadline: deadline ? fromKarachiInputValue(deadline) : undefined,
      status: (status as MatchStatus) || undefined,
      notes: notes || null,
      // Reset reminders when rescheduling so they fire again for the new deadline
      ...(deadline ? { remindersSent: [], isOverdue: false } : {}),
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
      ...(params?.status && { status: params.status as MatchStatus }),
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

export async function bulkUpdateMatchResults(
  results: Array<{ matchId: string; homeScore: number; awayScore: number }>
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden" };

  let updated = 0;
  const errors: string[] = [];

  for (const { matchId, homeScore, awayScore } of results) {
    try {
      const match = await prisma.match.update({
        where: { id: matchId },
        data: {
          homeScore,
          awayScore,
          status: "COMPLETED" as MatchStatus,
          completedAt: new Date(),
        },
        include: { tournament: true },
      });

      // Auto-create goal events for individual tournaments
      if (match.tournament.participantType === "INDIVIDUAL") {
        await prisma.matchEvent.deleteMany({
          where: { matchId, type: "GOAL", description: "Auto-generated from match result" },
        });
        if (match.homePlayerId && homeScore > 0) {
          await prisma.matchEvent.createMany({
            data: Array.from({ length: homeScore }, () => ({
              matchId, playerId: match.homePlayerId!, type: "GOAL" as const,
              description: "Auto-generated from match result",
            })),
          });
        }
        if (match.awayPlayerId && awayScore > 0) {
          await prisma.matchEvent.createMany({
            data: Array.from({ length: awayScore }, () => ({
              matchId, playerId: match.awayPlayerId!, type: "GOAL" as const,
              description: "Auto-generated from match result",
            })),
          });
        }
      }

      await recomputeStandings(match.tournamentId);
      await advanceKnockoutWinner(matchId, match.tournamentId);
      const { updateEloAfterMatch } = await import("@/lib/elo");
      await updateEloAfterMatch(matchId);
      updated++;
    } catch (e) {
      errors.push(matchId);
    }
  }

  revalidatePath("/admin/matches");
  revalidatePath("/admin/tournaments");

  return {
    success: true,
    data: { updated, errors: errors.length, total: results.length },
  };
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
    ...(options?.status && { status: options.status as MatchStatus }),
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
        _count: { select: { participants: true } },
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
      participants: {
        include: {
          team: { select: { id: true, name: true } },
          player: { select: { id: true, name: true } },
        },
      },
      events: {
        orderBy: { minute: "asc" },
        include: {
          player: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
      },
      scoreReports: {
        where: { status: { in: ["PENDING", "DISPUTED"] } },
        select: { id: true, submittedBy: true, homeScore: true, awayScore: true, status: true },
      },
    },
  });
}

// ─── PUBG BATTLE ROYALE RESULTS ──────────────────────────────

export async function updatePUBGMatchResult(matchId: string, formData: FormData) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "EDITOR")) return { success: false, error: "Forbidden" };

  const status = formData.get("status") as string;
  const participantsData = JSON.parse(formData.get("participants") as string) as Record<
    string,
    { placement: number; kills: number }
  >;

  // Get match with tournament info
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournament: { select: { id: true, slug: true, gameCategory: true } } },
  });

  if (!match) return { success: false, error: "Match not found" };
  if (match.tournament.gameCategory !== "PUBG") {
    return { success: false, error: "This function is only for PUBG matches" };
  }

  // Parse scoring config from match notes
  let pointsPerKill = 1;
  let placementPoints: { placement: number; points: number }[] = [];
  try {
    const config = JSON.parse(match.notes || "{}");
    pointsPerKill = config.pointsPerKill || 1;
    placementPoints = config.placementPoints || [];
  } catch {
    // Use defaults
  }

  // Get placement points helper
  const getPlacementPoints = (placement: number) => {
    const pp = placementPoints.find((p) => p.placement === placement);
    return pp?.points || 0;
  };

  // Wrap participant updates + match status in a transaction
  const totalParticipants = Object.keys(participantsData).length;
  await prisma.$transaction(async (tx) => {
    for (const [participantId, data] of Object.entries(participantsData)) {
      const totalScore = getPlacementPoints(data.placement) + data.kills * pointsPerKill;
      await tx.matchParticipant.update({
        where: { id: participantId },
        data: {
          placement: data.placement,
          score: totalScore,
          result: data.placement === 1 ? "WIN" : data.placement <= Math.ceil(totalParticipants / 2) ? "DRAW" : "LOSS",
        },
      });
    }

    await tx.match.update({
      where: { id: matchId },
      data: {
        status: status as MatchStatus,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });
  });

  // Recompute standings (outside transaction — uses own queries)
  await recomputeStandings(match.tournamentId);

  await logActivity({
    action: "UPDATE",
    entityType: "MATCH",
    entityId: matchId,
    details: { status, type: "PUBG_RESULT" },
  });

  revalidatePath(`/admin/matches/${matchId}`);
  revalidatePath(`/admin/tournaments/${match.tournamentId}`);
  revalidatePath("/admin/matches");
  revalidatePath(`/tournaments/${match.tournament.slug}`);
  await invalidateCache(`standings:${match.tournamentId}`);
  await invalidateCache(`tstats:${match.tournamentId}`);
  await invalidateCache("leaderboard:");
  await invalidateCache("rankings:");
  return { success: true, data: undefined };
}
