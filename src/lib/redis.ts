import { Redis } from "@upstash/redis";

/**
 * Redis caching layer using Upstash (serverless-compatible).
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars to enable.
 * When not configured, all cache operations gracefully no-op (returns null).
 */

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

/**
 * Get a cached value, or compute and cache it if missing.
 *
 * @param key - Cache key
 * @param ttlSeconds - Time-to-live in seconds
 * @param fn - Async function to compute the value if cache miss
 * @returns The cached or computed value
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const client = getRedis();

  if (!client) {
    // Redis not configured — skip caching
    return fn();
  }

  try {
    const hit = await client.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis error — fall through to compute
  }

  const value = await fn();

  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch {
    // Redis write error — value still returned
  }

  return value;
}

/**
 * Invalidate cache keys by pattern prefix.
 * Use after admin mutations to ensure fresh data.
 *
 * @param prefix - Key prefix to invalidate (e.g., "standings:", "stats:")
 */
export async function invalidateCache(prefix: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    // Upstash supports SCAN-like operations via keys
    const keys = await client.keys(`${prefix}*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Silent fail
  }
}

// ─── Cache key builders ────────────────────────────────

export const CACHE_KEYS = {
  standings: (tournamentId: string) => `standings:${tournamentId}`,
  tournamentStats: (tournamentId: string) => `tstats:${tournamentId}`,
  playerLeaderboard: (game: string, season?: string) =>
    `leaderboard:${game}:${season ?? "all"}`,
  rankings: (game: string) => `rankings:${game}`,
} as const;

// ─── Cache TTLs (seconds) ──────────────────────────────

export const CACHE_TTL = {
  standings: 30,
  tournamentStats: 60,
  playerLeaderboard: 300, // 5 minutes
  rankings: 300,
} as const;
