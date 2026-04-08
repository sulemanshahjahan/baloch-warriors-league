export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSeasonById, updateSeason } from "@/lib/actions/season";
import { AdminHeader } from "@/components/admin/header";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";

interface EditSeasonPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSeasonPage({ params }: EditSeasonPageProps) {
  await requireRole("ADMIN");
  const { id } = await params;
  const season = await getSeasonById(id);
  if (!season) notFound();

  async function handleUpdate(formData: FormData) {
    "use server";
    const result = await updateSeason(id, formData);
    if (result.success) redirect("/admin/seasons");
  }

  const startDateValue = season.startDate
    ? new Date(season.startDate).toISOString().split("T")[0]
    : "";
  const endDateValue = season.endDate
    ? new Date(season.endDate).toISOString().split("T")[0]
    : "";

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="Edit Season" description={season.name} />
      <main className="flex-1 p-6">
        <div className="max-w-lg">
          <Link
            href="/admin/seasons"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Seasons
          </Link>

          <Card>
            <CardContent className="pt-6">
              <form action={handleUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Season Name *</Label>
                  <Input id="name" name="name" defaultValue={season.name} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" name="startDate" type="date" defaultValue={startDateValue} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input id="endDate" name="endDate" type="date" defaultValue={endDateValue} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    value="true"
                    defaultChecked={season.isActive}
                    className="rounded border-border"
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Mark as active season
                  </Label>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit">Save Changes</Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/admin/seasons">Cancel</Link>
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
