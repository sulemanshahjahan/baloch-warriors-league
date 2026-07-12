"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { generateScheduleForMatch, adminSetManualTime } from "@/lib/actions/scheduling-admin";

export function FixtureActions({ matchId, assignable }: { matchId: string; assignable: boolean }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");

  function regenerate() {
    setMsg("");
    start(async () => {
      const r = await generateScheduleForMatch(matchId);
      if (!r.success) return setMsg(r.error);
      router.refresh();
    });
  }

  function setManual() {
    setMsg("");
    start(async () => {
      const r = await adminSetManualTime(matchId, time, reason);
      if (!r.success) return setMsg(r.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={regenerate} disabled={isPending || !assignable} title={assignable ? "Regenerate proposed slots" : "Both participants must be assigned"}>
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" title="Set an official time (override)">
            <Clock className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set official time</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Kickoff (PKT)</Label>
              <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Reason (required — audit trail)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Final — fixed broadcast slot" />
            </div>
            {msg && <p className="text-sm text-red-400">{msg}</p>}
            <Button onClick={setManual} disabled={isPending || !time || !reason.trim()} className="w-full">
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Schedule match
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {msg && !open && <span className="text-xs text-red-400 ml-1">{msg}</span>}
    </div>
  );
}
