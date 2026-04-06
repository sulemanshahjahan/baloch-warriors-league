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
import { User, Trophy, ChevronRight, Search } from "lucide-react";
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
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {positions.length > 0 && (
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-[160px]">
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
            <SelectTrigger className="w-[180px]">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((player) => {
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
                        <span className="text-sm text-muted-foreground">Free Agent</span>
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
  );
}
