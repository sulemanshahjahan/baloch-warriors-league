import type { Metadata } from "next";
import { MatchesClient } from "./matches-client";

export const metadata: Metadata = {
  title: "Matches",
  description: "View all BWL match fixtures and results — upcoming, live, and completed.",
  openGraph: {
    title: "Matches | Baloch Warriors League",
    description: "All BWL fixtures, live scores, and completed match results.",
    type: "website",
  },
};

export default function MatchesPage() {
  return <MatchesClient />;
}
