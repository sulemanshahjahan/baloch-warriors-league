export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { getMatchById } from "@/lib/actions/match";
import { MatchResultForm } from "./match-result-form";
import { MatchEventManager } from "./match-event-manager";
import { DeleteMatchButton } from "./delete-match-button";
import { RescheduleForm } from "./reschedule-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatDateTime,
  gameLabel,
  statusColor,
  statusLabel,
} from "@/lib/utils";
import { Calendar, MapPin, Trophy } from "lucide-react";

interface MatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  await requireRole("EDITOR");
  const { id } = await params;
  const match = await getMatchById(id);

  if (!match) notFound();

  // Handle both team matches and individual player matches
  const homeTeamPlayers =
    match.homeTeam?.players.map((tp) => tp.player) ?? [];
  const awayTeamPlayers =
    match.awayTeam?.players.map((tp) => tp.player) ?? [];
  
  // For individual player matches (eFootball 1v1), use homePlayer/awayPlayer
  const homeIndividualPlayer = match.homePlayer ? [match.homePlayer] : [];
  const awayIndividualPlayer = match.awayPlayer ? [match.awayPlayer] : [];
  
  const allPlayers = [
    ...homeTeamPlayers, 
    ...awayTeamPlayers,
    ...homeIndividualPlayer,
    ...awayIndividualPlayer
  ];
  
  // Show team names or player names depending on match type
  const homeName = match.homeTeam?.name ?? match.homePlayer?.name ?? "TBD";
  const awayName = match.awayTeam?.name ?? match.awayPlayer?.name ?? "TBD";

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title={`${homeName} vs ${awayName}`}
        description={match.tournament.name}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Match metadata & actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor(match.status)}`}
            >
              {statusLabel(match.status)}
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              {gameLabel(match.tournament.gameCategory)}
            </span>
            {match.round && (
              <span className="text-sm text-muted-foreground">{match.round}</span>
            )}
            {match.scheduledAt && (
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {formatDateTime(match.scheduledAt)}
              </span>
            )}
          </div>
          <DeleteMatchButton
            matchId={match.id}
            homeName={homeName}
            awayName={awayName}
          />
        </div>

        {/* Score display */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="text-center flex-1">
                <p className="text-xl font-bold">{homeName}</p>
                <p className="text-sm text-muted-foreground">Home</p>
              </div>
              <div className="text-center shrink-0">
                {match.status === "COMPLETED" || match.status === "LIVE" ? (
                  <div className="text-5xl font-black tracking-tighter">
                    {match.homeScore ?? 0}
                    <span className="text-muted-foreground mx-2 font-light">–</span>
                    {match.awayScore ?? 0}
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-muted-foreground">
                    vs
                  </div>
                )}
                {match.homeScorePens != null && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ({match.homeScorePens} – {match.awayScorePens} pens)
                  </p>
                )}
                {match.motmPlayer && (
                  <p className="text-xs text-accent mt-2 font-medium">
                    ⭐ MOTM: {match.motmPlayer.name}
                  </p>
                )}
              </div>
              <div className="text-center flex-1">
                <p className="text-xl font-bold">{awayName}</p>
                <p className="text-sm text-muted-foreground">Away</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reschedule Form - only shown for non-completed matches */}
        <RescheduleForm
          matchId={match.id}
          currentScheduledAt={match.scheduledAt}
          currentStatus={match.status}
          currentNotes={match.notes}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Result Entry Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update Result</CardTitle>
            </CardHeader>
            <CardContent>
              <MatchResultForm
                matchId={match.id}
                currentStatus={match.status}
                homeScore={match.homeScore}
                awayScore={match.awayScore}
                homeScorePens={match.homeScorePens}
                awayScorePens={match.awayScorePens}
                motmPlayerId={match.motmPlayerId}
                players={allPlayers}
              />
            </CardContent>
          </Card>

          {/* Match Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Events</CardTitle>
            </CardHeader>
            <CardContent>
              <MatchEventManager
                matchId={match.id}
                events={match.events}
                homeTeam={
                  match.homeTeam
                    ? { id: match.homeTeam.id, name: match.homeTeam.name }
                    : null
                }
                awayTeam={
                  match.awayTeam
                    ? { id: match.awayTeam.id, name: match.awayTeam.name }
                    : null
                }
                players={allPlayers}
                gameCategory={match.tournament.gameCategory}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
