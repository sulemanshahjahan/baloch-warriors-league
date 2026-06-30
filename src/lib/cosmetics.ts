// BWL cosmetics catalog — bought with coins, equipped on the profile.
// Pure data + style resolvers (no DB). Status only — zero competitive effect.
//
// Each item maps to a semantic CSS class (`bwl-*`, in globals.css) plus a
// loadout thumbnail (CSS class or reusable image asset). Item KEYS are stable +
// backward-compatible — only visual treatment / names were upgraded.

export type CosmeticType = "PROFILE_FRAME" | "PROFILE_BANNER" | "NAME_COLOR" | "CARD_BG";
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type FrameTier = "bronze" | "silver" | "gold" | "epic" | "legendary";
export type EquipSlot = "FRAME" | "BANNER" | "NAMEPLATE";

export interface StoreItem {
  key: string;
  /** Short legacy name (kept for compatibility). */
  name: string;
  /** Full premium name — store, inventory, purchase messages. */
  displayName: string;
  /** Compact name for the equipped loadout cards. */
  shortName: string;
  /** Loadout subtitle, e.g. "Stadium Background". */
  description: string;
  type: CosmeticType;
  slot: EquipSlot;
  cost: number;
  rarity: Rarity;
  /** Metallic tier (frames) — drives progressive richness. */
  tier?: FrameTier;
  minLevel?: number;
  /** Semantic `bwl-*` variant class applied where the cosmetic shows. */
  css: string;
  /** CSS class for the loadout thumbnail (when no image asset). */
  thumbnailClass?: string;
  /** Optional image used as the loadout thumbnail (drop-in upgrade path). */
  thumbnailAsset?: string;
}

