import { auth } from "@/lib/auth";

const ROLE_LEVELS: Record<string, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR: 1,
};

export async function getAuthSession() {
  const session = await auth();
  if (!session) return { session: null, role: null, isAdmin: false, isSuperAdmin: false };
  const role = (session.user as { role?: string })?.role ?? "EDITOR";
  return {
    session,
    role,
    isAdmin: (ROLE_LEVELS[role] ?? 0) >= ROLE_LEVELS.ADMIN,
    isSuperAdmin: role === "SUPER_ADMIN",
  };
}
