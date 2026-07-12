export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import {
  STATUS_META,
  type AvailabilityStatus,
} from "@/app/(public)/player/availability/shared";

export const metadata = { title: "Availability Overlap" };

// When a player has several blocks on one day, the earlier entry wins.
const PRIORITY: AvailabilityStatus[] = [
  "CONFIRMED",
  "LIKELY",
  "IF_NEEDED",
  "SHIFT_UNCONFIRMED",
  "UNAVAILABLE",
  "NO_RESPONSE",
];
const rank = (s: AvailabilityStatus): number => {
  const i = PRIORITY.indexOf(s);
  return i === -1 ? PRIORITY.length : i;
};

// Statuses that count as "available" for the coverage row.
const ELIGIBLE: AvailabilityStatus[] = ["CONFIRMED", "LIKELY", "IF_NEEDED"];

const LEGEND: AvailabilityStatus[] = [
  "CONFIRMED",
  "LIKELY",
  "IF_NEEDED",
  "SHIFT_UNCONFIRMED",
  "UNAVAILABLE",
];

type Row = { id: string; label: string };

export default async function Page({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  await requireRole("EDITOR");
  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, participantType: true },
  });
  if (!tournament) notFound();

  // ── Participant player rows ──
  const rows: Row[] = [];
  const seen = new Set<string>();

  if (tournament.participantType === "INDIVIDUAL") {
    const tps = await prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      select: { player: { select: { id: true, name: true } } },
    });
    for (const tp of tps) {
      if (seen.has(tp.player.id)) continue;
      seen.add(tp.player.id);
      rows.push({ id: tp.player.id, label: tp.player.name });
    }
  } else {
    const tts = await prisma.tournamentTeam.findMany({
      where: { tournamentId },
      select: {
        team: {
          select: {
            name: true,
            players: {
              where: { isActive: true },
              select: { player: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    for (const tt of tts) {
      for (const tp of tt.team.players) {
        if (seen.has(tp.player.id)) continue;
        seen.add(tp.player.id);
        rows.push({ id: tp.player.id, label: `${tt.team.name} · ${tp.player.name}` });
      }
    }
  }

  const playerIds = rows.map((r) => r.id);

  // ── Next 14 calendar days (PKT = UTC+5, fixed) ──
  const base = new Date(Date.now() + 5 * 3600 * 1000);
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayLabel = (dateStr: string): string =>
    new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  // ── Availability blocks → dominant status per (player, day) ──
  const statusByKey = new Map<string, AvailabilityStatus>();
  if (playerIds.length > 0) {
    const blocks = await prisma.availabilityBlock.findMany({
      where: {
        playerId: { in: playerIds },
        date: {
          gte: new Date(`${days[0]}T00:00:00Z`),
          lte: new Date(`${days[13]}T00:00:00Z`),
        },
      },
      select: { playerId: true, date: true, status: true },
    });
    for (const b of blocks) {
      const key = `${b.playerId}|${b.date.toISOString().slice(0, 10)}`;
      const s = b.status as AvailabilityStatus;
      const prev = statusByKey.get(key);
      if (!prev || rank(s) < rank(prev)) statusByKey.set(key, s);
    }
  }

  const cellStatus = (playerId: string, day: string): AvailabilityStatus =>
    statusByKey.get(`${playerId}|${day}`) ?? "NO_RESPONSE";

  // ── Per-day coverage: how many players are eligible ──
  const coverage = days.map(
    (day) => rows.filter((r) => ELIGIBLE.includes(cellStatus(r.id, day))).length,
  );

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Availability Overlap"
        description={`${tournament.name} · next 14 days (PKT)`}
      />
      <main className="flex-1 p-6 space-y-6">
        <Link
          href={`/admin/scheduling/${tournamentId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>

        {playerIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h3 className="text-lg font-medium mb-1">No participants enrolled yet</h3>
            <p className="text-sm text-muted-foreground">
              Once players or teams are enrolled, their availability will show up here.
            </p>
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {LEGEND.map((s) => (
                <div
                  key={s}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className={`inline-block w-3 h-3 rounded-sm ${STATUS_META[s].dot}`}
                  />
                  {STATUS_META[s].label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded-sm border border-border bg-muted/30" />
                {STATUS_META.NO_RESPONSE.label}
              </div>
            </div>

            {/* Overlap matrix */}
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card w-44 min-w-44 px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border-b border-r border-border">
                      Player
                    </th>
                    {days.map((day) => (
                      <th
                        key={day}
                        className="w-8 px-1 py-2 text-center font-medium text-muted-foreground whitespace-nowrap border-b border-border"
                      >
                        {dayLabel(day)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <th className="sticky left-0 z-10 bg-card w-44 min-w-44 px-3 py-1.5 text-left font-normal whitespace-nowrap border-b border-r border-border">
                        {row.label}
                      </th>
                      {days.map((day) => {
                        const status = cellStatus(row.id, day);
                        const meta = STATUS_META[status];
                        return (
                          <td
                            key={day}
                            className="px-1 py-1 text-center border-b border-border"
                          >
                            <span
                              title={meta.label}
                              className={
                                status === "NO_RESPONSE"
                                  ? "inline-block w-7 h-7 rounded-sm border border-border bg-muted/20"
                                  : `inline-block w-7 h-7 rounded-sm ${meta.dot}`
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Coverage row */}
                  <tr>
                    <th className="sticky left-0 z-10 bg-card w-44 min-w-44 px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap border-r border-border">
                      Coverage (eligible)
                    </th>
                    {coverage.map((count, i) => (
                      <td
                        key={days[i]}
                        className="px-1 py-1.5 text-center font-semibold text-foreground"
                      >
                        {count}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Coverage counts players marked confirmed, likely, or available-if-needed on
              each day — higher is a better slot to schedule.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
