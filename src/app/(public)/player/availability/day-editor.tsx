"use client";

import { useState, useTransition, useEffect } from "react";
import { Loader2, Trash2, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  upsertAvailabilityBlock,
  deleteAvailabilityBlock,
  quickSetDay,
} from "@/lib/actions/player-availability";
import { STATUS_META, DUTY_LABELS, fmtTimeRange, type DayBlock, type AvailabilityStatus } from "./shared";
import { MONTH_LABELS } from "./shared";

const selectCls =
  "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const TIMED_STATUSES: AvailabilityStatus[] = ["CONFIRMED", "LIKELY", "IF_NEEDED"];

function prettyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]} ${d}, ${y}`;
}

export function DayEditor({
  date,
  blocks,
  canEdit,
  onClose,
  onChanged,
}: {
  date: string | null;
  blocks: DayBlock[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [isPending, start] = useTransition();
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Timed-block form state
  const [status, setStatus] = useState<AvailabilityStatus>("CONFIRMED");
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("23:00");
  const [overnight, setOvernight] = useState(false);
  const [duty, setDuty] = useState("");
  const [note, setNote] = useState("");
  const [privacy, setPrivacy] = useState("PRIVATE");

  useEffect(() => {
    // Reset the form each time the day changes.
    setEditingId(null);
    setErr("");
    setStatus("CONFIRMED");
    setStartTime("20:00");
    setEndTime("23:00");
    setOvernight(false);
    setDuty("");
    setNote("");
    setPrivacy("PRIVATE");
  }, [date]);

  if (!date) return null;
  const dayBlocks = blocks.filter((b) => b.date === date);

  function loadForEdit(b: DayBlock) {
    setEditingId(b.id);
    setStatus(b.status);
    setStartTime(b.startTime ?? "20:00");
    setEndTime(b.endTime ?? "23:00");
    setOvernight(b.isOvernight);
    setDuty(b.dutyType ?? "");
    setNote(b.note ?? "");
    setPrivacy(b.privacy);
    setErr("");
  }

  function saveBlock() {
    setErr("");
    start(async () => {
      const r = await upsertAvailabilityBlock({
        id: editingId ?? undefined,
        date,
        status,
        isAllDay: false,
        startTime,
        endTime,
        isOvernight: overnight,
        dutyType: duty || undefined,
        note: note || undefined,
        privacy,
      });
      if (!r.success) return setErr(r.error);
      setEditingId(null);
      setNote("");
      onChanged();
    });
  }

  function quick(s: "CONFIRMED" | "UNAVAILABLE" | "SHIFT_UNCONFIRMED" | "CLEAR") {
    setErr("");
    start(async () => {
      const r = await quickSetDay({ date: date!, status: s });
      if (!r.success) return setErr(r.error);
      onChanged();
    });
  }

  function remove(id: string) {
    setErr("");
    start(async () => {
      const r = await deleteAvailabilityBlock(id);
      if (!r.success) return setErr(r.error);
      onChanged();
    });
  }

  return (
    <Dialog open={!!date} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prettyDate(date)}</DialogTitle>
          <DialogDescription>
            {canEdit ? "Add one or more time blocks, or set the whole day." : "This month is locked — view only."}
          </DialogDescription>
        </DialogHeader>

        {/* Existing blocks */}
        <div className="space-y-2">
          {dayBlocks.length === 0 && (
            <p className="text-sm text-muted-foreground">No availability set for this day yet.</p>
          )}
          {dayBlocks.map((b) => {
            const m = STATUS_META[b.status];
            return (
              <div key={b.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${m.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.short} · {fmtTimeRange(b)}</div>
                  {(b.dutyType || b.note) && (
                    <div className="text-xs text-muted-foreground truncate">
                      {b.dutyType ? DUTY_LABELS[b.dutyType] ?? b.dutyType : ""}{b.dutyType && b.note ? " · " : ""}{b.note}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <>
                    <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => loadForEdit(b)} aria-label="Edit block">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-red-400 hover:text-red-300" onClick={() => remove(b.id)} aria-label="Delete block" disabled={isPending}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {canEdit && (
          <>
            {/* Quick whole-day actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => quick("CONFIRMED")}>All day available</Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => quick("UNAVAILABLE")}>Unavailable</Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => quick("SHIFT_UNCONFIRMED")}>Shift TBD</Button>
              <Button size="sm" variant="ghost" disabled={isPending || dayBlocks.length === 0} onClick={() => quick("CLEAR")}>Clear day</Button>
            </div>

            {/* Add / edit timed block */}
            <div className="rounded-lg border border-border p-3 space-y-3 mt-1">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                {editingId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {editingId ? "Edit time block" : "Add a time block"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Status</Label>
                  <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as AvailabilityStatus)}>
                    {TIMED_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <Label className="text-xs">Crosses midnight (e.g. 11 PM → 2 AM)</Label>
                  <Switch checked={overnight} onCheckedChange={setOvernight} />
                </div>
                <div>
                  <Label className="text-xs">Duty (optional)</Label>
                  <select className={selectCls} value={duty} onChange={(e) => setDuty(e.target.value)}>
                    <option value="">—</option>
                    {Object.entries(DUTY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Note visibility</Label>
                  <select className={selectCls} value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
                    <option value="PRIVATE">Only me &amp; admin</option>
                    <option value="TEAM_CAPTAIN">+ team captain</option>
                    <option value="TEAM">+ teammates</option>
                    <option value="ENGINE_ONLY">Scheduling only (hidden)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Note (optional)</Label>
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Free after 9:30 PM" />
                </div>
              </div>
              {err && <p className="text-sm text-red-400">{err}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={saveBlock} disabled={isPending}>
                  {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                  {editingId ? "Update block" : "Add block"}
                </Button>
                {editingId && (
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={isPending}>Cancel edit</Button>
                )}
              </div>
            </div>
          </>
        )}
        {err && !canEdit && <p className="text-sm text-red-400">{err}</p>}
      </DialogContent>
    </Dialog>
  );
}
