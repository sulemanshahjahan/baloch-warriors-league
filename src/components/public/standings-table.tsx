import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { DuoTeamAvatar } from "@/components/public/duo-team-avatar";
import { TiebreakInfo } from "@/components/public/tiebreak-info";
import { getInitials } from "@/lib/utils";

// Shared rich standings table — used by the normal tournament view and the
// multi-stage (BWL Cup) stages view so both look identical.

export type FormResult = "W" | "D" | "L";

export interface MatchForForm {
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homePlayerId: string | null;
  awayPlayerId: string | null;
}

export function computeForm(
  participantId: string,
  matches: MatchForForm[],
  isIndividual: boolean
): FormResult[] {
  const results: FormResult[] = [];
  for (const match of matches) {
    if (results.length >= 5) break;
    const homeId = isIndividual ? match.homePlayerId : match.homeTeamId;
    const awayId = isIndividual ? match.awayPlayerId : match.awayTeamId;
    if (!homeId || !awayId) continue;
    if (match.homeScore === null || match.awayScore === null) continue;
    const isHome = homeId === participantId;
    const isAway = awayId === participantId;
    if (!isHome && !isAway) continue;
    const homeScore = match.homeScore;
    const awayScore = match.awayScore;
    if (homeScore === awayScore) {
      results.push("D");
    } else if (isHome) {
      results.push(homeScore > awayScore ? "W" : "L");
    } else {
      results.push(awayScore > homeScore ? "W" : "L");
    }
  }
  return results;
}

function FormBadge({ result }: { result: FormResult }) {
  const colors = {
    W: "bg-green-500",
    D: "bg-yellow-500",
    L: "bg-red-500",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white rounded-full ${colors[result]}`}
      title={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}
    >
      {result}
    </span>
  );
}

export function StandingsTable({
  standings,
  participantType,
  gameCategory,
  formMatches,
}: {
  standings: Array<{
    id: string;
    teamId: string | null;
    playerId: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
    tiebreakNote: string | null;
    team: { id: string; slug: string; name: string; isDuo?: boolean; players?: { player: { id: string; name: string; photoUrl: string | null } }[] } | null;
    player: { id: string; slug: string; name: string } | null;
  }>;
  participantType: string;
  gameCategory: string;
  formMatches: MatchForForm[];
}) {
  const isIndividual = participantType === "INDIVIDUAL";
  const isPUBG = gameCategory === "PUBG";
  const isSnookerOrCheckers = gameCategory === "SNOOKER" || gameCategory === "CHECKERS";
  const frameLabel = gameCategory === "CHECKERS" ? "GW" : "FW";
  const frameLabelFull = gameCategory === "CHECKERS" ? "Games" : "Frames";

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="w-10">#</TableHead>
          <TableHead>{isIndividual ? "Player" : "Team"}</TableHead>
          <TableHead className="text-center">MP</TableHead>
          {isPUBG ? (
            <>
              <TableHead className="text-center">💀 Kills</TableHead>
              <TableHead className="text-center">🐔</TableHead>
              <TableHead className="text-center font-bold">Total Pts</TableHead>
            </>
          ) : isSnookerOrCheckers ? (
            <>
              <TableHead className="text-center">W</TableHead>
              <TableHead className="text-center">L</TableHead>
              <TableHead className="text-center" title={`${frameLabelFull} Won`}>{frameLabel}</TableHead>
              <TableHead className="text-center" title={`${frameLabelFull} Lost`}>{frameLabel}A</TableHead>
              <TableHead className="text-center font-bold">Pts</TableHead>
              <TableHead className="text-center w-[120px]">Form</TableHead>
            </>
          ) : (
            <>
              <TableHead className="text-center">W</TableHead>
              <TableHead className="text-center">D</TableHead>
              <TableHead className="text-center">L</TableHead>
              <TableHead className="text-center hidden sm:table-cell">GF</TableHead>
              <TableHead className="text-center hidden sm:table-cell">GA</TableHead>
              <TableHead className="text-center">GD</TableHead>
              <TableHead className="text-center font-bold">Pts</TableHead>
              <TableHead className="text-center w-[120px]">Form</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((s, i) => {
          const name = isIndividual ? s.player?.name : s.team?.name;
          const href = isIndividual
            ? `/players/${s.player?.slug}`
            : `/teams/${s.team?.slug}`;
          const participantId = isIndividual ? s.playerId : s.teamId;
          const form = participantId ? computeForm(participantId, formMatches, isIndividual) : [];

          // Tiebreak explanation — persisted note (null for the obvious cases / PUBG).
          const tiebreakMsg = isPUBG ? null : s.tiebreakNote;

          return (
            <TableRow key={s.id}>
              <TableCell className="font-medium text-muted-foreground text-center">{i + 1}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Link href={href} className="flex items-center gap-2 hover:text-primary transition-colors min-w-0">
                    {isIndividual && s.player ? (
                      <SmartAvatar type="player" id={s.player.id} name={name ?? ""} className="h-7 w-7 shrink-0" fallbackClassName="text-[10px]" />
                    ) : s.team ? (
                      <DuoTeamAvatar id={s.team.id} name={name ?? ""} isDuo={s.team.isDuo} members={s.team.players?.map((p) => p.player)} className="h-7 w-7 shrink-0" fallbackClassName="text-[10px]" />
                    ) : (
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px]">{getInitials(name ?? "")}</AvatarFallback>
                      </Avatar>
                    )}
                    <span className="font-medium truncate">{name}</span>
                  </Link>
                  {tiebreakMsg && <TiebreakInfo message={tiebreakMsg} />}
                </div>
              </TableCell>
              <TableCell className="text-center">{s.played}</TableCell>
              {isPUBG ? (
                <>
                  <TableCell className="text-center">{s.goalsFor}</TableCell>
                  <TableCell className="text-center">{s.won}</TableCell>
                  <TableCell className="text-center font-bold text-primary">{s.points}</TableCell>
                </>
              ) : isSnookerOrCheckers ? (
                <>
                  <TableCell className="text-center text-green-400">{s.won}</TableCell>
                  <TableCell className="text-center text-red-400">{s.lost}</TableCell>
                  <TableCell className="text-center">{s.goalsFor}</TableCell>
                  <TableCell className="text-center">{s.goalsAgainst}</TableCell>
                  <TableCell className="text-center font-bold">{s.points}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {form.length > 0 ? (
                        form.map((r, idx) => <FormBadge key={idx} result={r} />)
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </div>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-center text-green-400">{s.won}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{s.drawn}</TableCell>
                  <TableCell className="text-center text-red-400">{s.lost}</TableCell>
                  <TableCell className="text-center hidden sm:table-cell">{s.goalsFor}</TableCell>
                  <TableCell className="text-center hidden sm:table-cell">{s.goalsAgainst}</TableCell>
                  <TableCell className={`text-center ${s.goalDiff > 0 ? "text-green-400" : s.goalDiff < 0 ? "text-red-400" : ""}`}>
                    {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
                  </TableCell>
                  <TableCell className="text-center font-bold">{s.points}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {form.length > 0 ? (
                        form.map((r, idx) => <FormBadge key={idx} result={r} />)
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
