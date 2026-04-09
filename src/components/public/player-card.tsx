"use client";

import { useRef, useEffect, useState } from "react";
import { Share2 } from "lucide-react";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface PlayerCardProps {
  name: string;
  position: string;
  rating: number;
  nationality: string;
  avatarUrl: string;
  playerId: string;
  stats: { goals: number; wins: number; matches: number; motm: number };
}

// ═══════════════════════════════════════════════════════
// THEME CONFIG — one object per tier, easily extensible
// ═══════════════════════════════════════════════════════

interface CardTheme {
  label: string;
  stars: number;
  bg: string | null; // custom background image path or null for generated
  colors: {
    base: string;
    dark: string;
    accent: string;
    gold: string;
    text: string;
    textSub: string;
    glow: string;
    statLabel: string;
  };
}

const THEMES: Record<string, CardTheme> = {
  LEGENDARY: {
    label: "LEGENDARY",
    stars: 5,
    bg: "/legendary-card-bg.png",
    colors: {
      base: "#08111f",
      dark: "#050b15",
      accent: "#1f6fe5",
      gold: "#d4a63a",
      text: "#f5f7fa",
      textSub: "#8da4c8",
      glow: "#1f6fe5",
      statLabel: "#d4a63a",
    },
  },
  EPIC: {
    label: "EPIC",
    stars: 4,
    bg: "/epiccard-bg.jpg",
    colors: {
      base: "#0a1640",
      dark: "#060e2a",
      accent: "#6090f0",
      gold: "#7aa2f7",
      text: "#f0f4ff",
      textSub: "#7a8fbb",
      glow: "#3b6ef6",
      statLabel: "#dc2626",
    },
  },
  GOLD: {
    label: "GOLD",
    stars: 3,
    bg: "/gold-card-legendary.jpg",
    colors: {
      base: "#1a1408",
      dark: "#0f0c04",
      accent: "#c9952a",
      gold: "#e8b830",
      text: "#fff8e7",
      textSub: "#c8a060",
      glow: "#c99530",
      statLabel: "#e8b830",
    },
  },
  SILVER: {
    label: "SILVER",
    stars: 2,
    bg: "/silver-card-bg.jpg",
    colors: {
      base: "#18181b",
      dark: "#0e0e10",
      accent: "#a0a0b0",
      gold: "#c0c0cc",
      text: "#e8e8ee",
      textSub: "#808090",
      glow: "#888898",
      statLabel: "#c0c0cc",
    },
  },
  BRONZE: {
    label: "BRONZE",
    stars: 1,
    bg: "/bronze-card-bg.jpg",
    colors: {
      base: "#1a1008",
      dark: "#0f0a04",
      accent: "#b07030",
      gold: "#c88040",
      text: "#f0e0d0",
      textSub: "#a08060",
      glow: "#905020",
      statLabel: "#c88040",
    },
  },
};

function getTheme(rating: number): CardTheme {
  if (rating >= 90) return THEMES.LEGENDARY;
  if (rating >= 80) return THEMES.EPIC;
  if (rating >= 70) return THEMES.GOLD;
  if (rating >= 60) return THEMES.SILVER;
  return THEMES.BRONZE;
}

// ═══════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════

const W = 760;
const H = 1120;
const PAD = 30;
const CORNER_R = 24;

// Zone Y positions
const HEADER_Y = 36;
const PORTRAIT_CY = 420; // center Y of portrait
const PORTRAIT_R = 190;  // circle radius
const NAME_Y = 710;
const SUBTITLE_Y = 755;
const STATS_Y = 805;
const STATS_H = 120;
const FOOTER_Y = 975;

// ═══════════════════════════════════════════════════════
// DRAWING HELPERS
// ═══════════════════════════════════════════════════════

