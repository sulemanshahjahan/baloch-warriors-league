import { STORE_ITEMS, RARITY_BORDER, type StoreItem } from "@/lib/cosmetics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Frame, Palette, Image as ImageIcon } from "lucide-react";

export const metadata = {
  title: "BWL Store — Spend your coins",
  description: "Profile frames, name colors and banners earned with BWL coins.",
};

const GROUPS: { type: StoreItem["type"]; label: string; icon: React.ReactNode }[] = [
  { type: "PROFILE_FRAME", label: "Profile Frames", icon: <Frame className="w-4 h-4 text-amber-300" /> },
  { type: "NAME_COLOR", label: "Name Colors", icon: <Palette className="w-4 h-4 text-fuchsia-300" /> },
  { type: "PROFILE_BANNER", label: "Profile Banners", icon: <ImageIcon className="w-4 h-4 text-sky-300" /> },
];

export default function StorePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black flex items-center gap-2"><Coins className="w-7 h-7 text-amber-300" /> BWL Store</h1>
        <p className="text-muted-foreground mt-1">Earn coins by playing, winning and completing contracts — then style your profile. Status only, never pay-to-win.</p>
      </div>

      {GROUPS.map((g) => {
        const items = STORE_ITEMS.filter((i) => i.type === g.type);
        return (
          <Card key={g.type}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">{g.icon} {g.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((item) => (
                  <div key={item.key} className={`rounded-xl border p-3 ${RARITY_BORDER[item.rarity]}`}>
                    {/* Preview */}
                    <div className="h-16 rounded-lg mb-2 flex items-center justify-center bg-muted/40 overflow-hidden">
                      {item.type === "NAME_COLOR" ? (
                        <span className={`text-lg font-black ${item.css}`}>Aa</span>
                      ) : item.type === "PROFILE_BANNER" ? (
                        <div className={`w-full h-full ${item.css}`} />
                      ) : (
                        <div className={`h-10 w-10 rounded-full bg-zinc-700 ${item.css}`} />
                      )}
                    </div>
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1"><Coins className="w-3 h-3" />{item.cost.toLocaleString()}</span>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{item.rarity}</span>
                    </div>
                    {(item.minLevel || item.minRespect) && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {item.minLevel ? `Lvl ${item.minLevel}+` : ""}{item.minLevel && item.minRespect ? " · " : ""}{item.minRespect ? `Respect ${item.minRespect}+` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
