"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { createVenue } from "@/lib/actions/venue";

export default function NewVenuePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createVenue(new FormData(e.currentTarget));
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/admin/venues");
  }

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="New Venue" description="Add a match venue" />
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
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Venue Name *</Label>
                  <Input id="name" name="name" placeholder="e.g. BWL Arena" required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" placeholder="e.g. Quetta" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" placeholder="Full address (optional)" />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating…" : "Create Venue"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
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
