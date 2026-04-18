"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SmartAvatar } from "./smart-avatar";

interface BracketMatch {
  id: string;
  round: string | null;
  roundNumber: number | null;
  matchNumber: number | null;
  status: string;
  scheduledAt: Date | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScorePens: number | null;
  awayScorePens: number | null;
  leg2HomeScore?: number | null;
  leg2AwayScore?: number | null;
  leg3HomeScore?: number | null;
  leg3AwayScore?: number | null;
  leg3HomePens?: number | null;
  leg3AwayPens?: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homePlayerId: string | null;
  awayPlayerId: string | null;
  homeTeam: { id: string; name: string; shortName: string | null } | null;
  awayTeam: { id: string; name: string; shortName: string | null } | null;
  homePlayer: { id: string; name: string } | null;
  awayPlayer: { id: string; name: string } | null;
}

interface BracketViewProps {
  rounds: number[];
  matchesByRound: Record<number, BracketMatch[]>;
  participantType: string;
}

function getRoundName(roundNum: number, matchCount: number, matchesByRound: Record<number, BracketMatch[]>) {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semi-final";
  if (matchCount === 4) return "Quarter-final";
  if (matchCount === 8) return "Round of 16";
  if (matchCount === 16) return "Round of 32";
  const firstMatch = matchesByRound[roundNum]?.[0];
  if (firstMatch?.round && !firstMatch.round.match(/^round\s*\d+$/i)) return firstMatch.round;
  return `Round ${roundNum}`;
}

function shortLabel(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + (words[1]?.[0] ?? "") + (words[2]?.[0] ?? "")).toUpperCase();
}

function getScores(match: BracketMatch) {
  const has2Legs = match.leg2HomeScore != null;
  const hasDecider = match.leg3HomeScore != null;

  const legs = {
    l1H: match.homeScore,
    l1A: match.awayScore,
    l2H: has2Legs ? match.leg2HomeScore : null,
    l2A: has2Legs ? match.leg2AwayScore : null,
    l3H: hasDecider ? match.leg3HomeScore : null,
    l3A: hasDecider ? match.leg3AwayScore : null,
  };

  const aggHome = (legs.l1H ?? 0) + (legs.l2H ?? 0) + (legs.l3H ?? 0);
  const aggAway = (legs.l1A ?? 0) + (legs.l2A ?? 0) + (legs.l3A ?? 0);

  let homeWon = aggHome > aggAway;
  let awayWon = aggAway > aggHome;

  if (!homeWon && !awayWon) {
    if (match.leg3HomePens != null) {
      homeWon = (match.leg3HomePens ?? 0) > (match.leg3AwayPens ?? 0);
      awayWon = !homeWon;
    } else if (match.homeScorePens != null) {
      homeWon = (match.homeScorePens ?? 0) > (match.awayScorePens ?? 0);
      awayWon = !homeWon;
    }
  }

  return { legs, aggHome, aggAway, homeWon, awayWon, has2Legs };
}

