export const revalidate = 60;

import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Shield } from "lucide-react";
import { TeamsList } from "./teams-list";

export const metadata: Metadata = {
  title: "Teams",
  description: "All BWL teams — rosters, captains, and tournament records.",
  openGraph: {
    title: "Teams | Baloch Warriors League",
    description: "Browse every team in the Baloch Warriors League.",
    type: "website",
  },
};

async function getTeams() {
  return prisma.team.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { players: true, tournaments: true },
      },
      captain: { select: { name: true } },
    },
  });
}

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary tracking-widest uppercase">
              Teams
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            All Teams
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Meet the squads competing in the Baloch Warriors League. View team
            rosters, stats, and tournament history.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TeamsList teams={teams} />
      </div>
    </div>
  );
}
