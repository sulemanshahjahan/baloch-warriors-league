export const dynamic = "force-dynamic";

import { Coins } from "lucide-react";
import { getPlayerSession } from "@/lib/player-session";
import { prisma } from "@/lib/db";
import { StoreGrid, type StoreViewer } from "./store-grid";

export const metadata = {
  title: "BWL Store — Spend your coins",
  description: "Profile frames, name colors and banners earned with BWL coins.",
};

export default async function StorePage() {
  const session = await getPlayerSession();
  let me: StoreViewer | null = null;
  if (session) {
    const [player, inventory, equipped] = await Promise.all([
      prisma.player.findUnique({ where: { id: session.playerId }, select: { coins: true, legacyLevel: true } }),
      prisma.playerInventoryItem.findMany({ where: { playerId: session.playerId }, select: { itemKey: true } }),
      prisma.playerEquippedCosmetics.findUnique({ where: { playerId: session.playerId } }),
    ]);
    if (player) {
      me = {
        coins: player.coins,
        level: player.legacyLevel,
        owned: inventory.map((i) => i.itemKey),
        equipped: { profileFrame: equipped?.profileFrame ?? null, nameColor: equipped?.nameColor ?? null, profileBanner: equipped?.profileBanner ?? null },
      };
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2"><Coins className="w-7 h-7 text-amber-300" /> BWL Store</h1>
          <p className="text-muted-foreground mt-1">Earn coins by playing — then style your profile. Status only, never pay-to-win.</p>
        </div>
        {me && <span className="text-lg font-bold text-amber-300 flex items-center gap-1.5"><Coins className="w-5 h-5" />{me.coins.toLocaleString()}</span>}
      </div>
      <StoreGrid me={me} />
    </div>
  );
}
