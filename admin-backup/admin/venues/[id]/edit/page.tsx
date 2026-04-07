export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getVenueById, updateVenue } from "@/lib/actions/venue";
import { AdminHeader } from "@/components/admin/header";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

interface EditVenuePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditVenuePage({ params }: EditVenuePageProps) {
  const { id } = await params;
  const venue = await getVenueById(id);
  if (!venue) notFound();

  async function handleUpdate(formData: FormData) {
    "use server";
    const result = await updateVenue(id, formData);
    if (result.success) redirect("/admin/venues");
  }

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Edit Venue" description={venue.name} />
      <main className="flex-1 p-6">
        <div className="max-w-lg">
          <Link
            href="/admin/venues"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Venues
          </Link>

          <Card>
            <CardContent className="pt-6">
              <form action={handleUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Venue Name *</Label>
                  <Input id="name" name="name" defaultValue={venue.name} required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" defaultValue={venue.city ?? ""} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" defaultValue={venue.address ?? ""} />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit">Save Changes</Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/admin/venues">Cancel</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
