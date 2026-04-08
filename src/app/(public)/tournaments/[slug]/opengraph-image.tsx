import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const alt = "BWL Tournament";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const GAME_ICONS: Record<string, string> = {
  FOOTBALL: "⚽",
  EFOOTBALL: "🎮",
  PUBG: "🔫",
  SNOOKER: "🎱",
  CHECKERS: "♟️",
};

export default async function Image({ params }: { params: { slug: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      gameCategory: true,
      format: true,
      status: true,
      _count: { select: { teams: true, players: true, matches: true } },
    },
  });

  const name = tournament?.name ?? "Tournament Not Found";
  const icon = GAME_ICONS[tournament?.gameCategory ?? ""] ?? "🏆";
  const participants = (tournament?._count.teams ?? 0) + (tournament?._count.players ?? 0);
  const matches = tournament?._count.matches ?? 0;
  const status = tournament?.status ?? "";
  const format = (tournament?.format ?? "").replace("_", " ");

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
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 40%, rgba(239, 68, 68, 0.1) 0%, transparent 60%)" }} />

        {/* Game icon */}
        <div style={{ fontSize: 72, marginBottom: 16 }}>{icon}</div>

        {/* Name */}
        <div style={{ fontSize: 56, fontWeight: 900, textAlign: "center", lineHeight: 1.1, maxWidth: 900 }}>
          {name}
        </div>

        {/* Meta */}
        <div style={{ display: "flex", gap: 16, marginTop: 24, fontSize: 24, color: "#aaa" }}>
          {format && <span style={{ textTransform: "capitalize" }}>{format}</span>}
          {status && (
            <span style={{
              padding: "4px 16px",
              borderRadius: 20,
              background: status === "ACTIVE" ? "rgba(34, 197, 94, 0.2)" : status === "COMPLETED" ? "rgba(107, 114, 128, 0.2)" : "rgba(59, 130, 246, 0.2)",
              color: status === "ACTIVE" ? "#22c55e" : status === "COMPLETED" ? "#9ca3af" : "#3b82f6",
              fontSize: 20,
              fontWeight: 600,
            }}>
              {status}
            </span>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 60, marginTop: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 800 }}>{participants}</div>
            <div style={{ fontSize: 18, color: "#888" }}>Participants</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 800 }}>{matches}</div>
            <div style={{ fontSize: 18, color: "#888" }}>Matches</div>
          </div>
        </div>

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
