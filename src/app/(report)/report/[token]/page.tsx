import { getMatchByToken } from "@/lib/actions/score-report";
import { notFound } from "next/navigation";
import { SubmitScoreForm } from "./submit-score-form";
import { ConfirmScoreForm } from "./confirm-score-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gameLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ReportPage({ params }: Props) {
  const { token } = await params;
  const result = await getMatchByToken(token);

  if (!result) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6 text-center">
          <p className="text-lg font-semibold text-destructive">Invalid Link</p>
          <p className="text-sm text-muted-foreground mt-2">
            This score report link is invalid or has expired.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { match, side, pendingReport } = result;
  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
  const yourSide = side === "home" ? homeName : awayName;

  // Match is already completed — show final result
  if (match.status === "COMPLETED") {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {match.tournament.name} — {gameLabel(match.tournament.gameCategory)}
          </p>
          {match.round && (
            <p className="text-sm text-muted-foreground">{match.round}</p>
          )}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-lg font-bold">{homeName}</p>
            </div>
            <div className="text-4xl font-black tracking-tight">
              {match.homeScore} <span className="text-muted-foreground mx-1">–</span> {match.awayScore}
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{awayName}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
            Completed
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Match header (shared by submit and confirm views)
  const matchHeader = (
    <div className="text-center space-y-2 mb-6">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {match.tournament.name} — {gameLabel(match.tournament.gameCategory)}
      </p>
      {match.round && (
        <p className="text-sm text-muted-foreground">{match.round}</p>
      )}
      <div className="flex items-center justify-center gap-4 mt-3">
        <p className="text-lg font-bold">{homeName}</p>
        <p className="text-muted-foreground font-light text-2xl">vs</p>
        <p className="text-lg font-bold">{awayName}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        You are: <span className="font-semibold text-foreground">{yourSide}</span> ({side})
      </p>
    </div>
  );

  // Pending report exists — show appropriate view
  if (pendingReport) {
    // Submitter sees waiting state
    if (pendingReport.submittedBy === side) {
      return (
        <Card className="mt-6">
          <CardContent className="pt-6 space-y-4">
            {matchHeader}
            <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-400">Waiting for opponent to confirm</p>
              <p className="text-3xl font-black mt-2">
                {pendingReport.homeScore} <span className="text-muted-foreground mx-1">–</span> {pendingReport.awayScore}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Auto-confirms in {Math.max(0, Math.round((new Date(pendingReport.autoConfirmAt).getTime() - Date.now()) / 3600000))} hours if no response
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Opponent sees confirm/dispute form
    return (
      <Card className="mt-6">
        <CardContent className="pt-6 space-y-4">
          {matchHeader}
          <ConfirmScoreForm
            token={token}
            reportId={pendingReport.id}
            homeScore={pendingReport.homeScore}
            awayScore={pendingReport.awayScore}
            homeName={homeName}
            awayName={awayName}
            tournamentName={match.tournament.name}
            matchId={match.id}
            round={match.round}
            matchNumber={match.matchNumber}
            homePhoto={match.homePlayer?.photoUrl ?? match.homeTeam?.logoUrl ?? null}
            awayPhoto={match.awayPlayer?.photoUrl ?? match.awayTeam?.logoUrl ?? null}
          />
        </CardContent>
      </Card>
    );
  }

  // No pending report — show submit form
  return (
    <Card className="mt-6">
      <CardContent className="pt-6 space-y-4">
        {matchHeader}
        <SubmitScoreForm
          token={token}
          homeName={homeName}
          awayName={awayName}
        />
      </CardContent>
    </Card>
  );
}
