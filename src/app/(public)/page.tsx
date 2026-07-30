import type { Metadata } from "next";

import "@/components/public/home/landing.css";
import { getLandingData } from "@/components/public/home/data";
import { LandingMotion } from "@/components/public/home/landing-motion";
import { SiteHeader } from "@/components/public/home/site-header";
import { SiteFooter } from "@/components/public/home/site-footer";
import { Hero, LiveStatus, Numbers } from "@/components/public/home/sections/hero";
import { Champion, Honours } from "@/components/public/home/sections/champion";
import { PlayerOfWeek } from "@/components/public/home/sections/player-of-week";
import { SeasonLeaders } from "@/components/public/home/sections/leaders";
import { Tournaments } from "@/components/public/home/sections/tournaments";
import { Managers } from "@/components/public/home/sections/managers";
import { ResultsBoard } from "@/components/public/home/sections/results";
import { LatestNews } from "@/components/public/home/sections/news";
import { GetApp } from "@/components/public/home/sections/get-app";

export const revalidate = 300; // 5 minutes

const DESCRIPTION =
  "The official home of the Baloch Warriors League — live tournaments, results, rankings, player ratings and records across eFootball, Football, PUBG, Snooker and Checkers.";

// Same origin the rest of the app resolves absolute links against.
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://bwlleague.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  // Absolute so the homepage isn't suffixed by the root "%s | BWL" template.
  title: { absolute: "Baloch Warriors League — Where Warriors Compete" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Baloch Warriors League — Where Warriors Compete",
    description: DESCRIPTION,
    type: "website",
    url: "/",
    siteName: "Baloch Warriors League",
    images: [{ url: "/logo.png", width: 300, height: 356, alt: "Baloch Warriors League crest" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Baloch Warriors League — Where Warriors Compete",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
};

export default async function HomePage() {
  const data = await getLandingData();

  return (
    <div
      id="bwl2"
      className="bwl2"
      style={{
        position: "relative",
        fontFamily: "var(--font-body)",
        color: "var(--color-text)",
        fontSize: 16,
        lineHeight: 1.6,
        overflowX: "clip",
        background:
          "radial-gradient(1300px 820px at 82% -240px, color-mix(in srgb, var(--color-accent-900) 88%, transparent), transparent 62%),radial-gradient(1000px 900px at -10% 42%, color-mix(in srgb, var(--crimson-deep) 34%, transparent), transparent 58%),radial-gradient(1100px 780px at 108% 88%, color-mix(in srgb, var(--color-accent-900) 52%, transparent), transparent 60%),var(--color-bg)",
      }}
    >
      <LandingMotion />

      <span
        data-atmo="grain"
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          mixBlendMode: "overlay",
          opacity: 0.05,
          backgroundImage:
            "url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxODAnIGhlaWdodD0nMTgwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC45JyBudW1PY3RhdmVzPSczJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9JzE4MCcgaGVpZ2h0PScxODAnIGZpbHRlcj0ndXJsKCNuKScvPjwvc3ZnPg==\")",
        }}
      />
      <span
        data-scroll-lighting="1"
        aria-hidden="true"
        style={{
          position: "fixed",
          top: "-16%",
          right: "-10%",
          width: "min(1000px,78vw)",
          height: "74vh",
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 62% 34%, color-mix(in srgb, var(--color-accent) 15%, transparent), transparent 64%)",
          filter: "blur(28px)",
          willChange: "transform",
        }}
      />

      <SiteHeader />

      <main>
        <Hero />
        <LiveStatus
          headline={data.headline}
          champion={data.champion}
          latest={data.results[0]}
        />
        <Numbers stats={data.stats} champion={data.champion} leaders={data.leaders} />
        <Champion champion={data.champion} />
        <Honours champion={data.champion} />
        <PlayerOfWeek potw={data.playerOfWeek} />
        <SeasonLeaders leaders={data.leaders} />
        <Tournaments tournaments={data.tournaments} />
        <Managers managers={data.managers} />
        <ResultsBoard
          results={data.results}
          fixtures={data.fixtures}
          champion={data.champion}
        />
        <LatestNews news={data.news} />
        <GetApp champion={data.champion} results={data.results} leaders={data.leaders} />
      </main>

      <SiteFooter />
    </div>
  );
}
