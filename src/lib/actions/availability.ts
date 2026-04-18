"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getMatchByToken } from "./score-report";

// ─── MARK AVAILABLE ──────────────────────────────────────────

export async function markAvailable(
  token: string,
  preferredTime?: string,
) {
  const result = await getMatchByToken(token);
  if (!result) return { success: false, error: "Invalid or expired link" };

  const { match, side } = result;

  if (match.status === "COMPLETED" || match.status === "CANCELLED") {
    return { success: false, error: "This match is already completed" };
  }

  const playerId = side === "home"
    ? match.homePlayer?.id ?? match.homeTeam?.id
    : match.awayPlayer?.id ?? match.awayTeam?.id;

  if (!playerId) return { success: false, error: "Player not found for this match" };

  // Upsert availability
  await prisma.matchAvailability.upsert({
    where: { matchId_side: { matchId: match.id, side } },
    update: {
      isAvailable: true,
      preferredTime: preferredTime ? new Date(preferredTime) : null,
      markedAt: new Date(),
    },
    create: {
      matchId: match.id,
      playerId,
      side,
      isAvailable: true,
      preferredTime: preferredTime ? new Date(preferredTime) : null,
    },
  });

  // Check if opponent has already marked available
  const opponentSide = side === "home" ? "away" : "home";
  const opponentAvailability = await prisma.matchAvailability.findUnique({
    where: { matchId_side: { matchId: match.id, side: opponentSide } },
  });

  const playerName = side === "home"
    ? (match.homePlayer?.name ?? match.homeTeam?.name ?? "Home")
    : (match.awayPlayer?.name ?? match.awayTeam?.name ?? "Away");
  const opponentName = opponentSide === "home"
    ? (match.homePlayer?.name ?? match.homeTeam?.name ?? "Home")
    : (match.awayPlayer?.name ?? match.awayTeam?.name ?? "Away");

  // Notify opponent that this player is ready
  const opponentPhone = opponentSide === "home"
    ? match.homePlayer?.phone
    : match.awayPlayer?.phone;
  const opponentToken = opponentSide === "home" ? match.homeToken : match.awayToken;

  if (opponentPhone && opponentToken) {
    const timeStr = preferredTime
      ? new Date(preferredTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "anytime";

    const { sendWithLog } = await import("@/lib/whatsapp-log");
    await sendWithLog({
      to: opponentPhone,
      templateName: "opponent_ready",
      parameters: [
        opponentName,
        playerName,
        timeStr,
        `https://bwlleague.com/report/${opponentToken}`,
      ],
      // Keyed on (match, side-that-marked-ready) — re-marking clears and re-fires
      dedupKey: `opponent_ready:${match.id}:${side}`,
      category: "OPPONENT_READY",
      matchId: match.id,
      tournamentId: match.tournamentId,
    });
  }

  // WhatsApp only — no broadcast push notification for availability
  // (opponent already gets a targeted WhatsApp message above)

  revalidatePath(`/report/${token}`);
  revalidatePath(`/matches/${match.id}`);
  return {
    success: true,
    data: {
      opponentReady: !!opponentAvailability?.isAvailable,
    },
  };
}

// ─── GET AVAILABILITY STATUS ─────────────────────────────────

export async function getAvailabilityStatus(matchId: string) {
  const availabilities = await prisma.matchAvailability.findMany({
    where: { matchId },
    include: { player: { select: { name: true } } },
  });

  return {
    home: availabilities.find((a) => a.side === "home") ?? null,
    away: availabilities.find((a) => a.side === "away") ?? null,
  };
}
