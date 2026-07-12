"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Wand2,
  LayoutTemplate,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { submitAvailabilityPeriod } from "@/lib/actions/player-availability";
import type { MonthStats } from "@/lib/scheduling/blocks";
import { DayEditor } from "./day-editor";
import { BulkTools } from "./bulk-tools";
import { TemplatesDialog, type TemplateSummary } from "./templates-dialog";
import {
  STATUS_META,
  WEEKDAY_LABELS,
  MONTH_LABELS,
  fmtTimeRange,
  type DayBlock,
  type AvailabilityStatus,
} from "./shared";

type PeriodStatus = "DRAFT" | "SUBMITTED" | "LOCKED" | "REOPENED" | null;

interface RequirementCheck {
  ok: boolean;
  hardFailures: string[];
  softWarnings: string[];
  qualifyingSlots: number;
}

interface Props {
  month: number;
  year: number;
  periodStatus: PeriodStatus;
  submittedAt: string | null;
  blocks: DayBlock[];
  stats: MonthStats;
  requirementMode: "HARD" | "SOFT" | "DISABLED";
  requirementCheck: RequirementCheck;
  requirementTournaments: { id: string; name: string }[];
  templates: TemplateSummary[];
  matchDates: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

export function AvailabilityClient(props: Props) {
  const { month, year, blocks, stats, matchDates } = props;
  const router = useRouter();
  const [view, setView] = useState<"month" | "list">("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [ack, setAck] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [isPending, startSubmit] = useTransition();

  const canEdit = props.periodStatus !== "LOCKED";
  const isSubmitted = props.periodStatus === "SUBMITTED";
  const matchSet = new Set(matchDates);

  const blocksByDate = new Map<string, DayBlock[]>();
  for (const b of blocks) {
    (blocksByDate.get(b.date) ?? blocksByDate.set(b.date, []).get(b.date)!).push(b);
  }

  function refresh() {
    router.refresh();
  }

  function navMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    router.push(`/player/availability?m=${y}-${pad(m)}`);
  }

  function submit() {
    setSubmitMsg("");
    startSubmit(async () => {
      const r = await submitAvailabilityPeriod({ month, year, acknowledge: true });
      if (!r.success) return setSubmitMsg(r.error);
      setSubmitMsg(
        r.data.warnings.length ? `Submitted with notes: ${r.data.warnings.join(" ")}` : "Availability submitted ✓"
      );
      refresh();
    });
  }

  // ── calendar grid geometry ──
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(`${year}-${pad(month)}-01T12:00:00Z`).getUTCDay();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-40 md:pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" /> My Availability
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">All times shown in PKT. <Link href="/player/schedule" className="text-primary hover:underline">Scheduling dashboard →</Link></p>
        </div>
        <StatusBadge status={props.periodStatus} />
      </div>

      {/* Month nav + view toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navMonth(-1)} aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></Button>
          <div className="w-40 text-center font-semibold">{MONTH_LABELS[month - 1]} {year}</div>
          <Button variant="outline" size="icon" onClick={() => navMonth(1)} aria-label="Next month"><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="flex rounded-md border border-border overflow-hidden">
          <button onClick={() => setView("month")} className={`px-2.5 py-1.5 text-sm flex items-center gap-1 ${view === "month" ? "bg-secondary" : ""}`}><CalendarDays className="w-4 h-4" /><span className="hidden sm:inline">Month</span></button>
          <button onClick={() => setView("list")} className={`px-2.5 py-1.5 text-sm flex items-center gap-1 border-l border-border ${view === "list" ? "bg-secondary" : ""}`}><List className="w-4 h-4" /><span className="hidden sm:inline">List</span></button>
        </div>
      </div>

      {/* Stats strip */}
      <StatsStrip stats={stats} />

      {/* Requirements */}
      {props.requirementMode !== "DISABLED" && (
        <RequirementPanel check={props.requirementCheck} mode={props.requirementMode} tournaments={props.requirementTournaments} />
      )}

      {/* Tools */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBulk(true)}><Wand2 className="w-4 h-4 mr-1.5" />Bulk tools</Button>
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}><LayoutTemplate className="w-4 h-4 mr-1.5" />Templates</Button>
        </div>
      )}

      {/* Calendar / list */}
      {view === "month" ? (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="text-center text-[11px] font-medium text-muted-foreground py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => (
              <DayCell
                key={i}
                date={date}
                blocks={date ? blocksByDate.get(date) ?? [] : []}
                hasMatch={date ? matchSet.has(date) : false}
                onClick={() => date && setSelectedDate(date)}
              />
            ))}
          </div>
        </div>
      ) : (
        <ListView
          year={year}
          month={month}
          blocksByDate={blocksByDate}
          matchSet={matchSet}
          onPick={(d) => setSelectedDate(d)}
        />
      )}

      {/* Legend */}
      <Legend />

      {/* Submit bar */}
      <div className="fixed above-mobile-tabbar inset-x-0 border-t border-border bg-background/95 backdrop-blur z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-2">
          {submitMsg && <p className="text-sm text-emerald-400">{submitMsg}</p>}
          {!canEdit ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Lock className="w-4 h-4" /> This month is locked. Ask an admin to reopen it to make changes.</p>
          ) : (
            <div className="flex items-center gap-3">
              <label className="flex items-start gap-2 text-xs text-muted-foreground flex-1 cursor-pointer">
                <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
                <span>I understand BWL may schedule my matches within the availability I submit.</span>
              </label>
              <Button onClick={submit} disabled={isPending || !ack || !props.requirementCheck.ok}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                {isSubmitted ? "Update submission" : "Submit availability"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <DayEditor date={selectedDate} blocks={blocks} canEdit={canEdit} onClose={() => setSelectedDate(null)} onChanged={refresh} />
      <BulkTools open={showBulk} month={month} year={year} onClose={() => setShowBulk(false)} onChanged={refresh} />
      <TemplatesDialog open={showTemplates} templates={props.templates} blocks={blocks} month={month} year={year} onClose={() => setShowTemplates(false)} onChanged={refresh} />
    </div>
  );
}

