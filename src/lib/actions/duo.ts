"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { auth, getUserRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";
import { defaultDuoName, pairBalancedRandom, type PairablePlayer } from "@/lib/duo-pairing";
import { logActivity } from "./activity-log";

// ─── ROLE HELPERS (mirror tournament.ts) ─────────────────────
const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };

function hasRole(session: { user?: { role?: string } } | null, minRole: string): boolean {
  const userRole = getUserRole(session);
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
}

async function checkAdmin(): Promise<ActionResult | null> {
  const session = await auth();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!hasRole(session, "ADMIN")) return { success: false, error: "Forbidden: Admin role required" };
  return null;
}

async function revalidateTournament(tournamentId: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  if (t?.slug) revalidatePath(`/tournaments/${t.slug}`);
  revalidatePath("/tournaments");
}

// ─── QUERIES ─────────────────────────────────────────────────

/** A duo as displayed in admin UI: the backing team plus its two players. */
export interface DuoView {
  tournamentTeamId: string; // TournamentTeam.id (enrollment) — used for group assignment
  teamId: string;
  name: string;
  groupId: string | null;
  players: { id: string; name: string; photoUrl: string | null; cardRank: number }[];
  /** Combined card rank of both members (sum) — informational. */
  combinedRating: number;
}

/** List all duos enrolled in a tournament. */
export async function getTournamentDuos(tournamentId: string): Promise<DuoView[]> {
  const enrollments = await prisma.tournamentTeam.findMany({
    where: { tournamentId, team: { isDuo: true } },
    select: {
      id: true,
      groupId: true,
      team: {
        select: {
          id: true,
          name: true,
          players: {
            where: { isActive: true },
            select: {
              player: { select: { id: true, name: true, photoUrl: true, cardRank: true } },
            },
          },
        },
      },
    },
    orderBy: { registeredAt: "asc" },
  });

  return enrollments.map((e) => {
    const players = e.team.players.map((tp) => tp.player);
    return {
      tournamentTeamId: e.id,
      teamId: e.team.id,
      name: e.team.name,
      groupId: e.groupId,
      players,
      combinedRating: players.reduce((sum, p) => sum + p.cardRank, 0),
    };
  });
}

/** Players eligible to be put into a (new) duo — active and not already in a duo here. */
export async function getAvailablePlayersForDuo(tournamentId: string) {
  const pairedIds = await getPairedPlayerIds(tournamentId);

  return prisma.player.findMany({
    where: {
      isActive: true,
      ...(pairedIds.length > 0 && { id: { notIn: pairedIds } }),
    },
    orderBy: [{ cardRank: "desc" }, { name: "asc" }],
    select: { id: true, name: true, photoUrl: true, cardRank: true, skillLevel: true },
  });
}

/** Which player metric to balance duos on. */
export type DuoRatingSource = "CARD" | "SKILL";

/** Internal: ids of every player already assigned to a duo in this tournament. */
async function getPairedPlayerIds(tournamentId: string): Promise<string[]> {
  const enrollments = await prisma.tournamentTeam.findMany({
    where: { tournamentId, team: { isDuo: true } },
    select: { team: { select: { players: { where: { isActive: true }, select: { playerId: true } } } } },
  });
  return enrollments.flatMap((e) => e.team.players.map((p) => p.playerId));
}

// ─── VALIDATION ──────────────────────────────────────────────

async function assertDuoTournament(tournamentId: string): Promise<ActionResult<{ slug: string }> | null> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { slug: true, gameCategory: true, eFootballMode: true, participantType: true },
  });
  if (!t) return { success: false, error: "Tournament not found" };
  if (t.gameCategory !== "EFOOTBALL" || t.eFootballMode !== "2v2") {
    return { success: false, error: "Duos are only available for 2v2 eFootball tournaments" };
  }
  return null;
}

/** True if the duo's backing team is already involved in any match (blocks deletion/rebuild). */
async function duoHasMatches(teamId: string): Promise<boolean> {
  const count = await prisma.match.count({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  });
  return count > 0;
}

