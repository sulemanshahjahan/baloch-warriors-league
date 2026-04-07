"use client";

import { useState, useRef, useEffect } from "react";

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
  const [showPreview, setShowPreview] = useState(false);
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

  // Generate share text with WhatsApp bold format (*text*)
  const shareText = matchInfo
    ? `*${matchInfo}*\n\n*${homeName} ${homeScore} - ${awayScore} ${awayName}*\n\n${tournamentName}`
    : `*${homeName} ${homeScore} - ${awayScore} ${awayName}*\n\n${tournamentName}`;
  const shareUrl = `https://bwlleague.com/matches/${matchId}`;

  // WhatsApp share URL
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `${shareText}\n\n${shareUrl}`
  )}`;

  // Copy to clipboard for Instagram
  const copyToClipboard = () => {
    const text = `${shareText}\n\n${shareUrl}`;
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard! Paste in Instagram.");
  };

  // Generate and download scorecard image
  const generateScorecard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas size (square for easy sharing)
    const size = 800;
    canvas.width = size;
    canvas.height = size;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#0a0a0a");
    gradient.addColorStop(0.5, "#1a1a1a");
    gradient.addColorStop(1, "#0f0f0f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // BWL Logo/header
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(size / 2 - 40, 40, 80, 80);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("B", size / 2, 95);

    // Tournament name
    ctx.fillStyle = "#888";
    ctx.font = "600 24px system-ui";
    ctx.fillText(tournamentName.toUpperCase(), size / 2, 160);

    // Match info
    if (matchInfo) {
      ctx.fillStyle = "#666";
      ctx.font = "500 20px system-ui";
      ctx.fillText(matchInfo, size / 2, 200);
    }

    // Draw player photos if available
    const drawAvatar = (url: string | null | undefined, x: number, y: number, name: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 60, 0, Math.PI * 2);
      ctx.clip();
      
      // Draw placeholder circle
      ctx.fillStyle = "#333";
      ctx.fill();
      
      // Draw initials
      ctx.fillStyle = "#fff";
      ctx.font = "bold 32px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      ctx.fillText(initials, x, y);
      
      ctx.restore();
    };

    // Home player
    drawAvatar(homePhoto, 200, 320, homeName);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(homeName, 200, 420);

    // Away player
    drawAvatar(awayPhoto, 600, 320, awayName);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px system-ui";
    ctx.fillText(awayName, 600, 420);

    // VS or Score
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 72px system-ui";
    ctx.fillText(`${homeScore} - ${awayScore}`, size / 2, 340);

    // Footer
    ctx.fillStyle = "#444";
    ctx.font = "20px system-ui";
    ctx.fillText("bwlleague.com", size / 2, 750);

    // Download
    const link = document.createElement("a");
    link.download = `BWL-${homeName}-vs-${awayName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
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
          onClick={copyToClipboard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-pink-500/10 text-pink-500 text-xs font-medium hover:bg-pink-500/20 transition-colors cursor-pointer"
          aria-label="Copy for Instagram"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
          Copy for IG
        </button>
        <button
          onClick={generateScorecard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium hover:bg-blue-500/20 transition-colors cursor-pointer"
          aria-label="Download Scorecard"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
          Save Image
        </button>
      </div>

      {/* Hidden canvas for generating image */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </>
  );
}
