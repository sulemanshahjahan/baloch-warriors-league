"use client";

import { useRef } from "react";
import { generateAndShareScorecard, type ScorecardData } from "@/lib/share-scorecard";

interface ShareButtonsProps {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  tournamentName: string;
  matchId: string;
  round: string | null;
  matchNumber: number | null;
  homePhoto?: string | null;
  awayPhoto?: string | null;
}

export function ShareButtons({
  homeName,
  awayName,
  homeScore,
  awayScore,
  tournamentName,
  matchId,
  round,
  matchNumber,
  homePhoto,
  awayPhoto,
}: ShareButtonsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Format match info
  let matchInfo = "";
  if (round) {
    if (round.match(/Semi-final|Quarter-final|Final/i)) {
      const matchNum = matchNumber ? ` ${matchNumber}` : "";
      matchInfo = `${round}${matchNum}`;
    } else {
      matchInfo = round;
    }
  }

  const shareUrl = `https://bwlleague.com/matches/${matchId}`;
  const scoreline = `${homeName} ${homeScore}–${awayScore} ${awayName}`;

  const shareText = [
    `🏆 ${tournamentName}`,
    matchInfo ? matchInfo : null,
    ``,
    `*FULL-TIME*`,
    `*${scoreline}*`,
    ``,
    `🔗 Match details:`,
    shareUrl,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const data: ScorecardData = {
    homeName, awayName, homeScore, awayScore,
    tournamentName, matchId, round, matchNumber,
    homePhoto, awayPhoto,
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await generateAndShareScorecard(canvas, data);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/10 text-green-500 text-xs font-medium hover:bg-green-500/20 transition-colors"
          aria-label="Share on WhatsApp"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </a>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium hover:bg-blue-500/20 transition-colors cursor-pointer"
          aria-label="Share scorecard"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
          </svg>
          Share
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </>
  );
}
