"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { registerSubstitute, setSubstituteRegistrationStatus } from "@/lib/actions/substitutes";

const selectCls = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm";

interface Team {
  id: string;
  name: string;
  players: { id: string; name: string }[];
}
interface Reg {
  id: string;
  teamId: string;
  playerId: string;
  playerName: string;
  status: string;
}

const STATUS_CLS: Record<string, string> = {
  APPROVED: "bg-green-500/15 text-green-300",
  PENDING: "bg-amber-500/15 text-amber-300",
  REJECTED: "bg-red-500/15 text-red-300",
  REMOVED: "bg-muted text-muted-foreground",
};

export function SubstitutesPanel({ tournamentId, teams, registrations }: { tournamentId: string; teams: Team[]; registrations: Reg[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [playerId, setPlayerId] = useState("");

  const selectedTeam = teams.find((t) => t.id === teamId);

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setMsg("");
    start(async () => {
      const r = await fn();
      if (!r.success) setMsg(r.error ?? "Failed");
      else router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Substitutes</h2>
        <p className="text-xs text-muted-foreground">Register reserve players per team. Approved subs are considered by the scheduler and can be activated for a match.</p>
      </div>

      {/* Register a substitute */}
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div>
          <Label className="text-xs">Team</Label>
          <select className={selectCls} value={teamId} onChange={(e) => { setTeamId(e.target.value); setPlayerId(""); }}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">Player</Label>
          <select className={selectCls} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Select…</option>
            {selectedTeam?.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Button disabled={isPending || !teamId || !playerId} onClick={() => run(() => registerSubstitute({ tournamentId, teamId, playerId }))}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Register
        </Button>
      </div>
      {msg && <p className="text-sm text-red-400">{msg}</p>}

      {/* Existing registrations */}
      {registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No substitutes registered yet.</p>
      ) : (
        <div className="space-y-1.5">
          {registrations.map((r) => {
            const team = teams.find((t) => t.id === r.teamId);
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{r.playerName}</div>
                  <div className="text-xs text-muted-foreground truncate">{team?.name ?? "—"}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLS[r.status] ?? "bg-muted text-muted-foreground"}`}>{r.status.toLowerCase()}</span>
                {r.status !== "APPROVED" && (
                  <button className="p-1.5 text-green-400 hover:text-green-300" title="Approve" disabled={isPending} onClick={() => run(() => setSubstituteRegistrationStatus(r.id, "APPROVED"))}><Check className="w-4 h-4" /></button>
                )}
                {r.status !== "REJECTED" && (
                  <button className="p-1.5 text-amber-400 hover:text-amber-300" title="Reject" disabled={isPending} onClick={() => run(() => setSubstituteRegistrationStatus(r.id, "REJECTED"))}><X className="w-4 h-4" /></button>
                )}
                <button className="p-1.5 text-red-400 hover:text-red-300" title="Remove" disabled={isPending} onClick={() => run(() => setSubstituteRegistrationStatus(r.id, "REMOVED"))}><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
