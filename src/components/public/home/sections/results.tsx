import Link from "next/link";
import { formatDate, formatDateTime, getInitials } from "@/lib/utils";
import type { ChampionData, FixtureRow, ResultRow } from "../data";
import { EmptyState, SectionHeading } from "../section-heading";
import { ArrowRightIcon, CalendarIcon, TrophySimpleIcon } from "../icons";

const badge = (accent: "gold" | "accent" | "muted"): React.CSSProperties => ({
  display: "grid",
  placeItems: "center",
  width: 38,
  height: 38,
  flex: "none",
  borderRadius: "50%",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: ".06em",
  ...(accent === "gold"
    ? {
        border: "1px solid color-mix(in srgb, var(--gold) 52%, transparent)",
        color: "var(--gold)",
        background: "color-mix(in srgb, var(--gold) 9%, transparent)",
      }
    : accent === "accent"
      ? {
          border: "1px solid var(--color-accent-600)",
          color: "var(--color-accent-300)",
          background: "color-mix(in srgb, var(--color-accent-900) 58%, transparent)",
        }
      : {
          border: "1px solid var(--color-neutral-800)",
          color: "color-mix(in srgb, var(--color-text) 58%, transparent)",
        }),
});

const nameWon: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 21,
  letterSpacing: ".02em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const nameLost: React.CSSProperties = {
  fontSize: 19.5,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "color-mix(in srgb, var(--color-text) 64%, transparent)",
};

/**
 * Two-letter code for the round badge. Multi-word names give one letter per
 * word; single-word names (most BWL players) fall back to their first two.
 */
function shortCode(name: string): string {
  const initials = getInitials(name);
  if (initials.length >= 2) return initials;
  const letters = name.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.slice(0, 2).toUpperCase() || initials;
}

function isFinalRound(label: string | null): boolean {
  if (!label) return false;
  const l = label.toLowerCase();
  return l.includes("final") && !l.includes("semi") && !l.includes("quarter");
}

