import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Returns the timestamp of the most recent activity log entry.
 * Used by LiveRefresh to detect ANY admin change.
 */
export async function GET() {
  const latest = await prisma.activityLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json(
    { id: latest?.id ?? null, ts: latest?.createdAt?.toISOString() ?? null },
    { headers: { "Cache-Control": "no-cache, no-store" } }
  );
}
