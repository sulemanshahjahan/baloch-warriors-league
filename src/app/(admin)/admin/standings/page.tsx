import { redirect } from "next/navigation";

// Standings are managed per-tournament. Redirect to tournaments list.
export default function StandingsPage() {
  redirect("/admin/tournaments");
}