function Row({
  shortLbl,
  fullName,
  entityId,
  entityType,
  scores,
  won,
  lost,
}: {
  shortLbl: string;
  fullName: string;
  entityId: string | null;
  entityType: "player" | "team";
  scores: Array<number | null | undefined>;
  won: boolean;
  lost: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 ${won ? "bg-primary/5" : ""}`}
      title={fullName}
    >
      {entityId ? (
        <SmartAvatar
          type={entityType}
          id={entityId}
          name={fullName}
          className="h-5 w-5 shrink-0"
          fallbackClassName="text-[8px]"
        />
      ) : (
        <div className="h-5 w-5 shrink-0 rounded-full bg-muted flex items-center justify-center text-[8px] text-muted-foreground">
          ?
        </div>
      )}
      <span
        className={`flex-1 min-w-0 text-sm truncate ${
          won ? "font-bold text-primary" : lost ? "text-muted-foreground" : "font-medium"
        }`}
      >
        {shortLbl}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {scores.map((s, i) => {
          if (s === undefined) return null;
          return (
            <span
              key={i}
              className={`w-5 text-center text-sm tabular-nums ${
                won ? "font-bold text-primary" : lost ? "text-muted-foreground" : "font-semibold"
              }`}
            >
              {s == null ? "-" : s}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  isIndividual,
  showAdvanceArrow,
}: {
  match: BracketMatch;
  isIndividual: boolean;
  showAdvanceArrow: boolean;
}) {
  const isCompleted = match.status === "COMPLETED";
  const { legs, aggHome, aggAway, homeWon, awayWon, has2Legs } = getScores(match);

  const homeName = isIndividual
    ? (match.homePlayer?.name ?? "TBD")
    : (match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD");
  const awayName = isIndividual
    ? (match.awayPlayer?.name ?? "TBD")
    : (match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD");

  const homeShort = homeName === "TBD"
    ? "TBD"
    : isIndividual
    ? shortLabel(homeName)
    : (match.homeTeam?.shortName?.toUpperCase() ?? shortLabel(homeName));
  const awayShort = awayName === "TBD"
    ? "TBD"
    : isIndividual
    ? shortLabel(awayName)
    : (match.awayTeam?.shortName?.toUpperCase() ?? shortLabel(awayName));

  const homeId = match.homePlayerId ?? match.homeTeamId;
  const awayId = match.awayPlayerId ?? match.awayTeamId;

  const showL2 = has2Legs;
  const showL3 = match.leg3HomeScore != null;

  return (
    <Link href={`/matches/${match.id}`} className="block group relative">
      <div className="rounded-xl border border-border/60 bg-card hover:border-primary/40 transition-colors overflow-hidden shadow-sm">
        <div className="flex items-center justify-end gap-1.5 px-3 pt-2 pb-1 text-[9px] font-semibold text-muted-foreground tracking-wider">
          <span className="w-5 text-center">L1</span>
          {showL2 && <span className="w-5 text-center">L2</span>}
          {showL3 && <span className="w-5 text-center">L3</span>}
        </div>

        <Row
          shortLbl={homeShort}
          fullName={homeName}
          entityId={homeId}
          entityType={isIndividual ? "player" : "team"}
          scores={[legs.l1H, showL2 ? legs.l2H : undefined, showL3 ? legs.l3H : undefined]}
          won={isCompleted && homeWon}
          lost={isCompleted && awayWon}
        />

        <Row
          shortLbl={awayShort}
          fullName={awayName}
          entityId={awayId}
          entityType={isIndividual ? "player" : "team"}
          scores={[legs.l1A, showL2 ? legs.l2A : undefined, showL3 ? legs.l3A : undefined]}
          won={isCompleted && awayWon}
          lost={isCompleted && homeWon}
        />

        <div className="px-3 pb-2 pt-1 text-[10px] text-muted-foreground">
          {isCompleted && has2Legs ? (
            <span>
              Aggregate: <span className="font-semibold text-foreground">{aggHome} - {aggAway}</span>
              {match.leg3HomePens != null && (
                <> · Pens <span className="font-semibold">{match.leg3HomePens}-{match.leg3AwayPens}</span></>
              )}
            </span>
          ) : isCompleted ? (
            <span>
              Full time
              {match.homeScorePens != null && (
                <> · Pens <span className="font-semibold">{match.homeScorePens}-{match.awayScorePens}</span></>
              )}
            </span>
          ) : match.scheduledAt ? (
            <span>
              Leg 1 on {new Date(match.scheduledAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          ) : (
            <span>Date TBD</span>
          )}
        </div>
      </div>

      {showAdvanceArrow && (
        <div className="hidden sm:flex absolute top-1/2 -right-3 -translate-y-1/2 items-center justify-center w-6 h-6 rounded-full bg-card border border-border/60 text-muted-foreground group-hover:text-primary group-hover:border-primary/40 transition-colors z-10">
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      )}
    </Link>
  );
}

// Approximate rendered height of a MatchCard (px). Used to derive later-round spacing.
const CARD_H = 130;
const GAP = 16;

export function BracketVisualization({ rounds, matchesByRound, participantType }: BracketViewProps) {
  if (rounds.length === 0) return null;
  const isIndividual = participantType === "INDIVIDUAL";

  // earliest round first
  const orderedRounds = [...rounds].reverse();
  const totalRounds = orderedRounds.length;

  const firstRoundCount = matchesByRound[orderedRounds[0]]?.length ?? 1;
  const columnHeight = firstRoundCount * CARD_H + (firstRoundCount - 1) * GAP;

  return (
    <div className="relative -mx-2 sm:mx-0">
      <div className="overflow-x-auto pb-4 px-2 sm:px-0">
        <div className="flex gap-4 sm:gap-10 items-start min-w-max">
          {orderedRounds.map((roundNum, idx) => {
            const matches = matchesByRound[roundNum];
            const roundName = getRoundName(roundNum, matches.length, matchesByRound);
            const isLastCol = idx === totalRounds - 1;

            return (
              <div key={roundNum} className="flex-shrink-0 w-[240px] sm:w-[260px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground tracking-wide">
                    {roundName}
                  </h3>
                  {!isLastCol && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 sm:hidden" />
                  )}
                </div>
                <div
                  className="flex flex-col justify-around"
                  style={{ minHeight: `${columnHeight}px` }}
                >
                  {matches.map((match, i) => (
                    <div
                      key={match.id}
                      style={{ marginTop: i === 0 ? 0 : `${GAP}px` }}
                    >
                      <MatchCard
                        match={match}
                        isIndividual={isIndividual}
                        showAdvanceArrow={!isLastCol}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sm:hidden text-[10px] text-muted-foreground text-center mt-1">
        Swipe to see all rounds →
      </div>
    </div>
  );
}
