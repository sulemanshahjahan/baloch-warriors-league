import "server-only";
import { auth, getUserRole } from "@/lib/auth";
import { getPlayerSession } from "@/lib/player-session";

const ROLE_LEVELS: Record<string, number> = { SUPER_ADMIN: 3, ADMIN: 2, EDITOR: 1 };

/** Returns the admin's id if the session meets `min`, else null. */
export async function adminActor(min: "EDITOR" | "ADMIN" | "SUPER_ADMIN" = "ADMIN"): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session) return null;
  const level = ROLE_LEVELS[getUserRole(session)] ?? 0;
  if (level < (ROLE_LEVELS[min] ?? 0)) return null;
  return { id: (session.user as { id?: string })?.id ?? "admin" };
}

/** Returns the logged-in player's id, or null. */
export async function playerActor(): Promise<string | null> {
  return (await getPlayerSession())?.playerId ?? null;
}
