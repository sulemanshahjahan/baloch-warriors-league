import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Clock, AlertTriangle, CheckCircle2, ChevronRight, CalendarPlus, CalendarClock } from "lucide-react";
import { getPlayerSession } from "@/lib/player-session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { computeMonthStats, validateMinRequirements, type BlockLike } from "@/lib/scheduling/blocks";
import { getPlayerMonthRequirements } from "@/lib/scheduling/requirements";
import { schedulingStatusMeta } from "@/lib/scheduling/labels";
import { MONTH_LABELS } from "../availability/shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Schedule | BWL" };

const pad = (n: number) => String(n).padStart(2, "0");

function pktNow() {
  const p = new Date(Date.now() + 5 * 3_600_000);
  return { month: p.getUTCMonth() + 1, year: p.getUTCFullYear() };
}

function toBlockLikes(blocks: { date: Date; startDateTime: Date | null; endDateTime: Date | null; status: string; isAllDay: boolean; isOvernight: boolean }[]): BlockLike[] {
  return blocks.map((b) => ({
    date: b.date.toISOString().slice(0, 10),
    startDateTime: b.startDateTime,
    endDateTime: b.endDateTime,
    status: b.status as BlockLike["status"],
    isAllDay: b.isAllDay,
    isOvernight: b.isOvernight,
  }));
}

