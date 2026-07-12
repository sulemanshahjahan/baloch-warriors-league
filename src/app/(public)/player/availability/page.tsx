import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/player-session";
import { prisma } from "@/lib/db";
import { toKarachiInputValue, fromKarachiInputValue } from "@/lib/utils";
import { computeMonthStats, validateMinRequirements, type BlockLike } from "@/lib/scheduling/blocks";
import { getPlayerMonthRequirements } from "@/lib/scheduling/requirements";
import { AvailabilityClient } from "./availability-client";
import type { DayBlock, AvailabilityStatus } from "./shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Availability | BWL" };

const pad = (n: number) => String(n).padStart(2, "0");

function pktNow() {
  const p = new Date(Date.now() + 5 * 3_600_000);
  return { month: p.getUTCMonth() + 1, year: p.getUTCFullYear() };
}

function parseMonthParam(m: string | undefined): { month: number; year: number } {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    if (mo >= 1 && mo <= 12 && y >= 2024 && y <= 2100) return { month: mo, year: y };
  }
  return pktNow();
}

function toTime(d: Date | null): string | null {
  return d ? toKarachiInputValue(d).slice(11, 16) : null;
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");
  const { m } = await searchParams;
  const { month, year } = parseMonthParam(m);

  const period = await prisma.playerAvailabilityPeriod.findUnique({
    where: { playerId_month_year: { playerId: session.playerId, month, year } },
    include: { blocks: { orderBy: [{ date: "asc" }, { startDateTime: "asc" }] } },
  });

  const blocks: DayBlock[] = (period?.blocks ?? []).map((b) => ({
    id: b.id,
    date: b.date.toISOString().slice(0, 10),
    status: b.status as AvailabilityStatus,
    isAllDay: b.isAllDay,
    isOvernight: b.isOvernight,
    startTime: toTime(b.startDateTime),
    endTime: toTime(b.endDateTime),
    dutyType: b.dutyType,
    confidence: b.confidence,
    note: b.note,
    privacy: b.privacy,
  }));

  const blockLikes: BlockLike[] = (period?.blocks ?? []).map((b) => ({
    date: b.date.toISOString().slice(0, 10),
    startDateTime: b.startDateTime,
    endDateTime: b.endDateTime,
    status: b.status as BlockLike["status"],
    isAllDay: b.isAllDay,
    isOvernight: b.isOvernight,
  }));

  const stats = computeMonthStats(blockLikes);
  const { requirements, tournaments } = await getPlayerMonthRequirements(session.playerId);
  const requirementCheck = validateMinRequirements(blockLikes, requirements);

  const templates = await prisma.availabilityTemplate.findMany({
    where: { playerId: session.playerId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, isDefault: true },
  });

  // Scheduled matches this month for the calendar's "match" markers.
  const teamIds = (
    await prisma.teamPlayer.findMany({ where: { playerId: session.playerId, isActive: true }, select: { teamId: true } })
  ).map((t) => t.teamId);
  const monthStart = fromKarachiInputValue(`${year}-${pad(month)}-01T00:00`)!;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = fromKarachiInputValue(`${nextYear}-${pad(nextMonth)}-01T00:00`)!;
  const monthMatches = await prisma.match.findMany({
    where: {
      status: { in: ["SCHEDULED", "LIVE"] },
      scheduledAt: { gte: monthStart, lt: monthEnd },
      OR: [
        { homePlayerId: session.playerId },
        { awayPlayerId: session.playerId },
        ...(teamIds.length ? [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] : []),
      ],
    },
    select: { scheduledAt: true },
  });
  const matchDates = [
    ...new Set(monthMatches.filter((mm) => mm.scheduledAt).map((mm) => toKarachiInputValue(mm.scheduledAt!).slice(0, 10))),
  ];

  return (
    <AvailabilityClient
      month={month}
      year={year}
      periodStatus={period?.status ?? null}
      submittedAt={period?.submittedAt ? period.submittedAt.toISOString() : null}
      blocks={blocks}
      stats={stats}
      requirementMode={requirements.mode}
      requirementCheck={requirementCheck}
      requirementTournaments={tournaments}
      templates={templates}
      matchDates={matchDates}
    />
  );
}
