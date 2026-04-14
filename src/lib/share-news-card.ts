/**
 * Generate a canvas PNG card for a news post and share it.
 * Shows BWL branding, title, and excerpt in a styled card.
 */

export interface NewsCardData {
  title: string;
  excerpt: string;
  slug: string;
}

const loadLocalImage = (path: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = path;
  });

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line + (line ? " " : "") + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

export async function generateAndShareNewsCard(
  canvas: HTMLCanvasElement,
  data: NewsCardData,
): Promise<boolean> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const width = 800;
  const height = 500;
  canvas.width = width;
  canvas.height = height;

  // Load assets
  const [bgResult, logoResult] = await Promise.allSettled([
    loadLocalImage("/scorecard-bg.jpg"),
    loadLocalImage("/logo.png"),
  ]);

  const bgImg = bgResult.status === "fulfilled" ? bgResult.value : null;
  const logoImg = logoResult.status === "fulfilled" ? logoResult.value : null;

  // Background
  if (bgImg) {
    const aspect = bgImg.width / bgImg.height;
    const dw = aspect >= 1 ? width * aspect : width;
    const dh = aspect >= 1 ? height : height / aspect;
    ctx.drawImage(bgImg, (width - dw) / 2, (height - dh) / 2, dw, dh);
  }

  // Dark overlay
  const overlay = ctx.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, "rgba(0,0,0,0.88)");
  overlay.addColorStop(0.5, "rgba(0,0,0,0.75)");
  overlay.addColorStop(1, "rgba(0,0,0,0.90)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  // Red accent line at top
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(0, 0, width, 4);

  // Logo
  if (logoImg) {
    ctx.drawImage(logoImg, 40, 30, 60, 60);
  } else {
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 32px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("BWL", 40, 70);
  }

  // "BWL NEWS" label
  ctx.fillStyle = "#ef4444";
  ctx.font = "bold 14px system-ui";
  ctx.textAlign = "left";
  ctx.letterSpacing = "2px";
  ctx.fillText("BWL NEWS", 115, 55);
  ctx.letterSpacing = "0px";

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 110);
  ctx.lineTo(width - 40, 110);
  ctx.stroke();

  // Title (wrapped)
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const titleY = wrapText(ctx, data.title, 40, 155, width - 80, 42);

  // Excerpt (wrapped, muted)
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "400 18px system-ui";
  wrapText(ctx, data.excerpt, 40, titleY + 15, width - 80, 26);

  // Footer divider
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.moveTo(40, height - 60);
  ctx.lineTo(width - 40, height - 60);
  ctx.stroke();

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 14px system-ui";
  ctx.fillText("bwlleague.com/news", 40, height - 30);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ef4444";
  ctx.font = "bold 14px system-ui";
  ctx.fillText("Read More →", width - 40, height - 30);

  // Convert to blob and share
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });

  const fileName = `BWL-News.png`;
  const file = new File([blob], fileName, { type: "image/png" });

  const shareUrl = `https://bwlleague.com/news/${data.slug}`;
  const shareText = [
    `📰 BWL News`,
    ``,
    `*${data.title}*`,
    ``,
    data.excerpt,
    ``,
    `🔗 Read more:`,
    shareUrl,
  ].join("\n");

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
      path: "bwl-news-card.png",
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: data.title,
      text: shareText,
      url: written.uri,
      dialogTitle: "Share News",
    });
    return true;
  } else if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText, title: data.title });
      return true;
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") throw err;
      return false;
    }
  } else {
    // Desktop fallback: download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    return false;
  }
}