export default async function SchedulePage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");
  const playerId = session.playerId;

  const now = pktNow();
  const next = now.month === 12 ? { month: 1, year: now.year + 1 } : { month: now.month + 1, year: now.year };

  const [curPeriod, nextPeriod, reqs] = await Promise.all([
    prisma.playerAvailabilityPeriod.findUnique({
      where: { playerId_month_year: { playerId, month: now.month, year: now.year } },
      include: { blocks: true },
    }),
    prisma.playerAvailabilityPeriod.findUnique({
      where: { playerId_month_year: { playerId, month: next.month, year: next.year } },
      include: { blocks: true },
    }),
    getPlayerMonthRequirements(playerId),
  ]);

  const teamIds = (
    await prisma.teamPlayer.findMany({ where: { playerId, isActive: true }, select: { teamId: true } })
  ).map((t) => t.teamId);

  const awaitingRows = await prisma.matchParticipantConfirmation.findMany({
    where: {
      playerId,
      status: { in: ["PENDING", "REJECTED", "TENTATIVE"] },
      matchSchedule: { schedulingStatus: { notIn: ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_COMMON_TIME"] } },
    },
    orderBy: { matchSchedule: { confirmationDeadline: "asc" } },
    take: 10,
    include: {
      matchSchedule: {
        select: {
          schedulingStatus: true,
          primaryStart: true,
          match: {
            select: {
              id: true,
              homePlayer: { select: { name: true } },
              awayPlayer: { select: { name: true } },
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
              tournament: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  const awaiting = awaitingRows.map((c) => {
    const m = c.matchSchedule.match;
    return {
      matchId: m.id,
      home: m.homePlayer?.name ?? m.homeTeam?.name ?? "TBD",
      away: m.awayPlayer?.name ?? m.awayTeam?.name ?? "TBD",
      tournament: m.tournament.name,
      status: c.matchSchedule.schedulingStatus,
      primary: c.matchSchedule.primaryStart,
    };
  });

  const upcoming = await prisma.match.findMany({
    where: {
      status: { in: ["SCHEDULED", "LIVE"] },
      scheduledAt: { gte: new Date() },
      OR: [
        { homePlayerId: playerId },
        { awayPlayerId: playerId },
        ...(teamIds.length ? [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] : []),
      ],
    },
    orderBy: { scheduledAt: "asc" },
    take: 8,
    include: {
      tournament: { select: { name: true, slug: true } },
      homePlayer: { select: { name: true } },
      awayPlayer: { select: { name: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  function monthSummary(
    period: { status: string; blocks: Parameters<typeof toBlockLikes>[0] } | null,
    label: string,
    month: number,
    year: number
  ) {
    const blocks = period ? toBlockLikes(period.blocks) : [];
    const stats = computeMonthStats(blocks);
    const check = validateMinRequirements(blocks, reqs.requirements);
    const status = period?.status ?? "NOT_STARTED";
    const daysInMonth = new Date(year, month, 0).getDate();
    const respondedDays = new Set(blocks.map((b) => b.date)).size;
    const pct = Math.round((respondedDays / daysInMonth) * 100);
    return { blocks, stats, check, status, pct, respondedDays, daysInMonth, label, month, year };
  }

  const cur = monthSummary(curPeriod, `${MONTH_LABELS[now.month - 1]} ${now.year}`, now.month, now.year);
  const nxt = monthSummary(nextPeriod, `${MONTH_LABELS[next.month - 1]} ${next.year}`, next.month, next.year);

  const actionNeeded =
    cur.status !== "SUBMITTED" || (reqs.requirements.mode === "HARD" && !cur.check.ok);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-black flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" /> My Schedule
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Availability, upcoming matches and confirmations. Times in PKT.</p>
      </div>

      {/* Priority banner */}
      {actionNeeded ? (
        <Link href="/player/availability" className="block rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 hover:bg-amber-500/10">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4" /> Action required
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {cur.status === "SUBMITTED"
              ? "Your availability doesn't meet the tournament requirements yet."
              : `Submit your availability for ${cur.label}.`}{" "}
            Tap to open your calendar →
          </p>
        </Link>
      ) : (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-green-300">
            <CheckCircle2 className="w-4 h-4" /> You&apos;re all set for {cur.label}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Availability submitted. You can still edit it until it locks.</p>
        </div>
      )}

      {/* Matches awaiting confirmation */}
      {awaiting.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> Awaiting your confirmation</h2>
          <div className="space-y-1.5">
            {awaiting.map((a) => {
              const meta = schedulingStatusMeta(a.status);
              return (
                <Link key={a.matchId} href={`/player/matches/${a.matchId}`} className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 hover:bg-amber-500/10">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.home} vs {a.away}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.tournament}{a.primary ? ` · proposed ${formatDateTime(a.primary)}` : ""}
                    </div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${meta.cls}`}>{meta.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Month cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[cur, nxt].map((mo) => (
          <div key={mo.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{mo.label}</div>
              <StatusPill status={mo.status} />
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${mo.pct}%` }} />
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {mo.respondedDays}/{mo.daysInMonth} days filled · {mo.stats.availableDays} available · {mo.stats.availableHours}h
            </div>
            <Link
              href={`/player/availability?m=${mo.year}-${pad(mo.month)}`}
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <CalendarPlus className="w-4 h-4" /> Edit availability
            </Link>
          </div>
        ))}
      </div>

      {reqs.requirements.mode !== "DISABLED" && reqs.tournaments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Requirements apply for: {reqs.tournaments.map((t) => t.name).join(", ")}
        </p>
      )}

      {/* Upcoming matches */}
      <div>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Upcoming matches</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card px-4 py-6 text-center">
            No upcoming matches scheduled yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map((m) => {
              const home = m.homePlayer?.name ?? m.homeTeam?.name ?? "TBD";
              const away = m.awayPlayer?.name ?? m.awayTeam?.name ?? "TBD";
              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 hover:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{home} vs {away}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.tournament.name}
                      {m.scheduledAt ? ` · ${formatDateTime(m.scheduledAt)}` : " · time TBD"}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    NOT_STARTED: { label: "Not started", cls: "bg-muted text-muted-foreground" },
    DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    SUBMITTED: { label: "Submitted", cls: "bg-green-500/15 text-green-300 border border-green-500/30" },
    LOCKED: { label: "Locked", cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
    REOPENED: { label: "Reopened", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  };
  const m = map[status] ?? map.NOT_STARTED;
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}
