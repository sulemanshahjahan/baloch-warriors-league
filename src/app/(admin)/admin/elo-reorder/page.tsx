export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { EloReorderList } from "./elo-reorder-list";

export default async function EloReorderPage() {
  await requireRole("ADMIN");

  const matches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      homePlayerId: { not: null },
      awayPlayerId: { not: null },
      tournament: { participantType: "INDIVIDUAL", gameCategory: { not: "PUBG" } },
    },
    orderBy: { completedAt: "asc" },
    select: {
      id: true,
      round: true,
      homeScore: true,
      awayScore: true,
      leg2HomeScore: true,
      leg2AwayScore: true,
      completedAt: true,
      homePlayer: { select: { name: true } },
      awayPlayer: { select: { name: true } },
      tournament: { select: { name: true } },
    },
  });

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="ELO Match Order"
        description={`${matches.length} completed matches — set the order then recalculate`}
      />
      <main className="flex-1 p-6">
        <EloReorderList matches={matches} />
      </main>
    </div>
  );
}
