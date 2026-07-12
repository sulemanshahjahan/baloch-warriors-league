"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, Save, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  saveAvailabilityTemplate,
  applyAvailabilityTemplate,
  deleteAvailabilityTemplate,
} from "@/lib/actions/player-availability";
import { weekdayOf, WEEKDAY_LABELS, type DayBlock } from "./shared";

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

/** Build weekday→rules from the earliest occurrence of each weekday in the month. */
function buildRulesFromBlocks(blocks: DayBlock[]): Record<string, unknown[]> {
  const byWeekday: Record<string, DayBlock[]> = {};
  const seenDate: Record<string, string> = {};
  for (const b of [...blocks].sort((a, z) => a.date.localeCompare(z.date))) {
    const wd = String(weekdayOf(b.date));
    if (seenDate[wd] && seenDate[wd] !== b.date) continue; // only the first date of that weekday
    seenDate[wd] = b.date;
    (byWeekday[wd] ??= []).push(b);
  }
  const rules: Record<string, unknown[]> = {};
  for (const [wd, bs] of Object.entries(byWeekday)) {
    rules[wd] = bs.map((b) => ({
      status: b.status,
      isAllDay: b.isAllDay,
      startTime: b.startTime ?? undefined,
      endTime: b.endTime ?? undefined,
      isOvernight: b.isOvernight,
      dutyType: b.dutyType ?? undefined,
      note: b.note ?? undefined,
    }));
  }
  return rules;
}

export function TemplatesDialog({
  open,
  templates,
  blocks,
  month,
  year,
  onClose,
  onChanged,
}: {
  open: boolean;
  templates: TemplateSummary[];
  blocks: DayBlock[];
  month: number;
  year: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");

  function saveCurrent() {
    setMsg("");
    if (!name.trim()) return setMsg("Give the template a name.");
    if (blocks.length === 0) return setMsg("Add some availability this month first, then save it as a template.");
    const rules = buildRulesFromBlocks(blocks);
    start(async () => {
      const r = await saveAvailabilityTemplate({ name: name.trim(), rules });
      if (!r.success) return setMsg(r.error);
      setName("");
      setMsg("Template saved.");
      onChanged();
    });
  }

  function apply(id: string) {
    setMsg("");
    start(async () => {
      const r = await applyAvailabilityTemplate({ templateId: id, month, year, scope: "MONTH" });
      if (!r.success) return setMsg(r.error);
      setMsg(`Applied to ${r.data.count} day(s).`);
      onChanged();
    });
  }

  function remove(id: string) {
    setMsg("");
    start(async () => {
      const r = await deleteAvailabilityTemplate(id);
      if (!r.success) return setMsg(r.error);
      onChanged();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> Availability templates</DialogTitle>
          <DialogDescription>Reuse a weekly pattern across the month. Applying a template replaces this month&apos;s blocks.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Save current month's weekly pattern */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="text-sm font-semibold flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Save this month&apos;s weekly pattern</div>
            <p className="text-xs text-muted-foreground">
              Captures the first {WEEKDAY_LABELS.join("/")} you&apos;ve filled in and saves it as a reusable weekly template.
            </p>
            <div className="flex gap-2">
              <Input placeholder="e.g. Night duty week" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={saveCurrent} disabled={isPending}>{isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}Save</Button>
            </div>
          </div>

          {/* Existing templates */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Your templates</div>
            {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.name}{t.isDefault ? " · default" : ""}</div>
                  {t.description && <div className="text-xs text-muted-foreground truncate">{t.description}</div>}
                </div>
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => apply(t.id)}>Apply to month</Button>
                <button className="p-1.5 text-red-400 hover:text-red-300" onClick={() => remove(t.id)} aria-label="Delete template" disabled={isPending}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
