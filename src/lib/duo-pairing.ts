// Pure, framework-free helpers for 2v2 eFootball duo pairing.
// Kept dependency-free so they can be unit-tested in isolation and reused
// by any future 2v2 tournament logic.
//
// `rating` is the player strength used to balance duos. In BWL this is the
// player's live `cardRank` (the FIFA-style card number, 50–99, shown on the
// player card) — NOT the static `skillLevel` seed field.

export interface PairablePlayer {
  id: string;
  name: string;
  rating?: number | null;
}

export interface PairedDuo<T extends PairablePlayer = PairablePlayer> {
  player1: T; // stronger of the pair (used first in the default name)
  player2: T; // weaker of the pair
}

export interface PairingResult<T extends PairablePlayer = PairablePlayer> {
  duos: PairedDuo<T>[];
  /** The single player left over when an odd number of players is supplied. */
  unpaired: T | null;
}

/** Default rating used when a player has no rating (matches Player.cardRank's default). */
export const DEFAULT_RATING = 70;

/**
 * Build a readable default duo name from two player names.
 * e.g. defaultDuoName("Haroon", "Suleman") => "Haroon & Suleman"
 */
export function defaultDuoName(name1: string, name2: string): string {
  return `${name1.trim()} & ${name2.trim()}`;
}

/**
 * Balanced rating-based auto-pairing.
 *
 * Sorts players by rating (highest → lowest) then pairs the strongest with the
 * weakest, the second strongest with the second weakest, and so on. This keeps
 * the combined rating of each duo as even as possible.
 *
 * If an odd number of players is supplied, the middle (median-rated) player is
 * returned in `unpaired` rather than being silently dropped — callers must
 * surface this to the admin.
 */
export function pairBySkill<T extends PairablePlayer>(players: T[]): PairingResult<T> {
  const sorted = [...players].sort(
    (a, b) => (b.rating ?? DEFAULT_RATING) - (a.rating ?? DEFAULT_RATING)
  );

  const duos: PairedDuo<T>[] = [];
  let lo = 0;
  let hi = sorted.length - 1;

  while (lo < hi) {
    duos.push({ player1: sorted[lo], player2: sorted[hi] });
    lo++;
    hi--;
  }

  // lo === hi means one player sits exactly in the middle → unpaired.
  const unpaired = lo === hi ? sorted[lo] : null;

  return { duos, unpaired };
}

/** Fisher–Yates shuffle (non-mutating). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Balanced **random** pairing.
 *
 * Splits players at the median into a strong half and a weak half, then matches
 * each strong player with a RANDOM partner from the weak half. Every duo is
 * still one stronger + one weaker player (so duos stay roughly balanced), but
 * the exact partner varies between runs — a 99 won't always get the single
 * lowest player, it gets a random one from the lower band.
 *
 * Odd player count: the median player is returned in `unpaired`, never dropped.
 */
export function pairBalancedRandom<T extends PairablePlayer>(players: T[]): PairingResult<T> {
  const sorted = [...players].sort(
    (a, b) => (b.rating ?? DEFAULT_RATING) - (a.rating ?? DEFAULT_RATING)
  );

  let unpaired: T | null = null;
  let pool = sorted;
  if (sorted.length % 2 === 1) {
    const midIdx = Math.floor(sorted.length / 2);
    unpaired = sorted[midIdx];
    pool = [...sorted.slice(0, midIdx), ...sorted.slice(midIdx + 1)];
  }

  const half = pool.length / 2;
  const strong = pool.slice(0, half);
  const weak = shuffle(pool.slice(half)); // randomise who from the lower band each gets

  const duos: PairedDuo<T>[] = strong.map((s, i) => ({ player1: s, player2: weak[i] }));

  return { duos, unpaired };
}
