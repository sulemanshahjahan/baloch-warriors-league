import Image from "next/image";
import { DownloadAppButton } from "@/components/public/download-app-button";
import type { ChampionData, LeaderCard, ResultRow } from "../data";
import { Kicker } from "../section-heading";
import {
  AppChartIcon,
  BellIcon,
  BracketIcon,
  HomeIcon,
  ProfileIcon,
  TrophySimpleIcon,
} from "../icons";

const featurePill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  padding: "9px 15px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--color-text) 20%, transparent)",
  fontSize: 14,
  background: "color-mix(in srgb, var(--color-bg) 34%, transparent)",
};

const tinyCap: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: ".19em",
  textTransform: "uppercase",
  color: "color-mix(in srgb, var(--color-text) 52%, transparent)",
};

function MiniResult({ r, dim }: { r: ResultRow; dim: boolean }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 9px",
        borderRadius: 9,
        background: `color-mix(in srgb, var(--color-surface) ${dim ? 42 : 62}%, transparent)`,
        fontSize: 12,
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.home.name}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontFeatureSettings: "'tnum' 1",
          color: "var(--color-accent-300)",
        }}
      >
        {r.homeScore}–{r.awayScore}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.away.name}
      </span>
    </span>
  );
}

/**
 * "The league in your pocket" — marketing band whose phone mock-up mirrors the
 * same live data the rest of the page shows, so the preview never drifts.
 */
