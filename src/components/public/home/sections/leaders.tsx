import Link from "next/link";
import { avatarSrc, type LeaderCard } from "../data";
import { EmptyState, SectionHeading } from "../section-heading";
import { BallIcon, ChartIcon, RatioIcon, ShieldCheckIcon } from "../icons";

/** Per-metric styling: icon, accent and the sparkline that sits under the value. */
function CardArt({ card }: { card: LeaderCard }) {
  switch (card.key) {
    case "goals": {
      // Nine bars rising to the leader's tally — proportion only, no invented data.
      const bars = [13, 18, 11, 22, 16, 26, 20, 14, 30];
      return (
        <svg
          viewBox="0 0 120 30"
          fill="none"
          preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 30 }}
        >
          {bars.map((h, i) => (
            <rect
              key={i}
              x={i * 13}
              y={30 - h}
              width={9}
              height={h}
              rx={2}
              fill={
                i === bars.length - 1
                  ? "var(--color-accent)"
                  : `color-mix(in srgb, var(--color-accent) ${28 + h}%, transparent)`
              }
            />
          ))}
        </svg>
      );
    }
    case "winRate": {
      const pct = Math.max(0, Math.min(100, card.value));
      const circ = 2 * Math.PI * 12;
      return (
        <svg viewBox="0 0 120 30" fill="none" style={{ display: "block", width: "100%", height: 30 }}>
          <circle
            cx="15"
            cy="15"
            r="12"
            stroke="color-mix(in srgb, var(--color-text) 15%, transparent)"
            strokeWidth="4"
          />
          <circle
            cx="15"
            cy="15"
            r="12"
            stroke="var(--flame)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${((circ * pct) / 100).toFixed(1)} ${circ.toFixed(1)}`}
            transform="rotate(-90 15 15)"
          />
          <rect
            x="38"
            y="12"
            width="82"
            height="6"
            rx="3"
            fill="color-mix(in srgb, var(--color-text) 13%, transparent)"
          />
          <rect
            x="38"
            y="12"
            width={(82 * pct) / 100}
            height="6"
            rx="3"
            fill="color-mix(in srgb, var(--flame) 78%, transparent)"
          />
        </svg>
      );
    }
    case "elo":
      return (
        <svg
          viewBox="0 0 120 30"
          fill="none"
          preserveAspectRatio="none"
          style={{ display: "block", width: "100%", height: 30 }}
        >
          <path
            d="M0 26L17 21L34 23L51 14L68 16L85 8L102 9L120 2"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 26L17 21L34 23L51 14L68 16L85 8L102 9L120 2V30H0Z"
            fill="color-mix(in srgb, var(--color-accent) 14%, transparent)"
          />
        </svg>
      );
    case "cleanSheets": {
      // 10×3 dot grid; the filled tail is the share of the grid the tally covers.
      const cols = 10;
      const filled = Math.min(cols, Math.max(1, Math.round(card.value / 3)));
      return (
        <svg viewBox="0 0 120 30" fill="none" style={{ display: "block", width: "100%", height: 30 }}>
          {Array.from({ length: cols }).flatMap((_, c) =>
            [5, 15, 25].map((cy) => (
              <circle
                key={`${c}-${cy}`}
                cx={4 + c * 12.6}
                cy={cy}
                r="3.1"
                fill={
                  cy === 25 && c >= cols - filled
                    ? "var(--flame)"
                    : "color-mix(in srgb, var(--flame) 52%, transparent)"
                }
              />
            )),
          )}
        </svg>
      );
    }
  }
}

const CARD_META: Record<
  LeaderCard["key"],
  { icon: React.ReactNode; accent: string; pattern: React.CSSProperties }
> = {
  goals: {
    icon: <BallIcon size={15} strokeWidth={17} />,
    accent: "var(--color-accent)",
    pattern: {
      backgroundImage:
        "repeating-linear-gradient(46deg, color-mix(in srgb, var(--color-accent) 13%, transparent) 0 1px, transparent 1px 11px)",
      mask: "radial-gradient(110% 80% at 100% 0%, black, transparent 72%)",
      WebkitMask: "radial-gradient(110% 80% at 100% 0%, black, transparent 72%)",
    },
  },
  winRate: {
    icon: <RatioIcon size={15} strokeWidth={17} />,
    accent: "var(--flame)",
    pattern: {
      backgroundImage:
        "repeating-radial-gradient(circle at 100% 0%, transparent 0 15px, color-mix(in srgb, var(--flame) 14%, transparent) 15px 16px)",
      mask: "radial-gradient(110% 80% at 100% 0%, black, transparent 74%)",
      WebkitMask: "radial-gradient(110% 80% at 100% 0%, black, transparent 74%)",
    },
  },
  elo: {
    icon: <ChartIcon size={15} strokeWidth={17} />,
    accent: "var(--color-accent)",
    pattern: {
      backgroundImage:
        "repeating-linear-gradient(to right, color-mix(in srgb, var(--color-accent) 15%, transparent) 0 1px, transparent 1px 8px)",
      mask: "linear-gradient(to top, black, transparent 70%)",
      WebkitMask: "linear-gradient(to top, black, transparent 70%)",
    },
  },
  cleanSheets: {
    icon: <ShieldCheckIcon size={15} strokeWidth={17} />,
    accent: "var(--flame)",
    pattern: {
      backgroundImage:
        "radial-gradient(color-mix(in srgb, var(--flame) 20%, transparent) 1px, transparent 1px)",
      backgroundSize: "13px 13px",
      mask: "radial-gradient(110% 80% at 100% 0%, black, transparent 74%)",
      WebkitMask: "radial-gradient(110% 80% at 100% 0%, black, transparent 74%)",
    },
  },
};

