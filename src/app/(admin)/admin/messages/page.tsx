import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, CheckCircle2, XCircle, SkipForward, Calendar, Trophy, Swords, Send } from "lucide-react";
import { ForceResendButton } from "./force-resend-button";

export const dynamic = "force-dynamic";

const CATEGORY_META: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  REMINDER: { label: "Reminder", color: "text-amber-400 border-amber-500/30 bg-amber-500/10", icon: Calendar },
  SCHEDULE: { label: "Schedule", color: "text-blue-400 border-blue-500/30 bg-blue-500/10", icon: Send },
  FIXTURE: { label: "Fixture Broadcast", color: "text-purple-400 border-purple-500/30 bg-purple-500/10", icon: Trophy },
  OPPONENT_READY: { label: "Opponent Ready", color: "text-green-400 border-green-500/30 bg-green-500/10", icon: CheckCircle2 },
  OTHER: { label: "Other", color: "text-muted-foreground border-border bg-muted/30", icon: MessageCircle },
};

const STATUS_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  SENT: { icon: CheckCircle2, color: "text-green-500", label: "Sent" },
  FAILED: { icon: XCircle, color: "text-red-500", label: "Failed" },
  SKIPPED: { icon: SkipForward, color: "text-muted-foreground", label: "Skipped" },
};

interface PageProps {
  searchParams: Promise<{ category?: string; status?: string; matchId?: string; tournamentId?: string }>;
}

export default async function MessagesPage({ searchParams }: PageProps) {
  await requireRole("ADMIN");
  const params = await searchParams;

  const where: {
    category?: string;
    status?: string;
    matchId?: string;
    tournamentId?: string;
  } = {};
  if (params.category) where.category = params.category;
  if (params.status) where.status = params.status;
  if (params.matchId) where.matchId = params.matchId;
  if (params.tournamentId) where.tournamentId = params.tournamentId;

  const [logs, counts, totals] = await Promise.all([
    prisma.whatsAppLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        match: {
          select: {
            id: true,
            round: true,
            homePlayer: { select: { name: true } },
            awayPlayer: { select: { name: true } },
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        },
        player: { select: { id: true, name: true, slug: true } },
        tournament: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.whatsAppLog.groupBy({
      by: ["category", "status"],
      _count: { _all: true },
    }),
    prisma.whatsAppLog.count(),
  ]);

  // Build summary cards per category
  const catSummary = new Map<string, { sent: number; failed: number; skipped: number }>();
  for (const c of counts) {
    const cur = catSummary.get(c.category) ?? { sent: 0, failed: 0, skipped: 0 };
    if (c.status === "SENT") cur.sent += c._count._all;
    if (c.status === "FAILED") cur.failed += c._count._all;
    if (c.status === "SKIPPED") cur.skipped += c._count._all;
    catSummary.set(c.category, cur);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            WhatsApp Message Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every outbound WhatsApp template message, deduplicated by intent. Total: {totals.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Category summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {["REMINDER", "SCHEDULE", "FIXTURE", "OPPONENT_READY", "OTHER"].map((cat) => {
          const s = catSummary.get(cat) ?? { sent: 0, failed: 0, skipped: 0 };
          const meta = CATEGORY_META[cat] ?? CATEGORY_META.OTHER;
          const Icon = meta.icon;
          return (
            <Link
              key={cat}
              href={`/admin/messages?category=${cat}`}
              className={`rounded-xl border p-3 hover:opacity-80 transition-opacity ${
                params.category === cat ? meta.color : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold">{meta.label}</span>
              </div>
              <div className="text-xl font-bold">{s.sent}</div>
              <div className="text-[10px] text-muted-foreground">
                sent{s.failed > 0 ? ` · ${s.failed} failed` : ""}{s.skipped > 0 ? ` · ${s.skipped} skipped` : ""}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <span className="text-muted-foreground">Filters:</span>
        {(params.category || params.status || params.matchId || params.tournamentId) && (
          <Link
            href="/admin/messages"
            className="px-2 py-1 rounded bg-muted text-foreground hover:bg-muted/80"
          >
            ✕ Clear all
          </Link>
        )}
        {params.category && (
          <Badge variant="outline">category: {params.category}</Badge>
        )}
        {params.status && (
          <Badge variant="outline">status: {params.status}</Badge>
        )}
        {params.matchId && (
          <Badge variant="outline">match: {params.matchId.slice(-6)}</Badge>
        )}
        {params.tournamentId && (
          <Badge variant="outline">tournament: {params.tournamentId.slice(-6)}</Badge>
        )}
      </div>

      {/* Log list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent messages ({logs.length}{logs.length >= 500 ? "+" : ""})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-12 text-sm">
              No messages match your filters.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const catMeta = CATEGORY_META[log.category] ?? CATEGORY_META.OTHER;
                const CatIcon = catMeta.icon;
                const statusMeta = STATUS_META[log.status] ?? STATUS_META.SENT;
                const StatusIcon = statusMeta.icon;

                const matchLabel = log.match
                  ? `${log.match.homePlayer?.name ?? log.match.homeTeam?.name ?? "?"} vs ${log.match.awayPlayer?.name ?? log.match.awayTeam?.name ?? "?"}`
                  : null;

                return (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className={`shrink-0 flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-semibold ${catMeta.color}`}>
                      <CatIcon className="w-3 h-3" />
                      {catMeta.label}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <StatusIcon className={`w-3.5 h-3.5 ${statusMeta.color}`} />
                        <span className="font-medium">
                          {log.player?.name ?? `+${log.phone}`}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground text-xs font-mono">
                          {log.templateName}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {matchLabel && log.match && (
                          <Link
                            href={`/admin/matches/${log.match.id}`}
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            <Swords className="w-3 h-3" />
                            {matchLabel}
                          </Link>
                        )}
                        {log.tournament && (
                          <Link
                            href={`/admin/tournaments/${log.tournament.id}`}
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            <Trophy className="w-3 h-3" />
                            {log.tournament.name}
                          </Link>
                        )}
                        <span>{new Date(log.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        {log.error && (
                          <span className="text-red-400" title={log.error}>
                            ⚠ {log.error.length > 50 ? log.error.slice(0, 50) + "…" : log.error}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono truncate">
                        key: {log.dedupKey}
                      </div>
                    </div>

                    <ForceResendButton logId={log.id} dedupKey={log.dedupKey} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
