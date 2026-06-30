export const dynamic = "force-dynamic";

import { Gift } from "lucide-react";
import { prisma } from "@/lib/db";
import { getPlayerSession } from "@/lib/player-session";
import { RaffleList, type RaffleView } from "./raffle-list";

export const metadata = { title: "BWL Raffles — Win real prizes", description: "Spend coins on tickets for real BWL prizes." };

export default async function RafflesPage() {
  const session = await getPlayerSession();
  const [raffles, me] = await Promise.all([
    prisma.raffle.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, name: true, prize: true, costPerTicket: true, isActive: true, winnerPlayerId: true,
        entries: { select: { playerId: true, tickets: true } },
      },
    }),
    session ? prisma.player.findUnique({ where: { id: session.playerId }, select: { coins: true } }) : Promise.resolve(null),
  ]);

  const winnerIds = raffles.map((r) => r.winnerPlayerId).filter(Boolean) as string[];
  const winners = winnerIds.length
    ? new Map((await prisma.player.findMany({ where: { id: { in: winnerIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]))
    : new Map<string, string>();

  const view: RaffleView[] = raffles.map((r) => ({
    id: r.id, name: r.name, prize: r.prize, costPerTicket: r.costPerTicket, isActive: r.isActive,
    winnerName: r.winnerPlayerId ? winners.get(r.winnerPlayerId) ?? null : null,
    totalTickets: r.entries.reduce((s, e) => s + e.tickets, 0),
    myTickets: session ? r.entries.find((e) => e.playerId === session.playerId)?.tickets ?? 0 : 0,
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-black flex items-center gap-2"><Gift className="w-7 h-7 text-amber-300" /> BWL Raffles</h1>
        <p className="text-muted-foreground mt-1">Spend coins on tickets — win real BWL prizes. More tickets, better odds.</p>
      </div>
      <RaffleList raffles={view} loggedIn={!!session} coins={me?.coins ?? 0} />
    </div>
  );
}
