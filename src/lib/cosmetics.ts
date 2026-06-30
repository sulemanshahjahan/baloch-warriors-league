// BWL cosmetics catalog — bought with coins, equipped on the profile.
// Pure data + style resolvers (no DB). Status only — zero competitive effect.
//
// Each item maps to a semantic CSS class (`bwl-*`, defined in globals.css) that
// renders a premium, layered look (metallic frames, stadium banners, gradient
// nameplates). Item KEYS are stable + backward-compatible — only their visual
// treatment and display names were upgraded.

export type CosmeticType = "PROFILE_FRAME" | "PROFILE_BANNER" | "NAME_COLOR" | "CARD_BG";
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type FrameTier = "bronze" | "silver" | "gold" | "epic" | "legendary";

export interface StoreItem {
  key: string;
  /** Short legacy name (kept for compatibility). */
  name: string;
  /** Premium display name shown in store / profile / inventory. */
  displayName: string;
  type: CosmeticType;
  cost: number;
  rarity: Rarity;
  /** Metallic tier (frames) — drives progressive richness. */
  tier?: FrameTier;
  minLevel?: number;
  minRespect?: number;
  /** Semantic `bwl-*` variant class applied where the cosmetic shows. */
  css: string;
}

export const STORE_ITEMS: StoreItem[] = [
  // ── Profile frames (metallic ring around the avatar) ──
  { key: "frame_bronze", name: "Bronze Frame", displayName: "Bronze Warrior Frame", type: "PROFILE_FRAME", cost: 300, rarity: "COMMON", tier: "bronze", css: "bwl-frame--bronze" },
  { key: "frame_silver", name: "Silver Frame", displayName: "Silver Vanguard Frame", type: "PROFILE_FRAME", cost: 800, rarity: "RARE", minLevel: 5, tier: "silver", css: "bwl-frame--silver" },
  { key: "frame_gold", name: "Gold Frame", displayName: "Gold Champion Frame", type: "PROFILE_FRAME", cost: 2000, rarity: "EPIC", minLevel: 10, tier: "gold", css: "bwl-frame--gold" },
  { key: "frame_trusted", name: "Trusted Frame", displayName: "Trusted Guardian Frame", type: "PROFILE_FRAME", cost: 1200, rarity: "EPIC", minRespect: 90, tier: "epic", css: "bwl-frame--epic" },
  { key: "frame_flame", name: "Elite Flame Frame", displayName: "Elite Flame Frame", type: "PROFILE_FRAME", cost: 4000, rarity: "LEGENDARY", minLevel: 20, tier: "legendary", css: "bwl-frame--legendary" },

  // ── Nameplates (gradient name treatment) ──
  { key: "name_red", name: "Red Name", displayName: "Crimson Strike Nameplate", type: "NAME_COLOR", cost: 600, rarity: "COMMON", css: "bwl-name--crimson" },
  { key: "name_cyan", name: "Cyan Name", displayName: "Ice Blue Nameplate", type: "NAME_COLOR", cost: 600, rarity: "COMMON", css: "bwl-name--ice" },
  { key: "name_gold", name: "Gold Name", displayName: "Gold Champion Nameplate", type: "NAME_COLOR", cost: 1500, rarity: "EPIC", minLevel: 10, css: "bwl-name--gold" },
  { key: "name_rainbow", name: "Legend Name", displayName: "Legendary Flame Nameplate", type: "NAME_COLOR", cost: 3000, rarity: "LEGENDARY", minLevel: 25, css: "bwl-name--legend" },

  // ── Profile banners (hero background) ──
  { key: "banner_pitch", name: "Pitch Banner", displayName: "Floodlight Pitch Banner", type: "PROFILE_BANNER", cost: 500, rarity: "COMMON", css: "bwl-banner--pitch" },
  { key: "banner_fire", name: "Fire Banner", displayName: "Inferno Banner", type: "PROFILE_BANNER", cost: 1500, rarity: "EPIC", minLevel: 8, css: "bwl-banner--fire" },
  { key: "banner_royal", name: "Royal Banner", displayName: "Royal Crown Banner", type: "PROFILE_BANNER", cost: 2500, rarity: "LEGENDARY", minLevel: 18, css: "bwl-banner--royal" },
];

export function getStoreItem(key: string | null | undefined): StoreItem | undefined {
  if (!key) return undefined;
  return STORE_ITEMS.find((i) => i.key === key);
}

