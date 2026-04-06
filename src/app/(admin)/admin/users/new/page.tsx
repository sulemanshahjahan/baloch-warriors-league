"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewAdminUserPage() {
  const router = useRouter();
  const [role, setRole] = useState("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("role", role);
    const result = await createAdminUser(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/admin/users");
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
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label>Role *</Label>
                  <Select value={role} onValueChange={setRole}>
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

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating…" : "Create Account"}
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
