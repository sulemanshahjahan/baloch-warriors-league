import Image from "next/image";
import Link from "next/link";
import { statusLabel } from "@/lib/utils";
import type { LandingData } from "../data";
import { ArrowRightIcon, BallIcon, FlameIcon, TrophyIcon, UsersIcon } from "../icons";

export function Hero() {
  return (
    <section id="top" style={{ position: "relative", overflow: "hidden", isolation: "isolate" }}>
      <span
        data-atmo="ray"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-24%",
          left: "14%",
          width: 210,
          height: "150%",
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom,color-mix(in srgb, var(--flame) 26%, transparent),transparent 72%)",
          filter: "blur(46px)",
          animation: "bwl-ray 15s ease-in-out infinite",
        }}
      />
      <span
        data-atmo="ray"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-30%",
          left: "44%",
          width: 150,
          height: "150%",
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom,color-mix(in srgb, var(--color-accent) 22%, transparent),transparent 66%)",
          filter: "blur(54px)",
          animation: "bwl-ray 19s ease-in-out infinite reverse",
        }}
      />
      <span
        data-atmo="smoke"
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-14%",
          left: "-8%",
          width: "78%",
          height: "52%",
          pointerEvents: "none",
          background:
            "radial-gradient(60% 100% at 40% 100%, color-mix(in srgb, var(--crimson) 24%, transparent), transparent 68%)",
          filter: "blur(56px)",
          animation: "bwl-smoke 22s ease-in-out infinite",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1400,
          margin: "0 auto",
          padding:
            "clamp(56px,6.5vw,96px) clamp(20px,4vw,56px) clamp(52px,6vw,84px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))",
          gap: "clamp(32px,4vw,64px)",
          alignItems: "center",
          minHeight: "min(760px,74vh)",
        }}
      >
        <div style={{ maxWidth: 660 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 15,
              animation: "bwl-rise .8s cubic-bezier(.2,.7,.2,1) both",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 52,
                height: 1,
                flex: "none",
                background: "linear-gradient(to right,transparent,var(--color-accent))",
              }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 12.5,
                  letterSpacing: ".26em",
                  textTransform: "uppercase",
                  color: "var(--color-accent)",
                }}
              >
                Baloch Warriors League
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  letterSpacing: ".26em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
                }}
              >
                The home of champions
              </span>
            </span>
          </span>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(48px,8.4vw,126px)",
              lineHeight: 0.92,
              letterSpacing: "-.012em",
              textTransform: "uppercase",
              margin: "26px 0 0 -.03em",
            }}
          >
            <span
              style={{
                display: "block",
                color: "color-mix(in srgb, var(--color-text) 82%, transparent)",
                fontSize: ".44em",
                letterSpacing: ".13em",
                fontWeight: 600,
                animation: "bwl-rise .9s cubic-bezier(.2,.7,.2,1) both .08s",
              }}
            >
              Where
            </span>
            <span
              style={{
                display: "block",
                fontWeight: 800,
                fontSize: "1.02em",
                background:
                  "linear-gradient(100deg,var(--crimson) 0%,var(--color-accent-600) 20%,var(--color-accent) 36%,var(--flame) 46%,oklch(0.97 0.03 62) 50%,var(--flame) 54%,var(--color-accent) 64%,var(--color-accent-600) 80%,var(--crimson) 100%)",
                backgroundSize: "300% 100%",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                filter:
                  "drop-shadow(0 0 44px color-mix(in srgb, var(--color-accent) 34%, transparent))",
                animation:
                  "bwl-rise .9s cubic-bezier(.2,.7,.2,1) both .16s, bwl-sheen 7s linear infinite",
              }}
            >
              Warriors
            </span>
            <span
              style={{
                display: "block",
                color: "color-mix(in srgb, var(--color-text) 92%, transparent)",
                animation: "bwl-rise .9s cubic-bezier(.2,.7,.2,1) both .24s",
              }}
            >
              Compete
            </span>
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: "29px",
              maxWidth: "57ch",
              margin: "30px 0 0",
              color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
              animation: "bwl-rise .9s cubic-bezier(.2,.7,.2,1) both .32s",
            }}
          >
            The official home of BWL — tracking every tournament, match, goal, record and rivalry
            across eFootball, Football, PUBG, Snooker and Checkers.
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginTop: 34,
              animation: "bwl-rise .9s cubic-bezier(.2,.7,.2,1) both .4s",
            }}
          >
            <Link
              data-shine="1"
              data-hv="hero-primary"
              className="btn btn-primary"
              href="/tournaments"
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "15px 26px",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: ".11em",
                textTransform: "uppercase",
                borderColor: "var(--color-accent-600)",
                background:
                  "linear-gradient(160deg,color-mix(in srgb, var(--color-accent-800) 62%, transparent),transparent 78%)",
                transition:
                  "transform .34s cubic-bezier(.2,.7,.2,1), box-shadow .34s ease, border-color .34s ease",
              }}
            >
              <TrophyIcon size={17} />
              Explore Tournaments
            </Link>
            <Link
              data-hv="hero-secondary"
              className="btn btn-secondary"
              href="/matches"
              style={{
                padding: "15px 24px",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: ".11em",
                textTransform: "uppercase",
                transition:
                  "transform .34s cubic-bezier(.2,.7,.2,1), border-color .34s ease, background .34s ease",
              }}
            >
              View Live Results
            </Link>
          </div>
        </div>

        <div
          data-tilt-host="1"
          style={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            width: "100%",
            maxWidth: 560,
            justifySelf: "end",
            aspectRatio: "1/1",
            minHeight: 340,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "-6%",
              borderRadius: "50%",
              opacity: 0.42,
              background:
                "repeating-conic-gradient(from 0deg, transparent 0 1.1deg, color-mix(in srgb, var(--color-text) 30%, transparent) 1.1deg 1.45deg)",
              mask: "radial-gradient(circle, transparent 68%, black 71%, black 82%, transparent 86%)",
              WebkitMask:
                "radial-gradient(circle, transparent 68%, black 71%, black 82%, transparent 86%)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "4%",
              borderRadius: "50%",
              opacity: 0.34,
              background:
                "repeating-conic-gradient(from 2deg, transparent 0 2.2deg, color-mix(in srgb, var(--color-text) 24%, transparent) 2.2deg 2.9deg)",
              mask: "radial-gradient(circle, transparent 55%, black 58%, black 67%, transparent 71%)",
              WebkitMask:
                "radial-gradient(circle, transparent 55%, black 58%, black 67%, transparent 71%)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "-6%",
              borderRadius: "50%",
              opacity: 0.5,
              background:
                "repeating-conic-gradient(from -46deg, var(--flame) 0 0.5deg, transparent 0.5deg 7deg)",
              mask: "radial-gradient(circle, transparent 84%, black 86%, black 90%, transparent 93%)",
              WebkitMask:
                "radial-gradient(circle, transparent 84%, black 86%, black 90%, transparent 93%)",
              filter: "blur(.4px)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "-6%",
              borderRadius: "50%",
              pointerEvents: "none",
              background:
                "radial-gradient(circle, transparent 58%, color-mix(in srgb, var(--color-bg) 76%, transparent) 88%)",
            }}
          />
          <span
            data-atmo="spot"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-12%",
              left: "50%",
              width: "54%",
              height: "78%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              clipPath: "polygon(41% 0%, 59% 0%, 100% 100%, 0% 100%)",
              background:
                "linear-gradient(to bottom,color-mix(in srgb, var(--flame) 26%, transparent),color-mix(in srgb, var(--color-accent) 12%, transparent) 46%,transparent 82%)",
              filter: "blur(26px)",
              opacity: 0.6,
            }}
          />
          <span
            data-atmo="spot"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-10%",
              left: "50%",
              width: "26%",
              height: "56%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              clipPath: "polygon(44% 0%, 56% 0%, 100% 100%, 0% 100%)",
              background:
                "linear-gradient(to bottom,color-mix(in srgb, oklch(0.98 0.02 66) 34%, transparent),transparent 70%)",
              filter: "blur(11px)",
              opacity: 0.5,
              animation: "bwl-ember 13s ease-in-out infinite",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "82%",
              aspectRatio: "1",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 62%)",
              filter: "blur(20px)",
              animation: "bwl-bloom 9s ease-in-out infinite",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "6%",
              width: "70%",
              aspectRatio: "2.6/1",
              borderRadius: "50%",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, transparent), color-mix(in srgb, var(--color-bg) 92%, transparent))",
              boxShadow:
                "inset 0 2px 0 color-mix(in srgb, var(--color-text) 12%, transparent), inset 0 -22px 46px rgba(0,0,0,.7), 0 30px 70px rgba(0,0,0,.62)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "6%",
              width: "70%",
              aspectRatio: "2.6/1",
              borderRadius: "50%",
              background:
                "linear-gradient(96deg, color-mix(in srgb, var(--crimson) 44%, transparent), transparent 42%, transparent 60%, color-mix(in srgb, var(--flame) 36%, transparent))",
              opacity: 0.6,
              filter: "blur(3px)",
            }}
          />
          <span
            data-orbit="1"
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "96%",
              aspectRatio: "1",
              borderRadius: "50%",
              border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
              mask: "conic-gradient(from 20deg, black 0 24%, transparent 26% 50%, black 52% 76%, transparent 78%)",
              WebkitMask:
                "conic-gradient(from 20deg, black 0 24%, transparent 26% 50%, black 52% 76%, transparent 78%)",
              animation: "bwl-orbit 46s linear infinite",
            }}
          />
          <span
            data-orbit="1"
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "78%",
              aspectRatio: "1",
              borderRadius: "50%",
              border: "1px solid color-mix(in srgb, var(--flame) 20%, transparent)",
              mask: "conic-gradient(from 130deg, black 0 16%, transparent 18% 60%, black 62% 82%, transparent 84%)",
              WebkitMask:
                "conic-gradient(from 130deg, black 0 16%, transparent 18% 60%, black 62% 82%, transparent 84%)",
              animation: "bwl-orbit-rev 62s linear infinite",
            }}
          />
          <span
            data-atmo="smoke"
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "1%",
              left: "8%",
              width: "84%",
              height: "30%",
              pointerEvents: "none",
              background:
                "radial-gradient(58% 100% at 42% 100%, color-mix(in srgb, var(--crimson) 34%, transparent), transparent 70%)",
              filter: "blur(24px)",
              animation: "bwl-smoke 17s ease-in-out infinite",
            }}
          />
          <span
            data-particles="hero"
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              overflow: "hidden",
              borderRadius: "50%",
            }}
          />

          <span
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              paddingBottom: "12%",
            }}
          >
            <span
              style={{
                display: "block",
                width: "min(352px,68%)",
                animation: "bwl-float 10s ease-in-out infinite",
              }}
            >
              <Image
                data-tilt="8"
                src="/logo.png"
                alt="Baloch Warriors League crest"
                width={352}
                height={352}
                priority
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  filter: "drop-shadow(0 22px 42px rgba(0,0,0,.68))",
                  transition: "transform .5s cubic-bezier(.2,.7,.2,1)",
                }}
              />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              style={{
                display: "block",
                width: "min(352px,68%)",
                height: "auto",
                marginTop: "-7%",
                transform: "scaleY(-1)",
                opacity: 0.2,
                mask: "linear-gradient(to top, transparent 8%, black 92%)",
                WebkitMask: "linear-gradient(to top, transparent 8%, black 92%)",
                filter: "blur(1px)",
              }}
            />
          </span>

          <span
            style={{
              position: "absolute",
              bottom: "-2%",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                letterSpacing: ".24em",
                textTransform: "uppercase",
                color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
              }}
            >
              Est. Baloch Warriors League
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 14,
                letterSpacing: ".2em",
                textTransform: "uppercase",
                color: "var(--gold)",
              }}
            >
              Compete · Conquer · Become Legend
            </span>
          </span>
        </div>
      </div>

      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 180,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-bg) 78%, transparent) 62%, var(--color-bg))",
        }}
      />
    </section>
  );
}

