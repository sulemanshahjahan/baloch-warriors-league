import { redirect } from "next/navigation";
import Link from "next/link";
import { getPlayerSession } from "@/lib/player-session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Account | BWL" };

export default async function AccountPage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");
  const player = await prisma.player.findUnique({
    where: { id: session.playerId },
    select: { name: true, slug: true, email: true, passwordHash: true, coins: true, legacyLevel: true, legacyTier: true },
  });
  if (!player) redirect("/player/login");

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-black">My Account</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {player.name} · {player.email} · Lvl {player.legacyLevel} {player.legacyTier} · {player.coins.toLocaleString()} 🪙
        </p>
        <Link href={`/players/${player.slug}`} className="text-sm text-primary hover:underline">View my profile →</Link>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Password</CardTitle></CardHeader>
        <CardContent>
          <AccountForm hasPassword={!!player.passwordHash} />
        </CardContent>
      </Card>
    </div>
  );
}
