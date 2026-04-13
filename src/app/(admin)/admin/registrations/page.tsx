export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/header";
import { getPendingRegistrations } from "@/lib/actions/registration";
import { RegistrationQueue } from "./registration-queue";

export default async function RegistrationsPage() {
  await requireRole("ADMIN");
  const pending = await getPendingRegistrations();

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader
        title="Player Registrations"
        description={`${pending.length} pending approval`}
      />
      <main className="flex-1 p-6">
        <RegistrationQueue registrations={pending} />
      </main>
    </div>
  );
}
