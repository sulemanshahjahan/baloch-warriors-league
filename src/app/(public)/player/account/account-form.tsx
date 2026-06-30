"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { setMyPassword, playerLogout } from "@/lib/actions/player-auth";

export function AccountForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  function save() {
    setMsg("");
    start(async () => {
      const r = await setMyPassword(pw);
      setMsg(r.success ? (r.message ?? "Saved") : (r.error ?? "Failed"));
      if (r.success) { setPw(""); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{hasPassword ? "Change password" : "Set a password"}</Label>
        <Input type="password" placeholder="At least 6 characters" value={pw} onChange={(e) => setPw(e.target.value)} />
        <p className="text-xs text-muted-foreground">Lets you sign in with email + password (instead of an emailed code).</p>
      </div>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={isPending || pw.length < 6}>{isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save Password</Button>
        <Button variant="outline" onClick={async () => { await playerLogout(); router.push("/"); router.refresh(); }}>Log out</Button>
      </div>
    </div>
  );
}