export function SeasonLeaders({ leaders }: { leaders: LeaderCard[] }) {
  return (
    <section
      id="leaders"
      data-band="1"
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1400,
        margin: "0 auto",
        background:
          "radial-gradient(900px 520px at 10% 2%, color-mix(in srgb, var(--color-accent-900) 46%, transparent), transparent 64%)",
        padding: "clamp(56px,6.5vw,96px) clamp(20px,4vw,56px) clamp(40px,4.5vw,64px)",
      }}
    >
      <SectionHeading
        kicker="Top performers"
        title="Season leaders"
        href="/rankings"
        linkLabel="Full rankings"
      />

      <div style={{ marginTop: "clamp(34px,4vw,52px)" }}>
        {leaders.length === 0 ? (
          <EmptyState>Rankings are not available yet — they appear once matches are played.</EmptyState>
        ) : (
          <div
            data-leader-rail="1"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))",
              gap: "clamp(16px,2vw,24px)",
            }}
          >
            {leaders.map((card, i) => {
              const meta = CARD_META[card.key];
              return (
                <Link
                  key={card.key}
                  href={card.href}
                  data-reveal="1"
                  data-delay={i === 0 ? undefined : String(i * 70)}
                  data-lift="1"
                  data-spotlight="1"
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    padding: 24,
                    borderRadius: 15,
                    color: "inherit",
                    border: "1px solid var(--color-divider)",
                    background:
                      "linear-gradient(168deg, color-mix(in srgb, var(--color-surface) 76%, transparent), transparent 88%)",
                    transition:
                      "transform .4s cubic-bezier(.2,.7,.2,1), box-shadow .4s ease, border-color .4s ease",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      opacity: 0.5,
                      ...meta.pattern,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: `linear-gradient(to right,transparent,color-mix(in srgb, ${meta.accent} 68%, transparent),transparent)`,
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 11.5,
                        letterSpacing: ".2em",
                        textTransform: "uppercase",
                        color: "color-mix(in srgb, var(--color-text) 66%, transparent)",
                      }}
                    >
                      <span style={{ display: "flex", color: meta.accent }}>{meta.icon}</span>
                      {card.label}
                    </span>
                    <span
                      className="tag tag-outline"
                      style={{
                        fontSize: 10.5,
                        letterSpacing: ".16em",
                        whiteSpace: "nowrap",
                        borderColor: `color-mix(in srgb, ${meta.accent} 42%, transparent)`,
                        color:
                          meta.accent === "var(--flame)" ? "var(--flame)" : "var(--color-accent-300)",
                      }}
                    >
                      {card.tag}
                    </span>
                  </span>

                  <p
                    data-count={String(card.value)}
                    data-suffix={card.suffix || undefined}
                    style={{
                      position: "relative",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "clamp(48px,4.6vw,70px)",
                      lineHeight: 1,
                      margin: "22px 0 0 -.02em",
                      fontFeatureSettings: "'tnum' 1",
                    }}
                  >
                    {card.value.toLocaleString("en-US")}
                    {card.suffix}
                  </p>

                  <span
                    aria-hidden="true"
                    style={{ position: "relative", display: "block", marginTop: 18 }}
                  >
                    <CardArt card={card} />
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      position: "relative",
                      display: "block",
                      height: 2,
                      marginTop: 14,
                      borderRadius: 2,
                      background: `linear-gradient(to right,${meta.accent},color-mix(in srgb, ${meta.accent} 12%, transparent) 66%,transparent)`,
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 16,
                      fontSize: 15.5,
                      color: "color-mix(in srgb, var(--color-text) 90%, transparent)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarSrc("player", card.playerId, 64)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={26}
                      height={26}
                      style={{
                        width: 26,
                        height: 26,
                        flex: "none",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: `1px solid color-mix(in srgb, ${meta.accent} 40%, transparent)`,
                      }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {card.playerName}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
