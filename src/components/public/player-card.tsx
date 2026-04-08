"use client";

import { useRef, useEffect, useState } from "react";
import { Share2 } from "lucide-react";

interface PlayerCardProps {
  name: string;
  position: string;
  rating: number;
  nationality: string;
  avatarUrl: string;
  playerId: string;
  stats: {
    goals: number;
    wins: number;
    matches: number;
    motm: number;
  };
}

function getTier(rating: number) {
  if (rating >= 90) return { base: [8, 42, 18], accent: [74, 222, 128], glow: "#22c55e", label: "LEGENDARY", stars: 5 };
  if (rating >= 80) return { base: [8, 16, 52], accent: [96, 165, 250], glow: "#3b82f6", label: "EPIC", stars: 4 };
  if (rating >= 70) return { base: [45, 36, 8], accent: [251, 191, 36], glow: "#f59e0b", label: "GOLD", stars: 3 };
  if (rating >= 60) return { base: [26, 26, 28], accent: [170, 170, 180], glow: "#a1a1aa", label: "SILVER", stars: 2 };
  return { base: [36, 22, 8], accent: [217, 119, 6], glow: "#b45309", label: "BRONZE", stars: 1 };
}

function rgb(c: number[]) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function rgba(c: number[], a: number) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function PlayerCard({ name, position, rating, nationality, avatarUrl, playerId, stats }: PlayerCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 500;
    const H = 700;
    canvas.width = W;
    canvas.height = H;
    const tier = getTier(rating);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => render(ctx, img, W, H, tier);
    img.onerror = () => render(ctx, null, W, H, tier);
    img.src = avatarUrl;

    function render(
      ctx: CanvasRenderingContext2D,
      avatar: HTMLImageElement | null,
      W: number,
      H: number,
      tier: ReturnType<typeof getTier>
    ) {
      const ac = tier.accent;
      const bc = tier.base;
      const darkBase = rgb([bc[0] * 0.25, bc[1] * 0.25, bc[2] * 0.25]);

      // ═══════════════════════════════════════
      // BACKGROUND — rich, layered, deep
      // ═══════════════════════════════════════

      ctx.fillStyle = darkBase;
      ctx.fillRect(0, 0, W, H);

      // Large radial glow behind player (warm center)
      const centerGlow = ctx.createRadialGradient(W / 2, H * 0.33, 12, W / 2, H * 0.33, W * 0.65);
      centerGlow.addColorStop(0, rgba(ac, 0.18));
      centerGlow.addColorStop(0.5, rgba(ac, 0.06));
      centerGlow.addColorStop(1, "transparent");
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, W, H);

      // Top-left accent wash
      const tlGlow = ctx.createRadialGradient(40, 40, 0, 40, 40, 200);
      tlGlow.addColorStop(0, rgba(ac, 0.12));
      tlGlow.addColorStop(1, "transparent");
      ctx.fillStyle = tlGlow;
      ctx.fillRect(0, 0, W, H);

      // Edge vignette
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, rgba([0, 0, 0], 0.5));
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      // Diagonal light beams
      ctx.save();
      ctx.globalAlpha = 0.025;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(W * (0.3 + i * 0.25), -H * 0.15);
        ctx.rotate(Math.PI / 4.5);
        const beam = ctx.createLinearGradient(0, 0, 0, W * 0.08);
        beam.addColorStop(0, "transparent");
        beam.addColorStop(0.5, rgb(ac));
        beam.addColorStop(1, "transparent");
        ctx.fillStyle = beam;
        ctx.fillRect(-W, 0, W * 3, W * 0.06);
        ctx.restore();
      }
      ctx.restore();

      // Noise texture
      ctx.save();
      ctx.globalAlpha = 0.025;
      for (let i = 0; i < 12000; i++) {
        const v = Math.random() * 200;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }
      ctx.restore();

      // Faint abstract crest watermark
      ctx.save();
      ctx.globalAlpha = 0.02;
      ctx.font = "bold 350px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = rgb(ac);
      ctx.fillText("B", W / 2, H * 0.55);
      ctx.restore();

      // ═══════════════════════════════════════
      // CARD BORDER — glowing, layered
      // ═══════════════════════════════════════

      // Outer glow
      ctx.save();
      ctx.shadowColor = tier.glow;
      ctx.shadowBlur = 30;
      roundRect(ctx, 1, 1, W - 2, H - 2, 18);
      ctx.strokeStyle = rgba(ac, 0.4);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Inner stroke
      roundRect(ctx, 5, 5, W - 10, H - 10, 15);
      ctx.strokeStyle = rgba(ac, 0.08);
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // ═══════════════════════════════════════
      // TOP SYSTEM — rating + position + rarity
      // Tightly aligned as one unit
      // ═══════════════════════════════════════

      const topY = 22;

      // Rating
      ctx.save();
      ctx.shadowColor = tier.glow;
      ctx.shadowBlur = 30;
      ctx.fillStyle = rgba(ac, 0.95);
      ctx.font = "900 68px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(String(rating), 28, topY);
      ctx.restore();

      // Position chip — directly under rating, tight
      const posText = position || "—";
      ctx.font = "700 16px system-ui";
      const posW = ctx.measureText(posText).width + 22;
      const posX = 30;
      const posY = topY + 70;
      roundRect(ctx, posX, posY, posW, 26, 5);
      ctx.fillStyle = rgba(ac, 0.12);
      ctx.fill();
      ctx.strokeStyle = rgba(ac, 0.25);
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.fillStyle = rgba(ac, 0.85);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(posText, posX + posW / 2, posY + 13);

      // Rarity block — right side, vertically centered with rating
      // Badge chip
      const badgeText = tier.label;
      ctx.font = "800 20px system-ui";
      ctx.textBaseline = "middle";
      const bW = ctx.measureText(badgeText).width + 26;
      const bX = W - 28 - bW;
      const bY = topY + 2;
      const bH = 30;

      ctx.save();
      ctx.shadowColor = tier.glow;
      ctx.shadowBlur = 15;
      roundRect(ctx, bX, bY, bW, bH, 5);
      // Metallic gradient fill
      const metalGrad = ctx.createLinearGradient(bX, bY, bX + bW, bY + bH);
      metalGrad.addColorStop(0, rgba(ac, 0.3));
      metalGrad.addColorStop(0.5, rgba(ac, 0.15));
      metalGrad.addColorStop(1, rgba(ac, 0.3));
      ctx.fillStyle = metalGrad;
      ctx.fill();
      ctx.restore();
      roundRect(ctx, bX, bY, bW, bH, 6);
      ctx.strokeStyle = rgba(ac, 0.5);
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.fillStyle = rgba(ac, 0.95);
      ctx.font = "800 20px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(badgeText, bX + bW / 2, bY + bH / 2);

      // Stars — directly under badge, aligned right
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.font = "13px system-ui";
      const starsY = bY + bH + 6;
      for (let i = 0; i < 5; i++) {
        const sx = W - 28 - (4 - i) * 17;
        ctx.fillStyle = i < tier.stars ? rgba(ac, 0.9) : rgba(ac, 0.15);
        ctx.textAlign = "center";
        ctx.fillText("★", sx, starsY);
      }

      // Holographic corner shine for EPIC+
      if (tier.stars >= 4) {
        ctx.save();
        const holoGrad = ctx.createLinearGradient(W - 100, 0, W, 75);
        holoGrad.addColorStop(0, "transparent");
        holoGrad.addColorStop(0.4, rgba(ac, 0.08));
        holoGrad.addColorStop(0.6, rgba([255, 255, 255], 0.06));
        holoGrad.addColorStop(1, "transparent");
        ctx.fillStyle = holoGrad;
        ctx.fillRect(W - 120, 0, 120, 100);
        ctx.restore();
      }

      // ═══════════════════════════════════════
      // PLAYER IMAGE — integrated, glowing
      // ═══════════════════════════════════════

      const imgCX = W / 2;
      const imgCY = 295;
      const imgR = 138; // radius

      // Soft glow ring behind head/shoulders
      ctx.save();
      const headGlow = ctx.createRadialGradient(imgCX, imgCY - 15, imgR * 0.5, imgCX, imgCY - 15, imgR * 1.4);
      headGlow.addColorStop(0, rgba(ac, 0.15));
      headGlow.addColorStop(0.6, rgba(ac, 0.04));
      headGlow.addColorStop(1, "transparent");
      ctx.fillStyle = headGlow;
      ctx.fillRect(imgCX - imgR * 1.5, imgCY - imgR * 1.5, imgR * 3, imgR * 3);
      ctx.restore();

      // Rim light ring (subtle outer glow circle)
      ctx.save();
      ctx.shadowColor = tier.glow;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(imgCX, imgCY, imgR + 3, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(ac, 0.25);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Inner thin ring
      ctx.beginPath();
      ctx.arc(imgCX, imgCY, imgR + 1, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(ac, 0.1);
      ctx.lineWidth = 0.5;
      ctx.stroke();

      if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(imgCX, imgCY, imgR, 0, Math.PI * 2);
        ctx.clip();

        // Dark fill behind
        ctx.fillStyle = "#080808";
        ctx.fillRect(imgCX - imgR, imgCY - imgR, imgR * 2, imgR * 2);

        // Draw avatar cover-fit into circle
        const aspect = avatar.width / avatar.height;
        const sz = imgR * 2;
        let dw = sz, dh = sz;
        if (aspect > 1) dh = sz / aspect; else dw = sz * aspect;
        ctx.drawImage(avatar, imgCX - dw / 2, imgCY - dh / 2, dw, dh);

        // Bottom fade
        const btmFade = ctx.createLinearGradient(0, imgCY + imgR * 0.4, 0, imgCY + imgR);
        btmFade.addColorStop(0, "transparent");
        btmFade.addColorStop(1, darkBase);
        ctx.fillStyle = btmFade;
        ctx.fillRect(imgCX - imgR, imgCY + imgR * 0.4, imgR * 2, imgR * 0.6);

        // Edge darkening inside the circle
        const edgeDark = ctx.createRadialGradient(imgCX, imgCY, imgR * 0.5, imgCX, imgCY, imgR);
        edgeDark.addColorStop(0, "transparent");
        edgeDark.addColorStop(0.8, "transparent");
        edgeDark.addColorStop(1, rgba([0, 0, 0], 0.5));
        ctx.fillStyle = edgeDark;
        ctx.fillRect(imgCX - imgR, imgCY - imgR, imgR * 2, imgR * 2);

        ctx.restore();
      } else {
        // Initials with glow
        const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
        ctx.save();
        ctx.beginPath();
        ctx.arc(imgCX, imgCY, imgR, 0, Math.PI * 2);
        ctx.fillStyle = rgba(ac, 0.05);
        ctx.fill();
        ctx.shadowColor = tier.glow;
        ctx.shadowBlur = 30;
        ctx.fillStyle = rgba(ac, 0.5);
        ctx.font = "900 100px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, imgCX, imgCY);
        ctx.restore();
      }

      ctx.textBaseline = "alphabetic";

      // ═══════════════════════════════════════
      // NAME — second biggest focus
      // ═══════════════════════════════════════

      ctx.textAlign = "center";
      ctx.save();
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#fff";
      ctx.font = "900 38px system-ui";
      ctx.fillText(name, W / 2, 482);
      ctx.restore();

      // Nationality — very subtle
      if (nationality) {
        ctx.fillStyle = rgba(ac, 0.4);
        ctx.font = "600 11px system-ui";
        ctx.fillText(nationality.toUpperCase(), W / 2, 504);
      }

      // ═══════════════════════════════════════
      // STATS — glassmorphism panel
      // ═══════════════════════════════════════

      const barX = 28;
      const barY = 522;
      const barW = W - 56;
      const barH = 80;

      // Glass panel
      roundRect(ctx, barX, barY, barW, barH, 14);
      ctx.fillStyle = rgba([0, 0, 0], 0.45);
      ctx.fill();

      // Glass top highlight
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, barX, barY, barW, barH / 2, 14);
      ctx.clip();
      const glassHL = ctx.createLinearGradient(0, barY, 0, barY + barH / 2);
      glassHL.addColorStop(0, rgba(ac, 0.06));
      glassHL.addColorStop(1, "transparent");
      ctx.fillStyle = glassHL;
      ctx.fillRect(barX, barY, barW, barH / 2);
      ctx.restore();

      // Glass border
      roundRect(ctx, barX, barY, barW, barH, 14);
      ctx.strokeStyle = rgba(ac, 0.15);
      ctx.lineWidth = 0.5;
      ctx.stroke();

      const statItems = [
        { label: "MAT", value: stats.matches },
        { label: "WIN", value: stats.wins },
        { label: "GOL", value: stats.goals },
      ];
      const sW = barW / statItems.length;

      statItems.forEach((stat, i) => {
        const x = barX + i * sW + sW / 2;

        // Value
        ctx.fillStyle = "#fff";
        ctx.font = "800 30px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(stat.value), x, barY + 38);

        // Label — BWL red
        ctx.fillStyle = "rgba(220, 38, 38, 0.8)";
        ctx.font = "700 16px system-ui";
        ctx.fillText(stat.label, x, barY + 62);

        // Thin divider
        if (i < statItems.length - 1) {
          const dx = barX + (i + 1) * sW;
          ctx.strokeStyle = rgba(ac, 0.1);
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(dx, barY + 16);
          ctx.lineTo(dx, barY + barH - 16);
          ctx.stroke();
        }
      });

      // ═══════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════

      // Divider
      const fDivY = H - 44;
      const fGrad = ctx.createLinearGradient(70, 0, W - 70, 0);
      fGrad.addColorStop(0, "transparent");
      fGrad.addColorStop(0.5, rgba(ac, 0.2));
      fGrad.addColorStop(1, "transparent");
      ctx.strokeStyle = fGrad;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(70, fDivY);
      ctx.lineTo(W - 70, fDivY);
      ctx.stroke();

      ctx.fillStyle = "rgba(220, 38, 38, 0.6)";
      ctx.font = "600 20px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("BWLLEAGUE.COM", W / 2, fDivY - 8);

      // Card ID + Season
      ctx.fillStyle = rgba(ac, 0.15);
      ctx.font = "600 9px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`#${playerId.slice(-4).toUpperCase()}`, 28, H - 15);
      ctx.textAlign = "right";
      ctx.fillText("SEASON 01", W - 28, H - 15);

      setReady(true);
    }
  }, [name, position, rating, nationality, avatarUrl, playerId, stats]);

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(), "image/png"));
    const file = new File([blob], `BWL-${name.replace(/\s+/g, "-")}-card.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${name} — BWL Player Card` }); return; }
      catch (e) { if (e instanceof Error && e.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="rounded-2xl"
        style={{
          width: 320,
          height: 448,
          filter: `drop-shadow(0 4px 20px ${getTier(rating).glow}30) drop-shadow(0 12px 40px rgba(0,0,0,0.5))`,
        }}
      />
      {ready && (
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${getTier(rating).glow}15, transparent)`,
            border: `1px solid ${getTier(rating).glow}25`,
            color: getTier(rating).glow,
          }}
        >
          <Share2 className="w-3.5 h-3.5" />
          Share Card
        </button>
      )}
    </div>
  );
}
