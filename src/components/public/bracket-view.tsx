"use client";

import Link from "next/link";
import { SmartAvatar } from "./smart-avatar";
import { formatDate } from "@/lib/utils";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

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

function getDisplayScores(match: BracketMatch) {
  const has2Legs = match.leg2HomeScore != null;
  if (has2Legs) {
    const aggHome = (match.homeScore ?? 0) + (match.leg2HomeScore ?? 0);
    const aggAway = (match.awayScore ?? 0) + (match.leg2AwayScore ?? 0);
    // Determine winner from aggregate, decider, or decider pens
    let homeWon = aggHome > aggAway;
    let awayWon = aggAway > aggHome;
    if (!homeWon && !awayWon && match.leg3HomeScore != null) {
      const d3h = match.leg3HomeScore ?? 0, d3a = match.leg3AwayScore ?? 0;
      if (d3h !== d3a) { homeWon = d3h > d3a; awayWon = d3a > d3h; }
      else if (match.leg3HomePens != null) { homeWon = (match.leg3HomePens ?? 0) > (match.leg3AwayPens ?? 0); awayWon = !homeWon; }
    }
    return { homeScore: aggHome, awayScore: aggAway, homeWon, awayWon, isAgg: true };
  }
  const hs = match.homeScore ?? 0, as2 = match.awayScore ?? 0;
  const hasPens = match.homeScorePens != null;
  const homeWon = hasPens ? (match.homeScorePens ?? 0) > (match.awayScorePens ?? 0) : hs > as2;
  const awayWon = hasPens ? (match.awayScorePens ?? 0) > (match.homeScorePens ?? 0) : as2 > hs;
  return { homeScore: hs, awayScore: as2, homeWon, awayWon, isAgg: false };
}

interface BracketViewProps {
  rounds: number[];
  matchesByRound: Record<number, BracketMatch[]>;
  participantType: string;
}

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const MATCH_W = 220;
const MATCH_H = 80;
const ROUND_GAP = 60; // horizontal gap between rounds
const CONNECTOR_W = 30; // width of connector lines

function getRoundName(roundNum: number, matchCount: number, matchesByRound: Record<number, BracketMatch[]>) {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semi-finals";
  if (matchCount === 4) return "Quarter-finals";
  if (matchCount === 8) return "Round of 16";
  if (matchCount === 16) return "Round of 32";
  const firstMatch = matchesByRound[roundNum]?.[0];
  if (firstMatch?.round && !firstMatch.round.match(/^round\s*\d+$/i)) return firstMatch.round;
  return `Round ${roundNum}`;
}

// ═══════════════════════════════════════════════════════
// MATCH CARD COMPONENT
// ═══════════════════════════════════════════════════════

