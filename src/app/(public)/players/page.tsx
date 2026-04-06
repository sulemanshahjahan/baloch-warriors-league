export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Trophy, ChevronRight, Users } from "lucide-react";
import { getInitials } from "@/lib/utils";

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
        {players.length === 0 ? (
          <div className="text-center py-16">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No players registered yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {players.map((player) => {
              const currentTeam = player.teams[0]?.team;
              return (
                <Link key={player.id} href={`/players/${player.slug}`}>
                  <Card className="hover:border-primary/50 transition-all hover:-translate-y-0.5 cursor-pointer h-full group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={player.photoUrl ?? undefined} />
                          <AvatarFallback className="text-xl">
                            {getInitials(player.name)}
                          </AvatarFallback>
                        </Avatar>
                        <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>

                      <h3 className="font-bold text-lg mt-4 group-hover:text-primary transition-colors">
                        {player.name}
                      </h3>

                      {player.nickname && (
                        <p className="text-sm text-muted-foreground">
                          &quot;{player.nickname}&quot;
                        </p>
                      )}

                      {player.position && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {player.position}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                        {currentTeam ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={currentTeam.logoUrl ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(currentTeam.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground truncate">
                              {currentTeam.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Free Agent
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Trophy className="w-3 h-3" />
                          <span>{player._count.awards} awards</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
