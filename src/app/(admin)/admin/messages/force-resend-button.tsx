"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { forceResendMessage } from "@/lib/actions/whatsapp-log";

export function ForceResendButton({ logId }: { logId: string; dedupKey: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handle() {
    if (loading) return;
    if (!confirm("Resend this WhatsApp message? This bypasses the dedup guard.")) return;
    setLoading(true);
    setStatus(null);
    const res = await forceResendMessage(logId);
    setLoading(false);
    setStatus(res.success ? "Resent ✓" : res.error || "Failed");
    setTimeout(() => setStatus(null), 4000);
  }

  return (
    <div className="shrink-0 flex items-center gap-2">
      {status && <span className="text-[10px] text-muted-foreground">{status}</span>}
      <Button
        variant="outline"
        size="sm"
        onClick={handle}
        disabled={loading}
        className="text-[10px] h-7"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        Resend
      </Button>
    </div>
  );
}
