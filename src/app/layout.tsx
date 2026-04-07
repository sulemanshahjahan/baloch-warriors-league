import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { LoadingProgress } from "@/components/loading-progress";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { OfflineProvider } from "@/lib/offline/provider";
import { OfflineIndicator } from "@/components/offline/offline-indicator";

export const metadata: Metadata = {
  title: {
    default: "Baloch Warriors League",
    template: "%s | BWL",
  },
  description:
    "Official website of the Baloch Warriors League — tracking tournaments, matches, players, and stats across Football, eFootball, PUBG, Snooker, and Checkers.",
  keywords: ["Baloch Warriors League", "BWL", "football", "PUBG", "snooker", "tournament"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BWL",
  },
};

export const viewport: Viewport = {
  themeColor: "#eab308",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="BWL" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BWL" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <OfflineProvider>
          <Suspense fallback={null}>
            <LoadingProgress />
          </Suspense>
          {children}
          <OfflineIndicator />
        </OfflineProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
