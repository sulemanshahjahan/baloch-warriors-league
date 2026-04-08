"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Users, Trophy, ChevronRight, Search, Shield } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { SmartAvatar } from "@/components/public/smart-avatar";

type Team = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  primaryColor: string | null;
  captain: { name: string } | null;
  _count: { players: number; tournaments: number };
};

export function TeamsList({ teams }: { teams: Team[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return teams;
    const q = search.toLowerCase();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortName?.toLowerCase().includes(q) ||
        t.captain?.name.toLowerCase().includes(q)
    );
  }, [teams, search]);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} team{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== teams.length && ` of ${teams.length}`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No teams match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((team) => (
            <Link key={team.id} href={`/teams/${team.slug}`}>
              <Card
                className="hover:border-primary/50 transition-all hover:-translate-y-0.5 cursor-pointer h-full group overflow-hidden"
                style={team.primaryColor ? { borderTopColor: team.primaryColor, borderTopWidth: 3 } : undefined}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <SmartAvatar
                      type="team"
                      id={team.id}
                      name={team.name}
                      className="h-16 w-16"
                      fallbackClassName="text-xl"
                      primaryColor={team.primaryColor}
                    />
                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <h3 className="font-bold text-lg mt-4 group-hover:text-primary transition-colors">
                    {team.name}
                  </h3>

                  {team.shortName && (
                    <p className="text-sm text-muted-foreground">{team.shortName}</p>
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
  );
}
