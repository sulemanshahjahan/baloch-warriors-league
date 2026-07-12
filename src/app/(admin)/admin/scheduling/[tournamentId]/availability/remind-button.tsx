"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { remindNonSubmitters } from "@/lib/actions/scheduling-admin";

export function RemindButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          start(async () => {
            const r = await remindNonSubmitters(tournamentId);
            setMsg(r.success ? r.message ?? "Reminder sent." : r.error);
            if (r.success) router.refresh();
          })
        }
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Bell className="w-4 h-4 mr-1.5" />}
        Remind non-submitters
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
