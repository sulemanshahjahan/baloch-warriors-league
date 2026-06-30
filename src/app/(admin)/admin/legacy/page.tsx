export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/header";
import { LegacyAdminPanel } from "./legacy-admin-panel";

export default async function AdminLegacyPage() {
  await requireRole("ADMIN");

  const [seasons, players, recentAudit, raffles] = await Promise.all([
    prisma.season.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, isActive: true, startDate: true, endDate: true } }),
    prisma.player.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, legacyLevel: true, legacyTier: true, coins: true } }),
    prisma.adminRewardAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, select: { id: true, action: true, reason: true, targetPlayerId: true, createdAt: true } }),
    prisma.raffle.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, prize: true, isActive: true, _count: { select: { entries: true } } } }),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="BWL Legacy" description="Seasons, manual rewards, cosmetics & audit" />
      <main className="flex-1 p-6">
        <LegacyAdminPanel
          seasons={seasons.map((s) => ({ ...s, startDate: s.startDate?.toISOString() ?? null, endDate: s.endDate?.toISOString() ?? null }))}
          players={players}
          recentAudit={recentAudit.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
          raffles={raffles.map((r) => ({ id: r.id, name: r.name, prize: r.prize, isActive: r.isActive, entries: r._count.entries }))}
        />
      </main>
    </div>
  );
}
