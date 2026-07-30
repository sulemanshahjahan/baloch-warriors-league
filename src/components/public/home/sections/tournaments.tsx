import Link from "next/link";
import { gameLabel, statusLabel } from "@/lib/utils";
import type { TournamentCard } from "../data";
import { BandRule, EmptyState, SectionHeading } from "../section-heading";
import { ArrowRightIcon, TrophyIcon } from "../icons";

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 10.5,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  padding: "3px 10px",
  borderRadius: 6,
  whiteSpace: "nowrap",
};

/**
 * Active + upcoming competitions. Not part of the static v2 comp, but a feature
 * of the live homepage — rebuilt here in the same visual language.
 */
export function Tournaments({ tournaments }: { tournaments: TournamentCard[] }) {
  return (
    <section
      id="tournaments"
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1400,
        margin: "0 auto",
        padding: "clamp(40px,4.5vw,64px) clamp(20px,4vw,56px)",
      }}
    >
      <BandRule />
      <div style={{ marginTop: "clamp(38px,4.4vw,60px)" }}>
        <SectionHeading
          kicker="On the calendar"
          title="Tournaments"
          href="/tournaments"
          linkLabel="All tournaments"
        />
      </div>

      <div style={{ marginTop: "clamp(30px,3.4vw,44px)" }}>
        {tournaments.length === 0 ? (
          <EmptyState>No active tournaments right now — the next one will show up here.</EmptyState>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))",
              gap: "clamp(16px,2vw,24px)",
            }}
          >
            {tournaments.map((t, i) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.slug}`}
                data-reveal="1"
                data-delay={i === 0 ? undefined : String(i * 70)}
                data-lift="1"
                data-spotlight="1"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: 24,
                  borderRadius: 15,
                  color: "inherit",
                  border: "1px solid var(--color-divider)",
                  background:
                    "linear-gradient(168deg, color-mix(in srgb, var(--color-surface) 74%, transparent), transparent 90%)",
                  transition:
                    "transform .4s cubic-bezier(.2,.7,.2,1), box-shadow .4s ease, border-color .4s ease",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    background:
                      "linear-gradient(to right,transparent,color-mix(in srgb, var(--color-accent) 62%, transparent),transparent)",
                  }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    bottom: "-32%",
                    right: "-8%",
                    width: 140,
                    height: 140,
                    pointerEvents: "none",
                    opacity: 0.07,
                    color: "var(--color-accent)",
                  }}
                >
                  <TrophyIcon size={140} strokeWidth={8} />
                </span>

                <span
                  style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 7 }}
                >
                  <span
                    style={{
                      ...chip,
                      border: "1px solid color-mix(in srgb, var(--color-accent) 42%, transparent)",
                      color: "var(--color-accent-300)",
                    }}
                  >
                    {gameLabel(t.gameCategory)}
                  </span>
                  <span
                    style={{
                      ...chip,
                      border:
                        t.status === "ACTIVE"
                          ? "1px solid color-mix(in srgb, var(--flame) 46%, transparent)"
                          : "1px solid var(--color-divider)",
                      color:
                        t.status === "ACTIVE"
                          ? "var(--flame)"
                          : "color-mix(in srgb, var(--color-text) 62%, transparent)",
                    }}
                  >
                    {statusLabel(t.status)}
                  </span>
                  {t.eFootballType && (
                    <span
                      style={{
                        ...chip,
                        border: "1px solid var(--color-divider)",
                        color: "color-mix(in srgb, var(--color-text) 62%, transparent)",
                      }}
                    >
                      {t.eFootballType === "DREAM" ? "Dream" : "Authentic"}
                    </span>
                  )}
                  {t.eFootballMode === "2v2" && (
                    <span
                      style={{
                        ...chip,
                        border: "1px solid var(--color-divider)",
                        color: "color-mix(in srgb, var(--color-text) 62%, transparent)",
                      }}
                    >
                      2v2
                    </span>
                  )}
                </span>

                <h3
                  style={{
                    position: "relative",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 24,
                    lineHeight: 1.1,
                    letterSpacing: ".01em",
                    textTransform: "uppercase",
                    overflowWrap: "anywhere",
                  }}
                >
                  {t.name}
                </h3>

                <span
                  style={{
                    position: "relative",
                    marginTop: "auto",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px 18px",
                    fontFeatureSettings: "'tnum' 1",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                    <span
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}
                    >
                      {t.participants}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        letterSpacing: ".15em",
                        textTransform: "uppercase",
                        color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
                      }}
                    >
                      {t.participantLabel}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                    <span
                      style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}
                    >
                      {t.matches}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        letterSpacing: ".15em",
                        textTransform: "uppercase",
                        color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
                      }}
                    >
                      Matches
                    </span>
                  </span>
                </span>

                <span
                  data-arrow-host="1"
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 13,
                    letterSpacing: ".13em",
                    textTransform: "uppercase",
                    color: "var(--color-accent)",
                  }}
                >
                  View
                  <ArrowRightIcon
                    size={13}
                    style={{ transition: "transform .32s cubic-bezier(.2,.7,.2,1)" }}
                  />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