export const STORE_ITEMS: StoreItem[] = [
  // ── Profile frames (metallic ring around the avatar) ──
  { key: "frame_bronze", name: "Bronze Frame", displayName: "Bronze Warrior Frame", shortName: "Bronze Warrior", description: "Avatar Frame", type: "PROFILE_FRAME", slot: "FRAME", cost: 300, rarity: "COMMON", tier: "bronze", css: "bwl-frame--bronze", thumbnailAsset: "/profile-assets/loadout-bronze-warrior.webp" },
  { key: "frame_silver", name: "Silver Frame", displayName: "Silver Vanguard Frame", shortName: "Silver Vanguard", description: "Avatar Frame", type: "PROFILE_FRAME", slot: "FRAME", cost: 800, rarity: "RARE", minLevel: 5, tier: "silver", css: "bwl-frame--silver", thumbnailAsset: "/silver-card-bg.jpg" },
  { key: "frame_gold", name: "Gold Frame", displayName: "Gold Champion Frame", shortName: "Gold Champion", description: "Avatar Frame", type: "PROFILE_FRAME", slot: "FRAME", cost: 2000, rarity: "EPIC", minLevel: 10, tier: "gold", css: "bwl-frame--gold", thumbnailAsset: "/gold-card-legendary.jpg" },
  { key: "frame_trusted", name: "Trusted Frame", displayName: "Trusted Guardian Frame", shortName: "Trusted Guardian", description: "Avatar Frame", type: "PROFILE_FRAME", slot: "FRAME", cost: 1200, rarity: "EPIC", minLevel: 12, tier: "epic", css: "bwl-frame--epic", thumbnailAsset: "/epiccard-bg.jpg" },
  { key: "frame_flame", name: "Elite Flame Frame", displayName: "Elite Flame Frame", shortName: "Elite Flame", description: "Avatar Frame", type: "PROFILE_FRAME", slot: "FRAME", cost: 4000, rarity: "LEGENDARY", minLevel: 20, tier: "legendary", css: "bwl-frame--legendary", thumbnailAsset: "/legendary-card-bg.jpg" },

  // ── Nameplates (gradient name treatment) ──
  { key: "name_red", name: "Red Name", displayName: "Crimson Strike Nameplate", shortName: "Crimson Strike", description: "Nameplate", type: "NAME_COLOR", slot: "NAMEPLATE", cost: 600, rarity: "COMMON", css: "bwl-name--crimson", thumbnailClass: "bwl-thumb-name bwl-thumb-name--crimson", thumbnailAsset: "/profile-assets/loadout-crimson-strike.webp" },
  { key: "name_cyan", name: "Cyan Name", displayName: "Ice Blue Nameplate", shortName: "Ice Blue", description: "Nameplate", type: "NAME_COLOR", slot: "NAMEPLATE", cost: 600, rarity: "COMMON", css: "bwl-name--ice", thumbnailClass: "bwl-thumb-name bwl-thumb-name--ice" },
  { key: "name_gold", name: "Gold Name", displayName: "Gold Champion Nameplate", shortName: "Gold Champion", description: "Nameplate", type: "NAME_COLOR", slot: "NAMEPLATE", cost: 1500, rarity: "EPIC", minLevel: 10, css: "bwl-name--gold", thumbnailClass: "bwl-thumb-name bwl-thumb-name--gold" },
  { key: "name_rainbow", name: "Legend Name", displayName: "Legendary Flame Nameplate", shortName: "Legendary Flame", description: "Nameplate", type: "NAME_COLOR", slot: "NAMEPLATE", cost: 3000, rarity: "LEGENDARY", minLevel: 25, css: "bwl-name--legend", thumbnailClass: "bwl-thumb-name bwl-thumb-name--legend" },

  // ── Profile banners (hero background) ──
  { key: "banner_pitch", name: "Pitch Banner", displayName: "Floodlight Pitch Banner", shortName: "Floodlight Pitch", description: "Stadium Background", type: "PROFILE_BANNER", slot: "BANNER", cost: 500, rarity: "RARE", css: "bwl-banner--pitch", thumbnailClass: "bwl-thumb-pitch", thumbnailAsset: "/profile-assets/loadout-floodlight-pitch.webp" },
  { key: "banner_fire", name: "Fire Banner", displayName: "Inferno Banner", shortName: "Inferno", description: "Stadium Background", type: "PROFILE_BANNER", slot: "BANNER", cost: 1500, rarity: "EPIC", minLevel: 8, css: "bwl-banner--fire", thumbnailClass: "bwl-thumb-fire" },
  { key: "banner_royal", name: "Royal Banner", displayName: "Royal Crown Banner", shortName: "Royal Crown", description: "Stadium Background", type: "PROFILE_BANNER", slot: "BANNER", cost: 2500, rarity: "LEGENDARY", minLevel: 18, css: "bwl-banner--royal", thumbnailClass: "bwl-thumb-royal" },
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
  shortName: string;
  description: string;
  type: CosmeticType;
  slot: EquipSlot;
  rarity: Rarity;
  tier?: FrameTier;
  className: string; // semantic bwl-* variant
  thumbnailClass?: string;
  thumbnailAsset?: string;
}

export interface ResolvedCosmetics {
  frame: ResolvedCosmetic | null;
  nameplate: ResolvedCosmetic | null;
  banner: ResolvedCosmetic | null;
  /** Banner → frame → nameplate order, for the loadout. */
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
  return {
    key: it.key, name: it.displayName, shortName: it.shortName, description: it.description,
    type: it.type, slot: it.slot, rarity: it.rarity, tier: it.tier, className: it.css,
    thumbnailClass: it.thumbnailClass, thumbnailAsset: it.thumbnailAsset,
  };
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

// ── Player class strip (status label from card rank) ─────────────────────────
// Distinct from earned achievement titles (those stay in the engagement section).

export interface PlayerClass {
  label: string;
  className: string; // bwl-title-strip--* tier
}

export function playerClassFor(cardRank: number): PlayerClass {
  if (cardRank >= 95) return { label: "Legendary Player", className: "bwl-title-strip--legendary" };
  if (cardRank >= 90) return { label: "Elite Player", className: "bwl-title-strip--elite" };
  if (cardRank >= 80) return { label: "Star Player", className: "bwl-title-strip--star" };
  return { label: "BWL Player", className: "bwl-title-strip--base" };
}

// ── Profile skins (sets) — scaffold for future bundled rewards ───────────────

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
