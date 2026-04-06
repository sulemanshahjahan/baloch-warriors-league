export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getVenues } from "@/lib/actions/venue";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MapPin, Edit } from "lucide-react";
import { DeleteVenueButton } from "./delete-button";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Venues" };

export default async function VenuesPage() {
  await requireRole("ADMIN");
  const venues = await getVenues();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Venues"
        description={`${venues.length} venue${venues.length !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/admin/venues/new">
              <Plus className="w-4 h-4" />
              New Venue
            </Link>
          </Button>
        </div>

        {venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No venues yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add venues to assign them to matches.
            </p>
            <Button asChild>
              <Link href="/admin/venues/new">
                <Plus className="w-4 h-4" />
                Add Venue
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-center">Matches</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venues.map((venue) => (
                  <TableRow key={venue.id}>
                    <TableCell className="font-medium">{venue.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {venue.city ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {venue.address ?? "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {venue._count.matches}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/venues/${venue.id}/edit`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                        <DeleteVenueButton id={venue.id} name={venue.name} matchCount={venue._count.matches} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
