import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SmartAvatar } from "@/components/public/smart-avatar";
import {
  Trophy,
  ArrowLeft,
  Crown,
  Target,
  ShieldCheck,
  BarChart3,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { gameLabel } from "@/lib/utils";

export const revalidate = 300;

interface RecapPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RecapPageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await prisma.tournament.findUnique({ where: { slug }, select: { name: true } });
  if (!t) return { title: "Not Found" };
  return {
    title: `Group Stage Recap — ${t.name}`,
    description: `Complete group stage recap with standings, qualifiers, top scorers, and more.`,
  };
}

export default async function RecapPage({ params }: RecapPageProps) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: { groups: { orderBy: { orderIndex: "asc" } } },
  });

  if (!tournament) notFound();

  // Standings per group
  const standings = await prisma.standing.findMany({
    where: { tournamentId: tournament.id, groupId: { not: null } },
    include: {
      player: { select: { id: true, name: true, slug: true, photoUrl: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: [{ points: "desc" }, { goalDiff: "desc" }, { goalsFor: "desc" }],
  });

  // Group standings by group
  const groupMap = new Map<string, {
    name: string;
    players: typeof standings;
  }>();
  for (const s of standings) {
    const gId = s.groupId ?? "unknown";
    const gName = s.group?.name ?? "Unknown";
    if (!groupMap.has(gId)) groupMap.set(gId, { name: gName, players: [] });
    groupMap.get(gId)!.players.push(s);
  }

  // Top scorers
  const topScorers = await prisma.matchEvent.groupBy({
    by: ["playerId"],
    where: { type: "GOAL", match: { tournamentId: tournament.id }, playerId: { not: null } },
    _count: { type: true },
    orderBy: { _count: { type: "desc" } },
    take: 5,
  });
  const scorerPlayers = await prisma.player.findMany({
    where: { id: { in: topScorers.map((s) => s.playerId!).filter(Boolean) } },
    select: { id: true, name: true, slug: true, photoUrl: true },
  });
  const scorerMap = new Map(scorerPlayers.map((p) => [p.id, p]));

  // ELO rankings (top players who played in this tournament)
  const tournamentPlayerIds = standings.map((s) => s.player?.id).filter(Boolean) as string[];
  const eloPlayers = await prisma.player.findMany({
    where: { id: { in: tournamentPlayerIds } },
    orderBy: { eloRating: "desc" },
    take: 5,
    select: { id: true, name: true, slug: true, photoUrl: true, eloRating: true },
  });

  // Best defensive records
  const defensive = standings
    .filter((s) => s.played > 0)
    .sort((a, b) => (a.goalsAgainst / a.played) - (b.goalsAgainst / b.played))
    .slice(0, 5);

  // Knockout matches (if any exist)
  const knockoutMatches = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      groupId: null,
      round: { not: { contains: "Group" } },
    },
    orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
    include: {
      homePlayer: { select: { id: true, name: true, slug: true } },
      awayPlayer: { select: { id: true, name: true, slug: true } },
    },
  });

  // Group knockout matches by round name
  const knockoutRounds = new Map<string, typeof knockoutMatches>();
  for (const m of knockoutMatches) {
    const roundName = m.round ?? `Round ${m.roundNumber}`;
    if (!knockoutRounds.has(roundName)) knockoutRounds.set(roundName, []);
    knockoutRounds.get(roundName)!.push(m);
  }

  // Qualifiers: top 4 per group
  const qualifiers: typeof standings = [];
  const eliminated: typeof standings = [];
  for (const [, group] of groupMap) {
    group.players.forEach((p, i) => {
      if (i < 4) qualifiers.push(p);
      else eliminated.push(p);
    });
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Link
            href={`/tournaments/${slug}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tournament
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{gameLabel(tournament.gameCategory)}</Badge>
            {tournament.eFootballType && (
              <Badge variant="outline" className={tournament.eFootballType === "DREAM" ? "text-purple-400 border-purple-400/30" : "text-amber-400 border-amber-400/30"}>
                {tournament.eFootballType === "DREAM" ? "Dream" : "Authentic"}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tight">{tournament.name}</h1>
          <p className="text-lg text-muted-foreground mt-1">Group Stage Recap</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Qualifiers */}
        <Card className="border-emerald-500/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-emerald-400">
              <Crown className="w-5 h-5" />
              Qualified for Knockout — Round of 16
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
              {qualifiers.map((q) => q.player && (
                <Link key={q.id} href={`/players/${q.player.slug}`} className="flex flex-col items-center gap-1 group">
                  <SmartAvatar
                    type="player"
                    id={q.player.id}
                    name={q.player.name}
                    className="h-12 w-12 ring-2 ring-emerald-500/30 group-hover:ring-emerald-400 transition-all"
                    fallbackClassName="text-xs"
                  />
                  <span className="text-xs font-medium text-center leading-tight group-hover:text-emerald-400 transition-colors">{q.player.name}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Group Standings */}
        {[...groupMap.entries()].map(([gId, group]) => (
          <Card key={gId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{group.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {group.players.map((s, i) => {
                  const qualified = i < 4;
                  return s.player ? (
                    <Link
                      key={s.id}
                      href={`/players/${s.player.slug}`}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${qualified ? "bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10" : "bg-muted/30 hover:bg-muted/50 opacity-60"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold w-5 ${i === 0 ? "text-amber-400" : i < 4 ? "text-emerald-400" : "text-muted-foreground"}`}>
                          {i + 1}
                        </span>
                        <SmartAvatar
                          type="player"
                          id={s.player.id}
                          name={s.player.name}
                          className="h-9 w-9"
                          fallbackClassName="text-xs"
                        />
                        <div>
                          <p className="font-medium text-sm">{s.player.name}</p>
                          <p className="text-xs text-muted-foreground">
                            W{s.won} D{s.drawn} L{s.lost}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">
                          {s.goalsFor}-{s.goalsAgainst}
                        </span>
                        <span className={`font-mono ${s.goalDiff > 0 ? "text-emerald-400" : s.goalDiff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {s.goalDiff > 0 ? "+" : ""}{s.goalDiff}
                        </span>
                        <span className="font-bold text-base w-8 text-right">{s.points}</span>
                        {qualified ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 text-[10px] px-1.5">Q</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] px-1.5">E</Badge>
                        )}
                      </div>
                    </Link>
                  ) : null;
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Knockout Bracket */}
        {knockoutRounds.size > 0 && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Knockout Stage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[...knockoutRounds.entries()].map(([roundName, matches]) => (
                <div key={roundName}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{roundName}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matches.map((m) => {
                      const homeName = m.homePlayer?.name ?? "TBD";
                      const awayName = m.awayPlayer?.name ?? "TBD";
                      const isCompleted = m.status === "COMPLETED";
                      const has2Legs = m.leg2HomeScore != null;
                      const displayHome = has2Legs ? (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) : (m.homeScore ?? 0);
                      const displayAway = has2Legs ? (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) : (m.awayScore ?? 0);
                      return (
                        <Link key={m.id} href={`/matches/${m.id}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50">
                          <div className="flex items-center gap-2">
                            {m.homePlayer ? (
                              <SmartAvatar type="player" id={m.homePlayer.id} name={homeName} className="h-7 w-7" fallbackClassName="text-[10px]" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">?</div>
                            )}
                            <span className={`text-sm font-medium ${homeName === "TBD" ? "text-muted-foreground" : ""}`}>{homeName}</span>
                          </div>
                          {isCompleted ? (
                            <div className="text-center">
                              <span className="text-sm font-black">{displayHome} - {displayAway}</span>
                              {has2Legs && <p className="text-[10px] text-muted-foreground">Agg</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">vs</span>
                          )}
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${awayName === "TBD" ? "text-muted-foreground" : ""}`}>{awayName}</span>
                            {m.awayPlayer ? (
                              <SmartAvatar type="player" id={m.awayPlayer.id} name={awayName} className="h-7 w-7" fallbackClassName="text-[10px]" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">?</div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top Scorers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Golden Boot Race
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topScorers.map((s, i) => {
                const player = scorerMap.get(s.playerId!);
                return player ? (
                  <Link key={player.id} href={`/players/${player.slug}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-5 ${i === 0 ? "text-amber-400" : "text-muted-foreground"}`}>{i + 1}</span>
                      <SmartAvatar type="player" id={player.id} name={player.name} className="h-9 w-9" fallbackClassName="text-xs" />
                      <span className="font-medium text-sm">{player.name}</span>
                    </div>
                    <span className="text-lg font-black">{s._count.type}</span>
                  </Link>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>

        {/* ELO Rankings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              ELO Power Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {eloPlayers.map((p, i) => (
                <Link key={p.id} href={`/players/${p.slug}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-5 ${i === 0 ? "text-blue-400" : "text-muted-foreground"}`}>{i + 1}</span>
                    <SmartAvatar type="player" id={p.id} name={p.name} className="h-9 w-9" fallbackClassName="text-xs" />
                    <span className="font-medium text-sm">{p.name}</span>
                  </div>
                  <span className="text-lg font-black text-blue-400">{p.eloRating}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Best Defensive */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Best Defensive Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {defensive.map((s, i) => s.player ? (
                <Link key={s.id} href={`/players/${s.player.slug}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-5 ${i === 0 ? "text-cyan-400" : "text-muted-foreground"}`}>{i + 1}</span>
                    <SmartAvatar type="player" id={s.player.id} name={s.player.name} className="h-9 w-9" fallbackClassName="text-xs" />
                    <span className="font-medium text-sm">{s.player.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-cyan-400">{s.goalsAgainst}</span>
                    <span className="text-xs text-muted-foreground ml-1">conceded in {s.played} matches</span>
                  </div>
                </Link>
              ) : null)}
            </div>
          </CardContent>
        </Card>

        {/* Eliminated */}
        <Card className="border-destructive/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
              <XCircle className="w-4 h-4" />
              Eliminated — Better Luck Next Season
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
              {eliminated.map((e) => e.player && (
                <Link key={e.id} href={`/players/${e.player.slug}`} className="flex flex-col items-center gap-1 group opacity-60 hover:opacity-100 transition-opacity">
                  <SmartAvatar
                    type="player"
                    id={e.player.id}
                    name={e.player.name}
                    className="h-10 w-10 grayscale group-hover:grayscale-0 transition-all"
                    fallbackClassName="text-xs"
                  />
                  <span className="text-xs text-center leading-tight">{e.player.name}</span>
                </Link>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              You fought hard. See you next season!
            </p>
          </CardContent>
        </Card>

        {/* What's Next */}
        <Card className="border-primary/20">
          <CardContent className="pt-6 text-center space-y-3">
            <Trophy className="w-10 h-10 text-primary mx-auto" />
            <h3 className="text-xl font-bold">Knockout Stage Coming Soon</h3>
            <p className="text-muted-foreground text-sm">
              16 players. 8 matches. Single elimination. Every match counts.
            </p>
            <Link
              href={`/tournaments/${slug}`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View Tournament <ChevronRight className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