function StatusBadge({ status }: { status: PeriodStatus }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    SUBMITTED: { label: "Submitted", cls: "bg-green-500/15 text-green-300 border border-green-500/30" },
    LOCKED: { label: "Locked", cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
    REOPENED: { label: "Reopened", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  };
  const m = map[status ?? "DRAFT"] ?? map.DRAFT;
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${m.cls}`}>{m.label}</span>;
}

function StatsStrip({ stats }: { stats: MonthStats }) {
  const items = [
    { label: "Available days", value: stats.availableDays },
    { label: "Hours", value: stats.availableHours },
    { label: "Confirmed", value: stats.confirmedSlots },
    { label: "Likely", value: stats.likelySlots },
    { label: "Shift TBD", value: stats.unknownShiftDays },
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border border-border bg-card px-3 py-2">
          <div className="text-lg font-bold leading-none">{it.value}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

function RequirementPanel({
  check,
  mode,
  tournaments,
}: {
  check: RequirementCheck;
  mode: "HARD" | "SOFT" | "DISABLED";
  tournaments: { id: string; name: string }[];
}) {
  const issues = [...check.hardFailures, ...check.softWarnings];
  const met = issues.length === 0;
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm ${met ? "border-green-500/30 bg-green-500/5" : mode === "HARD" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      <div className="flex items-center gap-1.5 font-medium">
        {met ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
        {met ? "Availability requirements met" : mode === "HARD" ? "Requirements not met yet" : "Suggested availability"}
      </div>
      {tournaments.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">For: {tournaments.map((t) => t.name).join(", ")}</p>
      )}
      {!met && (
        <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 text-muted-foreground">
          {issues.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}

function DayCell({
  date,
  blocks,
  hasMatch,
  onClick,
}: {
  date: string | null;
  blocks: DayBlock[];
  hasMatch: boolean;
  onClick: () => void;
}) {
  if (!date) return <div className="aspect-square" />;
  const dayNum = Number(date.slice(8, 10));
  // Dominant cell colour = highest-priority status present.
  const priority: AvailabilityStatus[] = ["CONFIRMED", "LIKELY", "IF_NEEDED", "SHIFT_UNCONFIRMED", "UNAVAILABLE"];
  const dominant = priority.find((p) => blocks.some((b) => b.status === p));
  const cell = dominant ? STATUS_META[dominant].cell : "";
  return (
    <button
      onClick={onClick}
      className={`aspect-square rounded-md border p-1 flex flex-col items-stretch text-left min-h-[44px] transition-colors ${cell || "border-border bg-card hover:bg-secondary"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{dayNum}</span>
        {hasMatch && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Scheduled match" />}
      </div>
      <div className="mt-auto flex flex-wrap gap-0.5">
        {blocks.slice(0, 3).map((b) => (
          <span key={b.id} className={`w-1.5 h-1.5 rounded-full ${STATUS_META[b.status].dot}`} />
        ))}
      </div>
    </button>
  );
}

function ListView({
  year,
  month,
  blocksByDate,
  matchSet,
  onPick,
}: {
  year: number;
  month: number;
  blocksByDate: Map<string, DayBlock[]>;
  matchSet: Set<string>;
  onPick: (d: string) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows = Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
  return (
    <div className="space-y-1.5">
      {rows.map((d) => {
        const bs = blocksByDate.get(d) ?? [];
        const wd = WEEKDAY_LABELS[new Date(`${d}T12:00:00Z`).getUTCDay()];
        return (
          <button key={d} onClick={() => onPick(d)} className="w-full flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-secondary min-h-[48px]">
            <div className="w-12 shrink-0">
              <div className="text-sm font-semibold">{wd} {Number(d.slice(8, 10))}</div>
            </div>
            <div className="flex-1 flex flex-wrap gap-1">
              {bs.length === 0 && <span className="text-xs text-muted-foreground">Tap to add</span>}
              {bs.map((b) => (
                <span key={b.id} className={`text-[11px] px-1.5 py-0.5 rounded ${STATUS_META[b.status].chip}`}>
                  {STATUS_META[b.status].short} {b.isAllDay ? "" : `· ${fmtTimeRange(b)}`}
                </span>
              ))}
            </div>
            {matchSet.has(d) && <span className="text-[11px] text-primary font-medium shrink-0">match</span>}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  const shown: AvailabilityStatus[] = ["CONFIRMED", "LIKELY", "IF_NEEDED", "SHIFT_UNCONFIRMED", "UNAVAILABLE"];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {shown.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[s].dot}`} />
          {STATUS_META[s].label}
        </span>
      ))}
    </div>
  );
}
