import { getMatchByToken } from "@/lib/actions/score-report";
import { getAvailabilityStatus } from "@/lib/actions/availability";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gameLabel, formatDateTime } from "@/lib/utils";
import { AvailabilityForm } from "./availability-form";
import { Check, Clock } from "lucide-react";

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
            This match link is invalid or has expired.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { match, side } = result;
  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
  const yourSide = side === "home" ? homeName : awayName;
  const opponentName = side === "home" ? awayName : homeName;

  // Match is completed — show final result
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
            <p className="text-lg font-bold">{homeName}</p>
            <div className="text-4xl font-black tracking-tight">
              {match.homeScore} <span className="text-muted-foreground mx-1">–</span> {match.awayScore}
            </div>
            <p className="text-lg font-bold">{awayName}</p>
          </div>
          <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
            Completed
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Get availability status
  const availability = await getAvailabilityStatus(match.id);
  const myAvailability = side === "home" ? availability.home : availability.away;
  const opponentAvailability = side === "home" ? availability.away : availability.home;

  // Match header
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
      {match.scheduledAt && (
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" />
          Scheduled: {formatDateTime(match.scheduledAt)}
        </p>
      )}
      {match.deadline && (
        <p className="text-xs text-amber-400 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" />
          Deadline: {formatDateTime(match.deadline)}
        </p>
      )}
    </div>
  );

  // Both players available
  if (myAvailability?.isAvailable && opponentAvailability?.isAvailable) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6 space-y-4">
          {matchHeader}
          <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-emerald-400">Both players are ready!</p>
            <p className="text-xs text-muted-foreground mt-2">
              Contact your opponent and play the match. The admin will enter the final score.
            </p>
            {opponentAvailability.preferredTime && (
              <p className="text-xs text-foreground mt-2">
                {opponentName} is available at: <strong>{formatDateTime(opponentAvailability.preferredTime)}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // I'm already available, waiting for opponent
  if (myAvailability?.isAvailable && !opponentAvailability?.isAvailable) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6 space-y-4">
          {matchHeader}
          <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-amber-400">Waiting for {opponentName}</p>
            <p className="text-xs text-muted-foreground mt-2">
              You're marked as available
              {myAvailability.preferredTime && ` at ${formatDateTime(myAvailability.preferredTime)}`}.
              Your opponent has been notified.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Opponent is available, I'm not yet
  if (!myAvailability?.isAvailable && opponentAvailability?.isAvailable) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6 space-y-4">
          {matchHeader}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center mb-4">
            <p className="text-sm text-emerald-400">
              {opponentName} is ready to play
              {opponentAvailability.preferredTime && ` at ${formatDateTime(opponentAvailability.preferredTime)}`}!
            </p>
          </div>
          <AvailabilityForm
            token={token}
            scheduledAt={match.scheduledAt?.toISOString() ?? null}
          />
        </CardContent>
      </Card>
    );
  }

  // Neither available — show availability form
  return (
    <Card className="mt-6">
      <CardContent className="pt-6 space-y-4">
        {matchHeader}
        <AvailabilityForm
          token={token}
          scheduledAt={match.scheduledAt?.toISOString() ?? null}
        />
      </CardContent>
    </Card>
  );
}
