export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { gameLabel, formatLabel } from "@/lib/utils";
import { CalendarClock, ChevronRight, ShieldAlert } from "lucide-react";

export const metadata = { title: "Scheduling" };

export default async function SchedulingOverviewPage() {
  await requireRole("EDITOR");

  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["DRAFT", "UPCOMING", "ACTIVE"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      gameCategory: true,
      format: true,
      status: true,
      schedulingSettings: { select: { enabled: true } },
      _count: { select: { matches: true } },
    },
  });

  const enabledCount = tournaments.filter((t) => t.schedulingSettings?.enabled).length;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Scheduling" description={`${enabledCount} of ${tournaments.length} active tournaments using scheduling`} />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Turn on availability-based scheduling per tournament. Once enabled and players have submitted availability,
            generate proposed match times from the overlap engine and let participants confirm.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/scheduling/conflicts">
              <ShieldAlert className="w-4 h-4" /> Conflict queue
            </Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarClock className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No active tournaments</h3>
            <p className="text-sm text-muted-foreground">Create or activate a tournament to configure scheduling.</p>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Matches</TableHead>
                  <TableHead>Scheduling</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournaments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{gameLabel(t.gameCategory)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatLabel(t.format)}</TableCell>
                    <TableCell><Badge variant="secondary">{formatLabel(t.status)}</Badge></TableCell>
                    <TableCell className="text-center text-sm">{t._count.matches}</TableCell>
                    <TableCell>
                      {t.schedulingSettings?.enabled ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/scheduling/${t.id}`}>
                          Manage <ChevronRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
