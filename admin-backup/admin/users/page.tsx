export const dynamic = "force-dynamic";

import Link from "next/link";
import { AdminHeader } from "@/components/admin/header";
import { getAdminUsers } from "@/lib/actions/admin-user";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ToggleActiveButton } from "./toggle-active-button";

export const metadata = { title: "Admin Users" };

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  ADMIN: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  EDITOR: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default async function AdminUsersPage() {
  const session = await auth();
  const currentUserId = (session?.user as { id?: string })?.id;
  const currentUserRole = (session?.user as { role?: string })?.role;
  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

  const users = await getAdminUsers();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Admin Users"
        description={`${users.length} admin account${users.length !== 1 ? "s" : ""}`}
      />

      <main className="flex-1 p-6 space-y-6">
        {!isSuperAdmin && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            Only Super Admins can create or modify admin accounts.
          </div>
        )}

        {isSuperAdmin && (
          <div className="flex justify-end">
            <Button asChild>
              <Link href="/admin/users/new">
                <Plus className="w-4 h-4" />
                New Admin User
              </Link>
            </Button>
          </div>
        )}

        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No admin users</h3>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={!user.isActive ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {user.name}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={roleColors[user.role] ?? ""}>
                        {user.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ToggleActiveButton
                            id={user.id}
                            name={user.name}
                            isActive={user.isActive}
                            isSelf={user.id === currentUserId}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Role Permissions</p>
          <p><span className="text-red-400 font-medium">Super Admin</span> — Full access, can manage admin users</p>
          <p><span className="text-blue-400 font-medium">Admin</span> — Full tournament, match, team, player, and news management</p>
          <p><span className="text-green-400 font-medium">Editor</span> — News and announcements only</p>
        </div>
      </main>
    </div>
  );
}
