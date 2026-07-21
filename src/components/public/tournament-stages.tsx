import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Renders a multi-stage tournament (Stage 1 groups → playoff → Stage 2 groups →
// knockout) as stacked sections in stage order. Minimal, reuses Card. Only shown
// when a tournament has more than one stage.

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

export async function TournamentStages({ tournamentId }: { tournamentId: string }) {
  const stages = await prisma.tournamentStage.findMany({
    where: { tournamentId },
    orderBy: { orderIndex: "asc" },
    include: {
      groups: { orderBy: { orderIndex: "asc" }, select: { id: true, name: true } },
    },
  });

  if (stages.length <= 1) return null; // not a multi-stage tournament

  const matchInclude = {
    homePlayer: { select: { name: true } },
    awayPlayer: { select: { name: true } },
  } as const;

  return (
    <div className="space-y-6">
      {await Promise.all(
        stages.map(async (stage) => {
          if (stage.kind === "GROUP" || stage.kind === "LEAGUE") {
            const groupBlocks = await Promise.all(
              stage.groups.map(async (g) => {
                const rows = await prisma.standing.findMany({
                  where: { stageId: stage.id, groupId: g.id },
                  orderBy: [{ rank: "asc" }, { id: "asc" }],
                  include: { player: { select: { name: true } }, team: { select: { name: true } } },
                });
                return { g, rows };
              })
            );
            return (
              <Card key={stage.id}>
                <CardHeader className="pb-3"><CardTitle className="text-base">{stage.name}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {groupBlocks.map(({ g, rows }) => (
                    <div key={g.id}>
                      <p className="text-sm font-medium mb-1.5">{g.name}</p>
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr className="text-left">
                            <th className="w-5">#</th><th>Player</th>
                            <th className="text-center w-7">P</th>
                            <th className="text-center w-8">GD</th>
                            <th className="text-center w-8 font-semibold">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s, i) => (
                            <tr key={s.id} className="border-t border-border/50">
                              <td className="text-muted-foreground">{i + 1}</td>
                              <td className="truncate">{s.player?.name ?? s.team?.name ?? "—"}</td>
                              <td className="text-center">{s.played}</td>
                              <td className="text-center">{s.goalDiff > 0 ? "+" : ""}{s.goalDiff}</td>
                              <td className="text-center font-semibold">{s.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          }

          // PLAYOFF or KNOCKOUT — list matches grouped by round.
          const matches = await prisma.match.findMany({
            where: { stageId: stage.id },
            orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
            include: matchInclude,
          });
          const rounds = [...new Set(matches.map((m) => m.round ?? "Matches"))];
          return (
            <Card key={stage.id}>
              <CardHeader className="pb-3"><CardTitle className="text-base">{stage.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {rounds.map((round) => (
                  <div key={round}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{round}</p>
                    <div className="space-y-1">
                      {matches.filter((m) => (m.round ?? "Matches") === round).map((m) => {
                        const w = winnerName(m);
                        return (
                          <div key={m.id} className="flex items-center justify-between text-sm rounded bg-muted/30 px-2.5 py-1.5">
                            <span className={w === m.homePlayer?.name ? "font-semibold" : ""}>{m.homePlayer?.name ?? "TBD"}</span>
                            <span className="text-xs text-muted-foreground mx-2">{scoreLabel(m)}</span>
                            <span className={`text-right ${w === m.awayPlayer?.name ? "font-semibold" : ""}`}>{m.awayPlayer?.name ?? "TBD"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