function ResultRowCard({ r, index }: { r: ResultRow; index: number }) {
  const gold = index === 0 && isFinalRound(r.roundLabel);
  const homeWon = r.winner === "home";
  const awayWon = r.winner === "away";

  return (
    <Link
      href={r.href}
      data-reveal="1"
      data-delay={index === 0 ? undefined : String(index * 60)}
      data-hover-row={gold ? "gold" : "1"}
      data-result-row="1"
      style={{
        position: "relative",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "minmax(96px,150px) minmax(0,1fr) auto minmax(0,1fr)",
        alignItems: "center",
        gap: "clamp(10px,1.5vw,20px)",
        padding: "20px 18px 30px",
        marginTop: index === 0 ? 0 : 8,
        borderRadius: 12,
        color: "inherit",
        ...(gold
          ? {
              border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
              background:
                "linear-gradient(102deg, color-mix(in srgb, var(--gold) 8%, transparent), color-mix(in srgb, var(--color-surface) 46%, transparent) 44%, transparent 92%)",
              boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--gold) 24%, transparent)",
            }
          : {
              border: "1px solid transparent",
              borderTopColor: "var(--color-divider)",
            }),
        transition:
          "transform .34s cubic-bezier(.2,.7,.2,1), background .34s ease, border-color .34s ease, box-shadow .34s ease",
      }}
    >
      {gold && (
        <>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-60%",
              left: "-6%",
              width: "36%",
              height: "220%",
              pointerEvents: "none",
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--gold) 16%, transparent), transparent 64%)",
              filter: "blur(20px)",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 12,
              bottom: 12,
              left: 0,
              width: 3,
              borderRadius: "0 3px 3px 0",
              background: "linear-gradient(to bottom,transparent,var(--gold),transparent)",
            }}
          />
        </>
      )}

      <span
        data-result-meta="1"
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
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: gold ? "var(--gold)" : "color-mix(in srgb, var(--color-text) 82%, transparent)",
          }}
        >
          {gold && <TrophySimpleIcon size={14} />}
          {r.roundLabel ?? r.tournamentName}
        </span>
        <span
          style={{
            fontSize: 13,
            fontFeatureSettings: "'tnum' 1",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: "color-mix(in srgb, var(--color-text) 56%, transparent)",
          }}
        >
          {r.gameLabel}
          {r.completedAt ? ` · ${formatDate(r.completedAt)}` : ""}
        </span>
      </span>

      <span
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 13,
          minWidth: 0,
        }}
      >
        <span
          data-side-name="1"
          style={{ ...(homeWon ? nameWon : nameLost), textAlign: "right" }}
        >
          {r.home.name}
        </span>
        <span aria-hidden="true" style={badge(homeWon ? (gold ? "gold" : "accent") : "muted")}>
          {shortCode(r.home.name)}
        </span>
      </span>

      <span
        data-score="1"
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: gold ? 38 : 33,
          letterSpacing: ".01em",
          fontFeatureSettings: "'tnum' 1",
          whiteSpace: "nowrap",
          ...(gold
            ? {
                color: "var(--gold)",
                textShadow: "0 0 28px color-mix(in srgb, var(--gold) 34%, transparent)",
              }
            : {}),
        }}
      >
        <span
          style={
            gold
              ? undefined
              : {
                  color: homeWon
                    ? "var(--color-accent-300)"
                    : "color-mix(in srgb, var(--color-text) 50%, transparent)",
                }
          }
        >
          {r.homeScore}
        </span>{" "}
        <span style={{ color: "color-mix(in srgb, var(--color-text) 30%, transparent)" }}>–</span>{" "}
        <span
          style={
            gold
              ? { color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }
              : {
                  color: awayWon
                    ? "var(--color-accent-300)"
                    : "color-mix(in srgb, var(--color-text) 50%, transparent)",
                }
          }
        >
          {r.awayScore}
        </span>
        {r.pens && (
          <span
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".08em",
              color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
              textShadow: "none",
            }}
          >
            ({r.pens.home}–{r.pens.away} pens)
          </span>
        )}
      </span>

      <span
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
        }}
      >
        <span aria-hidden="true" style={badge(awayWon ? (gold ? "gold" : "accent") : "muted")}>
          {shortCode(r.away.name)}
        </span>
        <span data-side-name="1" style={awayWon ? nameWon : nameLost}>
          {r.away.name}
        </span>
      </span>

      <span
        data-row-cta="1"
        style={{
          position: "absolute",
          right: 16,
          bottom: 9,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          opacity: 0,
          transform: "translateX(-6px)",
          fontSize: 12,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          color: gold ? "var(--gold)" : "var(--color-accent)",
          transition: "opacity .32s ease, transform .32s cubic-bezier(.2,.7,.2,1)",
        }}
      >
        View match
        <ArrowRightIcon size={13} />
      </span>

      {r.motm && (
        <span
          style={{
            position: "absolute",
            left: 18,
            bottom: 9,
            fontSize: 11.5,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "color-mix(in srgb, var(--color-text) 48%, transparent)",
          }}
        >
          MOTM · {r.motm}
        </span>
      )}
    </Link>
  );
}

function RoadToFinal({ champion }: { champion: ChampionData }) {
  const steps = champion.road;
  if (steps.length === 0) return null;

  return (
    <>
      <span
        style={{
          fontSize: 11.5,
          letterSpacing: ".2em",
          textTransform: "uppercase",
          marginBottom: 20,
          color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
        }}
      >
        Road to final
      </span>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <span key={step} style={{ display: "contents" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0" }}>
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  flex: "none",
                  borderRadius: "50%",
                  ...(last
                    ? {
                        border: "1px solid var(--gold)",
                        background: "var(--gold)",
                        boxShadow: "0 0 10px color-mix(in srgb, var(--gold) 70%, transparent)",
                      }
                    : {
                        border: "1px solid var(--color-accent-600)",
                        background: "color-mix(in srgb, var(--color-accent-900) 80%, transparent)",
                      }),
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: last ? 700 : 600,
                  fontSize: 13.5,
                  letterSpacing: ".11em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  color: last ? "var(--gold)" : "color-mix(in srgb, var(--color-text) 76%, transparent)",
                }}
              >
                {step}
              </span>
            </span>
            {!last && (
              <span
                aria-hidden="true"
                style={{
                  width: 1,
                  height: 26,
                  marginLeft: 4,
                  background:
                    i === steps.length - 2
                      ? "linear-gradient(to bottom,var(--color-accent),color-mix(in srgb, var(--gold) 60%, transparent))"
                      : "linear-gradient(to bottom,var(--color-accent-700),color-mix(in srgb, var(--color-accent-700) 30%, transparent))",
                }}
              />
            )}
          </span>
        );
      })}
      <Link
        href={champion.winnerHref}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          margin: "16px 0 0 21px",
          color: "inherit",
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
          }}
        >
          Winner
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: ".02em",
            textTransform: "uppercase",
            color: "var(--gold)",
            overflowWrap: "anywhere",
          }}
        >
          {champion.winnerName}
        </span>
      </Link>
    </>
  );
}

