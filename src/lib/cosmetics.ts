// BWL cosmetics catalog — bought with coins, equipped on the profile.
// Pure data + style resolvers (no DB). Status only — zero competitive effect.

export type CosmeticType = "PROFILE_FRAME" | "PROFILE_BANNER" | "NAME_COLOR" | "CARD_BG";

export interface StoreItem {
  key: string;
  name: string;
  type: CosmeticType;
  cost: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  minLevel?: number;
  minRespect?: number;
  /** Tailwind classes applied where the cosmetic shows. */
  css: string;
}

export const STORE_ITEMS: StoreItem[] = [
  // ── Profile frames (ring around the avatar) ──
  { key: "frame_bronze", name: "Bronze Frame", type: "PROFILE_FRAME", cost: 300, rarity: "COMMON", css: "ring-4 ring-amber-700" },
  { key: "frame_silver", name: "Silver Frame", type: "PROFILE_FRAME", cost: 800, rarity: "RARE", minLevel: 5, css: "ring-4 ring-zinc-300" },
  { key: "frame_gold", name: "Gold Frame", type: "PROFILE_FRAME", cost: 2000, rarity: "EPIC", minLevel: 10, css: "ring-4 ring-yellow-400 shadow-[0_0_22px_rgba(250,204,21,0.45)]" },
  { key: "frame_flame", name: "Elite Flame Frame", type: "PROFILE_FRAME", cost: 4000, rarity: "LEGENDARY", minLevel: 20, css: "ring-4 ring-orange-500 shadow-[0_0_26px_rgba(249,115,22,0.55)]" },
  { key: "frame_trusted", name: "Trusted Frame", type: "PROFILE_FRAME", cost: 1200, rarity: "EPIC", minRespect: 90, css: "ring-4 ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]" },

  // ── Name colors ──
  { key: "name_red", name: "Red Name", type: "NAME_COLOR", cost: 600, rarity: "COMMON", css: "text-red-400" },
  { key: "name_cyan", name: "Cyan Name", type: "NAME_COLOR", cost: 600, rarity: "COMMON", css: "text-cyan-300" },
  { key: "name_gold", name: "Gold Name", type: "NAME_COLOR", cost: 1500, rarity: "EPIC", minLevel: 10, css: "text-yellow-300" },
  { key: "name_rainbow", name: "Legend Name", type: "NAME_COLOR", cost: 3000, rarity: "LEGENDARY", minLevel: 25, css: "bg-gradient-to-r from-fuchsia-400 via-amber-300 to-cyan-300 bg-clip-text text-transparent" },

  // ── Profile banners (hero background strip) ──
  { key: "banner_pitch", name: "Pitch Banner", type: "PROFILE_BANNER", cost: 500, rarity: "COMMON", css: "bg-gradient-to-r from-emerald-900/60 to-emerald-700/40" },
  { key: "banner_fire", name: "Fire Banner", type: "PROFILE_BANNER", cost: 1500, rarity: "EPIC", minLevel: 8, css: "bg-gradient-to-r from-orange-900/60 to-red-700/40" },
  { key: "banner_royal", name: "Royal Banner", type: "PROFILE_BANNER", cost: 2500, rarity: "LEGENDARY", minLevel: 18, css: "bg-gradient-to-r from-indigo-900/60 to-violet-700/40" },
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
