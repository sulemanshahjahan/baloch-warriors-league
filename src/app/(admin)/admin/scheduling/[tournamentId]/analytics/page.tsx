export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Scheduling Analytics" };

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ tournamentId: string }> }) {
  await requireRole("EDITOR");
  const { tournamentId } = await params;

  // Current + next month window for availability submissions.
  const now = new Date();
  const curMonth = now.getMonth() + 1; // 1-12
  const curYear = now.getFullYear();
  const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
  const nextYear = curMonth === 12 ? curYear + 1 : curYear;

  const [
    tournament,
    totalMatches,
    schedules,
    reschedulePending,
    rescheduleApproved,
    rescheduleRejected,
    subTotal,
    subApproved,
    noShowResolutions,
    enrolledPlayers,
    enrolledTeams,
  ] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true },
    }),
    prisma.match.count({ where: { tournamentId } }),
    prisma.matchSchedule.findMany({
      where: { match: { tournamentId } },
      select: {
        schedulingStatus: true,
        adminOverride: true,
        _count: { select: { slots: true } },
      },
    }),
    prisma.rescheduleRequest.count({ where: { match: { tournamentId }, status: "PENDING" } }),
    prisma.rescheduleRequest.count({ where: { match: { tournamentId }, status: "APPROVED" } }),
    prisma.rescheduleRequest.count({ where: { match: { tournamentId }, status: "REJECTED" } }),
    prisma.substituteActivation.count({ where: { match: { tournamentId } } }),
    prisma.substituteActivation.count({ where: { match: { tournamentId }, status: "APPROVED" } }),
    prisma.schedulingAuditEvent.count({
      where: { tournamentId, eventType: { startsWith: "NOSHOW_" } },
    }),
    prisma.tournamentPlayer.findMany({ where: { tournamentId }, select: { playerId: true } }),
    prisma.tournamentTeam.findMany({
      where: { tournamentId },
      select: { team: { select: { players: { select: { playerId: true } } } } },
    }),
  ]);

  if (!tournament) notFound();

  // ── Overview ──────────────────────────────────────────────
  const matchesWithSchedule = schedules.length;
  const scheduledCount = schedules.filter((s) => s.schedulingStatus === "SCHEDULED").length;
  const noCommonTimeCount = schedules.filter((s) => s.schedulingStatus === "NO_COMMON_TIME").length;
  const needsAdminCount = schedules.filter(
    (s) => s.schedulingStatus === "ADMIN_DECISION" || s.adminOverride,
  ).length;

  // % auto-scheduled = SCHEDULED without an admin override, over all SCHEDULED.
  const scheduledNoOverride = schedules.filter(
    (s) => s.schedulingStatus === "SCHEDULED" && !s.adminOverride,
  ).length;
  const autoPct = scheduledCount > 0 ? Math.round((scheduledNoOverride / scheduledCount) * 100) : null;

  // Average proposed slots across schedules that actually have proposals.
  const withSlots = schedules.filter((s) => s._count.slots > 0);
  const avgSlots =
    withSlots.length > 0
      ? withSlots.reduce((sum, s) => sum + s._count.slots, 0) / withSlots.length
      : null;

  // ── Availability ──────────────────────────────────────────
  // Enrolled player ids: individual enrollments + every team roster member.
  const enrolledIds = [
    ...new Set([
      ...enrolledPlayers.map((p) => p.playerId),
      ...enrolledTeams.flatMap((t) => t.team.players.map((tp) => tp.playerId)),
    ]),
  ];
  const totalEnrolled = enrolledIds.length;

  const submittedPeriods = enrolledIds.length
    ? await prisma.playerAvailabilityPeriod.findMany({
        where: {
          playerId: { in: enrolledIds },
          status: "SUBMITTED",
          OR: [
            { month: curMonth, year: curYear },
            { month: nextMonth, year: nextYear },
          ],
        },
        select: { playerId: true },
      })
    : [];
  const submittedCount = new Set(submittedPeriods.map((p) => p.playerId)).size;
  const availPct = totalEnrolled > 0 ? Math.round((submittedCount / totalEnrolled) * 100) : null;

  // ── Display helpers (never NaN) ───────────────────────────
  const autoLabel = autoPct === null ? "—" : `${autoPct}%`;
  const avgLabel = avgSlots === null ? "—" : avgSlots.toFixed(1);
  const availValue = `${submittedCount} / ${totalEnrolled}`;
  const availPctLabel = availPct === null ? "—" : `${availPct}%`;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Scheduling Analytics" description={tournament.name} />
      <main className="flex-1 p-6 space-y-6">
        <Link
          href={`/admin/scheduling/${tournamentId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to tournament scheduling
        </Link>

        {/* Overview */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatTile value={String(totalMatches)} label="Total matches" />
            <StatTile value={String(matchesWithSchedule)} label="With a schedule" />
            <StatTile value={String(scheduledCount)} label="Scheduled" />
            <StatTile value={String(noCommonTimeCount)} label="No common time" />
            <StatTile value={String(needsAdminCount)} label="Needs admin decision" />
            <StatTile value={autoLabel} label="Auto-scheduled (no override)" />
            <StatTile value={avgLabel} label="Avg proposed slots" />
          </div>
        </section>

        {/* Reschedules */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Reschedules</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatTile value={String(reschedulePending)} label="Pending" />
            <StatTile value={String(rescheduleApproved)} label="Approved" />
            <StatTile value={String(rescheduleRejected)} label="Rejected" />
          </div>
        </section>

        {/* Substitutes */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Substitutes</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatTile value={String(subTotal)} label="Activations" />
            <StatTile value={String(subApproved)} label="Approved activations" />
            <StatTile value={String(noShowResolutions)} label="No-show resolutions" />
          </div>
        </section>

        {/* Availability */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Availability</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatTile value={String(totalEnrolled)} label="Enrolled players" />
            <StatTile value={String(submittedCount)} label="Submitted availability" />
            <StatTile value={availValue} label={`Submission rate (${availPctLabel})`} />
          </div>
        </section>
      </main>
    </div>
  );
}