const divider = (
  <span
    data-live-rule="1"
    aria-hidden="true"
    style={{ width: 1, height: 22, flex: "none", background: "var(--color-divider)" }}
  />
);

/** Live strip: which competition is running, who holds the crown, latest score. */
export function LiveStatus({
  headline,
  champion,
  latest,
}: {
  headline: LandingData["headline"];
  champion: LandingData["champion"];
  latest: LandingData["results"][number] | undefined;
}) {
  if (!headline && !champion && !latest) return null;

  return (
    <section
      aria-label="Live league status"
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1400,
        margin: "0 auto",
        padding: "0 clamp(20px,4vw,56px)",
      }}
    >
      <div
        data-reveal="1"
        data-live-strip="1"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(14px,2vw,26px)",
          flexWrap: "wrap",
          padding: "15px clamp(16px,2vw,24px)",
          borderRadius: 13,
          border: "1px solid color-mix(in srgb, var(--color-divider) 84%, transparent)",
          background:
            "linear-gradient(100deg, color-mix(in srgb, var(--crimson-deep) 52%, transparent), color-mix(in srgb, var(--color-surface) 54%, transparent) 46%, transparent 88%)",
          boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--color-text) 8%, transparent)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            flex: "none",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 13.5,
            letterSpacing: ".19em",
            textTransform: "uppercase",
            color: "var(--color-accent-300)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--color-accent)",
              animation: "bwl-live 2.4s ease-out infinite",
            }}
          />
          Live
        </span>

        {headline && (
          <>
            {divider}
            <span
              style={{
                fontSize: 15.5,
                color: "color-mix(in srgb, var(--color-text) 88%, transparent)",
              }}
            >
              {headline.tournamentName}{" "}
              <span style={{ color: "color-mix(in srgb, var(--color-text) 64%, transparent)" }}>
                — {statusLabel(headline.status)}
              </span>
            </span>
          </>
        )}

        {champion && (
          <>
            {divider}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15.5 }}>
              <span
                style={{
                  fontSize: 11.5,
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                }}
              >
                Champion
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  letterSpacing: ".02em",
                  fontSize: 16,
                }}
              >
                {champion.winnerName}
              </span>
            </span>
          </>
        )}

        {headline && headline.activePlayers > 0 && (
          <>
            {divider}
            <span
              style={{
                fontSize: 15.5,
                fontFeatureSettings: "'tnum' 1",
                color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
              }}
            >
              {headline.activePlayers} active players
            </span>
          </>
        )}

        {latest && (
          <>
            {divider}
            <span
              style={{
                fontSize: 15.5,
                fontFeatureSettings: "'tnum' 1",
                color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
              }}
            >
              Latest: {latest.home.name}{" "}
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                {latest.homeScore}–{latest.awayScore}
              </span>{" "}
              {latest.away.name}
            </span>
          </>
        )}

        <Link
          data-arrow="1"
          href={headline ? `/tournaments/${headline.tournamentSlug}` : "/tournaments"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
            flex: "none",
            fontSize: 14.5,
            letterSpacing: ".03em",
            whiteSpace: "nowrap",
          }}
        >
          View tournament
          <ArrowRightIcon
            size={14}
            style={{ transition: "transform .32s cubic-bezier(.2,.7,.2,1)" }}
          />
        </Link>
      </div>
    </section>
  );
}