function cardPath(ctx: CanvasRenderingContext2D) {
  const r = CORNER_R;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r);
  ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H);
  ctx.lineTo(r, H);
  ctx.quadraticCurveTo(0, H, 0, H - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

// ═══════════════════════════════════════════════════════
// DRAWING MODULES
// ═══════════════════════════════════════════════════════

function drawBackground(ctx: CanvasRenderingContext2D, theme: CardTheme, bgImg: HTMLImageElement | null) {
  const c = theme.colors;

  if (bgImg) {
    // Custom background — cover-fit into card
    const aspect = bgImg.width / bgImg.height;
    const cardAspect = W / H;
    let dw = W, dh = H;
    if (aspect > cardAspect) dh = W / aspect; else dw = H * aspect;
    ctx.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);

    // Darken bottom half for text zones
    const botFade = ctx.createLinearGradient(0, H * 0.5, 0, H);
    botFade.addColorStop(0, "transparent");
    botFade.addColorStop(0.3, c.base + "a0");
    botFade.addColorStop(1, c.dark + "f0");
    ctx.fillStyle = botFade;
    ctx.fillRect(0, 0, W, H);

    // Slight overall darken for readability
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, 0, W, H);
  } else {
    // Generated background for non-custom tiers
    ctx.fillStyle = c.base;
    ctx.fillRect(0, 0, W, H);

    // Center radial glow
    const glow = ctx.createRadialGradient(W / 2, H * 0.35, 20, W / 2, H * 0.35, W * 0.7);
    glow.addColorStop(0, c.accent + "25");
    glow.addColorStop(0.5, c.accent + "08");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Diagonal beams
    ctx.save();
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(W * (0.15 + i * 0.25), -H * 0.1);
      ctx.rotate(Math.PI / 4.2);
      const beam = ctx.createLinearGradient(0, 0, 0, W * 0.06);
      beam.addColorStop(0, "transparent");
      beam.addColorStop(0.5, c.accent);
      beam.addColorStop(1, "transparent");
      ctx.fillStyle = beam;
      ctx.fillRect(-W, 0, W * 3, W * 0.05);
      ctx.restore();
    }
    ctx.restore();

    // Noise
    ctx.save();
    ctx.globalAlpha = 0.02;
    for (let i = 0; i < 10000; i++) {
      const v = Math.random() * 180;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    ctx.restore();
  }
}

function drawCardBorder(ctx: CanvasRenderingContext2D, theme: CardTheme) {
  const c = theme.colors;

  // Outer glow border
  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 30;
  cardPath(ctx);
  ctx.strokeStyle = c.gold + "50";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Inner fine stroke
  ctx.save();
  ctx.translate(5, 5);
  ctx.scale((W - 10) / W, (H - 10) / H);
  cardPath(ctx);
  ctx.strokeStyle = c.gold + "15";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawHeader(ctx: CanvasRenderingContext2D, theme: CardTheme, rating: number, position: string) {
  const c = theme.colors;

  // ── Backing gradient behind rating + position ──
  const hdrGrad = ctx.createRadialGradient(PAD + 60, HEADER_Y + 80, 10, PAD + 60, HEADER_Y + 80, 160);
  hdrGrad.addColorStop(0, c.dark + "d0");
  hdrGrad.addColorStop(0.6, c.dark + "80");
  hdrGrad.addColorStop(1, "transparent");
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(0, HEADER_Y - 10, 240, 180);

  // ── Rating ──
  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 35;
  ctx.fillStyle = c.gold;
  ctx.font = "900 108px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(String(rating), PAD + 6, HEADER_Y);
  ctx.restore();

  // ── Position chip ──
  const posText = position || "—";
  ctx.font = "700 24px system-ui";
  const posMetrics = ctx.measureText(posText);
  const chipW = posMetrics.width + 28;
  const chipX = PAD + 8;
  const chipY = HEADER_Y + 115;
  rrect(ctx, chipX, chipY, chipW, 36, 8);
  ctx.fillStyle = c.gold + "20";
  ctx.fill();
  ctx.strokeStyle = c.gold + "40";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = c.gold;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(posText, chipX + chipW / 2, chipY + 18);

  // ── Rarity badge — corner plate system ──
  drawRarityBadge(ctx, theme);
}

function drawRarityBadge(ctx: CanvasRenderingContext2D, theme: CardTheme) {
  const c = theme.colors;
  const badgeText = theme.label;

  // Measure text to size the plate
  ctx.font = "900 20px system-ui";
  const textW = ctx.measureText(badgeText).width;

  // Plate dimensions — wider to contain text + stars
  const plateW = textW + 52;
  const plateH = 72;
  const plateX = W - PAD - plateW + 8; // slightly past edge for embedded feel
  const plateY = HEADER_Y - 2;

  // Corner connector lines — attach plate to card edge
  ctx.save();
  ctx.strokeStyle = c.gold + "30";
  ctx.lineWidth = 1;
  // Top line from plate to card top-right corner
  ctx.beginPath();
  ctx.moveTo(W - PAD, plateY);
  ctx.lineTo(W - 8, 8);
  ctx.stroke();
  // Right line from plate to card right edge
  ctx.beginPath();
  ctx.moveTo(W - PAD + 6, plateY + plateH * 0.4);
  ctx.lineTo(W - 8, plateY + plateH * 0.6);
  ctx.stroke();
  ctx.restore();

  // Plate backing — angled trapezoid shape
  ctx.save();
  ctx.shadowColor = c.gold;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  const inset = 10; // top is narrower than bottom for trapezoid feel
  ctx.moveTo(plateX + inset, plateY);
  ctx.lineTo(plateX + plateW, plateY);
  ctx.lineTo(plateX + plateW + 4, plateY + plateH);
  ctx.lineTo(plateX - 4, plateY + plateH);
  ctx.closePath();

  // Metallic gradient fill
  const metalGrad = ctx.createLinearGradient(plateX, plateY, plateX + plateW, plateY + plateH);
  metalGrad.addColorStop(0, c.gold + "35");
  metalGrad.addColorStop(0.3, c.dark + "e0");
  metalGrad.addColorStop(0.5, c.gold + "18");
  metalGrad.addColorStop(0.7, c.dark + "e0");
  metalGrad.addColorStop(1, c.gold + "35");
  ctx.fillStyle = metalGrad;
  ctx.fill();
  ctx.restore();

  // Plate border
  ctx.beginPath();
  ctx.moveTo(plateX + inset, plateY);
  ctx.lineTo(plateX + plateW, plateY);
  ctx.lineTo(plateX + plateW + 4, plateY + plateH);
  ctx.lineTo(plateX - 4, plateY + plateH);
  ctx.closePath();
  ctx.strokeStyle = c.gold + "50";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inner highlight line (top edge)
  ctx.beginPath();
  ctx.moveTo(plateX + inset + 6, plateY + 2);
  ctx.lineTo(plateX + plateW - 6, plateY + 2);
  ctx.strokeStyle = c.gold + "40";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Badge text
  ctx.fillStyle = c.gold;
  ctx.font = "900 20px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, plateX + plateW / 2 + 3, plateY + 24);

  // Stars — inside the plate, below text
  ctx.font = "15px system-ui";
  const starsW = theme.stars * 20 + (5 - theme.stars) * 20;
  const starsStartX = plateX + (plateW - starsW) / 2 + 12;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < theme.stars ? c.gold : c.gold + "20";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", starsStartX + i * 20, plateY + 52);
  }
}

