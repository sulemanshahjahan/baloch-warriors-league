export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { MatchFinder } from "./match-finder";

export default async function MatchFinderPage() {
  await requireRole("EDITOR");

  // Get all players for the search dropdown
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  // Get all tournaments for filtering
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Match Finder"
        description="Search matches by player name — instant results"
      />
      <main className="flex-1 p-6">
        <MatchFinder players={players} tournaments={tournaments} />
      </main>
    </div>
  );
}
