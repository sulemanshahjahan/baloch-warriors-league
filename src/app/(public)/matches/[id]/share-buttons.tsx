"use client";

import { useRef } from "react";

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

  // Generate share text with WhatsApp bold format (*text*)
  const shareText = matchInfo
    ? `*${matchInfo}*\n\n*${homeName} ${homeScore} - ${awayScore} ${awayName}*\n\n${tournamentName}`
    : `*${homeName} ${homeScore} - ${awayScore} ${awayName}*\n\n${tournamentName}`;
  const shareUrl = `https://bwlleague.com/matches/${matchId}`;

  // WhatsApp share URL
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `${shareText}\n\n${shareUrl}`
  )}`;


  // Local assets (same-origin) must NOT use crossOrigin — it causes cache
  // mismatch issues that taint the canvas even for same-origin requests.
  const loadLocalImage = (path: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = path;
    });

  // External images (Cloudinary etc.) need crossOrigin to avoid canvas taint.
  const loadExternalImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

  // Generate and download scorecard image
  const generateScorecard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 800;
    canvas.width = size;
    canvas.height = size;

    // Step 1: load ALL images in parallel before touching the canvas.
    // Local assets use loadLocalImage (no crossOrigin).
    // External player photos use loadExternalImage (crossOrigin = anonymous).
    const [bgResult, logoResult, homeResult, awayResult] = await Promise.allSettled([
      loadLocalImage("/scorecard-bg.jpg"),
      loadLocalImage("/logo.png"),
      homePhoto ? loadExternalImage(homePhoto) : Promise.reject("none"),
      awayPhoto ? loadExternalImage(awayPhoto) : Promise.reject("none"),
    ]);

    const bgImg   = bgResult.status   === "fulfilled" ? bgResult.value   : null;
    const logoImg = logoResult.status === "fulfilled" ? logoResult.value : null;
    const homeImg = homeResult.status === "fulfilled" ? homeResult.value : null;
    const awayImg = awayResult.status === "fulfilled" ? awayResult.value : null;

    // Step 2: draw everything synchronously — no more awaits after this point

    // Background — stadium photo, cover-fit, then dark overlay for readability
    if (bgImg) {
      const aspect = bgImg.width / bgImg.height;
      const dw = aspect >= 1 ? size * aspect : size;
      const dh = aspect >= 1 ? size : size / aspect;
      ctx.drawImage(bgImg, (size - dw) / 2, (size - dh) / 2, dw, dh);
    }
    // Dark overlay — gradient from near-opaque top to semi-transparent middle to dark bottom
    const overlay = ctx.createLinearGradient(0, 0, 0, size);
    overlay.addColorStop(0,   "rgba(0,0,0,0.82)");
    overlay.addColorStop(0.4, "rgba(0,0,0,0.55)");
    overlay.addColorStop(0.7, "rgba(0,0,0,0.65)");
    overlay.addColorStop(1,   "rgba(0,0,0,0.88)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, size, size);

    // Logo — actual PNG, no red fallback box
    if (logoImg) {
      ctx.drawImage(logoImg, size / 2 - 50, 30, 100, 100);
    } else {
      // Text-only fallback if logo.png fails
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 56px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("BWL", size / 2, 115);
    }

    // Tournament name
    ctx.fillStyle = "#888";
    ctx.font = "600 24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(tournamentName.toUpperCase(), size / 2, 170);

    // Match round
    if (matchInfo) {
      ctx.fillStyle = "#666";
      ctx.font = "500 20px system-ui";
      ctx.fillText(matchInfo, size / 2, 205);
    }

    // Synchronous avatar draw — no async, no interleaved clip states
    const drawAvatar = (img: HTMLImageElement | null, x: number, y: number, name: string) => {
      const r = 70;
      const initials = name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();

      // Background circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = "#2a2a2a";
      ctx.fill();

      if (img) {
        // Clip to circle, draw image, restore — all synchronous
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();
        const aspect = img.width / img.height;
        const dw = aspect >= 1 ? r * 2 * aspect : r * 2;
        const dh = aspect >= 1 ? r * 2 : (r * 2) / aspect;
        ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
        ctx.restore();
      } else {
        // Initials fallback
        ctx.fillStyle = "#fff";
        ctx.font = "bold 40px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, x, y);
        ctx.textBaseline = "alphabetic";
      }

      // Border — drawn after restore so it's never clipped
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Name below avatar
      ctx.fillStyle = "#fff";
      ctx.font = "bold 26px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(name, x, y + r + 42);
    };

    // Draw home (left) then away (right) — sequential, no concurrency
    drawAvatar(homeImg, 200, 370, homeName);
    drawAvatar(awayImg, 600, 370, awayName);

    // Score — drawn last so it sits on top between the two avatars
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 80px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${homeScore} - ${awayScore}`, size / 2, 370);
    ctx.textBaseline = "alphabetic";

    // Divider
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 540);
    ctx.lineTo(720, 540);
    ctx.stroke();

    // Footer
    ctx.fillStyle = "#555";
    ctx.font = "20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("bwlleague.com", size / 2, 760);

    // Step 3: convert canvas to blob (more memory-efficient than toDataURL)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });

    const fileName = `BWL-${homeName}-vs-${awayName}.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    const imageShareText = matchInfo
      ? `*${matchInfo}*\n*${homeName} ${homeScore} - ${awayScore} ${awayName}*\n${tournamentName}\n${shareUrl}`
      : `*${homeName} ${homeScore} - ${awayScore} ${awayName}*\n${tournamentName}\n${shareUrl}`;

    // Step 4: native share sheet on mobile (Android/iOS/Capacitor WebView)
    // Falls back to download on desktop where Web Share API is unavailable.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          text: imageShareText,
          title: `${homeName} ${homeScore} - ${awayScore} ${awayName}`,
        });
      } catch (err) {
        // User cancelled share — not an error
        if (err instanceof Error && err.name !== "AbortError") throw err;
      }
    } else {
      // Desktop fallback: download the image
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = fileName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
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
          onClick={generateScorecard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium hover:bg-blue-500/20 transition-colors cursor-pointer"
          aria-label="Share scorecard"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
          </svg>
          Share
        </button>
      </div>

      {/* Hidden canvas for generating image */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </>
  );
}
