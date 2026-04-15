/**
 * Generate a canvas scorecard image and share it via Web Share API / Capacitor / download.
 * Used by both the public match page share button and the admin result form auto-share.
 */

export interface ScorecardData {
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
  // 2-legged knockout
  leg2HomeScore?: number | null;
  leg2AwayScore?: number | null;
  leg3HomeScore?: number | null;
  leg3AwayScore?: number | null;
  leg3HomePens?: number | null;
  leg3AwayPens?: number | null;
}

function formatMatchInfo(round: string | null, matchNumber: number | null): string {
  if (!round) return "";
  if (round.match(/Semi-final|Quarter-final|Final/i)) {
    const matchNum = matchNumber ? ` ${matchNumber}` : "";
    return `${round}${matchNum}`;
  }
  return round;
}

function buildShareText(data: ScorecardData): string {
  const matchInfo = formatMatchInfo(data.round, data.matchNumber);
  const shareUrl = `https://bwlleague.com/matches/${data.matchId}`;
  const has2Legs = data.leg2HomeScore != null;

  let scoreLines: (string | null)[];
  if (has2Legs) {
    const totalH = data.homeScore + (data.leg2HomeScore ?? 0) + (data.leg3HomeScore ?? 0);
    const totalA = data.awayScore + (data.leg2AwayScore ?? 0) + (data.leg3AwayScore ?? 0);
    const hasDecider = data.leg3HomeScore != null;
    scoreLines = [
      `*FULL-TIME*`,
      `*${data.homeName} ${totalH}–${totalA} ${data.awayName}${hasDecider ? " (3 legs)" : " (Agg)"}*`,
      `Leg 1: ${data.homeScore}–${data.awayScore} | Leg 2: ${data.leg2HomeScore}–${data.leg2AwayScore ?? 0}`,
      hasDecider
        ? `Decider: ${data.leg3HomeScore}–${data.leg3AwayScore ?? 0}${data.leg3HomePens != null ? ` (${data.leg3HomePens}–${data.leg3AwayPens ?? 0} pens)` : ""}`
        : null,
    ];
  } else {
    scoreLines = [
      `*FULL-TIME*`,
      `*${data.homeName} ${data.homeScore}–${data.awayScore} ${data.awayName}*`,
    ];
  }

  return [
    `🏆 ${data.tournamentName}`,
    matchInfo || null,
    ``,
    ...scoreLines,
    ``,
    `🔗 Match details:`,
    shareUrl,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

const loadLocalImage = (path: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = path;
  });

const loadExternalImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/**
 * Generates the scorecard on a canvas, then shares it via the best available method.
 * Returns true if sharing was initiated, false if it fell back to download.
 */
export async function generateAndShareScorecard(
  canvas: HTMLCanvasElement,
  data: ScorecardData,
): Promise<boolean> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const size = 800;
  canvas.width = size;
  canvas.height = size;

  // Load all images in parallel
  const [bgResult, logoResult, homeResult, awayResult] = await Promise.allSettled([
    loadLocalImage("/scorecard-bg.jpg"),
    loadLocalImage("/logo.png"),
    data.homePhoto ? loadExternalImage(data.homePhoto) : Promise.reject("none"),
    data.awayPhoto ? loadExternalImage(data.awayPhoto) : Promise.reject("none"),
  ]);

  const bgImg = bgResult.status === "fulfilled" ? bgResult.value : null;
  const logoImg = logoResult.status === "fulfilled" ? logoResult.value : null;
  const homeImg = homeResult.status === "fulfilled" ? homeResult.value : null;
  const awayImg = awayResult.status === "fulfilled" ? awayResult.value : null;

  // Background
  if (bgImg) {
    const aspect = bgImg.width / bgImg.height;
    const dw = aspect >= 1 ? size * aspect : size;
    const dh = aspect >= 1 ? size : size / aspect;
    ctx.drawImage(bgImg, (size - dw) / 2, (size - dh) / 2, dw, dh);
  }

  // Dark overlay
  const overlay = ctx.createLinearGradient(0, 0, 0, size);
  overlay.addColorStop(0, "rgba(0,0,0,0.82)");
  overlay.addColorStop(0.4, "rgba(0,0,0,0.55)");
  overlay.addColorStop(0.7, "rgba(0,0,0,0.65)");
  overlay.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, size, size);

  // Logo
  if (logoImg) {
    ctx.drawImage(logoImg, size / 2 - 50, 30, 100, 100);
  } else {
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 56px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("BWL", size / 2, 115);
  }

  // Tournament name
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 36px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(data.tournamentName.toUpperCase(), size / 2, 175);

  // Match round
  const matchInfo = formatMatchInfo(data.round, data.matchNumber);
  if (matchInfo) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "500 24px system-ui";
    ctx.fillText(matchInfo, size / 2, 215);
  }

  // Avatar helper
  const drawAvatar = (img: HTMLImageElement | null, x: number, y: number, name: string) => {
    const r = 70;
    const initials = name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#2a2a2a";
    ctx.fill();

    if (img) {
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
      ctx.fillStyle = "#fff";
      ctx.font = "bold 40px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, x, y);
      ctx.textBaseline = "alphabetic";
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(name, x, y + r + 42);
  };

  drawAvatar(homeImg, 200, 370, data.homeName);
  drawAvatar(awayImg, 600, 370, data.awayName);

  // Score — show aggregate for 2-legged, single score otherwise
  const has2Legs = data.leg2HomeScore != null;

  if (has2Legs) {
    // Total score across all legs including decider
    const totalH = data.homeScore + (data.leg2HomeScore ?? 0) + (data.leg3HomeScore ?? 0);
    const totalA = data.awayScore + (data.leg2AwayScore ?? 0) + (data.leg3AwayScore ?? 0);
    const hasDecider = data.leg3HomeScore != null;
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 64px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${totalH} - ${totalA}`, size / 2, 350);
    ctx.textBaseline = "alphabetic";

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "500 14px system-ui";
    ctx.fillText(hasDecider ? "TOTAL (3 LEGS)" : "AGGREGATE", size / 2, 390);

    // Leg scores below
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "500 18px system-ui";
    ctx.fillText(`Leg 1: ${data.homeScore} - ${data.awayScore}   |   Leg 2: ${data.leg2HomeScore} - ${data.leg2AwayScore ?? 0}`, size / 2, 420);

    // Decider if exists
    if (data.leg3HomeScore != null) {
      let deciderText = `Decider: ${data.leg3HomeScore} - ${data.leg3AwayScore ?? 0}`;
      if (data.leg3HomePens != null) deciderText += ` (${data.leg3HomePens} - ${data.leg3AwayPens ?? 0} pens)`;
      ctx.fillText(deciderText, size / 2, 448);
    }
  } else {
    // Single match score
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 80px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${data.homeScore} - ${data.awayScore}`, size / 2, 370);
    ctx.textBaseline = "alphabetic";
  }

  // Divider
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 540);
  ctx.lineTo(720, 540);
  ctx.stroke();

  // Footer
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 26px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("bwlleague.com", size / 2, 760);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });

  const fileName = `BWL-${data.homeName}-vs-${data.awayName}.png`;
  const file = new File([blob], fileName, { type: "image/png" });
  const shareTextStr = buildShareText(data);
  const title = `${data.homeName} ${data.homeScore} - ${data.awayScore} ${data.awayName}`;

  // Share via best available method
  const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;

  if (isCapacitor) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const written = await Filesystem.writeFile({
      path: "bwl-scorecard.png",
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title,
      text: shareTextStr,
      url: written.uri,
      dialogTitle: "Share Scorecard",
    });
    return true;
  } else if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareTextStr, title });
      return true;
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") throw err;
      return false;
    }
  } else {
    // Desktop fallback: download image
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    return false;
  }
}