function drawPortrait(ctx: CanvasRenderingContext2D, theme: CardTheme, avatar: HTMLImageElement | null, name: string) {
  const c = theme.colors;
  const cx = W / 2;
  const cy = PORTRAIT_CY;
  const r = PORTRAIT_R;

  // ── Layer 1: Wide ambient glow ──
  ctx.save();
  const ambientGlow = ctx.createRadialGradient(cx, cy - 10, r * 0.4, cx, cy - 10, r * 1.6);
  ambientGlow.addColorStop(0, c.accent + "1a");
  ambientGlow.addColorStop(0.4, c.gold + "08");
  ambientGlow.addColorStop(1, "transparent");
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  ctx.restore();

  // ── Layer 2: Outer metallic ring ──
  ctx.save();
  ctx.shadowColor = c.gold;
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  const outerRingGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  outerRingGrad.addColorStop(0, c.gold + "90");
  outerRingGrad.addColorStop(0.25, c.gold + "25");
  outerRingGrad.addColorStop(0.5, c.gold + "70");
  outerRingGrad.addColorStop(0.75, c.gold + "25");
  outerRingGrad.addColorStop(1, c.gold + "90");
  ctx.strokeStyle = outerRingGrad;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  // ── Layer 3: Accent arc fragments ──
  const fragmentR = r + 24;
  const fragments = [
    { start: -0.15, end: 0.15 },
    { start: 0.85, end: 1.15 },
    { start: 0.35, end: 0.65 },
    { start: -0.65, end: -0.35 },
  ];
  ctx.save();
  ctx.strokeStyle = c.gold + "45";
  ctx.lineWidth = 2;
  for (const f of fragments) {
    ctx.beginPath();
    ctx.arc(cx, cy, fragmentR, Math.PI * f.start, Math.PI * f.end);
    ctx.stroke();
  }
  ctx.strokeStyle = c.accent + "20";
  ctx.lineWidth = 1;
  const innerFragR = r + 18;
  for (const f of [{ start: 0.1, end: 0.35 }, { start: 0.65, end: 0.85 }, { start: -0.35, end: -0.15 }, { start: 1.15, end: 1.35 }]) {
    ctx.beginPath();
    ctx.arc(cx, cy, innerFragR, Math.PI * f.start, Math.PI * f.end);
    ctx.stroke();
  }
  ctx.restore();

  // ── Layer 4: Inner highlight ring ──
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = c.gold + "35";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Layer 5: Portrait image ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = c.dark;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  if (avatar) {
    // Fit to width, top-center aligned so face is always visible
    const aspect = avatar.width / avatar.height;
    const dw = r * 2;
    const dh = dw / aspect;
    // Align to top of circle (cy - r), not center
    ctx.drawImage(avatar, cx - dw / 2, cy - r, dw, dh);

    // Bottom fade
    const btmFade = ctx.createLinearGradient(0, cy + r * 0.3, 0, cy + r);
    btmFade.addColorStop(0, "transparent");
    btmFade.addColorStop(0.5, c.dark + "40");
    btmFade.addColorStop(1, c.dark);
    ctx.fillStyle = btmFade;
    ctx.fillRect(cx - r, cy + r * 0.3, r * 2, r * 0.7);

    // Soft edge feathering
    const feather = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    feather.addColorStop(0, "transparent");
    feather.addColorStop(0.65, "transparent");
    feather.addColorStop(0.85, "rgba(0,0,0,0.25)");
    feather.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = feather;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Top highlight
    const topHL = ctx.createLinearGradient(0, cy - r, 0, cy - r + 40);
    topHL.addColorStop(0, "rgba(255,255,255,0.08)");
    topHL.addColorStop(1, "transparent");
    ctx.fillStyle = topHL;
    ctx.fillRect(cx - r, cy - r, r * 2, 40);
  } else {
    const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
    ctx.fillStyle = c.accent + "08";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.save();
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 30;
    ctx.fillStyle = c.gold + "60";
    ctx.font = "900 120px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, cx, cy);
    ctx.restore();
  }
  ctx.restore();

  // ── Layer 6: Inner rim light ──
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  const rimGrad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  rimGrad.addColorStop(0, c.gold + "30");
  rimGrad.addColorStop(0.3, "transparent");
  rimGrad.addColorStop(0.7, "transparent");
  rimGrad.addColorStop(1, c.gold + "20");
  ctx.strokeStyle = rimGrad;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawIdentity(ctx: CanvasRenderingContext2D, theme: CardTheme, name: string, nationality: string) {
  const c = theme.colors;

  // Dark backing strip for readability
  const stripGrad = ctx.createLinearGradient(0, NAME_Y - 40, 0, SUBTITLE_Y + 20);
  stripGrad.addColorStop(0, "transparent");
  stripGrad.addColorStop(0.3, c.dark + "c0");
  stripGrad.addColorStop(0.7, c.dark + "c0");
  stripGrad.addColorStop(1, "transparent");
  ctx.fillStyle = stripGrad;
  ctx.fillRect(0, NAME_Y - 40, W, (SUBTITLE_Y + 20) - (NAME_Y - 40));

  // Name
  ctx.save();
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 15;
  ctx.fillStyle = c.text;
  ctx.font = "900 54px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(name, W / 2, NAME_Y);
  ctx.restore();

  // Decorative line under name
  const lineGrad = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
  lineGrad.addColorStop(0, "transparent");
  lineGrad.addColorStop(0.3, c.gold + "40");
  lineGrad.addColorStop(0.5, c.gold + "70");
  lineGrad.addColorStop(0.7, c.gold + "40");
  lineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.25, NAME_Y + 12);
  ctx.lineTo(W * 0.75, NAME_Y + 12);
  ctx.stroke();

  // Nationality / subtitle
  if (nationality) {
    ctx.fillStyle = c.textSub;
    ctx.font = "600 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(nationality.toUpperCase(), W / 2, SUBTITLE_Y);
  }
}

