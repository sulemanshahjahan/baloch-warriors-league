"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toggleAdminUserActive } from "@/lib/actions/admin-user";
import { useRouter } from "next/navigation";

export function ToggleActiveButton({
  id,
  name,
  isActive,
  isSelf,
}: {
  id: string;
  name: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    if (isSelf) return;
    setLoading(true);
    await toggleAdminUserActive(id);
    setLoading(false);
    router.refresh();
  }

  if (isSelf) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className={isActive ? "text-destructive hover:text-destructive" : ""}
    >
      {loading ? "…" : isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
