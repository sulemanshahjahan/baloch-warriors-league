import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { LoadingProgress } from "@/components/loading-progress";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#dc2626",
};

export const metadata: Metadata = {
  title: {
    default: "Baloch Warriors League",
    template: "%s | BWL",
  },
  description:
    "Official website of the Baloch Warriors League — tracking tournaments, matches, players, and stats across Football, eFootball, PUBG, Snooker, and Checkers.",
  keywords: ["Baloch Warriors League", "BWL", "football", "PUBG", "snooker", "tournament"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('bwl-theme');if(t==='light'||(!t&&window.matchMedia('(prefers-color-scheme:light)').matches)){document.documentElement.classList.add('light')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <Suspense fallback={null}>
          <LoadingProgress />
        </Suspense>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
