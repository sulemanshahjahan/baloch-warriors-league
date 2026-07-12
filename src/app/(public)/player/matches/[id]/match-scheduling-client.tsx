"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Star,
  LifeBuoy,
  Loader2,
  CalendarCheck,
  AlertTriangle,
  X,
  LogIn,
  CalendarClock,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import { schedulingStatusMeta, confirmationMeta, REJECT_REASONS } from "@/lib/scheduling/labels";
import type { MatchSchedulingView } from "@/lib/scheduling/view";
import { confirmSelectedSlot, switchSelectedSlot, rejectMatchTime } from "@/lib/actions/match-scheduling";
import { playerCheckIn } from "@/lib/actions/checkin";
import { createRescheduleRequest } from "@/lib/actions/reschedule";
import { requestSubstituteActivation } from "@/lib/actions/substitutes";

const RESCHEDULE_REASONS = [
  { value: "DUTY_SHIFT_CHANGED", label: "Duty / shift changed" },
  { value: "WORK_EMERGENCY", label: "Work emergency" },
  { value: "MEDICAL_FAMILY", label: "Medical / family emergency" },
  { value: "TECHNICAL", label: "Technical issue" },
  { value: "TRAVEL", label: "Travel" },
  { value: "OPPONENT_REQUEST", label: "Opponent request" },
  { value: "OTHER", label: "Other" },
];

