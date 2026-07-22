import { prisma } from "@/lib/db";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StandingsTable } from "@/components/public/standings-table";

// Renders a multi-stage tournament (Stage 1 groups → playoff → Stage 2 groups →
// knockout) as stacked sections in stage order, reusing the same rich standings
// table as normal leagues. Only shown when a tournament has more than one stage.

function stageLabel(kind: string, orderIndex: number, name: string) {
  if (kind === "PLAYOFF") return "Playoff";
  if (kind === "KNOCKOUT") return "Knockout";
  if (orderIndex === 0) return "Stage 1 · Groups";
  if (orderIndex >= 2) return "Stage 2 · Groups";
  return name;
}

function scoreLabel(m: { homeScore: number | null; awayScore: number | null; homeScorePens: number | null; awayScorePens: number | null }) {
  if (m.homeScore == null || m.awayScore == null) return "vs";
  const pens = m.homeScorePens != null && m.awayScorePens != null ? ` (${m.homeScorePens}-${m.awayScorePens} pens)` : "";
  return `${m.homeScore}-${m.awayScore}${pens}`;
}

function winnerName(m: {
  homeScore: number | null; awayScore: number | null; homeScorePens: number | null; awayScorePens: number | null;
  homePlayer: { name: string } | null; awayPlayer: { name: string } | null;
}) {
  if (m.homeScore == null || m.awayScore == null) return null;
  if (m.homeScore > m.awayScore) return m.homePlayer?.name;
  if (m.awayScore > m.homeScore) return m.awayPlayer?.name;
  if ((m.homeScorePens ?? 0) > (m.awayScorePens ?? 0)) return m.homePlayer?.name;
  if ((m.awayScorePens ?? 0) > (m.homeScorePens ?? 0)) return m.awayPlayer?.name;
  return null;
}

const STANDING_INCLUDE = {
  team: { select: { id: true, slug: true, name: true, isDuo: true, players: { where: { isActive: true }, select: { player: { select: { id: true, name: true, photoUrl: true } } } } } },
  player: { select: { id: true, slug: true, name: true } },
} as const;

export async function TournamentStages({ tournamentId }: { tournamentId: string }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { participantType: true, gameCategory: true },
  });
  const stages = await prisma.tournamentStage.findMany({
    where: { tournamentId },
    orderBy: { orderIndex: "asc" },
    include: { groups: { orderBy: { orderIndex: "asc" }, select: { id: true, name: true } } },
  });

  if (!tournament || stages.length <= 1) return null; // not a multi-stage tournament

  return (
    <div className="space-y-8">
      {await Promise.all(
        stages.map(async (stage) => {
          const label = stageLabel(stage.kind, stage.orderIndex, stage.name);

          if (stage.kind === "GROUP" || stage.kind === "LEAGUE") {
            // Form is computed per-stage so Stage 2 form doesn't include Stage 1.
            const formMatches = await prisma.match.findMany({
              where: { stageId: stage.id, status: "COMPLETED" },
              orderBy: { completedAt: "desc" },
              select: { homeScore: true, awayScore: true, homeTeamId: true, awayTeamId: true, homePlayerId: true, awayPlayerId: true },
            });
            const groupBlocks = await Promise.all(
              stage.groups.map(async (g) => ({
                g,
                rows: await prisma.standing.findMany({
                  where: { stageId: stage.id, groupId: g.id },
                  orderBy: [{ rank: "asc" }, { id: "asc" }],
                  include: STANDING_INCLUDE,
                }),
              }))
            );
            return (
              <section key={stage.id} className="space-y-4">
                <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground px-1">{label}</h2>
                {groupBlocks.map(({ g, rows }) => (
                  <Card key={g.id}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-yellow-400" />
                        {g.name} Standings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {rows.length > 0 ? (
                        <StandingsTable
                          standings={rows}
                          participantType={tournament.participantType}
                          gameCategory={tournament.gameCategory}
                          formMatches={formMatches}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No standings yet.</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </section>
            );
          }

          // PLAYOFF or KNOCKOUT — matches grouped by round.
          const matches = await prisma.match.findMany({
            where: { stageId: stage.id },
            orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
            include: { homePlayer: { select: { name: true } }, awayPlayer: { select: { name: true } } },
          });
          const rounds = [...new Set(matches.map((m) => m.round ?? "Matches"))];
          return (
            <section key={stage.id} className="space-y-4">
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground px-1">{label}</h2>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  {rounds.map((round) => (
                    <div key={round}>
                      {rounds.length > 1 && <p className="text-xs font-medium text-muted-foreground mb-1.5">{round}</p>}
                      <div className="space-y-1.5">
                        {matches.filter((m) => (m.round ?? "Matches") === round).map((m) => {
                          const w = winnerName(m);
                          return (
                            <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm rounded-lg bg-muted/30 px-3 py-2">
                              <span className={`text-right truncate ${w && w === m.homePlayer?.name ? "font-semibold" : ""}`}>{m.homePlayer?.name ?? "TBD"}</span>
                              <span className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">{scoreLabel(m)}</span>
                              <span className={`truncate ${w && w === m.awayPlayer?.name ? "font-semibold" : ""}`}>{m.awayPlayer?.name ?? "TBD"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
