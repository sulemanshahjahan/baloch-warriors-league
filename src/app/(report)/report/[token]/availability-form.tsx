"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Clock } from "lucide-react";
import { markAvailable } from "@/lib/actions/availability";
import { useRouter } from "next/navigation";

interface AvailabilityFormProps {
  token: string;
  scheduledAt: string | null;
}

export function AvailabilityForm({ token, scheduledAt }: AvailabilityFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const defaultTime = scheduledAt
    ? new Date(scheduledAt).toISOString().slice(0, 16)
    : "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const preferredTime = fd.get("preferredTime") as string;

    startTransition(async () => {
      const result = await markAvailable(token, preferredTime || undefined);
      if (result.success) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to mark available");
      }
    });
  }

  if (success) {
    return (
      <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-emerald-400">You're marked as available!</p>
        <p className="text-xs text-muted-foreground mt-2">
          Your opponent has been notified. Coordinate and play your match!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Let your opponent know you're ready to play
      </p>

      <div className="space-y-2">
        <Label htmlFor="preferredTime" className="text-xs flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Preferred time (optional)
        </Label>
        <Input
          id="preferredTime"
          name="preferredTime"
          type="datetime-local"
          defaultValue={defaultTime}
          className="text-center"
        />
        <p className="text-xs text-muted-foreground text-center">
          Leave empty if you're flexible on timing
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md text-center">{error}</p>
      )}

      <Button type="submit" disabled={isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        I'm Available
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Your opponent will be notified via WhatsApp that you're ready.
      </p>
    </form>
  );
}
