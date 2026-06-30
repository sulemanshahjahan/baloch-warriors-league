"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, KeyRound, Mail } from "lucide-react";
import { loginWithPassword, requestEmailOtp, verifyEmailOtp } from "@/lib/actions/player-auth";

export function PlayerLoginForm({ initialError }: { initialError?: string } = {}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState(initialError ?? "");
  const [info, setInfo] = useState("");

  // shared
  const [email, setEmail] = useState("");
  // password
  const [password, setPassword] = useState("");
  // otp
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");

  const done = (slug?: string) => { router.push(slug ? `/players/${slug}` : "/"); router.refresh(); };
  const reset = () => { setError(""); setInfo(""); };

  function pwLogin() {
    reset();
    start(async () => {
      const r = await loginWithPassword(email, password);
      if (r.success) done((r as { data?: { slug: string } }).data?.slug);
      else setError(r.error);
    });
  }
  function sendCode() {
    reset();
    start(async () => {
      const r = await requestEmailOtp(email);
      if (r.success) { setOtpStep("code"); setInfo(r.message ?? "Code sent."); }
      else setError(r.error);
    });
  }
  function verify() {
    reset();
    start(async () => {
      const r = await verifyEmailOtp(email, code);
      if (r.success) done((r as { data?: { slug: string } }).data?.slug);
      else setError(r.error);
    });
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-6">
        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 mb-3">{error}</p>}
        {info && <p className="text-sm text-emerald-400 bg-emerald-500/10 rounded-md px-3 py-2 mb-3">{info}</p>}

        {/* Social login */}
        <a
          href="/api/player/oauth/google"
          className="flex items-center justify-center gap-2 w-full border border-border rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors mb-3"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          Continue with Google
        </a>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or continue with</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs defaultValue="password" onValueChange={reset}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="password"><KeyRound className="w-4 h-4 mr-1.5" /> Password</TabsTrigger>
            <TabsTrigger value="otp"><Mail className="w-4 h-4 mr-1.5" /> Email code</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pwLogin()} />
            </div>
            <Button className="w-full" onClick={pwLogin} disabled={isPending || !email || !password}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Sign In
            </Button>
            <p className="text-xs text-muted-foreground text-center">No password yet? Use <strong>Email code</strong>, then set one in your account.</p>
          </TabsContent>

          <TabsContent value="otp" className="space-y-3">
            {otpStep === "email" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <p className="text-xs text-muted-foreground">We&apos;ll email you a 6-digit code.</p>
                </div>
                <Button className="w-full" onClick={sendCode} disabled={isPending || !email.includes("@")}>
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
                <button className="text-xs text-muted-foreground hover:text-foreground w-full" onClick={() => { setOtpStep("email"); setCode(""); reset(); }}>← Use a different email</button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