const bigNumber: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "clamp(42px,4.4vw,68px)",
  lineHeight: 1,
  margin: "14px 0 0 -.02em",
  fontFeatureSettings: "'tnum' 1",
};

const numberLabel: React.CSSProperties = {
  fontSize: 12.5,
  letterSpacing: ".2em",
  textTransform: "uppercase",
  margin: "14px 0 0",
  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
};

/** "BWL by the numbers" band — league totals plus three headline records. */
export function Numbers({
  stats,
  champion,
  leaders,
}: {
  stats: LandingData["stats"];
  champion: LandingData["champion"];
  leaders: LandingData["leaders"];
}) {
  if (!stats) return null;

  const cells = [
    { icon: <TrophyIcon size={19} strokeWidth={16} />, value: stats.tournaments, label: "Tournaments" },
    { icon: <UsersIcon size={19} strokeWidth={16} />, value: stats.players, label: "Players" },
    { icon: <BallIcon size={19} strokeWidth={16} />, value: stats.matches, label: "Matches played" },
    { icon: <FlameIcon size={19} strokeWidth={16} />, value: stats.goals, label: "Goals scored" },
  ];

  const elo = leaders.find((l) => l.key === "elo");
  const winRate = leaders.find((l) => l.key === "winRate");
  const records = [
    champion && { label: "Current champion", value: champion.winnerName, gold: true },
    elo && { label: "Highest ELO", value: String(elo.value), gold: false },
    winRate && { label: "Best win rate", value: `${winRate.value}%`, gold: false },
  ].filter(Boolean) as { label: string; value: string; gold: boolean }[];

  return (
    <section
      aria-label="BWL by the numbers"
      style={{
        position: "relative",
        zIndex: 1,
        marginTop: "clamp(40px,5vw,72px)",
        overflow: "hidden",
        background:
          "radial-gradient(1000px 460px at 84% -60%, color-mix(in srgb, var(--color-section-glow) 70%, transparent), transparent 66%), linear-gradient(172deg, color-mix(in srgb, var(--color-section) 96%, transparent), color-mix(in srgb, var(--crimson-deep) 88%, transparent))",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          height: 1,
          background:
            "linear-gradient(to right,transparent,color-mix(in srgb, var(--gold) 55%, transparent) 20%,var(--gold) 50%,color-mix(in srgb, var(--gold) 55%, transparent) 80%,transparent)",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(to right, color-mix(in srgb, var(--color-text) 30%, transparent) 1px, transparent 1px),linear-gradient(to bottom, color-mix(in srgb, var(--color-text) 30%, transparent) 1px, transparent 1px)",
          backgroundSize: "66px 66px",
          mask: "radial-gradient(120% 90% at 50% 0%, black, transparent 76%)",
          WebkitMask: "radial-gradient(120% 90% at 50% 0%, black, transparent 76%)",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(178deg, color-mix(in srgb, var(--flame) 10%, transparent), transparent 34%)",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1400,
          margin: "0 auto",
          padding: "clamp(40px,4.6vw,64px) clamp(20px,4vw,56px)",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "32px 0",
          }}
          data-numbers-grid="1"
        >
          {cells.map((cell, i) => (
            <div
              key={cell.label}
              data-reveal="1"
              data-delay={i === 0 ? undefined : String(i * 70)}
            >
              <span
                aria-hidden="true"
                style={{ display: "block", color: "var(--flame)", opacity: 0.8 }}
              >
                {cell.icon}
              </span>
              <p data-count={String(cell.value)} style={bigNumber}>
                {cell.value.toLocaleString("en-US")}
              </p>
              <p style={numberLabel}>{cell.label}</p>
            </div>
          ))}
        </div>

        {records.length > 0 && (
          <>
            <div
              style={{
                height: 1,
                margin: "clamp(30px,3.4vw,44px) 0 0",
                background:
                  "linear-gradient(to right,transparent,color-mix(in srgb, var(--color-text) 16%, transparent) 6%,color-mix(in srgb, var(--color-text) 16%, transparent) 94%,transparent)",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "clamp(20px,3vw,52px)",
                flexWrap: "wrap",
                paddingTop: "clamp(20px,2.4vw,28px)",
              }}
            >
              {records.map((r, i) => (
                <span
                  key={r.label}
                  data-reveal="1"
                  data-delay={i === 0 ? undefined : String(i * 60)}
                  style={{ display: "flex", alignItems: "baseline", gap: 11 }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      letterSpacing: ".2em",
                      textTransform: "uppercase",
                      color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
                    }}
                  >
                    {r.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: 19,
                      letterSpacing: r.gold ? ".02em" : undefined,
                      fontFeatureSettings: r.gold ? undefined : "'tnum' 1",
                      color: r.gold ? "var(--gold)" : undefined,
                    }}
                  >
                    {r.value}
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
