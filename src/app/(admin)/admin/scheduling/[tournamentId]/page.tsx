export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, toKarachiInputValue, getRoundDisplayName } from "@/lib/utils";
import { getEffectiveSettings } from "@/lib/scheduling/settings";
import { schedulingStatusMeta } from "@/lib/scheduling/labels";
import { ArrowLeft } from "lucide-react";
import { SchedulingControls } from "./scheduling-controls";
import { FixtureActions } from "./fixture-actions";

export const metadata = { title: "Tournament Scheduling" };

export default async function TournamentSchedulingPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  await requireRole("EDITOR");
  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, slug: true, format: true, participantType: true, eFootballMode: true, schedulingSettings: true },
  });
  if (!tournament) notFound();

  const eff = await getEffectiveSettings(tournamentId);
  const row = tournament.schedulingSettings;
  const initial = {
    enabled: row?.enabled ?? false,
    schedulingMode: eff!.schedulingMode,
    matchDurationMinutes: eff!.matchDurationMinutes,
    preMatchBufferMinutes: eff!.preMatchBufferMinutes,
    postMatchBufferMinutes: eff!.postMatchBufferMinutes,
    confirmationWindowHours: eff!.confirmationWindowHours,
    rescheduleCutoffHours: eff!.rescheduleCutoffHours,
    maxReschedules: eff!.maxReschedules,
    gracePeriodMinutes: eff!.gracePeriodMinutes,
    substitutesEnabled: eff!.substitutesEnabled,
    captainConfirmationEnabled: eff!.captainConfirmationEnabled,
    earlyPlayEnabled: eff!.earlyPlayEnabled,
    opponentAvailabilityVisible: eff!.opponentAvailabilityVisible,
    minRequirementMode: (row?.minRequirementMode ?? "SOFT") as "HARD" | "SOFT" | "DISABLED",
    minimumAvailableSlots: row?.minimumAvailableSlots ?? null,
    minimumAvailableDays: row?.minimumAvailableDays ?? null,
    minimumSlotDuration: row?.minimumSlotDuration ?? null,
    availabilityDeadline: row?.availabilityDeadline ? toKarachiInputValue(row.availabilityDeadline) : "",
  };

  const matches = await prisma.match.findMany({
    where: { tournamentId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    orderBy: [{ roundNumber: "asc" }, { matchNumber: "asc" }],
    include: {
      homePlayer: { select: { name: true } },
      awayPlayer: { select: { name: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      schedule: { include: { confirmations: { select: { status: true } } } },
    },
  });

  const fixtures = matches.map((m) => {
    const home = m.homePlayer?.name ?? m.homeTeam?.name ?? "TBD";
    const away = m.awayPlayer?.name ?? m.awayTeam?.name ?? "TBD";
    const confs = m.schedule?.confirmations ?? [];
    return {
      id: m.id,
      label: getRoundDisplayName(m.round, m.roundNumber, m.matchNumber),
      home,
      away,
      status: m.schedule?.schedulingStatus ?? (m.scheduledAt ? "SCHEDULED" : "FIXTURE_CREATED"),
      confirmed: confs.filter((c) => c.status === "CONFIRMED").length,
      total: confs.length,
      primary: m.schedule?.primaryStart ? formatDateTime(m.schedule.primaryStart) : m.scheduledAt ? formatDateTime(m.scheduledAt) : null,
      assignable: !!(m.homePlayerId || m.homeTeamId) && !!(m.awayPlayerId || m.awayTeamId),
    };
  });

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title={tournament.name} description="Scheduling configuration & fixtures" />
      <main className="flex-1 p-6 space-y-6">
        <Link href="/admin/scheduling" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All tournaments
        </Link>

        <SchedulingControls tournamentId={tournamentId} initial={initial} />

        <div>
          <h2 className="text-sm font-semibold mb-2">Fixtures ({fixtures.length})</h2>
          {fixtures.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-md border border-border p-6 text-center">
              No fixtures yet. Generate the tournament schedule first (Tournaments → this tournament).
            </p>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Confirmed</TableHead>
                    <TableHead>Primary time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixtures.map((f) => {
                    const meta = schedulingStatusMeta(f.status);
                    return (
                      <TableRow key={f.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{f.home} vs {f.away}</div>
                          <div className="text-xs text-muted-foreground">{f.label}</div>
                        </TableCell>
                        <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span></TableCell>
                        <TableCell className="text-center text-sm">{f.total > 0 ? `${f.confirmed}/${f.total}` : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.primary ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <FixtureActions matchId={f.id} assignable={f.assignable} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
