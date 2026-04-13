"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserPlus, Phone, MapPin, Loader2 } from "lucide-react";
import { approveRegistration, rejectRegistration } from "@/lib/actions/registration";

interface Registration {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  position: string | null;
  nationality: string | null;
  createdAt: Date;
}

interface RegistrationQueueProps {
  registrations: Registration[];
}

function RegistrationCard({ reg }: { reg: Registration }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const result = await approveRegistration(reg.id);
      if (result.success) {
        setResolved("approved");
        router.refresh();
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectRegistration(reg.id);
      if (result.success) {
        setResolved("rejected");
        router.refresh();
      }
    });
  }

  if (resolved) {
    return (
      <div className={`p-4 rounded-lg border ${resolved === "approved" ? "border-emerald-500/20 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5"}`}>
        <div className="flex items-center gap-2 text-sm">
          {resolved === "approved" ? (
            <><Check className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">{reg.name} approved — WhatsApp notification sent</span></>
          ) : (
            <><X className="w-4 h-4 text-destructive" /><span className="text-destructive">{reg.name} rejected</span></>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{reg.name}</p>
          {reg.nickname && (
            <p className="text-xs text-muted-foreground">"{reg.nickname}"</p>
          )}
        </div>
        <Badge variant="outline" className="text-amber-400 border-amber-400/30">
          Pending
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {reg.phone && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {reg.phone}
          </span>
        )}
        {reg.position && (
          <span>{reg.position}</span>
        )}
        {reg.nationality && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {reg.nationality}
          </span>
        )}
        <span>
          {new Date(reg.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleReject}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          Reject
        </Button>
      </div>
    </div>
  );
}

export function RegistrationQueue({ registrations }: RegistrationQueueProps) {
  if (registrations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No pending registrations.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Share <span className="font-mono text-foreground">bwlleague.com/register</span> with players to let them sign up.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl space-y-3">
      {registrations.map((reg) => (
        <RegistrationCard key={reg.id} reg={reg} />
      ))}
    </div>
  );
}
