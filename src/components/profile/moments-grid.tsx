import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Moment {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  rarity: string;
}

const RARITY: Record<string, string> = {
  COMMON: "border-zinc-500/30 bg-zinc-500/5",
  RARE: "border-sky-500/40 bg-sky-500/5",
  EPIC: "border-violet-500/40 bg-violet-500/5",
  LEGENDARY: "border-yellow-400/50 bg-yellow-400/5 shadow-[0_0_16px_rgba(250,204,21,0.15)]",
};
const RARITY_TEXT: Record<string, string> = {
  COMMON: "text-zinc-400",
  RARE: "text-sky-400",
  EPIC: "text-violet-400",
  LEGENDARY: "text-yellow-300",
};

export function MomentsGrid({ moments }: { moments: Moment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          BWL Moments {moments.length > 0 && <span className="text-muted-foreground font-normal">({moments.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {moments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No moments yet. Win matches, keep clean sheets and lift trophies to create your first BWL Moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {moments.map((m) => (
              <div key={m.id} className={`rounded-xl border p-3 flex items-start gap-3 ${RARITY[m.rarity] ?? RARITY.COMMON}`}>
                <div className="text-2xl shrink-0">{m.icon ?? "🏅"}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${RARITY_TEXT[m.rarity] ?? RARITY_TEXT.COMMON}`}>
                    {m.rarity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
