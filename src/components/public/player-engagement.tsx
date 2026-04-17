import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Flame, Shield, TrendingUp } from "lucide-react";
import type { PlayerBadge } from "@/lib/badges";
import type { PlayerTitle } from "@/lib/titles";
import type { PlayerStreaks } from "@/lib/streaks";

interface Props {
  badges: PlayerBadge[];
  titles: PlayerTitle[];
  streaks: PlayerStreaks;
}

export function PlayerEngagement({ badges, titles, streaks }: Props) {
  return (
    <>
      {/* Titles — exclusive, shown prominently */}
      {titles.length > 0 && (
        <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-400" />
              Titles Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {titles.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${t.color}`}
                  title={t.description}
                >
                  <span className="text-lg">{t.icon}</span>
                  <div>
                    <div className="text-sm font-bold">{t.name}</div>
                    <div className="text-[10px] opacity-80">{t.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streaks & Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            Form & Streaks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {streaks.form && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Last 5 results (newest first)</p>
              <div className="flex gap-1.5">
                {streaks.form.split("").map((r, i) => {
                  const color =
                    r === "W"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : r === "D"
                      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30";
                  return (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded border flex items-center justify-center text-xs font-bold ${color}`}
                    >
                      {r}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StreakStat
              icon={<Flame className="w-3 h-3 text-orange-400" />}
              label="Current Win Streak"
              value={streaks.currentWinStreak}
              highlight={streaks.isHot}
            />
            <StreakStat
              icon={<Flame className="w-3 h-3 text-yellow-400" />}
              label="Longest Win Streak"
              value={streaks.longestWinStreak}
            />
            <StreakStat
              icon={<Shield className="w-3 h-3 text-cyan-400" />}
              label="Longest Unbeaten"
              value={streaks.longestUnbeatenStreak}
            />
            <StreakStat
              icon={<Shield className="w-3 h-3 text-slate-400" />}
              label="Clean Sheet Streak"
              value={streaks.longestCleanSheetStreak}
            />
          </div>

          {(streaks.isHot || streaks.isCold) && (
            <div
              className={`text-xs px-3 py-2 rounded-lg ${
                streaks.isHot
                  ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}
            >
              {streaks.isHot
                ? `🔥 On fire — ${streaks.currentWinStreak} wins in a row`
                : `🥶 Cold streak — ${streaks.currentLossStreak} losses in a row`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badges */}
      {badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Badges ({badges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${b.color}`}
                  title={b.description}
                >
                  <span className="text-lg shrink-0">{b.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{b.name}</div>
                    <div className="text-[10px] opacity-80 truncate">{b.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function StreakStat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg text-center ${
        highlight ? "bg-orange-500/10 border border-orange-500/30" : "bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</div>
    </div>
  );
}