// ─── MUTATIONS ───────────────────────────────────────────────

/**
 * Create a single duo from two players, optionally with a custom name.
 * Validates: distinct active players, neither already paired, unique duo name.
 */
export async function createDuo(
  tournamentId: string,
  player1Id: string,
  player2Id: string,
  name?: string
): Promise<ActionResult<{ teamId: string }>> {
  const denied = await checkAdmin();
  if (denied) return denied as ActionResult<{ teamId: string }>;

  const bad = await assertDuoTournament(tournamentId);
  if (bad) return bad as ActionResult<{ teamId: string }>;

  if (!player1Id || !player2Id) return { success: false, error: "Select two players" };
  if (player1Id === player2Id) return { success: false, error: "A duo needs two different players" };

  const players = await prisma.player.findMany({
    where: { id: { in: [player1Id, player2Id] }, isActive: true },
    select: { id: true, name: true },
  });
  if (players.length !== 2) return { success: false, error: "One or both players were not found" };

  // Neither player may already be in a duo for this tournament.
  const paired = await getPairedPlayerIds(tournamentId);
  const clash = [player1Id, player2Id].filter((id) => paired.includes(id));
  if (clash.length > 0) {
    return { success: false, error: "A selected player is already in another duo in this tournament" };
  }

  // Resolve player order to keep the default name stable.
  const p1 = players.find((p) => p.id === player1Id)!;
  const p2 = players.find((p) => p.id === player2Id)!;

  const finalName = await resolveDuoName(tournamentId, name, defaultDuoName(p1.name, p2.name), !name);
  if (!finalName.ok) return { success: false, error: finalName.error };

  const team = await prisma.team.create({
    data: {
      name: finalName.name,
      slug: `duo-${slugify(finalName.name)}-${randomUUID().slice(0, 8)}`,
      isDuo: true,
      players: {
        create: [{ playerId: player1Id }, { playerId: player2Id }],
      },
      tournaments: {
        create: [{ tournamentId }],
      },
    },
    select: { id: true },
  });

  await logActivity({
    action: "CREATE",
    entityType: "DUO",
    entityId: tournamentId,
    details: { name: finalName.name, player1Id, player2Id },
  });

  await revalidateTournament(tournamentId);
  return { success: true, data: { teamId: team.id }, message: `Created duo "${finalName.name}"` };
}

/**
 * Auto-pair a set of players into balanced duos by skill rating.
 * Strongest pairs with weakest. An odd player out is reported, never dropped.
 */
export async function autoPairDuos(
  tournamentId: string,
  playerIds: string[],
  ratingSource: DuoRatingSource = "CARD"
): Promise<ActionResult<{ created: number; unpaired: string | null }>> {
  const denied = await checkAdmin();
  if (denied) return denied as ActionResult<{ created: number; unpaired: string | null }>;

  const bad = await assertDuoTournament(tournamentId);
  if (bad) return bad as ActionResult<{ created: number; unpaired: string | null }>;

  const unique = [...new Set(playerIds)];
  if (unique.length < 2) return { success: false, error: "Select at least 2 players to auto-pair" };

  // Only pair players that are active and not already in a duo.
  const alreadyPaired = await getPairedPlayerIds(tournamentId);
  const eligible = await prisma.player.findMany({
    where: { id: { in: unique }, isActive: true, ...(alreadyPaired.length > 0 && { id: { notIn: alreadyPaired } }) },
    select: { id: true, name: true, cardRank: true, skillLevel: true },
  });

  if (eligible.length < 2) {
    return { success: false, error: "Not enough available players to pair (some may already be in a duo)" };
  }

  // Balance duos (a stronger + a random weaker player) on the admin-chosen metric.
  const { duos, unpaired } = pairBalancedRandom<PairablePlayer>(
    eligible.map((p) => ({
      id: p.id,
      name: p.name,
      rating: ratingSource === "SKILL" ? p.skillLevel : p.cardRank,
    }))
  );

  let created = 0;
  for (const duo of duos) {
    const name = await resolveDuoName(
      tournamentId,
      undefined,
      defaultDuoName(duo.player1.name, duo.player2.name),
      true
    );
    if (!name.ok) continue;
    await prisma.team.create({
      data: {
        name: name.name,
        slug: `duo-${slugify(name.name)}-${randomUUID().slice(0, 8)}`,
        isDuo: true,
        players: { create: [{ playerId: duo.player1.id }, { playerId: duo.player2.id }] },
        tournaments: { create: [{ tournamentId }] },
      },
    });
    created++;
  }

  await logActivity({
    action: "AUTO_PAIR",
    entityType: "DUO",
    entityId: tournamentId,
    details: { created, unpaired: unpaired?.name ?? null },
  });

  await revalidateTournament(tournamentId);
  return {
    success: true,
    data: { created, unpaired: unpaired?.name ?? null },
    message:
      `Created ${created} duo(s).` +
      (unpaired ? ` ⚠ ${unpaired.name} is unpaired (odd number of players).` : ""),
  };
}

