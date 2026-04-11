"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { executeMatchCompletion } from "./match";
import { logActivity } from "./activity-log";
import { auth, getUserRole } from "@/lib/auth";

const AUTO_CONFIRM_HOURS = 24;

// ─── LOOKUP ──────────────────────────────────────────────────

export async function getMatchByToken(token: string) {
  // Try homeToken first
  let match = await prisma.match.findUnique({
    where: { homeToken: token },
    include: {
      tournament: { select: { id: true, name: true, slug: true, gameCategory: true } },
      homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      homePlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
      awayPlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
      scoreReports: { where: { status: "PENDING" }, take: 1 },
    },
  });
  let side: "home" | "away" = "home";

  if (!match) {
    match = await prisma.match.findUnique({
      where: { awayToken: token },
      include: {
        tournament: { select: { id: true, name: true, slug: true, gameCategory: true } },
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        homePlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
        awayPlayer: { select: { id: true, name: true, slug: true, photoUrl: true } },
        scoreReports: { where: { status: "PENDING" }, take: 1 },
      },
    });
    side = "away";
  }

  if (!match) return null;

  const pendingReport = match.scoreReports[0] ?? null;
  return { match, side, pendingReport };
}

// ─── SUBMIT SCORE ────────────────────────────────────────────

export async function submitScore(
  token: string,
  homeScore: number,
  awayScore: number,
) {
  const result = await getMatchByToken(token);
  if (!result) return { success: false, error: "Invalid or expired link" };

  const { match, side } = result;

  if (match.status === "COMPLETED") {
    return { success: false, error: "This match is already completed" };
  }

  if (match.status !== "SCHEDULED" && match.status !== "POSTPONED" && match.status !== "LIVE") {
    return { success: false, error: "This match cannot accept score reports" };
  }

  // Check for existing pending report
  const existingReport = await prisma.scoreReport.findFirst({
    where: { matchId: match.id, status: "PENDING" },
  });

  if (existingReport) {
    return { success: false, error: "A score has already been submitted for this match. Check your link to confirm or dispute it." };
  }

  const report = await prisma.scoreReport.create({
    data: {
      matchId: match.id,
      submittedBy: side,
      homeScore,
      awayScore,
      autoConfirmAt: new Date(Date.now() + AUTO_CONFIRM_HOURS * 60 * 60 * 1000),
    },
  });

  // Broadcast push notification
  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "Home";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "Away";
  import("@/lib/push").then(({ sendPushToAll }) =>
    sendPushToAll({
      title: "Score Submitted — Confirm or Dispute",
      body: `${homeName} ${homeScore} - ${awayScore} ${awayName} (${match.tournament.name})`,
      url: `/matches/${match.id}`,
      tag: `score-report-${match.id}`,
    })
  ).catch(() => {});

  revalidatePath(`/report/${token}`);
  return { success: true, data: { reportId: report.id } };
}

// ─── CONFIRM SCORE ───────────────────────────────────────────

export async function confirmScore(token: string, reportId: string) {
  const result = await getMatchByToken(token);
  if (!result) return { success: false, error: "Invalid or expired link" };

  const { match, side } = result;

  const report = await prisma.scoreReport.findUnique({
    where: { id: reportId },
  });

  if (!report || report.matchId !== match.id) {
    return { success: false, error: "Score report not found" };
  }

  if (report.status !== "PENDING") {
    return { success: false, error: "This score report has already been resolved" };
  }

  // Ensure the confirmer is the opposite side
  if (report.submittedBy === side) {
    return { success: false, error: "You cannot confirm your own score submission" };
  }

  // Update report status
  await prisma.scoreReport.update({
    where: { id: reportId },
    data: { status: "CONFIRMED", respondedAt: new Date() },
  });

  // Trigger the full match completion cascade
  const completionResult = await executeMatchCompletion(
    match.id,
    report.homeScore,
    report.awayScore,
  );

  if (!completionResult.success) {
    return { success: false, error: completionResult.error ?? "Failed to complete match" };
  }

  await logActivity({
    action: "COMPLETE",
    entityType: "MATCH",
    entityId: match.id,
    details: {
      homeScore: report.homeScore,
      awayScore: report.awayScore,
      method: "player-self-report",
      submittedBy: report.submittedBy,
      confirmedBy: side,
    },
  });

  revalidatePath(`/report/${token}`);
  return { success: true, data: undefined };
}

// ─── DISPUTE SCORE ───────────────────────────────────────────

export async function disputeScore(
  token: string,
  reportId: string,
  reason?: string,
) {
  const result = await getMatchByToken(token);
  if (!result) return { success: false, error: "Invalid or expired link" };

  const { match, side } = result;

  const report = await prisma.scoreReport.findUnique({
    where: { id: reportId },
  });

  if (!report || report.matchId !== match.id) {
    return { success: false, error: "Score report not found" };
  }

  if (report.status !== "PENDING") {
    return { success: false, error: "This score report has already been resolved" };
  }

  if (report.submittedBy === side) {
    return { success: false, error: "You cannot dispute your own score submission" };
  }

  await prisma.scoreReport.update({
    where: { id: reportId },
    data: {
      status: "DISPUTED",
      respondedAt: new Date(),
      disputeReason: reason || null,
    },
  });

  // Notify admin via broadcast
  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "Home";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "Away";
  import("@/lib/push").then(({ sendPushToAll }) =>
    sendPushToAll({
      title: "Score DISPUTED — Admin Action Needed",
      body: `${homeName} vs ${awayName} (${match.tournament.name}) — ${reason || "No reason given"}`,
      url: `/admin/matches/${match.id}`,
      tag: `dispute-${match.id}`,
    })
  ).catch(() => {});

  revalidatePath(`/report/${token}`);
  return { success: true, data: undefined };
}

// ─── ADMIN: GENERATE TOKENS ─────────────────────────────────

export async function generateMatchTokens(matchId: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const { randomUUID } = await import("crypto");

  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeToken: randomUUID(),
      awayToken: randomUUID(),
    },
  });

  revalidatePath(`/admin/matches/${matchId}`);
  return { success: true, data: undefined };
}

// ─── ADMIN: OVERRIDE REPORT ─────────────────────────────────

export async function adminResolveReport(
  reportId: string,
  action: "confirm" | "cancel",
) {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };

  const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };
  const userRole = getUserRole(session);
  if ((ROLE_LEVELS[userRole] ?? 0) < 2) {
    return { success: false, error: "Forbidden: Admin role required" };
  }

  const report = await prisma.scoreReport.findUnique({
    where: { id: reportId },
    include: { match: true },
  });

  if (!report) return { success: false, error: "Report not found" };

  if (action === "confirm") {
    await prisma.scoreReport.update({
      where: { id: reportId },
      data: { status: "CONFIRMED", respondedAt: new Date() },
    });

    const result = await executeMatchCompletion(
      report.matchId,
      report.homeScore,
      report.awayScore,
    );

    if (!result.success) return result;

    await logActivity({
      action: "COMPLETE",
      entityType: "MATCH",
      entityId: report.matchId,
      details: {
        homeScore: report.homeScore,
        awayScore: report.awayScore,
        method: "admin-override",
      },
    });
  } else {
    await prisma.scoreReport.update({
      where: { id: reportId },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
  }

  revalidatePath(`/admin/matches/${report.matchId}`);
  revalidatePath("/admin/matches");
  return { success: true, data: undefined };
}
