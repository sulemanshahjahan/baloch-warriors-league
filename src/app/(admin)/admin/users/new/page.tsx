import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { createAdminUser } from "@/lib/actions/admin-user";
import { requireRole } from "@/lib/auth";

export default async function NewAdminUserPage() {
  await requireRole("SUPER_ADMIN");

  async function handleSubmit(formData: FormData) {
    "use server";
    const result = await createAdminUser(formData);
    if (!result.success) {
      throw new Error(result.error);
    }
    redirect("/admin/users");
  }

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader title="New Admin User" description="Create a new admin account" />
      <main className="flex-1 p-6">
        <div className="max-w-lg">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin Users
          </Link>

          <Card>
            <CardContent className="pt-6">
              <form action={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" name="name" placeholder="e.g. Ahmed Khan" required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" name="email" type="email" placeholder="admin@bwl.com" required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Min 8 characters"
                    minLength={8}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="role">Role *</Label>
                  <Select name="role" defaultValue="EDITOR">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EDITOR">Editor — News only</SelectItem>
                      <SelectItem value="ADMIN">Admin — Full management</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin — Full access + user management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit">Create Account</Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/admin/users">Cancel</Link>
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