const selectCls =
  "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MatchSchedulingClient({ view }: { view: MatchSchedulingView }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0].value);
  const [note, setNote] = useState("");
  const [rsOpen, setRsOpen] = useState(false);
  const [rsReason, setRsReason] = useState(RESCHEDULE_REASONS[0].value);
  const [rsText, setRsText] = useState("");
  const [rsEmergency, setRsEmergency] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subOrig, setSubOrig] = useState("");
  const [subNew, setSubNew] = useState("");

  const meta = schedulingStatusMeta(view.aggregateStatus);
  const isScheduled = view.aggregateStatus === "SCHEDULED" || !!view.scheduledAt;
  const canAct = view.viewer?.canAct ?? false;
  const home = view.sides.find((s) => s.sideId === "home");
  const away = view.sides.find((s) => s.sideId === "away");

  function act(fn: () => Promise<{ success: boolean; error?: string }>) {
    setMsg("");
    start(async () => {
      const r = await fn();
      if (!r.success) return setMsg(r.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-28">
      <Link href="/player/schedule" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> My schedule
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-black">{home?.label} vs {away?.label}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full ${meta.cls}`}>{meta.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{view.tournamentName} · {view.roundLabel} · times in PKT</p>
      </div>

      {/* Scheduled banner */}
      {isScheduled && view.scheduledAt && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <div className="font-semibold text-green-300">Scheduled</div>
            <div className="text-sm text-muted-foreground">{formatDateTime(new Date(view.scheduledAt))}</div>
          </div>
        </div>
      )}

      {/* No schedule / no overlap states */}
      {!view.hasSchedule && (
        <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          <Clock className="w-6 h-6 mx-auto mb-2 opacity-60" />
          No times have been proposed yet. You&apos;ll be notified when scheduling opens for this match.
        </div>
      )}
      {view.hasSchedule && view.slots.length === 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-red-300"><AlertTriangle className="w-4 h-4" /> No common time found</div>
          <p className="text-muted-foreground mt-1">The scheduler couldn&apos;t find a slot that works for everyone. An admin has been alerted and may extend the window, adjust availability, or bring in a substitute.</p>
        </div>
      )}

      {/* Deadlines */}
      {view.hasSchedule && !isScheduled && (view.confirmationDeadline || view.windowEnd) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {view.confirmationDeadline && <span>Confirm by <b className="text-foreground">{formatDateTime(new Date(view.confirmationDeadline))}</b></span>}
          {view.windowEnd && <span>Play before <b className="text-foreground">{formatDateTime(new Date(view.windowEnd))}</b></span>}
        </div>
      )}

      {/* Proposed slots */}
      {view.slots.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Proposed times</h2>
          {view.slots.map((s) => {
            const selected = s.isSelected;
            return (
              <div
                key={s.id}
                className={`rounded-lg border px-3 py-2.5 ${selected ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      {formatDateTime(new Date(s.start))}
                      {s.isPrimary && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary flex items-center gap-0.5"><Star className="w-3 h-3" />Primary</span>}
                      {s.isBackup && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">Backup</span>}
                      {s.requiresSubstitute && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 flex items-center gap-0.5"><LifeBuoy className="w-3 h-3" />Sub</span>}
                    </div>
                    {s.explanation && <div className="text-[11px] text-muted-foreground mt-0.5">{s.explanation}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">score {Math.round(s.score)}</div>
                    {selected ? (
                      <span className="text-[11px] text-primary font-medium">Selected</span>
                    ) : (
                      canAct && (
                        <button
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => act(() => switchSelectedSlot(view.matchId, s.id))}
                          disabled={isPending}
                        >
                          Choose this
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Participant confirmations */}
      {view.hasSchedule && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Confirmations</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {view.sides.map((side) => (
              <div key={side.sideId} className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1.5">{side.label}</div>
                <div className="space-y-1.5">
                  {side.players.map((p) => {
                    const cm = confirmationMeta(p.confirmationStatus);
                    return (
                      <div key={p.playerId} className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate">{p.name}{p.isCaptain ? " (C)" : ""}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${cm.cls}`}>{cm.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match management: check-in, reschedule, substitute */}
      {view.hasSchedule && (view.checkInOpen || view.canRequestReschedule || view.pendingRescheduleId || (view.mySideCaptain && view.substitutesEnabled)) && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Match management</h2>
          <div className="flex flex-wrap gap-2">
            {view.checkInOpen && (
              <Button
                variant={view.myCheckInStatus === "CHECKED_IN" || view.myCheckInStatus === "LATE" ? "outline" : "default"}
                size="sm"
                disabled={isPending || view.myCheckInStatus === "CHECKED_IN"}
                onClick={() => act(() => playerCheckIn(view.matchId))}
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                {view.myCheckInStatus === "CHECKED_IN" ? "Checked in" : view.myCheckInStatus === "LATE" ? "Checked in (late)" : "Check in"}
              </Button>
            )}
            {view.pendingRescheduleId ? (
              <span className="text-xs px-2.5 py-1.5 rounded-md bg-purple-500/15 text-purple-300 inline-flex items-center gap-1">
                <CalendarClock className="w-4 h-4" /> Reschedule requested
              </span>
            ) : view.canRequestReschedule ? (
              <Button variant="outline" size="sm" onClick={() => setRsOpen(true)}>
                <CalendarClock className="w-4 h-4 mr-1.5" /> Request reschedule
              </Button>
            ) : null}
            {view.mySideCaptain && view.substitutesEnabled && (
              <Button variant="outline" size="sm" onClick={() => setSubOpen(true)} disabled={view.registeredSubs.length === 0} title={view.registeredSubs.length === 0 ? "No approved substitutes registered" : ""}>
                <UserCog className="w-4 h-4 mr-1.5" /> Activate substitute
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Reschedules used: {view.rescheduleUsed}/{view.maxReschedules}</p>
        </div>
      )}

      {msg && <p className="text-sm text-red-400">{msg}</p>}

      {/* Action bar */}
      {canAct && view.slots.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur z-30">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <Button className="flex-1" onClick={() => act(() => confirmSelectedSlot(view.matchId))} disabled={isPending || !view.selectedSlotId}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Confirm selected time
            </Button>
            <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={isPending}>
              <X className="w-4 h-4 mr-1.5" /> Can&apos;t make it
            </Button>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject this time</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              If another proposed time works better, pick &ldquo;Choose this&rdquo; on it instead — that keeps the match on track.
            </p>
            <div>
              <Label className="text-xs">Reason</Label>
              <select className={selectCls} value={reason} onChange={(e) => setReason(e.target.value)}>
                {REJECT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the admin/opponent should know" />
            </div>
            <Button
              className="w-full"
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                act(async () => {
                  const r = await rejectMatchTime(view.matchId, reason, note || undefined);
                  if (r.success) setRejectOpen(false);
                  return r;
                })
              }
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Submit rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={rsOpen} onOpenChange={setRsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Request a reschedule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Used {view.rescheduleUsed} of {view.maxReschedules} allowed. An admin reviews and sets the new time.</p>
            <div>
              <Label className="text-xs">Reason</Label>
              <select className={selectCls} value={rsReason} onChange={(e) => setRsReason(e.target.value)}>
                {RESCHEDULE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Explanation</Label>
              <Textarea rows={2} value={rsText} onChange={(e) => setRsText(e.target.value)} placeholder="What changed?" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={rsEmergency} onChange={(e) => setRsEmergency(e.target.checked)} />
              Emergency (bypass the cutoff window)
            </label>
            <Button
              className="w-full"
              disabled={isPending || !rsText.trim()}
              onClick={() =>
                act(async () => {
                  const r = await createRescheduleRequest({ matchId: view.matchId, reasonCategory: rsReason, reasonText: rsText, isEmergency: rsEmergency });
                  if (r.success) { setRsOpen(false); setRsText(""); }
                  return r;
                })
              }
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Submit request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Substitute activation dialog */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Activate a substitute</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Player to replace</Label>
              <select className={selectCls} value={subOrig} onChange={(e) => setSubOrig(e.target.value)}>
                <option value="">Select…</option>
                {view.mySideLineup.map((p) => <option key={p.playerId} value={p.playerId}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Substitute (approved)</Label>
              <select className={selectCls} value={subNew} onChange={(e) => setSubNew(e.target.value)}>
                <option value="">Select…</option>
                {view.registeredSubs.map((p) => <option key={p.playerId} value={p.playerId}>{p.name}</option>)}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">An admin approves the swap unless captain confirmation covers it.</p>
            <Button
              className="w-full"
              disabled={isPending || !subOrig || !subNew || !view.mySideTeamId}
              onClick={() =>
                act(async () => {
                  const r = await requestSubstituteActivation({ matchId: view.matchId, teamId: view.mySideTeamId!, originalPlayerId: subOrig, substitutePlayerId: subNew });
                  if (r.success) { setSubOpen(false); setSubOrig(""); setSubNew(""); }
                  return r;
                })
              }
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Request substitute
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