function drawStats(ctx: CanvasRenderingContext2D, theme: CardTheme, stats: PlayerCardProps["stats"]) {
  const c = theme.colors;
  const panelX = PAD + 10;
  const panelW = W - (PAD + 10) * 2;

  // Panel background — dark glass
  rrect(ctx, panelX, STATS_Y, panelW, STATS_H, 16);
  ctx.fillStyle = c.dark + "d0";
  ctx.fill();

  // Top highlight
  ctx.save();
  rrect(ctx, panelX, STATS_Y, panelW, STATS_H / 2, 16);
  ctx.clip();
  const hl = ctx.createLinearGradient(0, STATS_Y, 0, STATS_Y + STATS_H / 2);
  hl.addColorStop(0, c.gold + "0a");
  hl.addColorStop(1, "transparent");
  ctx.fillStyle = hl;
  ctx.fillRect(panelX, STATS_Y, panelW, STATS_H / 2);
  ctx.restore();

  // Panel border
  rrect(ctx, panelX, STATS_Y, panelW, STATS_H, 16);
  ctx.strokeStyle = c.gold + "25";
  ctx.lineWidth = 1;
  ctx.stroke();

  const items = [
    { label: "MATCHES", value: stats.matches },
    { label: "WINS", value: stats.wins },
    { label: "GOALS", value: stats.goals },
  ];
  const colW = panelW / items.length;

  items.forEach((stat, i) => {
    const x = panelX + i * colW + colW / 2;

    // Value
    ctx.fillStyle = c.text;
    ctx.font = "900 42px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(stat.value), x, STATS_Y + 58);

    // Label
    ctx.fillStyle = c.statLabel;
    ctx.font = "700 14px system-ui";
    ctx.fillText(stat.label, x, STATS_Y + 85);

    // Divider
    if (i < items.length - 1) {
      const dx = panelX + (i + 1) * colW;
      ctx.strokeStyle = c.gold + "18";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, STATS_Y + 20);
      ctx.lineTo(dx, STATS_Y + STATS_H - 20);
      ctx.stroke();
    }
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, theme: CardTheme, playerId: string) {
  const c = theme.colors;

  // Divider
  const divGrad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
  divGrad.addColorStop(0, "transparent");
  divGrad.addColorStop(0.5, c.gold + "30");
  divGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, FOOTER_Y);
  ctx.lineTo(W * 0.8, FOOTER_Y);
  ctx.stroke();

  // Branding
  ctx.fillStyle = c.statLabel + "90";
  ctx.font = "700 18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("BWLLEAGUE.COM", W / 2, FOOTER_Y + 30);

  // Card ID + Season
  ctx.fillStyle = c.textSub + "40";
  ctx.font = "600 14px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`#${playerId.slice(-4).toUpperCase()}`, PAD + 10, H - 24);
  ctx.textAlign = "right";
  ctx.fillText("SEASON 01", W - PAD - 10, H - 24);
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function PlayerCard({ name, position, rating, nationality, avatarUrl, playerId, stats }: PlayerCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const theme = getTheme(rating);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;

    const bgSrc = theme.bg;

    Promise.all([
      loadImg(avatarUrl),
      bgSrc ? loadImg(bgSrc) : Promise.resolve(null),
    ]).then(([avatar, bgImg]) => {
      // Draw in order: base → background → border → portrait → identity → stats → footer
      drawBackground(ctx, theme, bgImg);
      drawCardBorder(ctx, theme);
      drawHeader(ctx, theme, rating, position);
      drawPortrait(ctx, theme, avatar, name);
      drawIdentity(ctx, theme, name, nationality);
      drawStats(ctx, theme, stats);
      drawFooter(ctx, theme, playerId);
      setReady(true);
    });
  }, [name, position, rating, nationality, avatarUrl, playerId, stats, theme]);

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/png"));
    const fileName = `BWL-${name.replace(/\s+/g, "-")}-card.png`;
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
        await Share.share({ title: `${name} — BWL Player Card`, url: written.uri, dialogTitle: "Share Player Card" });
        return;
      } catch { /* fall through */ }
    }

    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${name} — BWL Player Card` }); return; }
      catch (e) { if (e instanceof Error && e.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="rounded-2xl"
        style={{
          width: 320,
          height: 472,
          filter: `drop-shadow(0 4px 24px ${theme.colors.glow}30) drop-shadow(0 12px 40px rgba(0,0,0,0.5))`,
        }}
      />
      {ready && (
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all hover:scale-105 min-h-[44px]"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.gold}20, transparent)`,
            border: `1px solid ${theme.colors.gold}30`,
            color: theme.colors.gold,
          }}
        >
          <Share2 className="w-4 h-4" />
          Share Card
        </button>
      )}
    </div>
  );
}
