import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Returns the ID of the most recent activity log entry.
 * Used by LiveRefresh to detect ANY admin change.
 *
 * In-memory cache prevents DB hammering from many concurrent pollers.
 * At most 1 DB query every 5 seconds regardless of user count.
 */

let cachedResult: { id: string | null; ts: string | null } | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5000; // 5 seconds

async function getLatestActivity() {
  const now = Date.now();
  if (cachedResult && now < cacheExpiry) return cachedResult;

  const latest = await prisma.activityLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });

  cachedResult = {
    id: latest?.id ?? null,
    ts: latest?.createdAt?.toISOString() ?? null,
  };
  cacheExpiry = now + CACHE_TTL;
  return cachedResult;
}

export async function GET() {
  const data = await getLatestActivity();

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-cache, no-store" },
  });
}
