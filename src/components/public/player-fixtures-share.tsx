"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Download, ChevronDown } from "lucide-react";

interface Match {
  id: string;
  round: string | null;
  homePlayer?: { id: string; name: string } | null;
  awayPlayer?: { id: string; name: string } | null;
  homeTeam?: { id: string; name: string } | null;
  awayTeam?: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scheduledAt: Date | null;
}

interface Player {
  id: string;
  name: string;
}

interface PlayerFixturesShareProps {
  tournamentName: string;
  matches: Match[];
  players: Player[];
  participantType: string;
}

export function PlayerFixturesShare({ tournamentName, matches, players, participantType }: PlayerFixturesShareProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");

  const isIndividual = participantType === "INDIVIDUAL";

  // Get unique players/teams from matches
  const participants = isIndividual ? players : [];

  if (participants.length === 0) return null;

  function getPlayerMatches(playerId: string) {
    return matches.filter((m) => {
      if (isIndividual) {
        return m.homePlayer?.id === playerId || m.awayPlayer?.id === playerId;
      }
      return m.homeTeam?.id === playerId || m.awayTeam?.id === playerId;
    });
  }

  function getOpponentName(match: Match, playerId: string): string {
    if (isIndividual) {
      return match.homePlayer?.id === playerId
        ? (match.awayPlayer?.name ?? "TBD")
        : (match.homePlayer?.name ?? "TBD");
    }
    return match.homeTeam?.id === playerId
      ? (match.awayTeam?.name ?? "TBD")
      : (match.homeTeam?.name ?? "TBD");
  }

  async function generateImage(playerId: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const player = participants.find((p) => p.id === playerId);
    if (!player) return;

    const playerMatches = getPlayerMatches(playerId);
    const W = 800;
    const rowH = 70;
    const headerH = 160;
    const footerH = 60;
    const H = headerH + playerMatches.length * rowH + footerH;

    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, W, H);

    // Header gradient
    const headerGrad = ctx.createLinearGradient(0, 0, W, headerH);
    headerGrad.addColorStop(0, "#1a0000");
    headerGrad.addColorStop(1, "#0a0a20");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, headerH);

    // Tournament name
    ctx.fillStyle = "#dc2626";
    ctx.font = "700 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(tournamentName.toUpperCase(), W / 2, 35);

    // Player name
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 42px system-ui";
    ctx.fillText(player.name, W / 2, 85);

    // Subtitle
    ctx.fillStyle = "#666";
    ctx.font = "500 16px system-ui";
    ctx.fillText(`${playerMatches.length} Group Stage Matches`, W / 2, 115);

    // Divider
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, 135);
    ctx.lineTo(W * 0.8, 135);
    ctx.stroke();

    // Match rows
    playerMatches.forEach((match, i) => {
      const y = headerH + i * rowH;
      const opponent = getOpponentName(match, playerId);
      const isHome = isIndividual
        ? match.homePlayer?.id === playerId
        : match.homeTeam?.id === playerId;
      const isCompleted = match.status === "COMPLETED";

      // Alternating row background
      if (i % 2 === 0) {
        ctx.fillStyle = "#111116";
        ctx.fillRect(0, y, W, rowH);
      }

      // Match number
      ctx.fillStyle = "#dc2626";
      ctx.font = "800 20px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`${i + 1}`, 30, y + rowH / 2 + 7);

      // Round name
      ctx.fillStyle = "#666";
      ctx.font = "500 13px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(match.round ?? "", 60, y + 22);

      // Player vs Opponent
      ctx.fillStyle = "#fff";
      ctx.font = "700 20px system-ui";
      ctx.textAlign = "center";

      const homeLabel = isHome ? player.name : opponent;
      const awayLabel = isHome ? opponent : player.name;

      // Home
      ctx.textAlign = "right";
      ctx.fillStyle = isHome ? "#dc2626" : "#fff";
      ctx.fillText(homeLabel, W / 2 - 30, y + rowH / 2 + 7);

      // VS
      ctx.textAlign = "center";
      ctx.fillStyle = "#555";
      ctx.font = "600 14px system-ui";
      ctx.fillText(isCompleted ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : "vs", W / 2, y + rowH / 2 + 7);

      // Away
      ctx.textAlign = "left";
      ctx.fillStyle = !isHome ? "#dc2626" : "#fff";
      ctx.font = "700 20px system-ui";
      ctx.fillText(awayLabel, W / 2 + 30, y + rowH / 2 + 7);

      // Status badge
      ctx.textAlign = "right";
      ctx.font = "500 12px system-ui";
      ctx.fillStyle = isCompleted ? "#22c55e" : "#f59e0b";
      ctx.fillText(isCompleted ? "Completed" : "Scheduled", W - 30, y + rowH / 2 + 5);
    });

    // Footer
    const footerY = headerH + playerMatches.length * rowH;
    ctx.fillStyle = "#111116";
    ctx.fillRect(0, footerY, W, footerH);

    ctx.fillStyle = "#dc2626";
    ctx.font = "600 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("BWLLEAGUE.COM", W / 2, footerY + 35);

    return canvas;
  }

  async function handleShare(playerId: string) {
    const canvas = await generateImage(playerId);
    if (!canvas) return;

    const player = participants.find((p) => p.id === playerId);
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej()), "image/png")
    );
    const fileName = `BWL-${player?.name ?? "fixtures"}-matches.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    // Try native share
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${player?.name} — ${tournamentName} Fixtures`,
        });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }

    // Capacitor share
    const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;
    if (isCapacitor) {
      try {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const written = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        await Share.share({ title: `${player?.name} Fixtures`, url: written.uri });
        return;
      } catch { /* fall through */ }
    }

    // Download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Share2 className="w-4 h-4" />
        Share Fixtures
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="mt-3 p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
          <p className="text-xs text-muted-foreground">
            Generate a fixture card for each player to share on WhatsApp:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {participants.map((player) => {
              const matchCount = getPlayerMatches(player.id).length;
              if (matchCount === 0) return null;
              return (
                <button
                  key={player.id}
                  onClick={() => handleShare(player.id)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card hover:bg-card/80 border border-border/50 hover:border-primary/30 transition-colors text-left min-h-[44px]"
                >
                  <span className="text-sm font-medium truncate">{player.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{matchCount}m</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </>
  );
}
