export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin/header";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { CountryFlag } from "@/components/public/country-flag";
import { LiveRefresh } from "@/components/public/live-refresh";
import { Radio, UserRound } from "lucide-react";

const ONLINE_MS = 5 * 60 * 1000; // "online now"
const WINDOW_MS = 24 * 60 * 60 * 1000; // show anyone seen in last 24h

function timeAgo(d: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Row = {
  key: string;
  kind: "member" | "guest";
  id: string;
  name: string;
  slug?: string;
  country: string | null;
  city: string | null;
  path: string | null;
  lastSeenAt: Date;
  views?: number;
};

export const metadata = { title: "Active Users" };

export default async function ActiveUsersPage() {
  await requireRole("ADMIN");

  const since = new Date(Date.now() - WINDOW_MS);

  // Members from the reliable player last-seen; guests from anonymous sessions.
  const [members, guests] = await Promise.all([
    prisma.player.findMany({
      where: { lastSeenAt: { gte: since } },
      orderBy: { lastSeenAt: "desc" },
      take: 300,
      select: { id: true, name: true, slug: true, lastSeenAt: true, lastCountry: true, lastCity: true, lastPath: true },
    }),
    prisma.visitorSession.findMany({
      where: { playerId: null, lastSeenAt: { gte: since } },
      orderBy: { lastSeenAt: "desc" },
      take: 300,
      select: { id: true, country: true, city: true, lastPath: true, lastSeenAt: true, pageViews: true },
    }),
  ]);

  const rows: Row[] = [
    ...members.map((m) => ({
      key: `m:${m.id}`,
      kind: "member" as const,
      id: m.id,
      name: m.name,
      slug: m.slug,
      country: m.lastCountry,
      city: m.lastCity,
      path: m.lastPath,
      lastSeenAt: m.lastSeenAt!,
    })),
    ...guests.map((g) => ({
      key: `g:${g.id}`,
      kind: "guest" as const,
      id: g.id,
      name: "Guest",
      country: g.country,
      city: g.city,
      path: g.lastPath,
      lastSeenAt: g.lastSeenAt,
      views: g.pageViews,
    })),
  ].sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

  const now = Date.now();
  const isOnline = (d: Date) => now - d.getTime() < ONLINE_MS;
  const onlineRows = rows.filter((r) => isOnline(r.lastSeenAt));
  const membersOnline = onlineRows.filter((r) => r.kind === "member").length;
  const guestsOnline = onlineRows.length - membersOnline;

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Active Users" description={`${onlineRows.length} online now · ${rows.length} in last 24h`} />
      <LiveRefresh interval={20000} />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-2xl font-black text-emerald-400 flex items-center gap-2">
              <Radio className="w-5 h-5" /> {onlineRows.length}
            </p>
            <p className="text-xs text-muted-foreground">Online now (last 5 min)</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-2xl font-black">{membersOnline} <span className="text-base text-muted-foreground font-bold">members</span></p>
            <p className="text-xs text-muted-foreground">{guestsOnline} guests online</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-2xl font-black">{rows.length}</p>
            <p className="text-xs text-muted-foreground">Active in last 24h</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Every real visitor (member or guest) that loads the site shows here within ~1 minute. Location is an
          approximate city/country from the IP (no raw IP stored). Full anonymous totals live in Vercel Analytics.
        </p>

        {rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No visitors in the last 24 hours yet.</div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Visitor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">On page</th>
                  <th className="px-3 py-2 font-medium text-right">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const online = isOnline(r.lastSeenAt);
                  return (
                    <tr key={r.key} className="border-t border-border/50">
                      <td className="px-3 py-2">
                        {r.kind === "member" && r.slug ? (
                          <Link href={`/players/${r.slug}`} className="flex items-center gap-2 hover:text-primary">
                            <SmartAvatar type="player" id={r.id} name={r.name} className="h-7 w-7 shrink-0" fallbackClassName="text-[10px]" />
                            <span className="font-medium truncate">{r.name}</span>
                          </Link>
                        ) : (
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="h-7 w-7 shrink-0 rounded-full bg-muted grid place-items-center">
                              <UserRound className="w-4 h-4" />
                            </span>
                            <span>Guest <span className="text-[11px] opacity-60">#{r.id.slice(0, 4)}</span></span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs ${online ? "text-emerald-400" : "text-muted-foreground"}`}>
                          <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                          {online ? "Online" : "Idle"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.country || r.city ? (
                          <span className="inline-flex items-center gap-1.5">
                            {r.country && <CountryFlag value={r.country} className="text-base" />}
                            <span className="text-muted-foreground">{r.city ?? r.country}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">{r.path ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{timeAgo(r.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
