export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Users } from "lucide-react";
import { PlayersList } from "./players-list";

export const metadata: Metadata = {
  title: "Players",
  description: "Browse all BWL players — view profiles, stats, and tournament history.",
  openGraph: {
    title: "Players | Baloch Warriors League",
    description: "All BWL players with profiles and career statistics.",
    type: "website",
  },
};

async function getPlayers() {
  return prisma.player.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { matchEvents: true, awards: true },
      },
      teams: {
        where: { isActive: true },
        include: { team: { select: { name: true, logoUrl: true } } },
        take: 1,
      },
    },
  });
}

export default async function PlayersPage() {
  const players = await getPlayers();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Players
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            All Players
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Discover the athletes competing in the Baloch Warriors League. View
            player profiles, stats, and achievements.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PlayersList players={players} />
      </div>
    </div>
  );
}
