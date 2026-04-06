import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