function MatchCard({
  match,
  isIndividual,
  x,
  y,
}: {
  match: BracketMatch;
  isIndividual: boolean;
  x: number;
  y: number;
}) {
  const isCompleted = match.status === "COMPLETED";
  const { homeScore, awayScore, homeWon: hw, awayWon: aw, isAgg } = getDisplayScores(match);
  const homeWon = isCompleted && hw;
  const awayWon = isCompleted && aw;

  const homeName = isIndividual
    ? (match.homePlayer?.name ?? "TBD")
    : (match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD");
  const awayName = isIndividual
    ? (match.awayPlayer?.name ?? "TBD")
    : (match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD");

  const halfH = MATCH_H / 2;

  return (
    <Link href={`/matches/${match.id}`}>
      <g className="cursor-pointer">
        {/* Card background */}
        <rect
          x={x}
          y={y}
          width={MATCH_W}
          height={MATCH_H}
          rx={8}
          fill="var(--card)"
          stroke="var(--border)"
          strokeWidth={1}
          className="hover:stroke-primary/50 transition-colors"
        />

        {/* Divider line */}
        <line x1={x} y1={y + halfH} x2={x + MATCH_W} y2={y + halfH} stroke="var(--border)" strokeWidth={0.5} />

        {/* Home row */}
        <rect
          x={x}
          y={y}
          width={MATCH_W}
          height={halfH}
          rx={8}
          fill={homeWon ? "var(--primary)" : "transparent"}
          fillOpacity={homeWon ? 0.08 : 0}
        />
        {/* Home row bottom corners need to be square when top has border-radius */}
        {homeWon && <rect x={x} y={y + halfH - 8} width={MATCH_W} height={8} fill="var(--primary)" fillOpacity={0.08} />}

        <text x={x + 12} y={y + halfH / 2 + 1} fontSize={13} fontWeight={homeWon ? 700 : 500} fill={homeWon ? "var(--primary)" : "var(--foreground)"} dominantBaseline="middle" fontFamily="system-ui">
          {homeName.length > 16 ? homeName.slice(0, 15) + "…" : homeName}
        </text>
        {isCompleted && (
          <text x={x + MATCH_W - 12} y={y + halfH / 2 + 1} fontSize={14} fontWeight={700} fill={homeWon ? "var(--primary)" : "var(--muted-foreground)"} dominantBaseline="middle" textAnchor="end" fontFamily="system-ui">
            {homeScore}
          </text>
        )}

        {/* Away row */}
        <rect
          x={x}
          y={y + halfH}
          width={MATCH_W}
          height={halfH}
          rx={8}
          fill={awayWon ? "var(--primary)" : "transparent"}
          fillOpacity={awayWon ? 0.08 : 0}
        />
        {awayWon && <rect x={x} y={y + halfH} width={MATCH_W} height={8} fill="var(--primary)" fillOpacity={0.08} />}

        <text x={x + 12} y={y + halfH + halfH / 2 + 1} fontSize={13} fontWeight={awayWon ? 700 : 500} fill={awayWon ? "var(--primary)" : "var(--foreground)"} dominantBaseline="middle" fontFamily="system-ui">
          {awayName.length > 16 ? awayName.slice(0, 15) + "…" : awayName}
        </text>
        {isCompleted && (
          <text x={x + MATCH_W - 12} y={y + halfH + halfH / 2 + 1} fontSize={14} fontWeight={700} fill={awayWon ? "var(--primary)" : "var(--muted-foreground)"} dominantBaseline="middle" textAnchor="end" fontFamily="system-ui">
            {awayScore}
          </text>
        )}

        {/* Aggregate / Penalty indicator */}
        {isCompleted && isAgg && (
          <text x={x + MATCH_W / 2} y={y + halfH + 1} fontSize={9} fill="var(--muted-foreground)" dominantBaseline="middle" textAnchor="middle" fontFamily="system-ui">
            Agg
          </text>
        )}
        {!isAgg && match.homeScorePens != null && (
          <text x={x + MATCH_W / 2} y={y + halfH + 1} fontSize={9} fill="var(--muted-foreground)" dominantBaseline="middle" textAnchor="middle" fontFamily="system-ui">
            ({match.homeScorePens}–{match.awayScorePens} pens)
          </text>
        )}
      </g>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════
// MOBILE STACKED VIEW
// ═══════════════════════════════════════════════════════

function MobileBracket({ rounds, matchesByRound, participantType }: BracketViewProps) {
  const isIndividual = participantType === "INDIVIDUAL";

  return (
    <div className="sm:hidden space-y-8">
      {[...rounds].reverse().map((roundNum) => {
        const matches = matchesByRound[roundNum];
        const roundName = getRoundName(roundNum, matches.length, matchesByRound);
        const isFinal = matches.length === 1;

        return (
          <div key={roundNum}>
            <h3 className="text-sm font-semibold mb-3 text-primary px-1">
              {roundName}
            </h3>
            <div className="space-y-3">
              {matches.map((match) => {
                const isCompleted = match.status === "COMPLETED";
                const { homeScore, awayScore, homeWon: hw, awayWon: aw, isAgg } = getDisplayScores(match);
                const homeWon = isCompleted && hw;
                const awayWon = isCompleted && aw;
                const homeName = isIndividual ? (match.homePlayer?.name ?? "TBD") : (match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD");
                const awayName = isIndividual ? (match.awayPlayer?.name ?? "TBD") : (match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD");

                return (
                  <Link key={match.id} href={`/matches/${match.id}`}>
                    <div className={`bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors ${isFinal ? "ring-1 ring-primary/30" : ""}`}>
                      {/* Home */}
                      <div className={`flex items-center justify-between px-4 py-3 ${homeWon ? "bg-primary/5" : ""}`}>
                        <span className={`text-sm ${homeWon ? "font-bold text-primary" : "font-medium"}`}>{homeName}</span>
                        {isCompleted && <span className={`text-sm font-bold ${homeWon ? "text-primary" : "text-muted-foreground"}`}>{homeScore}</span>}
                      </div>
                      {/* VS / Agg divider */}
                      <div className="border-t border-border/50 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground py-0.5 px-2 bg-muted/30">
                          {isCompleted && isAgg ? "Aggregate" : isCompleted ? "FT" : "vs"}
                        </span>
                      </div>
                      {!isAgg && match.homeScorePens != null && (
                        <div className="text-center text-[10px] text-muted-foreground py-0.5 bg-muted/30 border-t border-border/50">
                          Pens: {match.homeScorePens}–{match.awayScorePens}
                        </div>
                      )}
                      {/* Away */}
                      <div className={`flex items-center justify-between px-4 py-3 ${awayWon ? "bg-primary/5" : ""}`}>
                        <span className={`text-sm ${awayWon ? "font-bold text-primary" : "font-medium"}`}>{awayName}</span>
                        {isCompleted && <span className={`text-sm font-bold ${awayWon ? "text-primary" : "text-muted-foreground"}`}>{awayScore}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DESKTOP SVG BRACKET
// ═══════════════════════════════════════════════════════

function DesktopBracket({ rounds, matchesByRound, participantType }: BracketViewProps) {
  const isIndividual = participantType === "INDIVIDUAL";
  const totalRounds = rounds.length;

  if (totalRounds === 0) return null;

  // Calculate positions for each match
  // First round: evenly spaced
  // Later rounds: centered between the two feeder matches
  const matchPositions = new Map<string, { x: number; y: number }>();

  // First round match count determines the bracket height
  const firstRoundCount = matchesByRound[rounds[0]]?.length ?? 0;
  const firstRoundGap = 20;
  const totalHeight = firstRoundCount * MATCH_H + (firstRoundCount - 1) * firstRoundGap + 60; // +60 for header

  const HEADER_H = 36;

  // Calculate positions round by round
  rounds.forEach((roundNum, roundIndex) => {
    const matches = matchesByRound[roundNum];
    const x = roundIndex * (MATCH_W + ROUND_GAP + CONNECTOR_W);

    if (roundIndex === 0) {
      // First round: evenly distributed
      const totalBlockH = matches.length * MATCH_H + (matches.length - 1) * firstRoundGap;
      const startY = HEADER_H + (totalHeight - HEADER_H - totalBlockH) / 2;

      matches.forEach((match, i) => {
        const y = startY + i * (MATCH_H + firstRoundGap);
        matchPositions.set(match.id, { x, y });
      });
    } else {
      // Later rounds: center between feeder matches
      const prevRound = rounds[roundIndex - 1];
      const prevMatches = matchesByRound[prevRound];

      matches.forEach((match, i) => {
        // This match is fed by prevMatches[i*2] and prevMatches[i*2+1]
        const feeder1 = prevMatches[i * 2];
        const feeder2 = prevMatches[i * 2 + 1];

        if (feeder1 && feeder2) {
          const pos1 = matchPositions.get(feeder1.id)!;
          const pos2 = matchPositions.get(feeder2.id)!;
          const y = (pos1.y + pos2.y) / 2;
          matchPositions.set(match.id, { x, y });
        } else if (feeder1) {
          const pos1 = matchPositions.get(feeder1.id)!;
          matchPositions.set(match.id, { x, y: pos1.y });
        } else {
          // Fallback
          const y = HEADER_H + (totalHeight - HEADER_H) / 2 - MATCH_H / 2;
          matchPositions.set(match.id, { x, y });
        }
      });
    }
  });

  const totalWidth = totalRounds * (MATCH_W + ROUND_GAP + CONNECTOR_W) - ROUND_GAP - CONNECTOR_W;

  return (
    <div className="hidden sm:block overflow-x-auto pb-4">
      <svg
        width={totalWidth + 40}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth + 40} ${totalHeight}`}
        className="mx-auto"
        style={{ minWidth: totalWidth + 40 }}
      >
        {/* Round headers */}
        {rounds.map((roundNum, roundIndex) => {
          const matches = matchesByRound[roundNum];
          const x = roundIndex * (MATCH_W + ROUND_GAP + CONNECTOR_W);
          const roundName = getRoundName(roundNum, matches.length, matchesByRound);

          return (
            <text
              key={`header-${roundNum}`}
              x={x + MATCH_W / 2}
              y={18}
              fontSize={13}
              fontWeight={600}
              fill="var(--muted-foreground)"
              textAnchor="middle"
              fontFamily="system-ui"
            >
              {roundName}
            </text>
          );
        })}

        {/* Connector lines between rounds */}
        {rounds.slice(1).map((roundNum, idx) => {
          const roundIndex = idx + 1;
          const prevRound = rounds[idx];
          const matches = matchesByRound[roundNum];
          const prevMatches = matchesByRound[prevRound];

          return matches.map((match, i) => {
            const feeder1 = prevMatches[i * 2];
            const feeder2 = prevMatches[i * 2 + 1];
            if (!feeder1 || !feeder2) return null;

            const pos1 = matchPositions.get(feeder1.id);
            const pos2 = matchPositions.get(feeder2.id);
            const posMatch = matchPositions.get(match.id);
            if (!pos1 || !pos2 || !posMatch) return null;

            // Connection points
            const x1 = pos1.x + MATCH_W; // right edge of feeder 1
            const y1 = pos1.y + MATCH_H / 2; // center of feeder 1
            const x2 = pos1.x + MATCH_W; // right edge of feeder 2
            const y2 = pos2.y + MATCH_H / 2; // center of feeder 2
            const xMid = x1 + CONNECTOR_W / 2 + ROUND_GAP / 2; // midpoint
            const xEnd = posMatch.x; // left edge of next match
            const yEnd = posMatch.y + MATCH_H / 2; // center of next match

            return (
              <g key={`conn-${match.id}`}>
                {/* From feeder 1 right → horizontal to midpoint → vertical down to merge → horizontal to next match */}
                <path
                  d={`M ${x1} ${y1} H ${xMid} V ${yEnd} H ${xEnd}`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
                {/* From feeder 2 right → horizontal to midpoint → vertical up to merge point */}
                <path
                  d={`M ${x2} ${y2} H ${xMid} V ${yEnd}`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </g>
            );
          });
        })}

        {/* Match cards */}
        {rounds.map((roundNum) => {
          const matches = matchesByRound[roundNum];
          return matches.map((match) => {
            const pos = matchPositions.get(match.id);
            if (!pos) return null;

            // Highlight final with a subtle glow
            const isFinal = matches.length === 1 && rounds.indexOf(roundNum) === rounds.length - 1;

            return (
              <g key={match.id}>
                {isFinal && (
                  <rect
                    x={pos.x - 3}
                    y={pos.y - 3}
                    width={MATCH_W + 6}
                    height={MATCH_H + 6}
                    rx={10}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={1}
                    opacity={0.4}
                  />
                )}
                <MatchCard match={match} isIndividual={isIndividual} x={pos.x} y={pos.y} />
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// EXPORTED COMPONENT
// ═══════════════════════════════════════════════════════

export function BracketVisualization({ rounds, matchesByRound, participantType }: BracketViewProps) {
  if (rounds.length === 0) return null;

  return (
    <>
      <MobileBracket rounds={rounds} matchesByRound={matchesByRound} participantType={participantType} />
      <DesktopBracket rounds={rounds} matchesByRound={matchesByRound} participantType={participantType} />
    </>
  );
}