/** Rename a duo. Enforces uniqueness among duos in the same tournament. */
export async function renameDuo(
  tournamentId: string,
  teamId: string,
  name: string
): Promise<ActionResult> {
  const denied = await checkAdmin();
  if (denied) return denied;

  const trimmed = name.trim();
  if (trimmed.length < 2) return { success: false, error: "Duo name must be at least 2 characters" };

  const resolved = await resolveDuoName(tournamentId, trimmed, trimmed, false, teamId);
  if (!resolved.ok) return { success: false, error: resolved.error };

  await prisma.team.update({ where: { id: teamId }, data: { name: resolved.name } });

  await logActivity({ action: "RENAME", entityType: "DUO", entityId: tournamentId, details: { teamId, name: resolved.name } });
  await revalidateTournament(tournamentId);
  return { success: true, data: undefined };
}

/** Delete (rebuild) a duo — only allowed before it has played any match. */
export async function deleteDuo(tournamentId: string, teamId: string): Promise<ActionResult> {
  const denied = await checkAdmin();
  if (denied) return denied;

  if (await duoHasMatches(teamId)) {
    return { success: false, error: "Cannot delete a duo that already has matches. Delete its matches first." };
  }

  // Remove enrollment + roster + the backing team.
  await prisma.tournamentTeam.deleteMany({ where: { tournamentId, teamId } });
  await prisma.teamPlayer.deleteMany({ where: { teamId } });
  await prisma.team.delete({ where: { id: teamId } });

  await logActivity({ action: "DELETE", entityType: "DUO", entityId: tournamentId, details: { teamId } });
  await revalidateTournament(tournamentId);
  return { success: true, data: undefined };
}

// ─── NAME RESOLUTION ─────────────────────────────────────────
//
// Returns a usable, unique duo name.
// - explicit name + duplicate → error (admin must change it)
// - auto-generated name + duplicate → append " (2)", " (3)", … so it never fails

async function resolveDuoName(
  tournamentId: string,
  explicit: string | undefined,
  fallback: string,
  autoSuffix: boolean,
  excludeTeamId?: string
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const base = (explicit ?? fallback).trim();

  const existing = await prisma.tournamentTeam.findMany({
    where: {
      tournamentId,
      team: { isDuo: true, ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}) },
    },
    select: { team: { select: { name: true } } },
  });
  const taken = new Set(existing.map((e) => e.team.name.toLowerCase()));

  if (!taken.has(base.toLowerCase())) return { ok: true, name: base };

  if (!autoSuffix) {
    return { ok: false, error: `A duo named "${base}" already exists in this tournament` };
  }

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})`;
    if (!taken.has(candidate.toLowerCase())) return { ok: true, name: candidate };
  }
  return { ok: false, error: "Could not generate a unique duo name" };
}
