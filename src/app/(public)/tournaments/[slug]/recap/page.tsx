export const revalidate = 60; // ISR — regenerate at most once per minute

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { DuoTeamAvatar } from "@/components/public/duo-team-avatar";
import { TiebreakInfo } from "@/components/public/tiebreak-info";
import { Trophy, ArrowLeft, Crown, Target, ShieldCheck, BarChart3, XCircle } from "lucide-react";
import { gameLabel } from "@/lib/utils";

interface RecapPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RecapPageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await prisma.tournament.findUnique({ where: { slug }, select: { name: true } });
  if (!t) return { title: "Not Found" };
  return {
    title: `Recap — ${t.name}`,
    description: `Standings, qualifiers, knockout bracket, top scorers and records.`,
  };
}

// A normalised entrant (player OR team) used across the recap.
type TeamSel = { id: string; name: string; slug: string; isDuo: boolean; players: { player: { id: string; name: string; photoUrl: string | null } }[] };
type PlayerSel = { id: string; name: string; slug: string };
type Entrant = { key: string; id: string; name: string; href: string; type: "player" | "team"; team?: TeamSel };

function entrantOfTeam(team: TeamSel | null): Entrant | null {
  if (!team) return null;
  return { key: `t:${team.id}`, id: team.id, name: team.name, href: `/teams/${team.slug}`, type: "team", team };
}
function entrantOfPlayer(player: PlayerSel | null): Entrant | null {
  if (!player) return null;
  return { key: `p:${player.id}`, id: player.id, name: player.name, href: `/players/${player.slug}`, type: "player" };
}
function entrantOf(s: { team: TeamSel | null; player: PlayerSel | null }): Entrant | null {
  return entrantOfTeam(s.team) ?? entrantOfPlayer(s.player);
}

function EntrantAvatar({ e, className, fallbackClassName, memberClassName }: { e: Entrant; className?: string; fallbackClassName?: string; memberClassName?: string }) {
  if (e.type === "team" && e.team) {
    return (
      <DuoTeamAvatar
        id={e.team.id}
        name={e.name}
        isDuo={e.team.isDuo}
        members={e.team.players.map((p) => p.player)}
        className={className}
        memberClassName={memberClassName}
        fallbackClassName={fallbackClassName}
      />
    );
  }
  return <SmartAvatar type="player" id={e.id} name={e.name} className={className} fallbackClassName={fallbackClassName} />;
}

const TEAM_INCLUDE = { select: { id: true, name: true, slug: true, isDuo: true, players: { where: { isActive: true }, select: { player: { select: { id: true, name: true, photoUrl: true } } } } } } as const;

