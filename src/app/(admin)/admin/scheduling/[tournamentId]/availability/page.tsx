export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { RemindButton } from "./remind-button";

export const metadata = { title: "Availability Roster" };

const STATUS_META: Record<string, { label: string; cls: string; order: number }> = {
  NOT_STARTED: { label: "Not started", cls: "bg-red-500/15 text-red-300 border border-red-500/30", order: 0 },
  DRAFT: { label: "Draft (not submitted)", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30", order: 1 },
  REOPENED: { label: "Reopened", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30", order: 1 },
  SUBMITTED: { label: "Submitted", cls: "bg-green-500/15 text-green-300 border border-green-500/30", order: 3 },
  LOCKED: { label: "Locked", cls: "bg-muted text-muted-foreground", order: 2 },
};

export default async function AvailabilityRosterPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  await requireRole("EDITOR");
  const { tournamentId } = await params;

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, name: true } });
  if (!tournament) notFound();

  // Enrolled players (individual + active team members), deduped.
  const [indiv, teams] = await Promise.all([
    prisma.tournamentPlayer.findMany({ where: { tournamentId }, select: { player: { select: { id: true, name: true, slug: true } } } }),
    prisma.tournamentTeam.findMany({
      where: { tournamentId },
      select: { team: { select: { name: true, players: { where: { isActive: true }, select: { player: { select: { id: true, name: true, slug: true } } } } } } },
    }),
  ]);
  const roster = new Map<string, { id: string; name: string; slug: string; team: string | null }>();
  for (const i of indiv) roster.set(i.player.id, { ...i.player, team: null });
  for (const t of teams) for (const p of t.team.players) if (!roster.has(p.player.id)) roster.set(p.player.id, { ...p.player, team: t.team.name });
  const players = [...roster.values()];

  // Current + next planning month.
  const now = new Date();
  const cm = now.getMonth() + 1;
  const cy = now.getFullYear();
  const nm = cm === 12 ? 1 : cm + 1;
  const ny = cm === 12 ? cy + 1 : cy;

  const periods = players.length
    ? await prisma.playerAvailabilityPeriod.findMany({
        where: { playerId: { in: players.map((p) => p.id) }, OR: [{ month: cm, year: cy }, { month: nm, year: ny }] },
        select: { playerId: true, status: true, submittedAt: true, updatedAt: true, _count: { select: { blocks: true } } },
      })
    : [];

  // Aggregate per player: best status, latest submittedAt, total blocks.
  const rankOf = (s: string) => STATUS_META[s]?.order ?? 0;
  const rows = players.map((p) => {
    const mine = periods.filter((x) => x.playerId === p.id);
    let status = "NOT_STARTED";
    let submittedAt: Date | null = null;
    let blocks = 0;
    for (const per of mine) {
      blocks += per._count.blocks;
      if (rankOf(per.status) >= rankOf(status)) status = per.status;
      if (per.submittedAt && (!submittedAt || per.submittedAt > submittedAt)) submittedAt = per.submittedAt;
    }
    // A player with draft blocks but nothing submitted shows DRAFT, not NOT_STARTED.
    if (status === "NOT_STARTED" && blocks > 0) status = "DRAFT";
    return { ...p, status, submittedAt, blocks };
  });
  rows.sort((a, b) => rankOf(a.status) - rankOf(b.status) || a.name.localeCompare(b.name));

  const submitted = rows.filter((r) => r.status === "SUBMITTED" || r.status === "LOCKED").length;
  const pending = rows.length - submitted;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Availability Roster" description={`${submitted}/${rows.length} submitted · ${tournament.name}`} />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link href={`/admin/scheduling/${tournamentId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to tournament scheduling
          </Link>
          {pending > 0 && <RemindButton tournamentId={tournamentId} />}
        </div>

        <p className="text-sm text-muted-foreground">
          Submission status for {rows.length} enrolled player(s), covering the current and next planning month. Players who haven&apos;t submitted are listed first.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-md border border-border p-6 text-center">No players enrolled yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Blocks</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.NOT_STARTED;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link href={`/players/${r.slug}`} className="hover:underline">{r.name}</Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.team ?? "—"}</TableCell>
                      <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span></TableCell>
                      <TableCell className="text-center text-sm">{r.blocks}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.submittedAt ? formatDateTime(r.submittedAt) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
