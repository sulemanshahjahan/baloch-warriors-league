import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const runtime = "edge";

export const alt = "BWL Match Result";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      tournament: { select: { name: true, gameCategory: true } },
      homeTeam: { select: { name: true, shortName: true } },
      awayTeam: { select: { name: true, shortName: true } },
      homePlayer: { select: { name: true } },
      awayPlayer: { select: { name: true } },
    },
  });

  if (!match) {
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 48,
            background: "linear-gradient(to bottom, #0f0f0f, #1a1a1a)",
            color: "white",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui",
          }}
        >
          <div style={{ color: "#ef4444", fontSize: 64, fontWeight: 800 }}>
            BWL
          </div>
          <div style={{ color: "#888", fontSize: 32, marginTop: 16 }}>
            Match Not Found
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const homeName = match.homePlayer?.name ?? match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBD";
  const showScore = match.status === "COMPLETED" || match.status === "LIVE";
  const scoreText = showScore ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}` : "vs";

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
        {/* Background pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 30% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 70% 80%, rgba(239, 68, 68, 0.08) 0%, transparent 50%)",
          }}
        />

        {/* Tournament name */}
        <div
          style={{
            fontSize: 28,
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: 4,
            marginBottom: 40,
            fontWeight: 600,
          }}
        >
          {match.tournament.name}
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 60,
            width: "100%",
          }}
        >
          {/* Home team */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              {homeName}
            </div>
          </div>

          {/* Score */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "0 40px",
            }}
          >
            <div
              style={{
                fontSize: 120,
                fontWeight: 900,
                fontFamily: "monospace",
                letterSpacing: -4,
                background: "linear-gradient(to bottom, #fff, #ccc)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {scoreText}
            </div>
          </div>

          {/* Away team */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              {awayName}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 50,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            B
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
            BWL
          </div>
          <div style={{ fontSize: 20, color: "#666" }}>
            bwlleague.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
