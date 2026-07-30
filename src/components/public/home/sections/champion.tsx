import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/lib/utils";
import type { ChampionData } from "../data";
import { Kicker } from "../section-heading";
import { ArrowRightIcon, BootIcon, TrophyIcon } from "../icons";

// No `white-space: nowrap` here — at three columns on a narrow screen a label
// like "MATCHES" is wider than its track, and nowrap makes it overrun the
// neighbouring column instead of wrapping.
const statLabel: React.CSSProperties = {
  fontSize: 11.5,
  letterSpacing: ".18em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
};
const statValue: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 20,
  overflowWrap: "anywhere",
  fontFeatureSettings: "'tnum' 1",
};

export function Champion({ champion }: { champion: ChampionData | null }) {
  if (!champion) return null;

  const cells: { label: string; value: string; gold?: boolean }[] = [
    { label: "Title", value: "Champion", gold: true },
    ...(champion.stats
      ? [
          { label: "Matches", value: String(champion.stats.matches) },
          { label: "Wins", value: String(champion.stats.wins) },
          { label: "Losses", value: String(champion.stats.losses) },
          { label: "Goals", value: String(champion.stats.goals) },
        ]
      : []),
  ];

  return (
    <section
      id="champion"
      style={{
        position: "relative",
        zIndex: 1,
        overflow: "hidden",
        isolation: "isolate",
        background:
          "radial-gradient(1200px 620px at 50% 0%, color-mix(in srgb, var(--gold) 5%, transparent), transparent 64%),linear-gradient(180deg, color-mix(in srgb, oklch(0.19 0.03 262) 62%, transparent), transparent 46%)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-18%",
          left: "50%",
          width: "min(1200px,124%)",
          height: "78%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 36%, color-mix(in srgb, var(--gold) 15%, transparent), transparent 62%)",
          animation: "bwl-ember 12s ease-in-out infinite",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "16%",
          left: "-6%",
          width: "44%",
          height: "60%",
          pointerEvents: "none",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--gold) 12%, transparent), transparent 66%)",
          filter: "blur(40px)",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          pointerEvents: "none",
          textAlign: "center",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "min(28vw,380px)",
          lineHeight: 0.8,
          letterSpacing: "-.02em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-text) 3.2%, transparent)",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        Champion
      </span>

      <div
        style={{
          position: "relative",
          maxWidth: 1400,
          margin: "0 auto",
          padding: "clamp(56px,7vw,112px) clamp(20px,4vw,56px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))",
          gap: "clamp(36px,5vw,88px)",
          alignItems: "center",
        }}
      >
        <figure data-tilt-host="1" style={{ position: "relative", width: "100%", maxWidth: 440 }}>
          <span
            data-atmo="spot"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-16%",
              left: "50%",
              width: "56%",
              height: "56%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              clipPath: "polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)",
              background:
                "linear-gradient(to bottom,color-mix(in srgb, var(--gold) 26%, transparent),transparent 80%)",
              filter: "blur(16px)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "-9% -7%",
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--gold) 24%, transparent), transparent 66%)",
              filter: "blur(30px)",
              animation: "bwl-bloom 10s ease-in-out infinite",
            }}
          />
          <span
            data-particles="gold"
            aria-hidden="true"
            style={{ position: "absolute", inset: "-6%", pointerEvents: "none", overflow: "hidden" }}
          />

          <Link
            href={`/tournaments/${champion.tournament.slug}`}
            data-tilt="6"
            style={{
              position: "relative",
              display: "block",
              padding: 13,
              borderRadius: 16,
              color: "inherit",
              background:
                "linear-gradient(158deg, color-mix(in srgb, var(--color-text) 16%, transparent), color-mix(in srgb, var(--color-surface) 92%, transparent) 22%, oklch(0.19 0.02 264) 62%, color-mix(in srgb, var(--color-surface) 88%, transparent))",
              boxShadow:
                "inset 0 1px 0 color-mix(in srgb, var(--gold) 40%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--gold) 26%, transparent), 0 40px 100px rgba(0,0,0,.7)",
              transition: "transform .5s cubic-bezier(.2,.7,.2,1)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 6,
                borderRadius: 11,
                pointerEvents: "none",
                border: "1px solid color-mix(in srgb, var(--gold) 34%, transparent)",
                zIndex: 1,
              }}
            />
            {champion.tournament.bannerUrl ? (
              // Banners are stored as data URLs or on external CDNs — plain <img>
              // keeps both cases working without an optimizer round-trip.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={champion.tournament.bannerUrl}
                alt={champion.posterAlt}
                style={{ display: "block", width: "100%", height: "auto", borderRadius: 9 }}
              />
            ) : (
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 18,
                  aspectRatio: "4/5",
                  borderRadius: 9,
                  padding: 24,
                  textAlign: "center",
                  background:
                    "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--gold) 12%, transparent), transparent 68%), oklch(0.17 0.02 264)",
                }}
              >
                <Image src="/logo.png" alt="" width={110} height={130} style={{ opacity: 0.9 }} />
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "clamp(28px,6vw,44px)",
                    lineHeight: 1,
                    textTransform: "uppercase",
                    color: "var(--gold)",
                  }}
                >
                  {champion.winnerName}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    letterSpacing: ".22em",
                    textTransform: "uppercase",
                    color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
                  }}
                >
                  {champion.tournament.name}
                </span>
              </span>
            )}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 13,
                borderRadius: 9,
                pointerEvents: "none",
                background:
                  "linear-gradient(168deg, color-mix(in srgb, var(--color-text) 9%, transparent), transparent 34%)",
              }}
            />
          </Link>

          <span
            aria-hidden="true"
            style={{
              display: "block",
              position: "relative",
              height: 66,
              margin: "0 20px",
              borderRadius: "0 0 60% 60%",
              background:
                "linear-gradient(to bottom, color-mix(in srgb, var(--gold) 15%, transparent), transparent 74%)",
              filter: "blur(7px)",
            }}
          />
        </figure>

        <div>
          <span data-reveal="1" style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <span
              aria-hidden="true"
              style={{
                width: 52,
                height: 1,
                flex: "none",
                background: "linear-gradient(to right,transparent,var(--gold))",
              }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 13.5,
                  letterSpacing: ".24em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                }}
              >
                Reigning champion
              </span>
              <Link
                href={`/tournaments/${champion.tournament.slug}`}
                style={{
                  fontSize: 12,
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
                }}
              >
                {champion.tournament.name}
              </Link>
            </span>
          </span>

          <h2
            data-reveal="1"
            data-delay="80"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(46px,8.4vw,124px)",
              lineHeight: 0.9,
              letterSpacing: "-.018em",
              textTransform: "uppercase",
              margin: "24px 0 0 -.03em",
              background:
                "linear-gradient(168deg, oklch(0.98 0.02 88) 4%, var(--gold) 40%, var(--gold-deep) 84%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              filter: "drop-shadow(0 0 38px color-mix(in srgb, var(--gold) 24%, transparent))",
              overflowWrap: "anywhere",
            }}
          >
            {champion.winnerName}
          </h2>

          {champion.crownedAt && (
            <p
              data-reveal="1"
              data-delay="130"
              style={{
                fontSize: 14.5,
                letterSpacing: ".13em",
                textTransform: "uppercase",
                margin: "20px 0 0",
                color: "color-mix(in srgb, var(--color-text) 64%, transparent)",
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              Crowned {formatDate(champion.crownedAt)}
            </p>
          )}

          {champion.description && (
            <p
              data-reveal="1"
              data-delay="170"
              style={{
                fontSize: 18,
                lineHeight: "30px",
                margin: "26px 0 0",
                maxWidth: "46ch",
                color: "color-mix(in srgb, var(--color-text) 80%, transparent)",
              }}
            >
              {champion.description}
            </p>
          )}

          {/* Column count and cell rules are driven from landing.css so the strip
              can reflow to 3 (then 2) columns without the dividers landing in
              the wrong places. */}
          <div
            data-reveal="1"
            data-delay="210"
            data-champion-stats="1"
            style={{
              display: "grid",
              marginTop: 38,
              borderTop: "1px solid color-mix(in srgb, var(--gold) 26%, transparent)",
              borderBottom: "1px solid color-mix(in srgb, var(--color-divider) 90%, transparent)",
            }}
          >
            {cells.map((c) => (
              <span
                key={c.label}
                // Padding lives in landing.css alongside the cell rules — an
                // inline shorthand here would outrank the per-breakpoint
                // padding-left reset on whichever cell opens a row.
                style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}
              >
                <span style={c.gold ? { ...statLabel, color: "var(--gold)" } : statLabel}>
                  {c.label}
                </span>
                <span
                  style={
                    c.gold ? { ...statValue, letterSpacing: ".02em", fontFeatureSettings: undefined } : statValue
                  }
                >
                  {c.value}
                </span>
              </span>
            ))}
          </div>

          <Link
            data-shine="1"
            data-reveal="1"
            data-delay="250"
            data-hv="gold-cta"
            className="btn"
            href={champion.winnerHref}
            style={{
              position: "relative",
              overflow: "hidden",
              marginTop: 34,
              padding: "14px 24px",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 15.5,
              letterSpacing: ".11em",
              textTransform: "uppercase",
              color: "var(--gold)",
              border: "1px solid color-mix(in srgb, var(--gold) 46%, transparent)",
              background:
                "linear-gradient(160deg, color-mix(in srgb, var(--gold) 11%, transparent), transparent 76%)",
              transition:
                "transform .34s cubic-bezier(.2,.7,.2,1), border-color .34s ease, box-shadow .34s ease",
            }}
          >
            View Champion Profile
            <ArrowRightIcon size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Season honours — the winner card plus every other award from that campaign. */
export function Honours({ champion }: { champion: ChampionData | null }) {
  if (!champion || champion.honours.length === 0) return null;

  return (
    <section
      aria-labelledby="honours-h"
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1400,
        margin: "0 auto",
        padding: "0 clamp(20px,4vw,56px) clamp(56px,6vw,88px)",
      }}
    >
      <Kicker as="h3" id="honours-h" color="var(--gold)">
        Season honours
      </Kicker>

      <div
        style={{
          marginTop: 26,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
          gap: "clamp(18px,2.4vw,28px)",
        }}
      >
        {champion.honours.map((h, i) => {
          const primary = i === 0;
          const body = (
            <>
              {primary && (
                <>
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: "-40%",
                      right: "-14%",
                      width: "52%",
                      height: "180%",
                      pointerEvents: "none",
                      background:
                        "radial-gradient(circle, color-mix(in srgb, var(--gold) 15%, transparent), transparent 62%)",
                      filter: "blur(22px)",
                    }}
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      bottom: "-34%",
                      right: "4%",
                      width: 150,
                      height: 150,
                      pointerEvents: "none",
                      opacity: 0.09,
                      color: "var(--gold)",
                    }}
                  >
                    <TrophyIcon size={150} strokeWidth={8} />
                  </span>
                </>
              )}
              <span
                aria-hidden="true"
                style={{
                  position: "relative",
                  display: "grid",
                  placeItems: "center",
                  width: 52,
                  height: 52,
                  flex: "none",
                  borderRadius: 12,
                  border: `1px solid color-mix(in srgb, var(--gold) ${primary ? 44 : 38}%, transparent)`,
                  background: primary
                    ? "color-mix(in srgb, var(--gold) 10%, transparent)"
                    : "linear-gradient(150deg, color-mix(in srgb, var(--gold) 16%, transparent), color-mix(in srgb, var(--gold) 4%, transparent))",
                  color: "var(--gold)",
                }}
              >
                {primary ? <TrophyIcon size={23} strokeWidth={17} /> : <BootIcon size={23} strokeWidth={16} />}
              </span>
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: "var(--gold)",
                  }}
                >
                  {h.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 27,
                    letterSpacing: ".01em",
                    textTransform: "uppercase",
                    overflowWrap: "anywhere",
                  }}
                >
                  {h.recipientName}
                </span>
                {h.note && (
                  <span
                    style={{
                      fontSize: 14,
                      fontFeatureSettings: "'tnum' 1",
                      color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
                    }}
                  >
                    {h.note}
                  </span>
                )}
              </span>
              {h.avatarSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={h.avatarSrc}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={62}
                  height={62}
                  style={{
                    position: "relative",
                    width: 62,
                    height: 62,
                    flex: "none",
                    marginLeft: "auto",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: `1px solid color-mix(in srgb, var(--gold) ${primary ? 55 : 40}%, transparent)`,
                    boxShadow: `0 0 0 5px color-mix(in srgb, var(--gold) ${primary ? 9 : 6}%, transparent)`,
                  }}
                />
              )}
            </>
          );

          const cardStyle: React.CSSProperties = {
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: 24,
            borderRadius: 15,
            color: "inherit",
            border: `1px solid color-mix(in srgb, var(--gold) ${primary ? 30 : 20}%, transparent)`,
            background: primary
              ? "linear-gradient(150deg, color-mix(in srgb, var(--gold) 9%, transparent), color-mix(in srgb, var(--color-surface) 62%, transparent) 44%, transparent 92%)"
              : "linear-gradient(150deg, color-mix(in srgb, var(--gold) 5%, transparent), color-mix(in srgb, var(--color-surface) 56%, transparent) 44%, transparent 92%)",
            boxShadow: primary
              ? "inset 0 1px 0 color-mix(in srgb, var(--gold) 30%, transparent)"
              : "inset 0 1px 0 color-mix(in srgb, var(--color-text) 7%, transparent)",
            transition:
              "transform .4s cubic-bezier(.2,.7,.2,1), box-shadow .4s ease, border-color .4s ease",
          };

          return h.recipientHref ? (
            <Link
              key={h.id}
              href={h.recipientHref}
              data-reveal="1"
              data-delay={i === 0 ? undefined : String(i * 80)}
              data-lift="1"
              style={cardStyle}
            >
              {body}
            </Link>
          ) : (
            <div
              key={h.id}
              data-reveal="1"
              data-delay={i === 0 ? undefined : String(i * 80)}
              data-lift="1"
              style={cardStyle}
            >
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
