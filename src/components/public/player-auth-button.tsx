"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, LogOut } from "lucide-react";
import { playerLogout } from "@/lib/actions/player-auth";

interface Me {
  id: string;
  name: string;
  slug: string;
  coins: number;
  legacyLevel: number;
}

export function PlayerAuthButton() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setMe(d.player))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return null;

  if (!me) {
    return (
      <Link
        href="/player/login"
        className="inline-flex items-center text-sm font-medium px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/player/account" className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-md bg-muted hover:bg-muted/70 transition-colors">
        <span className="text-amber-300 flex items-center gap-1"><Coins className="w-3.5 h-3.5" />{me.coins.toLocaleString()}</span>
        <span className="text-muted-foreground hidden sm:inline">·</span>
        <span className="hidden sm:inline truncate max-w-[100px]">{me.name}</span>
      </Link>
      <button
        onClick={async () => { await playerLogout(); setMe(null); router.refresh(); }}
        className="text-muted-foreground hover:text-foreground p-1.5"
        aria-label="Log out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
