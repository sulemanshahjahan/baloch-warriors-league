export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getAwards, getAwardStats } from "@/lib/actions/award";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Award, Trophy, TrendingUp, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, formatDate } from "@/lib/utils";

export const metadata = { title: "Awards" };

const AWARD_TYPE_LABELS: Record<string, string> = {
  GOLDEN_BOOT: "Golden Boot",
  TOP_ASSISTS: "Top Assists",
  BEST_PLAYER: "Best Player",
  BEST_GOALKEEPER: "Best Goalkeeper",
  FAIR_PLAY: "Fair Play",
  TOURNAMENT_MVP: "Tournament MVP",
  TOURNAMENT_WINNER: "Tournament Winner",
  CUSTOM: "Custom",
};

export default async function AwardsPage() {
  const [awards, stats] = await Promise.all([getAwards(), getAwardStats()]);

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Awards"
        description={`${stats.totalAwards} awards given across all tournaments`}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Awards</p>
                  <p className="text-3xl font-bold">{stats.totalAwards}</p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-400/10">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Award Types</p>
                  <p className="text-3xl font-bold">{stats.awardsByType.length}</p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10">
                  <Award className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Most Common</p>
                  <p className="text-lg font-bold truncate">
                    {stats.awardsByType.length > 0
                      ? AWARD_TYPE_LABELS[stats.awardsByType[0].type] ??
                        stats.awardsByType[0].type
                      : "—"}
                  </p>
                </div>
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-400/10">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Awards List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Awards</CardTitle>
          </CardHeader>
          <CardContent>
            {awards.length === 0 ? (
              <div className="text-center py-12">
                <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-1">No awards yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Awards are created from individual tournament pages.
                </p>
                <Button asChild>
                  <Link href="/admin/tournaments">
                    Go to Tournaments
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Award</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Tournament</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {awards.map((award) => (
                    <TableRow key={award.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20">
                            <Award className="w-4 h-4 text-yellow-400" />
                          </div>
                          <span className="font-medium">
                            {AWARD_TYPE_LABELS[award.type] ?? award.type}
                            {award.customName && (
                              <span className="text-muted-foreground ml-1">
                                ({award.customName})
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {award.player ? (
                          <Link
                            href={`/admin/players/${award.player.id}`}
                            className="flex items-center gap-2 hover:text-primary hover:underline"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={award.player.photoUrl ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(award.player.name)}
                              </AvatarFallback>
                            </Avatar>
                            {award.player.name}
                          </Link>
                        ) : award.team ? (
                          <Link
                            href={`/admin/teams/${award.team.id}`}
                            className="flex items-center gap-2 hover:text-primary hover:underline"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={award.team.logoUrl ?? undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(award.team.name)}
                              </AvatarFallback>
                            </Avatar>
                            {award.team.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/tournaments/${award.tournament.id}`}
                          className="text-sm hover:text-primary hover:underline"
                        >
                          {award.tournament.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(award.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Awards */}
        {stats.recentAwards.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recently Added</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentAwards.map((award) => (
                  <div
                    key={award.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20">
                        <Award className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {AWARD_TYPE_LABELS[award.type] ?? award.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {award.player?.name ?? award.team?.name ?? "No recipient"} •{" "}
                          {award.tournament.name}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(award.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
