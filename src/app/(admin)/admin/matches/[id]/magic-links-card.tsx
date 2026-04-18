"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, Copy, Check, RefreshCw, MessageCircle } from "lucide-react";
import { generateMatchTokens, sendMatchLinksViaWhatsApp } from "@/lib/actions/score-report";
import { useRouter } from "next/navigation";

interface MagicLinksCardProps {
  matchId: string;
  homeToken: string | null;
  awayToken: string | null;
  homeName: string;
  awayName: string;
  matchStatus: string;
  pendingReport?: {
    id: string;
    submittedBy: string;
    homeScore: number;
    awayScore: number;
    status: string;
  } | null;
}

export function MagicLinksCard({
  matchId,
  homeToken,
  awayToken,
  homeName,
  awayName,
  matchStatus,
  pendingReport,
}: MagicLinksCardProps) {
  const router = useRouter();
  const [copiedHome, setCopiedHome] = useState(false);
  const [copiedAway, setCopiedAway] = useState(false);
  const [loading, setLoading] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState<string | null>(null);

  // Only show for non-completed matches
  if (matchStatus === "COMPLETED" || matchStatus === "CANCELLED") return null;

  const baseUrl = "https://bwlleague.com";

  function copyToClipboard(token: string | null, side: "home" | "away") {
    if (!token) return;
    const url = `${baseUrl}/report/${token}`;
    navigator.clipboard.writeText(url);
    if (side === "home") {
      setCopiedHome(true);
      setTimeout(() => setCopiedHome(false), 2000);
    } else {
      setCopiedAway(true);
      setTimeout(() => setCopiedAway(false), 2000);
    }
  }

  async function handleRegenerate() {
    setLoading(true);
    await generateMatchTokens(matchId);
    setLoading(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-400" />
            Player Match Links
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {homeToken ? "Regenerate" : "Generate"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!homeToken && (
          <p className="text-xs text-muted-foreground">
            No tokens generated yet. Click &quot;Generate&quot; to create score report links.
          </p>
        )}

        {homeToken && (
          <>
            <div className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{homeName} (Home)</p>
                <p className="text-xs font-mono truncate">{baseUrl}/report/{homeToken}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(homeToken, "home")}
              >
                {copiedHome ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{awayName} (Away)</p>
                <p className="text-xs font-mono truncate">{baseUrl}/report/{awayToken}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(awayToken, "away")}
              >
                {copiedAway ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </>
        )}

        {pendingReport && (
          <div className="p-2 rounded border">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={
                pendingReport.status === "PENDING" ? "text-amber-400 border-amber-400/30" :
                pendingReport.status === "DISPUTED" ? "text-destructive border-destructive/30" :
                "text-muted-foreground"
              }>
                {pendingReport.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {pendingReport.submittedBy} reported: {pendingReport.homeScore} – {pendingReport.awayScore}
              </span>
            </div>
          </div>
        )}

        {homeToken && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setWaSending(true);
                setWaResult(null);
                const res = await sendMatchLinksViaWhatsApp(matchId);
                setWaSending(false);
                if (res.success && res.data) {
                  const { sent, skipped = 0, errors } = res.data as { sent: number; skipped?: number; errors: string[] };
                  const parts: string[] = [];
                  if (sent > 0) parts.push(`Sent to ${sent} player(s)`);
                  if (skipped > 0) parts.push(`${skipped} already sent (skipped)`);
                  if (errors.length > 0) parts.push(`issues: ${errors.join(", ")}`);
                  setWaResult(parts.join(" · ") || "No action");
                } else {
                  setWaResult(res.error ?? "Failed");
                }
              }}
              disabled={waSending}
              className="text-xs"
            >
              <MessageCircle className={`w-3 h-3 ${waSending ? "animate-pulse" : ""}`} />
              {waSending ? "Sending..." : "Send via WhatsApp"}
            </Button>
            {waResult && (
              <span className="text-xs text-muted-foreground">{waResult}</span>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Share these links with players to mark availability and coordinate matches.
        </p>
      </CardContent>
    </Card>
  );
}
