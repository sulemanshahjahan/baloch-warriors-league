import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

// Helpers for resolving WhatsApp recipients of a match side.
//
// A 1v1 match has a single player per side. A 2v2 duo match has a TEAM per side
// whose two members are the real people to message — duos themselves have no
// phone. These helpers turn either shape into a flat list of recipients so every
// WhatsApp path (reminders, fixtures, knockout, score links) reaches both duo
// members instead of silently skipping team-backed matches.

export interface WaRecipient {
  playerId: string;
  name: string;
  phone: string;
}

interface SidePlayer {
  id: string;
  name: string;
  phone: string | null;
}

interface SideTeam {
  players: { player: SidePlayer }[];
}

/**
 * Who to WhatsApp for one side of a match:
 * - individual player → that player (if they have a phone)
 * - duo / team → every active member with a phone
 */
export function resolveSideRecipients(side: {
  player?: SidePlayer | null;
  team?: SideTeam | null;
}): WaRecipient[] {
  if (side.player?.phone) {
    return [{ playerId: side.player.id, name: side.player.name, phone: side.player.phone }];
  }
  const members = side.team?.players?.map((p) => p.player) ?? [];
  return members
    .filter((p): p is SidePlayer & { phone: string } => !!p.phone)
    .map((p) => ({ playerId: p.id, name: p.name, phone: p.phone }));
}

/** Prisma select fragment for a side's team that exposes its members' contact details. */
export const teamMembersSelect = {
  players: {
    where: { isActive: true },
    select: { player: { select: { id: true, name: true, phone: true } } },
  },
} as const;

/**
 * Guarantee a match has both report tokens (group-stage matches are created
 * without them). Generates + persists any missing token and returns both, so
 * the score-report magic link works for duo matches too.
 */
export async function ensureMatchTokens(
  matchId: string,
  current: { homeToken: string | null; awayToken: string | null }
): Promise<{ homeToken: string; awayToken: string }> {
  const data: { homeToken?: string; awayToken?: string } = {};
  if (!current.homeToken) data.homeToken = randomUUID();
  if (!current.awayToken) data.awayToken = randomUUID();
  if (data.homeToken || data.awayToken) {
    await prisma.match.update({ where: { id: matchId }, data });
  }
  return {
    homeToken: current.homeToken ?? data.homeToken!,
    awayToken: current.awayToken ?? data.awayToken!,
  };
}
