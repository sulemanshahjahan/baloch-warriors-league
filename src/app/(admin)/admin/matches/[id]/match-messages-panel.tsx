import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, CheckCircle2, XCircle, SkipForward, ExternalLink } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  REMINDER: "Reminder",
  SCHEDULE: "Schedule",
  FIXTURE: "Fixture",
  OPPONENT_READY: "Opponent ready",
  OTHER: "Other",
};

const STATUS_ICON: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SENT: { icon: CheckCircle2, color: "text-green-500" },
  FAILED: { icon: XCircle, color: "text-red-500" },
  SKIPPED: { icon: SkipForward, color: "text-muted-foreground" },
};

export async function MatchMessagesPanel({ matchId }: { matchId: string }) {
  const logs = await prisma.whatsAppLog.findMany({
    where: { matchId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      phone: true,
      templateName: true,
      category: true,
      status: true,
      error: true,
      createdAt: true,
      dedupKey: true,
      player: { select: { name: true } },
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          WhatsApp messages ({logs.length})
        </CardTitle>
        <Link
          href={`/admin/messages?matchId=${matchId}`}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No WhatsApp messages sent for this match yet.
          </p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const statusMeta = STATUS_ICON[log.status] ?? STATUS_ICON.SENT;
              const StatusIcon = statusMeta.icon;
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-card/50 text-xs"
                >
                  <StatusIcon className={`w-4 h-4 shrink-0 ${statusMeta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{CATEGORY_LABEL[log.category] ?? log.category}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{log.player?.name ?? `+${log.phone}`}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">{log.templateName}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(log.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Karachi",
                      })} PKT
                      {log.error && <span className="text-red-400 ml-2">· {log.error}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
