export const revalidate = 300;

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartAvatar } from "@/components/public/smart-avatar";
import { Sparkles, Coins, Trophy, Crown, Star } from "lucide-react";

export const metadata = {
  title: "BWL Legacy — Leaderboards & Hall of Fame",
  description: "Legacy XP, coins and the all-time BWL records.",
};

function RankRow({ i, id, name, slug, value, suffix }: { i: number; id: string; name: string; slug: string; value: string | number; suffix?: string }) {
  return (
    <Link href={`/players/${slug}`} className="flex items-center gap-3 py-2 px-1 hover:bg-muted/40 rounded-lg transition-colors">
      <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
      <SmartAvatar type="player" id={id} name={name} className="h-8 w-8 shrink-0" fallbackClassName="text-[10px]" />
      <span className="flex-1 font-medium text-sm truncate">{name}</span>
      <span className="text-sm font-bold shrink-0">{value}{suffix && <span className="text-muted-foreground font-normal text-xs ml-1">{suffix}</span>}</span>
    </Link>
  );
}

export default async function LegacyPage() {
  const [topLegacy, topCoins, mostTitles, highestElo, highestCard, mostWins] = await Promise.all([
    prisma.player.findMany({ where: { isActive: true }, orderBy: { legacyXp: "desc" }, take: 15, select: { id: true, name: true, slug: true, legacyLevel: true, legacyTier: true, legacyXp: true } }),
    prisma.player.findMany({ where: { isActive: true }, orderBy: { coins: "desc" }, take: 10, select: { id: true, name: true, slug: true, coins: true } }),
    prisma.award.groupBy({ by: ["playerId"], where: { type: "TOURNAMENT_WINNER", playerId: { not: null } }, _count: { playerId: true }, orderBy: { _count: { playerId: "desc" } }, take: 1 }),
    prisma.player.findFirst({ where: { isActive: true }, orderBy: { eloRating: "desc" }, select: { id: true, name: true, slug: true, eloRating: true } }),
    prisma.player.findFirst({ where: { isActive: true }, orderBy: { cardRank: "desc" }, select: { id: true, name: true, slug: true, cardRank: true } }),
    prisma.player.findFirst({ where: { isActive: true }, orderBy: { legacyXp: "desc" }, select: { id: true, name: true, slug: true, legacyLevel: true } }),
  ]);

  const titleLeader = mostTitles[0]?.playerId
    ? await prisma.player.findUnique({ where: { id: mostTitles[0].playerId }, select: { id: true, name: true, slug: true } })
    : null;

  const records: { icon: React.ReactNode; label: string; player: { id: string; name: string; slug: string } | null; value: string }[] = [
    { icon: <Crown className="w-5 h-5 text-yellow-400" />, label: "Highest Legacy Level", player: mostWins, value: mostWins ? `Lvl ${mostWins.legacyLevel}` : "—" },
    { icon: <Trophy className="w-5 h-5 text-yellow-400" />, label: "Highest ELO", player: highestElo, value: highestElo ? `${highestElo.eloRating}` : "—" },
    { icon: <Star className="w-5 h-5 text-amber-300" />, label: "Highest Card Rank", player: highestCard, value: highestCard ? `${highestCard.cardRank}` : "—" },
    { icon: <Trophy className="w-5 h-5 text-emerald-400" />, label: "Most Tournament Wins", player: titleLeader, value: titleLeader ? `${mostTitles[0]._count.playerId}` : "—" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black flex items-center gap-2"><Sparkles className="w-7 h-7 text-amber-400" /> BWL Legacy</h1>
        <p className="text-muted-foreground mt-1">Lifetime XP, coins, and the all-time records.</p>
      </div>

      {/* Hall of Fame */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-400" /> Hall of Fame — All-Time Records</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {records.map((r) => (
              <div key={r.label} className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 flex items-center gap-3">
                {r.icon}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  {r.player ? (
                    <Link href={`/players/${r.player.slug}`} className="font-semibold text-sm hover:text-primary truncate block">{r.player.name}</Link>
                  ) : <p className="text-sm">—</p>}
                </div>
                <span className="font-black text-lg">{r.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Legacy XP</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {topLegacy.map((p, i) => <RankRow key={p.id} i={i} id={p.id} name={p.name} slug={p.slug} value={`Lvl ${p.legacyLevel}`} suffix={p.legacyTier} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Coins className="w-4 h-4 text-amber-300" /> Richest</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {topCoins.map((p, i) => <RankRow key={p.id} i={i} id={p.id} name={p.name} slug={p.slug} value={p.coins.toLocaleString()} suffix="🪙" />)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
