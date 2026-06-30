"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Smartphone, ShieldCheck } from "lucide-react";
import { requestPlayerOtp, verifyPlayerOtp } from "@/lib/actions/player-auth";

export function PlayerLoginForm() {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function sendCode() {
    setError(""); setInfo("");
    start(async () => {
      const r = await requestPlayerOtp(phone);
      if (r.success) { setStep("code"); setInfo(r.message ?? "Code sent."); }
      else setError(r.error);
    });
  }

  function verify() {
    setError("");
    start(async () => {
      const r = await verifyPlayerOtp(phone, code);
      if (r.success) {
        const slug = (r as { data?: unknown }).data as string | undefined;
        router.push(slug ? `/players/${slug}` : "/");
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {step === "phone" ? <Smartphone className="w-5 h-5 text-primary" /> : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
          Player Login
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        {info && <p className="text-sm text-emerald-400 bg-emerald-500/10 rounded-md px-3 py-2">{info}</p>}

        {step === "phone" ? (
          <>
            <div className="space-y-1.5">
              <Label>WhatsApp number on your profile</Label>
              <Input type="tel" placeholder="+92 300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="text-xs text-muted-foreground">We&apos;ll send a 6-digit code to this WhatsApp number.</p>
            </div>
            <Button className="w-full" onClick={sendCode} disabled={isPending || phone.replace(/\D/g, "").length < 7}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Send Code
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Enter the 6-digit code</Label>
              <Input inputMode="numeric" maxLength={6} placeholder="● ● ● ● ● ●" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.4em]" />
            </div>
            <Button className="w-full" onClick={verify} disabled={isPending || code.length !== 6}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Verify & Sign In
            </Button>
            <button className="text-xs text-muted-foreground hover:text-foreground w-full" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>
              ← Use a different number
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
