export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { MatchDayList } from "./match-day-list";

async function getMatchDayData() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const tomorrowEnd = new Date(todayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const [todayMatches, tomorrowMatches, overdueMatches, liveMatches] = await Promise.all([
    // Today's matches
    prisma.match.findMany({
      where: {
        status: { in: ["SCHEDULED", "POSTPONED"] },
        OR: [
          { scheduledAt: { gte: todayStart, lte: todayEnd } },
          { deadline: { gte: todayStart, lte: todayEnd } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        tournament: { select: { id: true, name: true, gameCategory: true } },
        homePlayer: { select: { id: true, name: true, phone: true } },
        awayPlayer: { select: { id: true, name: true, phone: true } },
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        availabilities: true,
      },
    }),
    // Tomorrow's matches
    prisma.match.findMany({
      where: {
        status: { in: ["SCHEDULED", "POSTPONED"] },
        OR: [
          { scheduledAt: { gte: todayEnd, lte: tomorrowEnd } },
          { deadline: { gte: todayEnd, lte: tomorrowEnd } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        tournament: { select: { id: true, name: true, gameCategory: true } },
        homePlayer: { select: { id: true, name: true, phone: true } },
        awayPlayer: { select: { id: true, name: true, phone: true } },
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        availabilities: true,
      },
    }),
    // Overdue matches
    prisma.match.findMany({
      where: {
        status: { in: ["SCHEDULED", "POSTPONED"] },
        isOverdue: true,
      },
      orderBy: { deadline: "asc" },
      include: {
        tournament: { select: { id: true, name: true, gameCategory: true } },
        homePlayer: { select: { id: true, name: true, phone: true } },
        awayPlayer: { select: { id: true, name: true, phone: true } },
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        availabilities: true,
      },
    }),
    // Live matches
    prisma.match.findMany({
      where: { status: "LIVE" },
      include: {
        tournament: { select: { id: true, name: true, gameCategory: true } },
        homePlayer: { select: { id: true, name: true, phone: true } },
        awayPlayer: { select: { id: true, name: true, phone: true } },
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        availabilities: true,
      },
    }),
  ]);

  return { todayMatches, tomorrowMatches, overdueMatches, liveMatches };
}

export default async function MatchDayPage() {
  await requireRole("EDITOR");
  const data = await getMatchDayData();

  const totalToday = data.todayMatches.length;
  const totalOverdue = data.overdueMatches.length;
  const totalLive = data.liveMatches.length;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Match Day"
        description={`${totalToday} today · ${totalOverdue} overdue · ${totalLive} live`}
      />
      <main className="flex-1 p-6">
        <MatchDayList
          todayMatches={data.todayMatches}
          tomorrowMatches={data.tomorrowMatches}
          overdueMatches={data.overdueMatches}
          liveMatches={data.liveMatches}
        />
      </main>
    </div>
  );
}
