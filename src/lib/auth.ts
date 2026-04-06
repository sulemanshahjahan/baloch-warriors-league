import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

// Role hierarchy: SUPER_ADMIN > ADMIN > EDITOR
const ROLE_LEVELS: Record<string, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR: 1,
};

export async function requireRole(minRole: "EDITOR" | "ADMIN" | "SUPER_ADMIN") {
  const session = await auth();
  if (!session) redirect("/login");

  const userRole = (session.user as { role?: string })?.role ?? "EDITOR";
  const userLevel = ROLE_LEVELS[userRole] ?? 0;
  const requiredLevel = ROLE_LEVELS[minRole] ?? 0;

  if (userLevel < requiredLevel) {
    redirect("/admin?error=forbidden");
  }

  return session;
}

export function getUserRole(session: Awaited<ReturnType<typeof auth>>): string {
  return (session?.user as { role?: string })?.role ?? "EDITOR";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.adminUser.findUnique({
          where: { email: credentials.email as string },
        });

        if (!admin || !admin.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          admin.password
        );

        if (!isValid) return null;

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
});
