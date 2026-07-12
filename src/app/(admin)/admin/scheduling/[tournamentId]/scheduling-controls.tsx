"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  enableTournamentScheduling,
  disableTournamentScheduling,
  updateSchedulingSettings,
  generateSchedulesForTournament,
} from "@/lib/actions/scheduling-admin";

const selectCls =
  "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Initial {
  enabled: boolean;
  schedulingMode: string;
  matchDurationMinutes: number;
  preMatchBufferMinutes: number;
  postMatchBufferMinutes: number;
  confirmationWindowHours: number;
  rescheduleCutoffHours: number;
  maxReschedules: number;
  gracePeriodMinutes: number;
  substitutesEnabled: boolean;
  captainConfirmationEnabled: boolean;
  earlyPlayEnabled: boolean;
  opponentAvailabilityVisible: boolean;
  minRequirementMode: "HARD" | "SOFT" | "DISABLED";
  minimumAvailableSlots: number | null;
  minimumAvailableDays: number | null;
  minimumSlotDuration: number | null;
  availabilityDeadline: string;
}

function NumField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SchedulingControls({ tournamentId, initial }: { tournamentId: string; initial: Initial }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [enabled, setEnabled] = useState(initial.enabled);

  const [f, setF] = useState({
    schedulingMode: initial.schedulingMode,
    matchDurationMinutes: String(initial.matchDurationMinutes),
    preMatchBufferMinutes: String(initial.preMatchBufferMinutes),
    postMatchBufferMinutes: String(initial.postMatchBufferMinutes),
    confirmationWindowHours: String(initial.confirmationWindowHours),
    rescheduleCutoffHours: String(initial.rescheduleCutoffHours),
    maxReschedules: String(initial.maxReschedules),
    gracePeriodMinutes: String(initial.gracePeriodMinutes),
    substitutesEnabled: initial.substitutesEnabled,
    captainConfirmationEnabled: initial.captainConfirmationEnabled,
    earlyPlayEnabled: initial.earlyPlayEnabled,
    opponentAvailabilityVisible: initial.opponentAvailabilityVisible,
    minRequirementMode: initial.minRequirementMode,
    minimumAvailableSlots: initial.minimumAvailableSlots == null ? "" : String(initial.minimumAvailableSlots),
    minimumAvailableDays: initial.minimumAvailableDays == null ? "" : String(initial.minimumAvailableDays),
    minimumSlotDuration: initial.minimumSlotDuration == null ? "" : String(initial.minimumSlotDuration),
    availabilityDeadline: initial.availabilityDeadline,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const [genResult, setGenResult] = useState<string>("");

  function toggleEnabled() {
    setMsg("");
    start(async () => {
      const r = enabled ? await disableTournamentScheduling(tournamentId) : await enableTournamentScheduling(tournamentId);
      if (!r.success) return setMsg(r.error);
      setEnabled(!enabled);
      setMsg(r.message ?? "Saved");
      router.refresh();
    });
  }

  function saveSettings() {
    setMsg("");
    const numOrUndef = (s: string) => (s === "" ? undefined : Number(s));
    const numOrNull = (s: string) => (s === "" ? null : Number(s));
    start(async () => {
      const r = await updateSchedulingSettings(tournamentId, {
        schedulingMode: f.schedulingMode,
        matchDurationMinutes: numOrUndef(f.matchDurationMinutes),
        preMatchBufferMinutes: numOrUndef(f.preMatchBufferMinutes),
        postMatchBufferMinutes: numOrUndef(f.postMatchBufferMinutes),
        confirmationWindowHours: numOrUndef(f.confirmationWindowHours),
        rescheduleCutoffHours: numOrUndef(f.rescheduleCutoffHours),
        maxReschedules: numOrUndef(f.maxReschedules),
        gracePeriodMinutes: numOrUndef(f.gracePeriodMinutes),
        substitutesEnabled: f.substitutesEnabled,
        captainConfirmationEnabled: f.captainConfirmationEnabled,
        earlyPlayEnabled: f.earlyPlayEnabled,
        opponentAvailabilityVisible: f.opponentAvailabilityVisible,
        minRequirementMode: f.minRequirementMode,
        minimumAvailableSlots: numOrNull(f.minimumAvailableSlots),
        minimumAvailableDays: numOrNull(f.minimumAvailableDays),
        minimumSlotDuration: numOrNull(f.minimumSlotDuration),
        availabilityDeadline: f.availabilityDeadline || null,
      });
      setMsg(r.success ? "Settings saved." : r.error);
      if (r.success) router.refresh();
    });
  }

  function generate() {
    setGenResult("");
    setMsg("");
    start(async () => {
      const r = await generateSchedulesForTournament(tournamentId);
      if (!r.success) return setGenResult(r.error);
      setGenResult(`Generated ${r.data.generated} · no common time ${r.data.noOverlap} · skipped ${r.data.skipped}`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Enable + generate */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant={enabled ? "outline" : "default"} onClick={toggleEnabled} disabled={isPending}>
            <Power className="w-4 h-4 mr-1.5" />
            {enabled ? "Scheduling on — click to disable" : "Enable scheduling"}
          </Button>
          {enabled && (
            <Button variant="secondary" onClick={generate} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
              Generate proposed slots
            </Button>
          )}
        </div>
        {genResult && <span className="text-sm text-muted-foreground">{genResult}</span>}
      </div>

      {/* Settings form */}
      <div className={enabled ? "space-y-4" : "space-y-4 opacity-60 pointer-events-none"}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Scheduling mode</Label>
            <select className={selectCls} value={f.schedulingMode} onChange={(e) => set("schedulingMode", e.target.value)}>
              <option value="AUTOMATIC">Automatic (engine picks)</option>
              <option value="ADMIN_ASSISTED">Admin-assisted (engine suggests)</option>
              <option value="PLAYER_CHOICE">Player choice (players pick & confirm)</option>
              <option value="MANUAL">Manual (admin sets time)</option>
              <option value="WINDOW">Window (play anytime in window)</option>
              <option value="OFFICIAL">Official fixed time</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Minimum-availability enforcement</Label>
            <select className={selectCls} value={f.minRequirementMode} onChange={(e) => set("minRequirementMode", e.target.value)}>
              <option value="DISABLED">Disabled</option>
              <option value="SOFT">Soft (warn only)</option>
              <option value="HARD">Hard (block submission)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumField label="Match duration (min)" value={f.matchDurationMinutes} onChange={(v) => set("matchDurationMinutes", v)} />
          <NumField label="Pre-buffer (min)" value={f.preMatchBufferMinutes} onChange={(v) => set("preMatchBufferMinutes", v)} />
          <NumField label="Post-buffer (min)" value={f.postMatchBufferMinutes} onChange={(v) => set("postMatchBufferMinutes", v)} />
          <NumField label="Confirm window (h)" value={f.confirmationWindowHours} onChange={(v) => set("confirmationWindowHours", v)} />
          <NumField label="Reschedule cutoff (h)" value={f.rescheduleCutoffHours} onChange={(v) => set("rescheduleCutoffHours", v)} />
          <NumField label="Max reschedules" value={f.maxReschedules} onChange={(v) => set("maxReschedules", v)} />
          <NumField label="Grace period (min)" value={f.gracePeriodMinutes} onChange={(v) => set("gracePeriodMinutes", v)} />
          <div>
            <Label className="text-xs">Availability deadline</Label>
            <Input type="datetime-local" value={f.availabilityDeadline} onChange={(e) => set("availabilityDeadline", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <NumField label="Min available slots" value={f.minimumAvailableSlots} onChange={(v) => set("minimumAvailableSlots", v)} hint="Blank = none" />
          <NumField label="Min available days" value={f.minimumAvailableDays} onChange={(v) => set("minimumAvailableDays", v)} hint="Blank = none" />
          <NumField label="Min slot length (min)" value={f.minimumSlotDuration} onChange={(v) => set("minimumSlotDuration", v)} hint="Blank = none" />
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <ToggleRow label="Allow registered substitutes (2v2)" checked={f.substitutesEnabled} onChange={(v) => set("substitutesEnabled", v)} />
          <ToggleRow label="Captain may confirm for the team" checked={f.captainConfirmationEnabled} onChange={(v) => set("captainConfirmationEnabled", v)} />
          <ToggleRow label="Allow early play" checked={f.earlyPlayEnabled} onChange={(v) => set("earlyPlayEnabled", v)} />
          <ToggleRow label="Opponents can see overlap" checked={f.opponentAvailabilityVisible} onChange={(v) => set("opponentAvailabilityVisible", v)} />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={saveSettings} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />} Save settings
          </Button>
          {msg && <span className="text-sm text-emerald-400">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
