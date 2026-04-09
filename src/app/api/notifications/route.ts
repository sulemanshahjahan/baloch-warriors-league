import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?since=ISO_DATE
 * Returns notifications created after the given timestamp.
 * Used by Capacitor app for polling.
 */
export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since");

  const notifications = await prisma.notification.findMany({
    where: since ? { createdAt: { gt: new Date(since) } } : {},
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      body: true,
      url: true,
      tag: true,
      createdAt: true,
    },
  });

  return NextResponse.json(notifications, {
    headers: { "Cache-Control": "no-cache, no-store" },
  });
}
