export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getActivityLogs } from "@/lib/actions/activity-log";
import { formatActionLabel, formatEntityLabel } from "@/lib/activity-helpers";
import { requireRole } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, User, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { ClearLogsButton } from "./clear-logs-button";
import { ActivityPagination } from "./activity-pagination";

export const metadata = { title: "Activity Log" };

const ITEMS_PER_PAGE = 25;

interface ActivityPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ActivityLogPage({ searchParams }: ActivityPageProps) {
  await requireRole("SUPER_ADMIN");
  
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  
  const { logs, total } = await getActivityLogs({
    limit: ITEMS_PER_PAGE,
    offset,
  });
  
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const actionColors: Record<string, string> = {
    CREATE: "bg-green-500/20 text-green-400 border-green-500/30",
    UPDATE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
    LOGIN: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    LOGOUT: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    PUBLISH: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    UNPUBLISH: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    SCHEDULE: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    RESCHEDULE: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    COMPLETE: "bg-green-500/20 text-green-400 border-green-500/30",
    START: "bg-green-500/20 text-green-400 border-green-500/30",
    CANCEL: "bg-red-500/20 text-red-400 border-red-500/30",
    POSTPONE: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    ACTIVATE: "bg-green-500/20 text-green-400 border-green-500/30",
    DEACTIVATE: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Activity Log"
        description={`${total} recorded activities`}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Today", value: logs.filter(l => {
              const today = new Date();
              const logDate = new Date(l.createdAt);
              return today.toDateString() === logDate.toDateString();
            }).length, icon: Clock },
            { label: "Create Actions", value: logs.filter(l => l.action === "CREATE").length, icon: Activity },
            { label: "Update Actions", value: logs.filter(l => l.action === "UPDATE").length, icon: Activity },
            { label: "Delete Actions", value: logs.filter(l => l.action === "DELETE").length, icon: Trash2 },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <stat.icon className="w-4 h-4" />
                  <span className="text-xs">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Clear old logs */}
        <div className="flex justify-end">
          <ClearLogsButton />
        </div>

        {/* Activity Table */}
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Activity className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No activity recorded</h3>
            <p className="text-sm text-muted-foreground">
              Admin actions will appear here once they are performed.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Time</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{log.admin.name}</p>
                            <Badge variant="secondary" className="text-[10px]">
                              {log.admin.role.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={actionColors[log.action] ?? "bg-gray-500/20 text-gray-400"}>
                          {formatActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.entityType ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {formatEntityLabel(log.entityType)}
                            </span>
                            {log.entityId && (
                              <span className="text-xs font-mono text-muted-foreground/60">
                                {log.entityId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.details && typeof log.details === "object" && Object.keys(log.details).length > 0 ? (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View details
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto max-w-xs">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ActivityPagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              total={total}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          </>
        )}
      </main>
    </div>
  );
}
