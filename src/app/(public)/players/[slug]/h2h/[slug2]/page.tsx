import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Swords } from "lucide-react";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { formatDate } from "@/lib/utils";

export const revalidate = 120;

interface H2HPageProps {
  params: Promise<{ slug: string; slug2: string }>;
}

export async function generateMetadata({ params }: H2HPageProps): Promise<Metadata> {
  const { slug, slug2 } = await params;
  const [p1, p2] = await Promise.all([
    prisma.player.findUnique({ where: { slug }, select: { name: true } }),
    prisma.player.findUnique({ where: { slug: slug2 }, select: { name: true } }),
  ]);
  if (!p1 || !p2) return { title: "Head to Head" };
  return {
    title: `${p1.name} vs ${p2.name} — Head to Head`,
    description: `Full match history and stats between ${p1.name} and ${p2.name}.`,
  };
}

export default async function H2HPage({ params }: H2HPageProps) {
  const { slug, slug2 } = await params;

  if (slug === slug2) notFound();

  const [player1, player2] = await Promise.all([
    prisma.player.findUnique({ where: { slug }, select: { id: true, name: true, slug: true } }),
    prisma.player.findUnique({ where: { slug: slug2 }, select: { id: true, name: true, slug: true } }),
  ]);

  if (!player1 || !player2) notFound();

  // All completed matches between these two players
  const matches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      OR: [
        { homePlayerId: player1.id, awayPlayerId: player2.id },
        { homePlayerId: player2.id, awayPlayerId: player1.id },
      ],
    },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      homePlayerId: true,
      awayPlayerId: true,
      homeScore: true,
      awayScore: true,
      homeScorePens: true,
      awayScorePens: true,
      homeClub: true,
      awayClub: true,
      round: true,
      completedAt: true,
      tournament: { select: { name: true, slug: true } },
    },
  });

  // Compute stats
  let p1Wins = 0;
  let p2Wins = 0;
  let draws = 0;
  let p1Goals = 0;
  let p2Goals = 0;

  for (const m of matches) {
    const p1IsHome = m.homePlayerId === player1.id;
    const p1Score = p1IsHome ? m.homeScore ?? 0 : m.awayScore ?? 0;
    const p2Score = p1IsHome ? m.awayScore ?? 0 : m.homeScore ?? 0;
    p1Goals += p1Score;
    p2Goals += p2Score;

    // Use pens for winner if available
    const p1Final = p1IsHome ? (m.homeScorePens ?? m.homeScore ?? 0) : (m.awayScorePens ?? m.awayScore ?? 0);
    const p2Final = p1IsHome ? (m.awayScorePens ?? m.awayScore ?? 0) : (m.homeScorePens ?? m.homeScore ?? 0);

    if (p1Final > p2Final) p1Wins++;
    else if (p2Final > p1Final) p2Wins++;
    else draws++;
  }

  return (
    <div className="min-h-screen">
      <section className="border-b border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href={`/players/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" />
            {player1.name}
          </Link>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-center mb-8">Head to Head</h1>

          {/* H2H Hero */}
          <div className="flex items-center justify-between gap-4">
            <Link href={`/players/${player1.slug}`} className="flex-1 flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
              <SmartAvatar type="player" id={player1.id} name={player1.name} className="h-20 w-20" fallbackClassName="text-xl" />
              <p className="font-bold text-lg text-center">{player1.name}</p>
            </Link>

            <div className="text-center shrink-0 px-6">
              <div className="text-4xl font-black tabular-nums">
                <span className={p1Wins > p2Wins ? "text-green-400" : ""}>{p1Wins}</span>
                <span className="text-muted-foreground mx-2 text-2xl">-</span>
                <span className="text-muted-foreground text-xl">{draws}</span>
                <span className="text-muted-foreground mx-2 text-2xl">-</span>
                <span className={p2Wins > p1Wins ? "text-green-400" : ""}>{p2Wins}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{matches.length} matches</p>
            </div>

            <Link href={`/players/${player2.slug}`} className="flex-1 flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
              <SmartAvatar type="player" id={player2.id} name={player2.name} className="h-20 w-20" fallbackClassName="text-xl" />
              <p className="font-bold text-lg text-center">{player2.name}</p>
            </Link>
          </div>

          {/* Goal comparison */}
          <div className="flex items-center justify-center gap-8 mt-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold">{p1Goals}</p>
              <p className="text-xs text-muted-foreground">Goals</p>
            </div>
            <Swords className="w-5 h-5 text-muted-foreground" />
            <div className="text-center">
              <p className="text-2xl font-bold">{p2Goals}</p>
              <p className="text-xs text-muted-foreground">Goals</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="w-4 h-4 text-orange-400" />
              Match History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No matches between these players yet.</p>
            ) : (
              <div className="space-y-3">
                {matches.map((m) => {
                  const p1IsHome = m.homePlayerId === player1.id;
                  const p1Score = p1IsHome ? m.homeScore ?? 0 : m.awayScore ?? 0;
                  const p2Score = p1IsHome ? m.awayScore ?? 0 : m.homeScore ?? 0;
                  const p1Club = p1IsHome ? m.homeClub : m.awayClub;
                  const p2Club = p1IsHome ? m.awayClub : m.homeClub;
                  const hasPens = m.homeScorePens != null && m.awayScorePens != null;
                  const p1Pens = p1IsHome ? m.homeScorePens : m.awayScorePens;
                  const p2Pens = p1IsHome ? m.awayScorePens : m.homeScorePens;

                  let result = "D";
                  let resultColor = "bg-yellow-500/20 text-yellow-500";
                  const p1Final = hasPens ? (p1Pens ?? p1Score) : p1Score;
                  const p2Final = hasPens ? (p2Pens ?? p2Score) : p2Score;
                  if (p1Final > p2Final) { result = "W"; resultColor = "bg-green-500/20 text-green-500"; }
                  else if (p2Final > p1Final) { result = "L"; resultColor = "bg-red-500/20 text-red-500"; }

                  return (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3 flex-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${resultColor}`}>{result}</span>
                        <div>
                          <p className="text-sm font-medium">
                            {p1Score} - {p2Score}
                            {hasPens && <span className="text-xs text-muted-foreground ml-1">({p1Pens}-{p2Pens} pens)</span>}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{m.tournament.name}</span>
                            {m.round && <span>· {m.round}</span>}
                          </div>
                          {(p1Club || p2Club) && (
                            <p className="text-xs text-primary/70 mt-0.5">
                              {p1Club ?? "?"} vs {p2Club ?? "?"}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {m.completedAt ? formatDate(m.completedAt) : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
