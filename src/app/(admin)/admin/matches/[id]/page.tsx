export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { getMatchById } from "@/lib/actions/match";
import { MatchResultForm } from "./match-result-form";
import { PUBGResultForm } from "./pubg-result-form";
import { MatchEventManager } from "./match-event-manager";
import { DeleteMatchButton } from "./delete-match-button";
import { RescheduleForm } from "./reschedule-form";
import { RoomIdForm } from "./room-id-form";
import { MagicLinksCard } from "./magic-links-card";
import { getAvailabilityStatus } from "@/lib/actions/availability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatDateTime,
  gameLabel,
  statusColor,
  statusLabel,
} from "@/lib/utils";
import { Calendar, Clock, MapPin, Trophy, AlertTriangle, MessageCircle } from "lucide-react";

interface MatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  await requireRole("EDITOR");
  const { id } = await params;
  const match = await getMatchById(id);

  if (!match) notFound();

  // Check if this is a PUBG match
  const isPUBG = match.tournament.gameCategory === "PUBG";
  const availability = await getAvailabilityStatus(match.id);

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

  // For PUBG, show match name instead of TBD vs TBD
  const pageTitle = isPUBG 
    ? (match.round || `Match ${match.matchNumber || 1}`)
    : `${homeName} vs ${awayName}`;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title={pageTitle}
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
            {match.deadline && (
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Deadline: {formatDateTime(match.deadline)}
              </span>
            )}
            {match.isOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                <AlertTriangle className="w-3 h-3" />
                OVERDUE
              </span>
            )}
            {match.status !== "COMPLETED" && (availability.home || availability.away) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                {availability.home && availability.away ? "Both Ready" : availability.home ? `${homeName} Ready` : `${awayName} Ready`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {match.status === "COMPLETED" && match.homeScore != null && (
              <a
                href={(() => {
                  const shareUrl = `https://bwlleague.com/matches/${match.id}`;
                  const scoreline = `${homeName} ${match.homeScore}–${match.awayScore} ${awayName}`;
                  const shareText = [
                    `🏆 ${match.tournament.name}`,
                    match.round || null,
                    ``,
                    `*FULL-TIME*`,
                    `*${scoreline}*`,
                    ``,
                    `🔗 Match details:`,
                    shareUrl,
                  ].filter((line) => line !== null).join("\n");
                  return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            )}
            <DeleteMatchButton
              matchId={match.id}
              homeName={homeName}
              awayName={awayName}
            />
          </div>
        </div>

        {/* Score display - hide for PUBG */}
        {!isPUBG && (
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
        )}

        {/* Reschedule Form - only shown for non-completed matches */}
        <RescheduleForm
          matchId={match.id}
          currentScheduledAt={match.scheduledAt}
          currentDeadline={match.deadline}
          currentStatus={match.status}
          currentNotes={match.notes}
        />

        {/* Room ID - for online games (eFootball, PUBG) */}
        <RoomIdForm
          matchId={match.id}
          currentRoomId={match.roomId}
          currentRoomPassword={match.roomPassword}
          gameCategory={match.tournament.gameCategory}
          matchStatus={match.status}
        />

        {/* Magic links for player self-reporting */}
        <MagicLinksCard
          matchId={match.id}
          homeToken={match.homeToken}
          awayToken={match.awayToken}
          homeName={homeName}
          awayName={awayName}
          matchStatus={match.status}
          pendingReport={match.scoreReports?.find((r: { status: string }) => r.status === "PENDING" || r.status === "DISPUTED") ?? null}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Result Entry Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isPUBG ? "PUBG Match Results" : "Update Result"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isPUBG ? (
                <PUBGResultForm
                  matchId={match.id}
                  currentStatus={match.status}
                  participants={match.participants || []}
                  pointsPerKill={1}
                  placementPoints={[
                    { placement: 1, points: 10 },
                    { placement: 2, points: 6 },
                    { placement: 3, points: 5 },
                    { placement: 4, points: 4 },
                    { placement: 5, points: 3 },
                    { placement: 6, points: 2 },
                    { placement: 7, points: 1 },
                    { placement: 8, points: 1 },
                  ]}
                />
              ) : (
                <MatchResultForm
                  matchId={match.id}
                  currentStatus={match.status}
                  homeScore={match.homeScore}
                  awayScore={match.awayScore}
                  homeScorePens={match.homeScorePens}
                  awayScorePens={match.awayScorePens}
                  homeClub={match.homeClub}
                  awayClub={match.awayClub}
                  homeFormation={match.homeFormation}
                  awayFormation={match.awayFormation}
                  isDerby={match.isDerby}
                  rivalNote={match.rivalNote}
                  highlights={match.highlights}
                  motmPlayerId={match.motmPlayerId}
                  players={allPlayers}
                  gameCategory={match.tournament.gameCategory}
                  homeName={homeName}
                  awayName={awayName}
                  tournamentName={match.tournament.name}
                  round={match.round}
                  matchNumber={match.matchNumber}
                  homePhoto={match.homePlayer?.photoUrl ?? match.homeTeam?.logoUrl ?? null}
                  awayPhoto={match.awayPlayer?.photoUrl ?? match.awayTeam?.logoUrl ?? null}
                  isKnockout={!match.groupId && (match.roundNumber ?? 0) > 0}
                  leg2HomeScore={match.leg2HomeScore}
                  leg2AwayScore={match.leg2AwayScore}
                  leg3HomeScore={match.leg3HomeScore}
                  leg3AwayScore={match.leg3AwayScore}
                  leg3HomePens={match.leg3HomePens}
                  leg3AwayPens={match.leg3AwayPens}
                />
              )}
            </CardContent>
          </Card>

          {/* Match Events - hide for PUBG */}
          {!isPUBG && (
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
          )}
        </div>
      </main>
    </div>
  );
}
