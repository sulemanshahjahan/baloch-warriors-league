export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Trophy, ChevronRight, Shield } from "lucide-react";
import { getInitials } from "@/lib/utils";

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
        {teams.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No teams registered yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.slug}`}>
                <Card className="hover:border-primary/50 transition-all hover:-translate-y-0.5 cursor-pointer h-full group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={team.logoUrl ?? undefined} />
                        <AvatarFallback
                          className="text-xl"
                          style={{
                            backgroundColor: team.primaryColor
                              ? `${team.primaryColor}33`
                              : undefined,
                          }}
                        >
                          {getInitials(team.name)}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <h3 className="font-bold text-lg mt-4 group-hover:text-primary transition-colors">
                      {team.name}
                    </h3>

                    {team.shortName && (
                      <p className="text-sm text-muted-foreground">
                        {team.shortName}
                      </p>
                    )}

                    {team.captain && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Captain: {team.captain.name}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{team._count.players} players</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Trophy className="w-4 h-4" />
                        <span>{team._count.tournaments} tournaments</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
