import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";

// Generate static pages for all matches at build time
export async function generateStaticParams() {
  const matches = await prisma.match.findMany({
    select: { id: true },
  });
  
  return matches.map((m) => ({
    id: m.id,
  }));
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Star,
  Trophy,
  Swords,
  Target,
  HandMetal,
  Square,
  AlertTriangle,
  ChevronRight,
  Share2,
} from "lucide-react";
import {
  formatDateTime,
  gameLabel,
  gameColor,
  statusColor,
  statusLabel,
  getInitials,
} from "@/lib/utils";

interface MatchPageProps {
  params: Promise<{ id: string }>;
}

async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      tournament: {
        select: { id: true, name: true, slug: true, gameCategory: true },
      },
      homeTeam: {
        select: { id: true, name: true, shortName: true, logoUrl: true, slug: true },
      },
      awayTeam: {
        select: { id: true, name: true, shortName: true, logoUrl: true, slug: true },
      },
      homePlayer: {
        select: { id: true, name: true, slug: true, photoUrl: true },
      },
      awayPlayer: {
        select: { id: true, name: true, slug: true, photoUrl: true },
      },
      motmPlayer: {
        select: { id: true, name: true, slug: true },
      },
      venue: true,
      events: {
        where: {
          description: { not: "Auto-generated from match result" },
        },
        orderBy: { minute: "asc" },
        include: {
          player: { select: { id: true, name: true, slug: true } },
          team: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) return { title: "Match Not Found" };

  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
  const score =
    match.status === "COMPLETED" || match.status === "LIVE"
      ? ` ${match.homeScore ?? 0}–${match.awayScore ?? 0}`
      : "";

  return {
    title: `${homeName} vs ${awayName}${score} | ${match.tournament.name}`,
    description: `Match result and events from ${match.tournament.name}.`,
    openGraph: {
      title: `${homeName} vs ${awayName}${score} | ${match.tournament.name}`,
      description: `Match result and events from ${match.tournament.name}.`,
      images: [`/matches/${id}/opengraph-image`],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${homeName} vs ${awayName}${score} | ${match.tournament.name}`,
      description: `Match result and events from ${match.tournament.name}.`,
      images: [`/matches/${id}/opengraph-image`],
    },
  };
}

const eventIcon: Record<string, React.ReactNode> = {
  GOAL: <Target className="w-4 h-4 text-green-400" />,
  PENALTY_GOAL: <Target className="w-4 h-4 text-green-400" />,
  OWN_GOAL: <Target className="w-4 h-4 text-red-400" />,
  ASSIST: <HandMetal className="w-4 h-4 text-blue-400" />,
  YELLOW_CARD: <Square className="w-4 h-4 text-yellow-400 fill-yellow-400" />,
  RED_CARD: <Square className="w-4 h-4 text-red-500 fill-red-500" />,
  MOTM: <Star className="w-4 h-4 text-amber-400 fill-amber-400" />,
  KILL: <Swords className="w-4 h-4 text-orange-400" />,
  FRAME_WIN: <Trophy className="w-4 h-4 text-teal-400" />,
  MVP: <Star className="w-4 h-4 text-amber-400 fill-amber-400" />,
  CLEAN_SHEET: <AlertTriangle className="w-4 h-4 text-emerald-400" />,
  PENALTY_MISS: <Target className="w-4 h-4 text-muted-foreground" />,
};

const eventLabel: Record<string, string> = {
  GOAL: "Goal",
  PENALTY_GOAL: "Penalty",
  OWN_GOAL: "Own Goal",
  ASSIST: "Assist",
  YELLOW_CARD: "Yellow Card",
  RED_CARD: "Red Card",
  MOTM: "Man of the Match",
  KILL: "Kill",
  FRAME_WIN: "Frame Won",
  MVP: "MVP",
  CLEAN_SHEET: "Clean Sheet",
  PENALTY_MISS: "Penalty Miss",
  CUSTOM: "Event",
};

export default async function MatchDetailPage({ params }: MatchPageProps) {
  const { id } = await params;
  const match = await getMatch(id);

  if (!match) notFound();

  const isCompleted = match.status === "COMPLETED";
  const isLive = match.status === "LIVE";
  const showScore = isCompleted || isLive;

  const homeName = match.homePlayer?.name ?? match.homeTeam?.name ?? "TBD";
  const awayName = match.awayPlayer?.name ?? match.awayTeam?.name ?? "TBD";
  const homeLogo = match.homePlayer?.photoUrl ?? match.homeTeam?.logoUrl;
  const awayLogo = match.awayPlayer?.photoUrl ?? match.awayTeam?.logoUrl;
  const homeSlug = match.homePlayer
    ? `/players/${match.homePlayer.slug}`
    : match.homeTeam
      ? `/teams/${match.homeTeam.slug}`
      : null;
  const awaySlug = match.awayPlayer
    ? `/players/${match.awayPlayer.slug}`
    : match.awayTeam
      ? `/teams/${match.awayTeam.slug}`
      : null;

  // Split events by side
  const homeId = match.homeTeam?.id ?? match.homePlayer?.id;
  const awayId = match.awayTeam?.id ?? match.awayPlayer?.id;

  const homeEvents = match.events.filter(
    (e) => e.teamId === homeId || e.playerId === match.homePlayer?.id
  );
  const awayEvents = match.events.filter(
    (e) => e.teamId === awayId || e.playerId === match.awayPlayer?.id
  );
  // Neutral events (no team/player assignment or MOTM)
  const neutralEvents = match.events.filter(
    (e) =>
      !e.teamId &&
      e.playerId !== match.homePlayer?.id &&
      e.playerId !== match.awayPlayer?.id
  );

  const allEventsChronological = [...match.events].sort(
    (a, b) => (a.minute ?? 999) - (b.minute ?? 999)
  );

  return (
    <div className="min-h-screen">
      {/* Back */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Link
          href="/matches"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Matches
        </Link>
      </div>

      {/* Score Hero */}
      <section className="border-b border-border/50 bg-card/30 mt-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Tournament + status row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <Link
              href={`/tournaments/${match.tournament.slug}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trophy className="w-4 h-4" />
              {match.tournament.name}
              <ChevronRight className="w-3 h-3" />
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${gameColor(match.tournament.gameCategory)}`}
              >
                {gameLabel(match.tournament.gameCategory)}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(match.status)}`}
              >
                {statusLabel(match.status)}
              </span>
            </div>
          </div>

          {match.round && (
            <p className="text-sm text-muted-foreground text-center mb-4">{match.round}</p>
          )}

          {/* Main scoreline */}
          <div className="flex items-center justify-between gap-4">
            {/* Home */}
            <div className="flex-1 flex flex-col items-center gap-3">
              {homeSlug ? (
                <Link href={homeSlug}>
                  <Avatar className="h-20 w-20 ring-2 ring-border hover:ring-primary transition-all">
                    <AvatarImage src={homeLogo ?? undefined} />
                    <AvatarFallback className="text-lg font-bold">
                      {getInitials(homeName)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <Avatar className="h-20 w-20 ring-2 ring-border">
                  <AvatarImage src={homeLogo ?? undefined} />
                  <AvatarFallback className="text-lg font-bold">
                    {getInitials(homeName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="text-center">
                <p className="font-bold text-lg leading-tight">{homeName}</p>
                {match.homeTeam?.shortName && (
                  <p className="text-xs text-muted-foreground">
                    {match.homeTeam.shortName}
                  </p>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="text-center shrink-0 px-4">
              {showScore ? (
                <>
                  <div className="text-5xl font-black tabular-nums">
                    {match.homeScore ?? 0}
                    <span className="text-muted-foreground mx-2 font-light text-3xl">–</span>
                    {match.awayScore ?? 0}
                  </div>
                  {(match.homeScorePens != null || match.awayScorePens != null) && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ({match.homeScorePens ?? 0} – {match.awayScorePens ?? 0} pens)
                    </p>
                  )}
                </>
              ) : (
                <div className="text-3xl font-bold text-muted-foreground">vs</div>
              )}
            </div>

            {/* Away */}
            <div className="flex-1 flex flex-col items-center gap-3">
              {awaySlug ? (
                <Link href={awaySlug}>
                  <Avatar className="h-20 w-20 ring-2 ring-border hover:ring-primary transition-all">
                    <AvatarImage src={awayLogo ?? undefined} />
                    <AvatarFallback className="text-lg font-bold">
                      {getInitials(awayName)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              ) : (
                <Avatar className="h-20 w-20 ring-2 ring-border">
                  <AvatarImage src={awayLogo ?? undefined} />
                  <AvatarFallback className="text-lg font-bold">
                    {getInitials(awayName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="text-center">
                <p className="font-bold text-lg leading-tight">{awayName}</p>
                {match.awayTeam?.shortName && (
                  <p className="text-xs text-muted-foreground">
                    {match.awayTeam.shortName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Match meta */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm text-muted-foreground">
            {match.scheduledAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDateTime(match.scheduledAt)}
              </div>
            )}
            {match.venue && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {match.venue.name}
                {match.venue.city && `, ${match.venue.city}`}
              </div>
            )}
          </div>

          {/* MOTM */}
          {match.motmPlayer && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-muted-foreground">Man of the Match:</span>
              <Link
                href={`/players/${match.motmPlayer.slug}`}
                className="font-semibold hover:text-primary transition-colors"
              >
                {match.motmPlayer.name}
              </Link>
            </div>
          )}

          {/* Social Share Buttons */}
          {isCompleted && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Share2 className="w-3 h-3" />
                Share:
              </span>
              <ShareButtons
                homeName={homeName}
                awayName={awayName}
                homeScore={match.homeScore ?? 0}
                awayScore={match.awayScore ?? 0}
                tournamentName={match.tournament.name}
                matchId={match.id}
              />
            </div>
          )}
        </div>
      </section>

      {/* Match Events */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {allEventsChronological.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {allEventsChronological.map((event) => {
                const isHomeEvent =
                  event.teamId === homeId ||
                  (match.homePlayer && event.playerId === match.homePlayer.id);
                const isAwayEvent =
                  event.teamId === awayId ||
                  (match.awayPlayer && event.playerId === match.awayPlayer.id);

                return (
                  <div
                    key={event.id}
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
                      isHomeEvent
                        ? "bg-card/60 flex-row"
                        : isAwayEvent
                          ? "bg-card/60 flex-row-reverse"
                          : "bg-card/60 justify-center"
                    }`}
                  >
                    {/* Minute */}
                    <span className="text-xs font-mono text-muted-foreground w-10 shrink-0 text-center">
                      {event.minute != null ? `${event.minute}'` : "–"}
                    </span>

                    {/* Icon */}
                    <span className="shrink-0">
                      {eventIcon[event.type] ?? (
                        <Swords className="w-4 h-4 text-muted-foreground" />
                      )}
                    </span>

                    {/* Detail */}
                    <div className={`flex-1 min-w-0 ${isAwayEvent ? "text-right" : ""}`}>
                      <span className="text-sm font-medium">
                        {eventLabel[event.type] ?? event.type}
                      </span>
                      {event.player && (
                        <Link
                          href={`/players/${event.player.slug}`}
                          className="text-sm text-primary hover:underline ml-1.5"
                        >
                          {event.player.name}
                        </Link>
                      )}
                      {event.description &&
                        event.description !== "Auto-generated from match result" && (
                          <span className="text-xs text-muted-foreground ml-1.5">
                            {event.description}
                          </span>
                        )}
                    </div>

                    {/* Team badge */}
                    {event.team && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {event.team.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {allEventsChronological.length === 0 && isCompleted && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No detailed events recorded for this match.
          </div>
        )}

        {/* Back to tournament */}
        <div className="text-center pt-4">
          <Link
            href={`/tournaments/${match.tournament.slug}`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Trophy className="w-4 h-4" />
            View full tournament
          </Link>
        </div>
      </div>
    </div>
  );
}

// Social Share Buttons Component - Pure HTML, Zero JS
function ShareButtons({
  homeName,
  awayName,
  homeScore,
  awayScore,
  tournamentName,
  matchId,
}: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  tournamentName: string;
  matchId: string;
}) {
  const scoreText = `${homeName} ${homeScore}–${awayScore} ${awayName}`;
  const shareText = `${scoreText} | ${tournamentName}`;
  const shareUrl = `https://bwlleague.com/matches/${matchId}`;
  
  // WhatsApp share URL
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  
  // Twitter/X share URL
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/10 text-green-500 text-xs font-medium hover:bg-green-500/20 transition-colors"
        aria-label="Share on WhatsApp"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        WhatsApp
      </a>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-500/10 text-slate-300 text-xs font-medium hover:bg-slate-500/20 transition-colors"
        aria-label="Share on X"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        X
      </a>
    </div>
  );
}
