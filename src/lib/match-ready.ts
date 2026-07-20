import "server-only";

import type { MatchStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  LOCK_DURATION_MS,
  getTeamById,
  pickRandomTeam,
  type RandomTeam,
} from "@/lib/randomTeams";

// ─────────────────────────────────────────────────────────────
// Match "Ready Check" — server-authoritative state machine.
//
// The server is the ONLY place that flips ready flags, assigns a team and
// decides whether the lock is active. The client polls and renders; it never
// picks a team or trusts its own clock for the lock.
//
// Scope: 1v1 individual matches only (Match.homePlayerId / awayPlayerId).
// ─────────────────────────────────────────────────────────────

export { LOCK_DURATION_MS };

type Side = "home" | "away";

/** The full ready state, safe to send to the client. Always carries serverTime
 *  so the client countdown can be corrected for clock drift. */
export interface ReadyStateDTO {
  matchId: string;
  /** false when the match isn't in a pre-match window or isn't a 1v1. */
  enabled: boolean;
  serverTime: string; // ISO
  lockDurationMs: number;
  /** Side the viewer is allowed to toggle. null = spectator / not signed in. */
  viewerSide: Side | null;
  /** Whether the viewer is a signed-in player (hides the "sign in" prompt). */
  loggedIn: boolean;
  home: { name: string; ready: boolean };
  away: { name: string; ready: boolean };
  assignedTeam: RandomTeam | null;
  assignedAt: string | null; // ISO
  lockedUntil: string | null; // ISO
  /** assignedAt set AND now < lockedUntil — both buttons disabled, countdown shown. */
  locked: boolean;
  /** A team is shown but the current ready cycle was broken by an unready. */
  stale: boolean;
}

export type ReadyMutationResult =
  | { ok: true; state: ReadyStateDTO }
  | { ok: false; status: number; error: string };

// Fields we need from the match to run the ready check.
const MATCH_SELECT = {
  id: true,
  status: true,
  homePlayerId: true,
  awayPlayerId: true,
  homePlayer: { select: { name: true } },
  awayPlayer: { select: { name: true } },
} as const;

type MatchRow = {
  id: string;
  status: MatchStatus;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  homePlayer: { name: string } | null;
  awayPlayer: { name: string } | null;
};

type ReadyRow = {
  homeReady: boolean;
  awayReady: boolean;
  assignedTeamId: string | null;
  assignedAt: Date | null;
  lockedUntil: Date | null;
  previousTeamId: string | null;
};

/** A 1v1 match in a pre-match window is eligible for the ready check. */
function isEnabled(match: MatchRow): boolean {
  const bothPlayers = !!match.homePlayerId && !!match.awayPlayerId;
  const preMatch = match.status === "SCHEDULED" || match.status === "POSTPONED";
  return bothPlayers && preMatch;
}

/** Which side (if any) this player is allowed to toggle. */
function sideForPlayer(match: MatchRow, playerId: string | null): Side | null {
  if (!playerId) return null;
  if (match.homePlayerId === playerId) return "home";
  if (match.awayPlayerId === playerId) return "away";
  return null;
}

function serialize(
  match: MatchRow,
  row: ReadyRow | null,
  viewerSide: Side | null,
  loggedIn: boolean,
  now: Date,
): ReadyStateDTO {
  const enabled = isEnabled(match);
  const assignedTeam = getTeamById(row?.assignedTeamId);
  const assignedAt = row?.assignedAt ?? null;
  const lockedUntil = row?.lockedUntil ?? null;
  const locked = !!assignedAt && !!lockedUntil && now.getTime() < lockedUntil.getTime();
  // A team is on screen but the ready cycle was broken by an unready.
  const stale = !assignedAt && !!assignedTeam;

  return {
    matchId: match.id,
    enabled,
    serverTime: now.toISOString(),
    lockDurationMs: LOCK_DURATION_MS,
    viewerSide: enabled ? viewerSide : null,
    loggedIn,
    home: { name: match.homePlayer?.name ?? "Home", ready: row?.homeReady ?? false },
    away: { name: match.awayPlayer?.name ?? "Away", ready: row?.awayReady ?? false },
    assignedTeam,
    assignedAt: assignedAt ? assignedAt.toISOString() : null,
    lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
    locked,
    stale,
  };
}

async function loadMatch(matchId: string): Promise<MatchRow | null> {
  return prisma.match.findUnique({ where: { id: matchId }, select: MATCH_SELECT });
}

async function loadRow(matchId: string): Promise<ReadyRow | null> {
  return prisma.matchReadyState.findUnique({
    where: { matchId },
    select: {
      homeReady: true,
      awayReady: true,
      assignedTeamId: true,
      assignedAt: true,
      lockedUntil: true,
      previousTeamId: true,
    },
  });
}

