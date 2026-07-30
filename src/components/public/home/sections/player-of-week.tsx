import Link from "next/link";
import { avatarSrc, type PlayerOfWeekData } from "../data";
import { ArrowRightIcon } from "../icons";

const metric: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5 };
const metricLabel: React.CSSProperties = {
  fontSize: 11.5,
  letterSpacing: ".19em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
};
const metricValue: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 24,
};

function Rule() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 34, background: "var(--color-divider)" }}
    />
  );
}

export function PlayerOfWeek({ potw }: { potw: PlayerOfWeekData | null }) {
  if (!potw) return null;

  const trendUp = potw.eloGained >= 0;

  return (
    <section
      aria-label="Player of the week"
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1400,
        margin: "0 auto",
        padding: "0 clamp(20px,4vw,56px)",
      }}
    >
      <Link
        data-reveal="1"
        data-lift="1"
        data-spotlight="1"
        href={`/players/${potw.slug}`}
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: "clamp(18px,3vw,36px)",
          flexWrap: "wrap",
          padding: "26px clamp(20px,3vw,32px)",
          borderRadius: 16,
          border: "1px solid color-mix(in srgb, var(--color-accent-700) 78%, transparent)",
          color: "inherit",
          background:
            "linear-gradient(102deg, color-mix(in srgb, var(--crimson-deep) 78%, transparent), color-mix(in srgb, var(--color-accent-900) 52%, transparent) 46%, transparent 90%)",
          boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--flame) 16%, transparent)",
          transition:
            "transform .4s cubic-bezier(.2,.7,.2,1), box-shadow .4s ease, border-color .4s ease",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc("player", potw.id, 256)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{
            position: "absolute",
            top: "-38%",
            right: "2%",
            width: 280,
            height: 280,
            pointerEvents: "none",
            borderRadius: "50%",
            objectFit: "cover",
            opacity: 0.07,
            filter: "grayscale(1) blur(1px)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(500px 240px at 8% 120%, color-mix(in srgb, var(--color-accent) 13%, transparent), transparent 70%)",
          }}
        />

        <span style={{ position: "relative", flex: "none" }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: -7,
              borderRadius: "50%",
              border: "1px solid color-mix(in srgb, var(--color-accent) 52%, transparent)",
              animation: "bwl-ember 6s ease-in-out infinite",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc("player", potw.id, 128)}
            alt=""
            loading="lazy"
            decoding="async"
            width={78}
            height={78}
            style={{
              display: "block",
              width: 78,
              height: 78,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--color-accent-600)",
            }}
          />
        </span>

        <span style={{ position: "relative", minWidth: 0 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 12.5,
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: "var(--color-accent-300)",
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 26, height: 1, background: "var(--color-accent)" }}
            />
            Player of the week
          </span>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 34,
              letterSpacing: ".01em",
              textTransform: "uppercase",
              marginTop: 8,
              overflowWrap: "anywhere",
            }}
          >
            {potw.name}
          </span>
        </span>

        <span
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "clamp(14px,2vw,26px)",
            marginLeft: "auto",
            flex: "1 1 460px",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          <span style={metric}>
            <span style={metricLabel}>Goals</span>
            <span style={metricValue}>{potw.goals}</span>
          </span>
          <Rule />
          <span style={metric}>
            <span style={metricLabel}>Wins</span>
            <span style={metricValue}>{potw.wins}</span>
          </span>
          <Rule />
          <span style={metric}>
            <span style={metricLabel}>Matches</span>
            <span style={metricValue}>{potw.matchesPlayed}</span>
          </span>
          <Rule />
          <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={metricLabel}>ELO this week</span>
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <svg
                viewBox="0 0 64 24"
                fill="none"
                aria-hidden="true"
                style={{ width: 56, height: 22, overflow: "visible" }}
              >
                <path
                  d={trendUp ? "M2 21L16 15L30 17L46 7L60 3" : "M2 3L16 9L30 7L46 17L60 21"}
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={trendUp ? "M52 3h9v9" : "M52 21h9v-9"}
                  stroke="var(--flame)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 20,
                  color: "var(--color-accent-300)",
                }}
              >
                {trendUp ? "+" : ""}
                {potw.eloGained}
              </span>
            </span>
          </span>
          <Rule />
          <span style={metric}>
            <span style={metricLabel}>Goals / match</span>
            <span style={metricValue}>{potw.goalsPerMatch}</span>
          </span>
          {potw.eloRank != null && (
            <>
              <Rule />
              <span style={metric}>
                <span style={metricLabel}>ELO rank</span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ ...metricValue, color: "var(--gold)" }}>
                    {String(potw.eloRank).padStart(2, "0")}
                  </span>
                </span>
              </span>
            </>
          )}
          {potw.form.length > 0 && (
            <>
              <Rule />
              <span style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={metricLabel}>{potw.formLabel}</span>
                <span
                  aria-hidden="true"
                  style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22 }}
                >
                  {potw.form.map((won, i) => (
                    <span
                      key={i}
                      style={{
                        width: 6,
                        height: won ? "100%" : "46%",
                        borderRadius: 2,
                        background: won
                          ? i === potw.form.length - 1
                            ? "var(--flame)"
                            : "var(--color-accent)"
                          : "color-mix(in srgb, var(--color-text) 22%, transparent)",
                      }}
                    />
                  ))}
                </span>
              </span>
            </>
          )}
          <span
            data-arrow-host="1"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              fontSize: 14,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              whiteSpace: "nowrap",
            }}
          >
            Profile
            <ArrowRightIcon
              size={15}
              style={{ transition: "transform .32s cubic-bezier(.2,.7,.2,1)" }}
            />
          </span>
        </span>
      </Link>
    </section>
  );
}