export function cssFor(key: string | null | undefined): string {
  return getStoreItem(key)?.css ?? "";
}

export const RARITY_BORDER: Record<string, string> = {
  COMMON: "border-zinc-500/30",
  RARE: "border-sky-500/40",
  EPIC: "border-violet-500/40",
  LEGENDARY: "border-yellow-400/50",
};

/** Rarity → chip text/border accents for the Equipped row + store. */
export const RARITY_CHIP: Record<Rarity, string> = {
  COMMON: "text-zinc-300 border-zinc-400/30 bg-zinc-400/10",
  RARE: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  EPIC: "text-violet-300 border-violet-400/40 bg-violet-400/10",
  LEGENDARY: "text-amber-300 border-amber-400/50 bg-amber-400/10",
};

// ── Resolver: turn stored item keys into render-ready descriptors ────────────

export interface ResolvedCosmetic {
  key: string;
  name: string; // premium display name
  type: CosmeticType;
  rarity: Rarity;
  tier?: FrameTier;
  className: string; // semantic bwl-* variant
}

export interface ResolvedCosmetics {
  frame: ResolvedCosmetic | null;
  nameplate: ResolvedCosmetic | null;
  banner: ResolvedCosmetic | null;
  /** Banner → frame → nameplate order, for the Equipped row. */
  equipped: ResolvedCosmetic[];
  hasAny: boolean;
  /** Cohesive accent colour for the hero (nameplate → frame → banner). */
  accent?: string;
}

/** Accent colour per item key — drives the nameplate slash + chip glow. */
const ACCENT_BY_KEY: Record<string, string> = {
  name_red: "#ef4444", name_cyan: "#38bdf8", name_gold: "#facc15", name_rainbow: "#f0abfc",
  frame_bronze: "#c8893f", frame_silver: "#d4d7dd", frame_gold: "#e3b341", frame_epic: "#34d399",
  frame_trusted: "#34d399", frame_flame: "#f97316",
  banner_pitch: "#34d399", banner_fire: "#f97316", banner_royal: "#a78bfa",
};

function toResolved(key: string | null | undefined): ResolvedCosmetic | null {
  const it = getStoreItem(key);
  if (!it) return null; // unknown/legacy key → safe no-op
  return { key: it.key, name: it.displayName, type: it.type, rarity: it.rarity, tier: it.tier, className: it.css };
}

export interface EquippedCosmeticKeys {
  profileFrame?: string | null;
  profileBanner?: string | null;
  nameColor?: string | null;
}

export function resolveCosmetics(eq: EquippedCosmeticKeys | null | undefined): ResolvedCosmetics {
  const frame = toResolved(eq?.profileFrame);
  const nameplate = toResolved(eq?.nameColor);
  const banner = toResolved(eq?.profileBanner);
  const equipped = [banner, frame, nameplate].filter(Boolean) as ResolvedCosmetic[];
  const accent =
    ACCENT_BY_KEY[nameplate?.key ?? ""] ??
    ACCENT_BY_KEY[frame?.key ?? ""] ??
    ACCENT_BY_KEY[banner?.key ?? ""];
  return { frame, nameplate, banner, equipped, hasAny: equipped.length > 0, accent };
}

// ── Profile skins (sets) — scaffold for future bundled rewards ───────────────
// A skin applies several cosmetics + an accent colour together. Structured now
// so a buy/equip flow can be wired later without reworking the render layer.

export interface ProfileSkin {
  key: string;
  name: string;
  rarity: Rarity;
  frame?: string;
  nameplate?: string;
  banner?: string;
  /** CSS accent colour exposed as --bwl-accent on the hero. */
  accent: string;
}

export const PROFILE_SKINS: ProfileSkin[] = [
  { key: "skin_pitch_warrior", name: "Pitch Warrior", rarity: "EPIC", frame: "frame_bronze", nameplate: "name_red", banner: "banner_pitch", accent: "#34d399" },
  { key: "skin_inferno", name: "Inferno", rarity: "EPIC", frame: "frame_flame", nameplate: "name_red", banner: "banner_fire", accent: "#f97316" },
  { key: "skin_royal", name: "Royal Legend", rarity: "LEGENDARY", frame: "frame_gold", nameplate: "name_gold", banner: "banner_royal", accent: "#a78bfa" },
];

export function getProfileSkin(key: string | null | undefined): ProfileSkin | undefined {
  if (!key) return undefined;
  return PROFILE_SKINS.find((s) => s.key === key);
}