function UpcomingRail({ fixtures }: { fixtures: FixtureRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          fontSize: 11.5,
          letterSpacing: ".2em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
        }}
      >
        <CalendarIcon size={13} strokeWidth={16} />
        Next up
      </span>
      {fixtures.map((f) => (
        <Link
          key={f.id}
          href={f.href}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "10px 12px",
            borderRadius: 10,
            color: "inherit",
            border: "1px solid var(--color-divider)",
            background: "color-mix(in srgb, var(--color-surface) 44%, transparent)",
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                textDecoration: f.walkoverSide === "home" ? "line-through" : undefined,
                opacity: f.walkoverSide === "home" ? 0.55 : 1,
              }}
            >
              {f.home.name}
            </span>
            <span style={{ color: "color-mix(in srgb, var(--color-text) 42%, transparent)" }}>vs</span>
            <span
              style={{
                textDecoration: f.walkoverSide === "away" ? "line-through" : undefined,
                opacity: f.walkoverSide === "away" ? 0.55 : 1,
              }}
            >
              {f.away.name}
            </span>
          </span>
          <span
            style={{
              fontSize: 11.5,
              fontFeatureSettings: "'tnum' 1",
              color: f.walkoverSide
                ? "var(--gold)"
                : "color-mix(in srgb, var(--color-text) 54%, transparent)",
            }}
          >
            {f.walkoverSide
              ? "Walkover"
              : f.scheduledAt
                ? formatDateTime(f.scheduledAt)
                : (f.roundLabel ?? f.tournamentName)}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ResultsBoard({
  results,
  fixtures,
  champion,
}: {
  results: ResultRow[];
  fixtures: FixtureRow[];
  champion: ChampionData | null;
}) {
  const showRail = (champion && champion.road.length > 0) || fixtures.length > 0;

  return (
    <section
      id="results"
      data-band="1"
      style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1400,
        margin: "0 auto",
        background:
          "radial-gradient(940px 540px at 92% 6%, color-mix(in srgb, var(--crimson-deep) 34%, transparent), transparent 62%)",
        padding: "clamp(48px,5.5vw,80px) clamp(20px,4vw,56px)",
      }}
    >
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(to right,transparent,var(--color-divider) 48px,var(--color-divider) calc(100% - 48px),transparent)",
        }}
      />
      <div style={{ marginTop: "clamp(38px,4.4vw,60px)" }}>
        <SectionHeading
          kicker={results[0]?.tournamentName ?? "Match centre"}
          title="Results board"
          href="/matches"
          linkLabel="All matches"
        />
      </div>

      <div
        data-results-grid="1"
        style={{
          marginTop: "clamp(30px,3.4vw,44px)",
          display: "grid",
          gridTemplateColumns: showRail ? "minmax(0,1fr) auto" : "minmax(0,1fr)",
          gap: "clamp(20px,3vw,44px)",
          alignItems: "start",
        }}
      >
        <div>
          {results.length === 0 ? (
            <EmptyState>No recent results yet — completed matches will appear here.</EmptyState>
          ) : (
            results.map((r, i) => <ResultRowCard key={r.id} r={r} index={i} />)
          )}
        </div>

        {showRail && (
          <div
            data-bracket="1"
            data-reveal="1"
            data-delay="140"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              width: "auto",
              minWidth: 158,
              maxWidth: 260,
              padding: "20px 0 20px 24px",
              borderLeft: "1px solid var(--color-divider)",
            }}
          >
            {champion && champion.road.length > 0 && <RoadToFinal champion={champion} />}
            {fixtures.length > 0 && (
              <div style={{ marginTop: champion && champion.road.length > 0 ? 28 : 0 }}>
                <UpcomingRail fixtures={fixtures} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
