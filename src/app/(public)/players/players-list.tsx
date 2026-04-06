"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Trophy, Search, Target, Swords, SwordsIcon } from "lucide-react";
import { getInitials } from "@/lib/utils";

type Player = {
  id: string;
  slug: string;
  name: string;
  nickname: string | null;
  photoUrl: string | null;
  position: string | null;
  nationality: string | null;
  _count: { matchEvents: number; awards: number };
  teams: { team: { name: string; logoUrl: string | null } }[];
  stats: {
    goals: number;
    assists: number;
    matches: number;
    tournaments: number;
  };
};

export function PlayersList({ players }: { players: Player[] }) {
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");

  // Collect unique positions and teams
  const positions = useMemo(
    () =>
      Array.from(
        new Set(players.map((p) => p.position).filter(Boolean) as string[])
      ).sort(),
    [players]
  );

  const teams = useMemo(
    () =>
      Array.from(
        new Map(
          players.flatMap((p) =>
            p.teams.map((t) => [t.team.name, t.team.name])
          )
        ).values()
      ).sort(),
    [players]
  );

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.nickname?.toLowerCase().includes(q) &&
          !p.nationality?.toLowerCase().includes(q)
        )
          return false;
      }
      if (positionFilter !== "all" && p.position !== positionFilter) return false;
      if (teamFilter !== "all") {
        const teamNames = p.teams.map((t) => t.team.name);
        if (!teamNames.includes(teamFilter)) return false;
      }
      return true;
    });
  }, [players, search, positionFilter, teamFilter]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full"
          />
        </div>

        <div className="flex gap-2">
          {positions.length > 0 && (
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[130px] sm:w-[160px]">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                {positions.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {teams.length > 0 && (
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[130px] sm:w-[160px]">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                <SelectItem value="__free">Free Agents</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} player{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== players.length && ` of ${players.length}`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No players match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {filtered.map((player) => {
            const currentTeam = player.teams[0]?.team;
            return (
              <Link key={player.id} href={`/players/${player.slug}`}>
                <Card className="hover:border-primary/50 transition-all hover:-translate-y-0.5 cursor-pointer h-full group overflow-hidden">
                  <CardContent className="p-3 sm:p-4">
                    {/* Big Avatar - Centered */}
                    <div className="flex flex-col items-center">
                      <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-border">
                        <AvatarImage src={player.photoUrl ?? undefined} />
                        <AvatarFallback className="text-xl sm:text-2xl bg-muted">
                          {getInitials(player.name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Name & Nickname */}
                      <h3 className="font-bold text-sm sm:text-base mt-3 group-hover:text-primary transition-colors text-center truncate w-full">
                        {player.name}
                      </h3>
                      
                      {player.nickname && (
                        <p className="text-xs text-muted-foreground text-center truncate w-full">
                          &quot;{player.nickname}&quot;
                        </p>
                      )}

                      {/* Position Badge */}
                      <div className="flex items-center gap-1 mt-2">
                        {player.position && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {player.position}
                          </span>
                        )}
                        {player._count.awards > 0 && (
                          <span className="text-[10px] sm:text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <Trophy className="w-3 h-3" />
                            {player._count.awards}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats Row - Always show for consistent layout */}
                    <div className="grid grid-cols-3 gap-1 mt-3 pt-3 border-t border-border/50">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-0.5 text-green-400">
                          <Target className="w-3 h-3" />
                          <span className="text-xs font-bold">{player.stats.goals}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Goals</span>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-0.5 text-blue-400">
                          <SwordsIcon className="w-3 h-3" />
                          <span className="text-xs font-bold">{player.stats.assists}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Assists</span>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-0.5 text-orange-400">
                          <Swords className="w-3 h-3" />
                          <span className="text-xs font-bold">{player.stats.matches}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Matches</span>
                      </div>
                    </div>

                    {/* Team */}
                    <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                      {currentTeam ? (
                        <>
                          <Avatar className="h-4 w-4 flex-shrink-0">
                            <AvatarImage src={currentTeam.logoUrl ?? undefined} />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(currentTeam.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate">
                            {currentTeam.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Free Agent</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
