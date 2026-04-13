"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserPlus, Check } from "lucide-react";
import { submitRegistration } from "@/lib/actions/registration";

export function RegistrationForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await submitRegistration(formData);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error ?? "Registration failed");
      }
    });
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold">Registration Submitted!</h2>
          <p className="text-muted-foreground">
            Your request has been sent to the admin for approval.
            You'll receive a WhatsApp message once you're approved.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Player Registration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g. Ahmed Khan"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname / Gamertag</Label>
            <Input
              id="nickname"
              name="nickname"
              placeholder="e.g. AK47"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp Number *</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              placeholder="+923001234567"
            />
            <p className="text-xs text-muted-foreground">
              Include country code. Used for match reminders and coordination.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                name="position"
                placeholder="e.g. FWD, MID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                name="nationality"
                placeholder="e.g. Pakistani"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Submit Registration
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Your registration will be reviewed by the admin. You'll be notified via WhatsApp once approved.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