export default async function RecapPage({ params }: RecapPageProps) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: { groups: { orderBy: { orderIndex: "asc" } } },
  });
  if (!tournament) notFound();

  // Group standings (team OR player based)
  const standings = await prisma.standing.findMany({
    where: { tournamentId: tournament.id, groupId: { not: null } },
    include: {
      player: { select: { id: true, name: true, slug: true } },
      team: TEAM_INCLUDE,
      group: { select: { id: true, name: true } },
    },
    orderBy: [{ rank: "asc" }, { id: "asc" }],
  });

  type StandingRow = (typeof standings)[number];
  const groupMap = new Map<string, { name: string; rows: StandingRow[] }>();
  for (const s of standings) {
    const gId = s.groupId ?? "unknown";
    if (!groupMap.has(gId)) groupMap.set(gId, { name: s.group?.name ?? "Group", rows: [] });
    groupMap.get(gId)!.rows.push(s);
  }

  // Knockout matches (team OR player)
  const knockoutMatches = await prisma.match.findMany({
    where: { tournamentId: tournament.id, groupId: null, round: { not: { contains: "Group" } } },
    orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
    include: {
      homePlayer: { select: { id: true, name: true, slug: true } },
      awayPlayer: { select: { id: true, name: true, slug: true } },
      homeTeam: TEAM_INCLUDE,
      awayTeam: TEAM_INCLUDE,
    },
  });

  const hasKnockout = knockoutMatches.length > 0;
  const minRound = hasKnockout ? Math.min(...knockoutMatches.map((m) => m.roundNumber ?? 99)) : null;
  const firstRoundMatches = knockoutMatches.filter((m) => (m.roundNumber ?? 99) === minRound);
  const firstRoundName = firstRoundMatches[0]?.round ?? "Knockout";

  // Qualifiers = entrants that appear in the first knockout round.
  const qualifierKeys = new Set<string>();
  for (const m of firstRoundMatches) {
    for (const e of [entrantOfTeam(m.homeTeam), entrantOfTeam(m.awayTeam), entrantOfPlayer(m.homePlayer), entrantOfPlayer(m.awayPlayer)]) {
      if (e) qualifierKeys.add(e.key);
    }
  }
  // Fallback when the bracket hasn't been seeded yet: top half of each group.
  const groupSize = Math.max(0, ...[...groupMap.values()].map((g) => g.rows.length));
  const fallbackAdvance = Math.max(1, Math.ceil(groupSize / 2));
  const isQualified = (e: Entrant | null, idx: number) =>
    e ? (hasKnockout ? qualifierKeys.has(e.key) : idx < fallbackAdvance) : false;

  // Group knockout by round
  const knockoutRounds = new Map<string, typeof knockoutMatches>();
  for (const m of knockoutMatches) {
    const roundName = m.round ?? `Round ${m.roundNumber}`;
    if (!knockoutRounds.has(roundName)) knockoutRounds.set(roundName, []);
    knockoutRounds.get(roundName)!.push(m);
  }

  // Top scorers (event-based → works for 1v1 and 2v2)
  const topScorers = await prisma.matchEvent.groupBy({
    by: ["playerId"],
    where: { type: "GOAL", match: { tournamentId: tournament.id }, playerId: { not: null } },
    _count: { type: true },
    orderBy: { _count: { type: "desc" } },
    take: 5,
  });
  const scorerPlayers = await prisma.player.findMany({
    where: { id: { in: topScorers.map((s) => s.playerId!).filter(Boolean) } },
    select: { id: true, name: true, slug: true },
  });
  const scorerMap = new Map(scorerPlayers.map((p) => [p.id, p]));

  // ELO — rank the players who took part (team members for 2v2)
  const memberIds = new Set<string>();
  for (const s of standings) {
    if (s.team) s.team.players.forEach((pp) => memberIds.add(pp.player.id));
    else if (s.player) memberIds.add(s.player.id);
  }
  const eloPlayers = await prisma.player.findMany({
    where: { id: { in: [...memberIds] } },
    orderBy: [{ eloRating: "desc" }, { cardRank: "desc" }, { id: "asc" }],
    take: 5,
    select: { id: true, name: true, slug: true, eloRating: true },
  });

  // Best defensive (fewest conceded per game)
  const defensive = standings
    .filter((s) => s.played > 0)
    .sort((a, b) => a.goalsAgainst / a.played - b.goalsAgainst / b.played)
    .slice(0, 5);

  // Qualifiers / eliminated lists for the top & bottom cards
  const qualifiers: { s: StandingRow; e: Entrant }[] = [];
  const eliminated: { s: StandingRow; e: Entrant }[] = [];
  for (const [, group] of groupMap) {
    group.rows.forEach((s, i) => {
      const e = entrantOf(s);
      if (!e) return;
      (isQualified(e, i) ? qualifiers : eliminated).push({ s, e });
    });
  }

  const anyData = standings.length > 0;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Link href={`/tournaments/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Tournament
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{gameLabel(tournament.gameCategory)}</Badge>
            {tournament.eFootballMode && <Badge variant="outline" className="text-sky-400 border-sky-400/30">{tournament.eFootballMode}</Badge>}
          </div>
          <h1 className="text-3xl font-black tracking-tight">{tournament.name}</h1>
          <p className="text-lg text-muted-foreground mt-1">Tournament Recap</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {!anyData && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No group-stage standings recorded yet for this tournament.
            </CardContent>
          </Card>
        )}

        {/* Qualifiers */}
        {qualifiers.length > 0 && (
          <Card className="border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-emerald-400">
                <Crown className="w-5 h-5" /> Qualified for Knockout{hasKnockout ? ` — ${firstRoundName}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {qualifiers.map(({ e }) => (
                  <Link key={e.key} href={e.href} className="flex flex-col items-center gap-1.5 group">
                    <EntrantAvatar e={e} className="h-14 w-14 ring-2 ring-emerald-500/30 group-hover:ring-emerald-400 transition-all" memberClassName="h-9 w-9" fallbackClassName="text-xs" />
                    <span className="text-xs font-medium text-center leading-tight group-hover:text-emerald-400 transition-colors line-clamp-2">{e.name}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Group Standings */}
        {[...groupMap.entries()].map(([gId, group]) => (
          <Card key={gId}>
            <CardHeader className="pb-3"><CardTitle className="text-base">{group.name}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {group.rows.map((s, i) => {
                  const e = entrantOf(s);
                  if (!e) return null;
                  const qualified = isQualified(e, i);
                  const tiebreak = s.tiebreakNote;
                  return (
                    <Link key={s.id} href={e.href} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${qualified ? "bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10" : "bg-muted/30 hover:bg-muted/50 opacity-70"}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-sm font-bold w-5 shrink-0 ${i === 0 ? "text-amber-400" : qualified ? "text-emerald-400" : "text-muted-foreground"}`}>{i + 1}</span>
                        <EntrantAvatar e={e} className="h-9 w-9 shrink-0" memberClassName="h-6 w-6" fallbackClassName="text-[10px]" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm truncate">{e.name}</p>
                            {tiebreak && <TiebreakInfo message={tiebreak} />}
                          </div>
                          <p className="text-xs text-muted-foreground">W{s.won} D{s.drawn} L{s.lost}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 text-xs shrink-0">
                        <span className="text-muted-foreground hidden sm:inline">{s.goalsFor}-{s.goalsAgainst}</span>
                        <span className={`font-mono ${s.goalDiff > 0 ? "text-emerald-400" : s.goalDiff < 0 ? "text-destructive" : "text-muted-foreground"}`}>{s.goalDiff > 0 ? "+" : ""}{s.goalDiff}</span>
                        <span className="font-bold text-base w-7 text-right">{s.points}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 ${qualified ? "text-emerald-400 border-emerald-400/30" : "text-destructive border-destructive/30"}`}>{qualified ? "Q" : "E"}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Knockout Bracket */}
        {knockoutRounds.size > 0 && (
          <Card className="border-primary/20">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Knockout Stage</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[...knockoutRounds.entries()].map(([roundName, matches]) => (
                <div key={roundName}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{roundName}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matches.map((m) => {
                      const home = entrantOfTeam(m.homeTeam) ?? entrantOfPlayer(m.homePlayer);
                      const away = entrantOfTeam(m.awayTeam) ?? entrantOfPlayer(m.awayPlayer);
                      const isCompleted = m.status === "COMPLETED";
                      const has2Legs = m.leg2HomeScore != null;
                      const dh = has2Legs ? (m.homeScore ?? 0) + (m.leg2HomeScore ?? 0) : m.homeScore ?? 0;
                      const da = has2Legs ? (m.awayScore ?? 0) + (m.leg2AwayScore ?? 0) : m.awayScore ?? 0;
                      return (
                        <Link key={m.id} href={`/matches/${m.id}`} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {home ? <EntrantAvatar e={home} className="h-7 w-7 shrink-0" memberClassName="h-5 w-5" fallbackClassName="text-[9px]" /> : <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-[10px] text-muted-foreground shrink-0">?</div>}
                            <span className={`text-sm font-medium truncate ${!home ? "text-muted-foreground" : ""}`}>{home?.name ?? "TBD"}</span>
                          </div>
                          {isCompleted ? (
                            <div className="text-center shrink-0">
                              <span className="text-sm font-black">{dh} - {da}</span>
                              {has2Legs && <p className="text-[10px] text-muted-foreground">Agg</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground shrink-0">vs</span>
                          )}
                          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                            <span className={`text-sm font-medium truncate text-right ${!away ? "text-muted-foreground" : ""}`}>{away?.name ?? "TBD"}</span>
                            {away ? <EntrantAvatar e={away} className="h-7 w-7 shrink-0" memberClassName="h-5 w-5" fallbackClassName="text-[9px]" /> : <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-[10px] text-muted-foreground shrink-0">?</div>}
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
        {topScorers.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Golden Boot Race</CardTitle></CardHeader>
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
        )}

        {/* ELO Rankings */}
        {eloPlayers.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" /> ELO Power Rankings</CardTitle></CardHeader>
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
        )}

        {/* Best Defensive */}
        {defensive.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-cyan-400" /> Best Defensive Records</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {defensive.map((s, i) => {
                  const e = entrantOf(s);
                  if (!e) return null;
                  return (
                    <Link key={s.id} href={e.href} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-sm font-bold w-5 ${i === 0 ? "text-cyan-400" : "text-muted-foreground"}`}>{i + 1}</span>
                        <EntrantAvatar e={e} className="h-9 w-9 shrink-0" memberClassName="h-6 w-6" fallbackClassName="text-[10px]" />
                        <span className="font-medium text-sm truncate">{e.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-cyan-400">{s.goalsAgainst}</span>
                        <span className="text-xs text-muted-foreground ml-1">in {s.played}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Eliminated */}
        {eliminated.length > 0 && (
          <Card className="border-destructive/10">
            <CardHeader><CardTitle className="text-base flex items-center gap-2 text-muted-foreground"><XCircle className="w-4 h-4" /> Did Not Qualify</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                {eliminated.map(({ e }) => (
                  <Link key={e.key} href={e.href} className="flex flex-col items-center gap-1 group opacity-70 hover:opacity-100 transition-opacity">
                    <EntrantAvatar e={e} className="h-11 w-11 grayscale group-hover:grayscale-0 transition-all" memberClassName="h-7 w-7" fallbackClassName="text-[10px]" />
                    <span className="text-[11px] text-center leading-tight text-muted-foreground line-clamp-2">{e.name}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
