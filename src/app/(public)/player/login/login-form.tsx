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
import { GoogleLoginButton } from "./google-button";

// Temporarily off until SMTP (email OTP / password reset) is configured.
// Flip to `true` to restore email + password and email-code login.
const EMAIL_LOGIN_ENABLED = false;

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
        <GoogleLoginButton onError={setError} />

        {!EMAIL_LOGIN_ENABLED && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Sign in with your Google account to continue.
          </p>
        )}

        {EMAIL_LOGIN_ENABLED && (
        <>
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
        </>
        )}
      </CardContent>
    </Card>
  );
}
