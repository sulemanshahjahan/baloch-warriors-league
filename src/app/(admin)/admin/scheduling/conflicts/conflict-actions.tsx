"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminDecideReschedule } from "@/lib/actions/reschedule";
import { adminDecideActivation } from "@/lib/actions/substitutes";
import { adminResolveNoShow, type NoShowResolution } from "@/lib/actions/checkin";
import { generateScheduleForMatch, adminSetManualTime } from "@/lib/actions/scheduling-admin";

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function useAction() {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setMsg("");
    start(async () => {
      const r = await fn();
      if (!r.success) setMsg(r.error ?? "Failed");
      else router.refresh();
    });
  };
  return { isPending, msg, run };
}

export function RescheduleDecision({ requestId, hasRequestedTime }: { requestId: string; hasRequestedTime: boolean }) {
  const { isPending, msg, run } = useAction();
  const [newTime, setNewTime] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hasRequestedTime && <Input type="datetime-local" className="h-9 w-52" value={newTime} onChange={(e) => setNewTime(e.target.value)} />}
      <Button size="sm" disabled={isPending || (!hasRequestedTime && !newTime)} onClick={() => run(() => adminDecideReschedule(requestId, "APPROVE", newTime ? { newStart: newTime } : {}))}>
        <Check className="w-4 h-4 mr-1" /> Approve
      </Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => adminDecideReschedule(requestId, "REJECT"))}>
        <X className="w-4 h-4 mr-1" /> Reject
      </Button>
      {msg && <span className="text-xs text-red-400">{msg}</span>}
    </div>
  );
}

export function ActivationDecision({ id }: { id: string }) {
  const { isPending, msg, run } = useAction();
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={isPending} onClick={() => run(() => adminDecideActivation(id, true))}><Check className="w-4 h-4 mr-1" />Approve</Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => adminDecideActivation(id, false))}><X className="w-4 h-4 mr-1" />Reject</Button>
      {msg && <span className="text-xs text-red-400">{msg}</span>}
    </div>
  );
}

export function NoShowResolve({ matchId, homeName, awayName }: { matchId: string; homeName: string; awayName: string }) {
  const { isPending, msg, run } = useAction();
  const [res, setRes] = useState<NoShowResolution>("WALKOVER_HOME");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={selectCls} value={res} onChange={(e) => setRes(e.target.value as NoShowResolution)}>
        <option value="WALKOVER_HOME">Walkover → {homeName}</option>
        <option value="WALKOVER_AWAY">Walkover → {awayName}</option>
        <option value="RESCHEDULE">Reschedule (reopen)</option>
        <option value="WARNING">Warning only</option>
        <option value="DISMISS">Dismiss</option>
      </select>
      <Button size="sm" disabled={isPending} onClick={() => run(() => adminResolveNoShow(matchId, res))}>Resolve</Button>
      {msg && <span className="text-xs text-red-400">{msg}</span>}
    </div>
  );
}

export function RegenOrTime({ matchId }: { matchId: string }) {
  const { isPending, msg, run } = useAction();
  const [time, setTime] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => generateScheduleForMatch(matchId))}>
        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}Regenerate
      </Button>
      <Input type="datetime-local" className="h-9 w-52" value={time} onChange={(e) => setTime(e.target.value)} />
      <Button size="sm" disabled={isPending || !time} onClick={() => run(() => adminSetManualTime(matchId, time, "Set from conflict queue"))}>Set time</Button>
      {msg && <span className="text-xs text-red-400">{msg}</span>}
    </div>
  );
}
