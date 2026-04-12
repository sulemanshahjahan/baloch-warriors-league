export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";
import { getSettings } from "@/lib/settings";
import { NotificationSettings } from "./notification-settings";

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const settings = await getSettings();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Settings"
        description="Global app configuration"
      />
      <main className="flex-1 p-6">
        <NotificationSettings settings={settings} />
      </main>
    </div>
  );
}
