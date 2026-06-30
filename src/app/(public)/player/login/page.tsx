import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/player-session";
import { prisma } from "@/lib/db";
import { PlayerLoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Player Login | BWL" };

const OAUTH_ERRORS: Record<string, string> = {
  google: "Google sign-in failed. Please try again.",
  google_not_configured: "Google sign-in isn't set up yet.",
  google_email: "Your Google email isn't verified.",
  no_account: "No BWL player has that email. Ask an admin to add it to your profile.",
};

export default async function PlayerLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getPlayerSession();
  if (session) {
    const p = await prisma.player.findUnique({ where: { id: session.playerId }, select: { slug: true } });
    if (p?.slug) redirect(`/players/${p.slug}`);
  }
  const { error } = await searchParams;
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-black text-center mb-2">Sign in to BWL</h1>
      <p className="text-center text-muted-foreground text-sm mb-6">
        Claim your coins, predict matches, and customise your profile.
      </p>
      <PlayerLoginForm initialError={error ? OAUTH_ERRORS[error] ?? "Sign-in failed." : undefined} />
    </div>
  );
}