/** Read-only snapshot — used by the GET endpoint and the initial page render. */
export async function getReadyState(
  matchId: string,
  viewerPlayerId: string | null,
): Promise<ReadyStateDTO | null> {
  const match = await loadMatch(matchId);
  if (!match) return null;
  const row = await loadRow(matchId);
  const viewerSide = sideForPlayer(match, viewerPlayerId);
  return serialize(match, row, viewerSide, viewerPlayerId != null, new Date());
}

/**
 * Lazily create the single ready-state row for a match. Uses
 * INSERT … ON CONFLICT DO NOTHING (createMany + skipDuplicates) so two players
 * clicking Ready at the same instant can't collide on the insert — an `upsert`
 * here would let one request throw a unique-constraint violation. After this,
 * the row exists and all mutations serialize cleanly on its write lock.
 */
async function ensureRow(matchId: string): Promise<void> {
  await prisma.matchReadyState.createMany({ data: { matchId }, skipDuplicates: true });
}

/**
 * Mark the caller ready. If this makes BOTH players ready and no active lock
 * exists, a random team is assigned and a fresh lock starts — all in one
 * transaction so two near-simultaneous clicks can only ever assign one team.
 */
export async function readyUp(
  matchId: string,
  viewerPlayerId: string | null,
): Promise<ReadyMutationResult> {
  const match = await loadMatch(matchId);
  if (!match) return { ok: false, status: 404, error: "Match not found." };
  if (!isEnabled(match)) return { ok: false, status: 409, error: "Ready check is closed for this match." };

  const side = sideForPlayer(match, viewerPlayerId);
  if (!side) return { ok: false, status: 403, error: "Only the two players in this match can ready up." };

  await ensureRow(matchId);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Setting the flag takes a write lock on the single row, so the other
    // player's readyUp() blocks here until we commit — they can't race us.
    const current = await tx.matchReadyState.update({
      where: { matchId },
      data: side === "home" ? { homeReady: true } : { awayReady: true },
      select: { homeReady: true, awayReady: true, assignedAt: true, assignedTeamId: true },
    });

    // Edge-triggered: only assign on the transition INTO both-ready
    // (assignedAt == null). This is why re-clicking Ready, or the lock simply
    // expiring, never silently re-rolls the team.
    if (current.homeReady && current.awayReady && current.assignedAt === null) {
      const team = pickRandomTeam(current.assignedTeamId); // never repeat the previous team
      await tx.matchReadyState.updateMany({
        where: { matchId, homeReady: true, awayReady: true, assignedAt: null },
        data: {
          assignedTeamId: team.id,
          teamRegion: team.region,
          teamLeague: team.league,
          teamName: team.team,
          assignedAt: now,
          lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
          previousTeamId: current.assignedTeamId, // record what we replaced
        },
      });
    }
  });

  const row = await loadRow(matchId);
  return { ok: true, state: serialize(match, row, side, viewerPlayerId != null, new Date()) };
}

/**
 * Clear the caller's ready flag. Rejected while a lock is active. Uses one
 * atomic conditional update: the WHERE only matches when there is no active
 * lock, so a lock that a concurrent assignment just set will correctly block
 * the unready.
 */
export async function unready(
  matchId: string,
  viewerPlayerId: string | null,
): Promise<ReadyMutationResult> {
  const match = await loadMatch(matchId);
  if (!match) return { ok: false, status: 404, error: "Match not found." };
  if (!isEnabled(match)) return { ok: false, status: 409, error: "Ready check is closed for this match." };

  const side = sideForPlayer(match, viewerPlayerId);
  if (!side) return { ok: false, status: 403, error: "Only the two players in this match can unready." };

  await ensureRow(matchId);

  const now = new Date();
  const res = await prisma.matchReadyState.updateMany({
    where: {
      matchId,
      // Only when NOT actively locked. A concurrent assignment that set
      // lockedUntil in the future makes this WHERE fail → count 0 → rejected.
      OR: [{ assignedAt: null }, { lockedUntil: { lte: now } }],
    },
    data:
      side === "home"
        ? { homeReady: false, assignedAt: null, lockedUntil: null }
        : { awayReady: false, assignedAt: null, lockedUntil: null },
  });

  if (res.count === 0) {
    // Row exists (ensured above) so the only reason to match nothing is an
    // active lock.
    return { ok: false, status: 409, error: "You can't unready while a team is locked in." };
  }

  const row = await loadRow(matchId);
  return { ok: true, state: serialize(match, row, side, viewerPlayerId != null, new Date()) };
}
