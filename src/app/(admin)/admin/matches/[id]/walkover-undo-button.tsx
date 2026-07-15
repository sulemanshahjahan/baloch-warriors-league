"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { undoWalkover } from "@/lib/actions/match";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";

export function WalkoverUndoButton({ matchId }: { matchId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handle = async () => {
    setLoading(true);
    const r = await undoWalkover(matchId);
    setLoading(false);
    if (r.success) {
      router.refresh();
    } else {
      alert(r.error ?? "Failed to undo walkover");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={loading}>
      <Undo2 className="w-4 h-4 mr-1" />
      {loading ? "Undoing…" : "Undo Walkover"}
    </Button>
  );
}
