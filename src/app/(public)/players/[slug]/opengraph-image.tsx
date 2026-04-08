import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const alt = "BWL Player Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: { slug: string } }) {
  const player = await prisma.player.findUnique({
    where: { slug: params.slug },
    select: { name: true, nickname: true, position: true, nationality: true },
  });

  const events = player
    ? await prisma.matchEvent.groupBy({
        by: ["type"],
        where: { playerId: (await prisma.player.findUnique({ where: { slug: params.slug }, select: { id: true } }))?.id },
        _count: { type: true },
      })
    : [];

  const statsMap: Record<string, number> = {};
  for (const e of events) statsMap[e.type] = e._count.type;

  const name = player?.name ?? "Player Not Found";
  const goals = statsMap["GOAL"] ?? 0;
  const assists = statsMap["ASSIST"] ?? 0;
  const motm = statsMap["MOTM"] ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)",
          color: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 60,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%, rgba(239, 68, 68, 0.12) 0%, transparent 60%)" }} />

        {/* Player initials circle */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            background: "linear-gradient(135deg, #dc2626, #991b1b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 800,
            marginBottom: 24,
          }}
        >
          {name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>

        {/* Name */}
        <div style={{ fontSize: 64, fontWeight: 900, textAlign: "center", lineHeight: 1.1 }}>
          {name}
        </div>

        {player?.nickname && (
          <div style={{ fontSize: 28, color: "#888", marginTop: 8 }}>
            &quot;{player.nickname}&quot;
          </div>
        )}

        {/* Meta */}
        <div style={{ display: "flex", gap: 24, marginTop: 16, fontSize: 22, color: "#aaa" }}>
          {player?.position && <span>{player.position}</span>}
          {player?.nationality && <span>· {player.nationality}</span>}
        </div>

        {/* Stats */}
        {(goals > 0 || assists > 0 || motm > 0) && (
          <div style={{ display: "flex", gap: 48, marginTop: 40 }}>
            {goals > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 800 }}>{goals}</div>
                <div style={{ fontSize: 18, color: "#888" }}>Goals</div>
              </div>
            )}
            {assists > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 800 }}>{assists}</div>
                <div style={{ fontSize: 18, color: "#888" }}>Assists</div>
              </div>
            )}
            {motm > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 800 }}>{motm}</div>
                <div style={{ fontSize: 18, color: "#888" }}>MOTM</div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ position: "absolute", bottom: 40, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #ef4444, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>B</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>BWL</div>
          <div style={{ fontSize: 18, color: "#666" }}>Baloch Warriors League</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