export function GetApp({
  champion,
  results,
  leaders,
}: {
  champion: ChampionData | null;
  results: ResultRow[];
  leaders: LeaderCard[];
}) {
  const latest = results[0];
  const miniResults = results.slice(0, 2);
  const goals = leaders.find((l) => l.key === "goals");
  const elo = leaders.find((l) => l.key === "elo");

  return (
    <section
      id="get-app"
      style={{
        position: "relative",
        zIndex: 1,
        marginTop: "clamp(24px,3vw,44px)",
        overflow: "hidden",
        background:
          "radial-gradient(900px 480px at 86% 116%, color-mix(in srgb, var(--color-section-glow) 62%, transparent), transparent 66%), linear-gradient(168deg, color-mix(in srgb, var(--crimson-deep) 92%, transparent), color-mix(in srgb, var(--color-bg) 96%, transparent))",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          height: 1,
          background:
            "linear-gradient(to right,transparent,color-mix(in srgb, var(--color-accent) 60%, transparent) 30%,var(--flame) 50%,color-mix(in srgb, var(--color-accent) 60%, transparent) 70%,transparent)",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.1,
          backgroundImage:
            "linear-gradient(to right, color-mix(in srgb, var(--color-text) 26%, transparent) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
          mask: "radial-gradient(90% 100% at 20% 50%, black, transparent 74%)",
          WebkitMask: "radial-gradient(90% 100% at 20% 50%, black, transparent 74%)",
        }}
      />

      <div
        style={{
          position: "relative",
          maxWidth: 1400,
          margin: "0 auto",
          padding: "clamp(52px,6vw,88px) clamp(20px,4vw,56px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))",
          gap: "clamp(36px,5vw,72px)",
          alignItems: "center",
        }}
      >
        <div>
          <Kicker color="var(--flame)">BWL Android app</Kicker>
          <h2
            data-reveal="1"
            data-delay="60"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(36px,4.8vw,72px)",
              lineHeight: 1,
              letterSpacing: "-.01em",
              textTransform: "uppercase",
              margin: "22px 0 0 -.025em",
            }}
          >
            The league in your pocket
          </h2>
          <p
            data-reveal="1"
            data-delay="110"
            style={{
              fontSize: 17,
              lineHeight: "29px",
              margin: "22px 0 0",
              maxWidth: "50ch",
              color: "color-mix(in srgb, var(--color-text) 78%, transparent)",
            }}
          >
            Track tournaments, receive match alerts, follow rankings and see every result the moment
            it lands.
          </p>

          <div
            data-reveal="1"
            data-delay="160"
            style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}
          >
            <span style={featurePill}>
              <span style={{ display: "flex", color: "var(--flame)" }}>
                <BellIcon size={14} />
              </span>
              Live match alerts
            </span>
            <span style={featurePill}>
              <span style={{ display: "flex", color: "var(--flame)" }}>
                <AppChartIcon size={14} />
              </span>
              Rankings
            </span>
            <span style={featurePill}>
              <span style={{ display: "flex", color: "var(--flame)" }}>
                <BracketIcon size={14} />
              </span>
              Tournament brackets
            </span>
            <span style={featurePill}>
              <span style={{ display: "flex", color: "var(--flame)" }}>
                <ProfileIcon size={14} />
              </span>
              Player profiles
            </span>
          </div>

          <div data-reveal="1" data-delay="210">
            <DownloadAppButton variant="landing" />
          </div>
        </div>

        <div
          data-tilt-host="1"
          aria-hidden="true"
          style={{ position: "relative", display: "grid", placeItems: "center", minHeight: 520 }}
        >
          <span
            style={{
              position: "absolute",
              width: "min(440px,88%)",
              aspectRatio: "1",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 24%, transparent), transparent 64%)",
              filter: "blur(26px)",
              animation: "bwl-bloom 11s ease-in-out infinite",
            }}
          />
          <span
            style={{
              position: "absolute",
              bottom: "3%",
              width: "58%",
              height: 36,
              pointerEvents: "none",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(0,0,0,.66), transparent 70%)",
              filter: "blur(15px)",
            }}
          />

          <span
            data-tilt="5"
            style={{
              position: "relative",
              display: "block",
              width: "min(302px,76%)",
              padding: 12,
              borderRadius: 42,
              background:
                "linear-gradient(160deg, color-mix(in srgb, var(--color-text) 15%, transparent), oklch(0.2 0.02 264) 30%, oklch(0.14 0.02 264))",
              boxShadow:
                "inset 0 1px 0 color-mix(in srgb, var(--color-text) 20%, transparent), 0 44px 90px rgba(0,0,0,.7)",
              transition: "transform .5s cubic-bezier(.2,.7,.2,1)",
            }}
          >
            <span
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: "13px 14px 12px",
                borderRadius: 31,
                overflow: "hidden",
                background:
                  "linear-gradient(178deg, color-mix(in srgb, var(--crimson-deep) 52%, transparent), var(--color-bg) 42%)",
              }}
            >
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 22,
                }}
              >
                <span
                  style={{
                    width: 76,
                    height: 20,
                    borderRadius: 12,
                    background: "oklch(0.09 0.008 264)",
                    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-text) 9%, transparent)",
                  }}
                />
              </span>

              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Image
                  src="/logo.png"
                  alt=""
                  width={16}
                  height={19}
                  style={{ width: 16, height: 19, objectFit: "contain" }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: ".08em",
                    color: "var(--color-accent)",
                  }}
                >
                  BWL
                </span>
              </span>

              {champion && (
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 11,
                    borderRadius: 13,
                    border: "1px solid color-mix(in srgb, var(--gold) 26%, transparent)",
                    background:
                      "linear-gradient(150deg, color-mix(in srgb, var(--gold) 8%, transparent), transparent 82%)",
                  }}
                >
                  <span style={{ ...tinyCap, color: "var(--gold)" }}>Champion</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    {champion.honours[0]?.avatarSrc && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={champion.honours[0].avatarSrc}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={28}
                        height={28}
                        style={{
                          width: 28,
                          height: 28,
                          flex: "none",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "1px solid color-mix(in srgb, var(--gold) 50%, transparent)",
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 16,
                        letterSpacing: ".02em",
                        textTransform: "uppercase",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {champion.winnerName}
                    </span>
                    {champion.finalScore && (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontFamily: "var(--font-display)",
                          fontWeight: 600,
                          fontSize: 14,
                          fontFeatureSettings: "'tnum' 1",
                          color: "var(--gold)",
                        }}
                      >
                        {champion.finalScore}
                      </span>
                    )}
                  </span>
                </span>
              )}

              {miniResults.length > 0 && (
                <span style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <span style={tinyCap}>Recent results</span>
                  {miniResults.map((r, i) => (
                    <MiniResult key={r.id} r={r} dim={i > 0} />
                  ))}
                </span>
              )}

              {(goals || elo) && (
                <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[goals, elo].filter(Boolean).map((l) => (
                    <span
                      key={l!.key}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        padding: "9px 10px",
                        borderRadius: 9,
                        border: "1px solid var(--color-divider)",
                      }}
                    >
                      <span style={{ ...tinyCap, letterSpacing: ".16em" }}>{l!.label}</span>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 19,
                          fontFeatureSettings: "'tnum' 1",
                        }}
                      >
                        {l!.value}
                        {l!.suffix}
                      </span>
                    </span>
                  ))}
                </span>
              )}

              <span
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 2,
                  margin: "4px -14px -12px",
                  padding: "10px 8px 12px",
                  borderTop: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
                  background: "color-mix(in srgb, var(--color-bg) 62%, transparent)",
                }}
              >
                {[
                  { icon: <HomeIcon size={15} />, label: "Home", active: true },
                  { icon: <TrophySimpleIcon size={15} />, label: "Matches", active: false },
                  { icon: <AppChartIcon size={15} strokeWidth={18} />, label: "Stats", active: false },
                  { icon: <ProfileIcon size={15} strokeWidth={18} />, label: "Profile", active: false },
                ].map((tab) => (
                  <span
                    key={tab.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 8.5,
                      letterSpacing: ".06em",
                      color: tab.active
                        ? "var(--color-accent)"
                        : "color-mix(in srgb, var(--color-text) 48%, transparent)",
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </span>
                ))}
              </span>
            </span>
          </span>

          {latest && (
            <span
              style={{
                position: "absolute",
                top: "9%",
                left: "-2%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                borderRadius: 12,
                border: "1px solid color-mix(in srgb, var(--color-accent-600) 80%, transparent)",
                background: "color-mix(in srgb, var(--color-surface) 92%, transparent)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                boxShadow: "0 20px 44px rgba(0,0,0,.6)",
                animation: "bwl-float 8s ease-in-out infinite",
                maxWidth: "70%",
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 28,
                  height: 28,
                  flex: "none",
                  borderRadius: 8,
                  background: "color-mix(in srgb, var(--color-accent-800) 76%, transparent)",
                  color: "var(--color-accent-200)",
                }}
              >
                <BellIcon size={14} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: ".17em",
                    textTransform: "uppercase",
                    color: "var(--color-accent-300)",
                  }}
                >
                  Match alert
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontFeatureSettings: "'tnum' 1",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {latest.home.name} {latest.homeScore}–{latest.awayScore} {latest.away.name}
                </span>
              </span>
            </span>
          )}

          {champion && champion.road.length > 0 && (
            <span
              style={{
                position: "absolute",
                bottom: "16%",
                right: "-3%",
                display: "flex",
                flexDirection: "column",
                gap: 7,
                padding: "13px 15px",
                borderRadius: 12,
                border: "1px solid var(--color-divider)",
                background: "color-mix(in srgb, var(--color-surface) 92%, transparent)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                boxShadow: "0 20px 44px rgba(0,0,0,.6)",
                animation: "bwl-float 11s ease-in-out infinite reverse",
                maxWidth: "62%",
              }}
            >
              <span style={{ ...tinyCap, fontSize: 10, letterSpacing: ".17em" }}>Bracket</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span
                  style={{ width: 24, height: 2, borderRadius: 2, background: "var(--color-accent-700)" }}
                />
                <span
                  style={{ width: 24, height: 2, borderRadius: 2, background: "var(--color-accent)" }}
                />
                <span style={{ width: 24, height: 2, borderRadius: 2, background: "var(--gold)" }} />
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {champion.road[champion.road.length - 1]} · {champion.winnerName}
              </span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
