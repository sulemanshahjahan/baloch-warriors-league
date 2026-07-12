export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, getRoundDisplayName } from "@/lib/utils";
import { schedulingStatusMeta, formatConflict } from "@/lib/scheduling/labels";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { RescheduleDecision, ActivationDecision, NoShowResolve, RegenOrTime } from "./conflict-actions";

export const metadata = { title: "Scheduling Conflicts" };

const NAMES = {
  round: true,
  roundNumber: true,
  matchNumber: true,
  homePlayer: { select: { name: true } },
  awayPlayer: { select: { name: true } },
  homeTeam: { select: { name: true } },
  awayTeam: { select: { name: true } },
  tournament: { select: { name: true, slug: true } },
} as const;

type MatchNamed = {
  round: string | null;
  roundNumber: number | null;
  matchNumber: number | null;
  homePlayer: { name: string } | null;
  awayPlayer: { name: string } | null;
  homeTeam: { name: string } | null;
  awayTeam: { name: string } | null;
  tournament: { name: string };
};

const homeOf = (m: MatchNamed) => m.homePlayer?.name ?? m.homeTeam?.name ?? "Home";
const awayOf = (m: MatchNamed) => m.awayPlayer?.name ?? m.awayTeam?.name ?? "Away";
const roundOf = (m: MatchNamed) => getRoundDisplayName(m.round, m.roundNumber, m.matchNumber);

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-3 space-y-2">{children}</div>;
}

export default async function ConflictsPage() {
  await requireRole("EDITOR");
  const now = new Date();
  const cutoff = new Date(now.getTime() - 15 * 60_000);

  const [reschedules, activations, attention, noShowRaw] = await Promise.all([
    prisma.rescheduleRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { match: { select: NAMES } },
    }),
    prisma.substituteActivation.findMany({
      where: { status: { in: ["REQUESTED", "ACCEPTED"] } },
      orderBy: { createdAt: "asc" },
      include: { match: { select: NAMES } },
    }),
    prisma.matchSchedule.findMany({
      where: { schedulingStatus: { in: ["NO_COMMON_TIME", "ADMIN_DECISION"] } },
      orderBy: { updatedAt: "asc" },
      include: { match: { select: { id: true, ...NAMES } } },
    }),
    prisma.match.findMany({
      where: { status: "SCHEDULED", scheduledAt: { not: null, lt: cutoff } },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      select: { id: true, scheduledAt: true, ...NAMES, schedule: { select: { schedulingStatus: true } } },
    }),
  ]);

  const noShow = noShowRaw.filter((m) => m.schedule && m.schedule.schedulingStatus !== "COMPLETED");

  // Player names for substitute activations (ids are plain scalars).
  const subPlayerIds = [...new Set(activations.flatMap((a) => [a.originalPlayerId, a.substitutePlayerId]))];
  const subPlayers = subPlayerIds.length
    ? await prisma.player.findMany({ where: { id: { in: subPlayerIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string) => subPlayers.find((p) => p.id === id)?.name ?? "player";

  const total = reschedules.length + activations.length + attention.length + noShow.length;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Scheduling Conflicts" description={`${total} item${total !== 1 ? "s" : ""} need attention`} />
      <main className="flex-1 p-6 space-y-6">
        <Link href="/admin/scheduling" className="text-sm text-muted-foreground hover:text-foreground">← All tournaments</Link>

        {total === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-3 opacity-70" />
            <h3 className="text-lg font-medium">All clear</h3>
            <p className="text-sm text-muted-foreground">No reschedules, substitutions, escalations, or no-shows pending.</p>
          </div>
        )}

        {/* No common time / admin decision */}
        {attention.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-red-400" /> Needs a decision ({attention.length})</h2>
            {attention.map((s) => (
              <Card key={s.id}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{homeOf(s.match)} vs {awayOf(s.match)}</div>
                    <div className="text-xs text-muted-foreground">{s.match.tournament.name} · {roundOf(s.match)}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${schedulingStatusMeta(s.schedulingStatus).cls}`}>{schedulingStatusMeta(s.schedulingStatus).label}</span>
                </div>
                {(() => {
                  const c = formatConflict(s.conflictSummary);
                  return c && c.blockers ? (
                    <p className="text-xs text-red-300">
                      Blocking: {c.blockers}
                      {c.partial ? ` · ${c.partial}` : ""}
                      {c.subs ? ` · sub fix: ${c.subs}` : ""}
                    </p>
                  ) : null;
                })()}
                <RegenOrTime matchId={s.match.id} />
              </Card>
            ))}
          </section>
        )}

        {/* Reschedule requests */}
        {reschedules.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Reschedule requests ({reschedules.length})</h2>
            {reschedules.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{homeOf(r.match)} vs {awayOf(r.match)}</div>
                    <div className="text-xs text-muted-foreground">{r.match.tournament.name} · {roundOf(r.match)}</div>
                  </div>
                  {r.isEmergency && <Badge className="bg-red-500/15 text-red-300 border-red-500/30">Emergency</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Reason: <span className="text-foreground">{r.reasonCategory.replaceAll("_", " ").toLowerCase()}</span> — {r.reasonText}
                  {r.requestedStart ? ` · wants ${formatDateTime(r.requestedStart)}` : ""}
                </p>
                <RescheduleDecision requestId={r.id} hasRequestedTime={!!r.requestedStart} />
              </Card>
            ))}
          </section>
        )}

        {/* Substitute activations */}
        {activations.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Substitute activations ({activations.length})</h2>
            {activations.map((a) => (
              <Card key={a.id}>
                <div className="text-sm font-medium">{homeOf(a.match)} vs {awayOf(a.match)}</div>
                <div className="text-xs text-muted-foreground">{a.match.tournament.name} · {roundOf(a.match)}</div>
                <p className="text-xs text-muted-foreground">Replace <span className="text-foreground">{nameOf(a.originalPlayerId)}</span> with <span className="text-foreground">{nameOf(a.substitutePlayerId)}</span> · {a.status.toLowerCase()}</p>
                <ActivationDecision id={a.id} />
              </Card>
            ))}
          </section>
        )}

        {/* No-show review */}
        {noShow.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">No-show review ({noShow.length})</h2>
            {noShow.map((m) => (
              <Card key={m.id}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{homeOf(m)} vs {awayOf(m)}</div>
                    <div className="text-xs text-muted-foreground">{m.tournament.name} · kickoff {m.scheduledAt ? formatDateTime(m.scheduledAt) : "—"}</div>
                  </div>
                </div>
                <NoShowResolve matchId={m.id} homeName={homeOf(m)} awayName={awayOf(m)} />
              </Card>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
