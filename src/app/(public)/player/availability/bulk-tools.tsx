"use client";

import { useState, useTransition } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { bulkApplyAvailability } from "@/lib/actions/player-availability";
import { STATUS_META, DUTY_LABELS, WEEKDAY_LABELS, type AvailabilityStatus } from "./shared";

const selectCls =
  "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Mode = "WEEKDAYS" | "RANGE" | "MARK_RANGE_UNAVAILABLE" | "COPY_PREVIOUS_MONTH" | "CLEAR";
const TIMED_STATUSES: AvailabilityStatus[] = ["CONFIRMED", "LIKELY", "IF_NEEDED"];

export function BulkTools({
  open,
  month,
  year,
  onClose,
  onChanged,
}: {
  open: boolean;
  month: number;
  year: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const first = `${year}-${pad(month)}-01`;
  const last = `${year}-${pad(month)}-${pad(lastDay)}`;

  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<Mode>("WEEKDAYS");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [fromDate, setFromDate] = useState(first);
  const [toDate, setToDate] = useState(last);
  const [status, setStatus] = useState<AvailabilityStatus>("CONFIRMED");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("23:00");
  const [overnight, setOvernight] = useState(false);
  const [duty, setDuty] = useState("");

  const showBlock = mode === "WEEKDAYS" || mode === "RANGE";
  const showWeekdays = mode === "WEEKDAYS";
  const showRange = mode === "RANGE" || mode === "MARK_RANGE_UNAVAILABLE" || mode === "CLEAR";

  function toggleWeekday(i: number) {
    setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]));
  }

  function apply() {
    setMsg("");
    start(async () => {
      const r = await bulkApplyAvailability({
        month,
        year,
        mode,
        weekdays: showWeekdays ? weekdays : undefined,
        fromDate: showRange ? fromDate : undefined,
        toDate: showRange ? toDate : undefined,
        status: showBlock ? status : undefined,
        isAllDay: showBlock ? allDay : undefined,
        startTime: showBlock && !allDay ? startTime : undefined,
        endTime: showBlock && !allDay ? endTime : undefined,
        isOvernight: showBlock && !allDay ? overnight : undefined,
        dutyType: showBlock && duty ? duty : undefined,
      });
      if (!r.success) return setMsg(r.error);
      setMsg(`Applied to ${r.data.count} day(s).`);
      onChanged();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="w-4 h-4" /> Bulk tools</DialogTitle>
          <DialogDescription>Apply availability to many days at once. This replaces existing blocks on the affected days.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Action</Label>
            <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="WEEKDAYS">Repeat on selected weekdays</option>
              <option value="RANGE">Apply to a date range</option>
              <option value="MARK_RANGE_UNAVAILABLE">Mark a date range unavailable</option>
              <option value="COPY_PREVIOUS_MONTH">Copy previous month</option>
              <option value="CLEAR">Clear a date range</option>
            </select>
          </div>

          {showWeekdays && (
            <div>
              <Label className="text-xs">Weekdays</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {WEEKDAY_LABELS.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => toggleWeekday(i)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border min-w-[44px] ${
                      weekdays.includes(i)
                        ? "bg-primary/15 text-primary border-primary/40"
                        : "bg-card text-muted-foreground border-border"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" min={first} max={last} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" min={first} max={last} value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          )}

          {showBlock && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div>
                <Label className="text-xs">Status</Label>
                <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as AvailabilityStatus)}>
                  {TIMED_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label className="text-xs">All day</Label>
                <Switch checked={allDay} onCheckedChange={setAllDay} />
              </div>
              {!allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Start</Label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">End</Label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <Label className="text-xs">Crosses midnight</Label>
                    <Switch checked={overnight} onCheckedChange={setOvernight} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Duty (optional)</Label>
                    <select className={selectCls} value={duty} onChange={(e) => setDuty(e.target.value)}>
                      <option value="">—</option>
                      {Object.entries(DUTY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "COPY_PREVIOUS_MONTH" && (
            <p className="text-sm text-muted-foreground">
              Copies every block from last month onto the same day-of-month here. Existing blocks this month are replaced.
            </p>
          )}
          {mode === "MARK_RANGE_UNAVAILABLE" && (
            <p className="text-sm text-muted-foreground">Marks each day in the range fully unavailable.</p>
          )}

          {msg && <p className="text-sm text-emerald-400">{msg}</p>}
          <Button onClick={apply} disabled={isPending} className="w-full">
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
