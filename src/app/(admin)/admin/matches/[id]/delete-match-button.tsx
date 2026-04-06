"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMatch } from "@/lib/actions/match";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteMatchButtonProps {
  matchId: string;
  homeName: string;
  awayName: string;
}

export function DeleteMatchButton({ matchId, homeName, awayName }: DeleteMatchButtonProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsLoading(true);
    const result = await deleteMatch(matchId);
    setIsLoading(false);
    if (result.success) {
      setOpen(false);
      router.push("/admin/matches");
      router.refresh();
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="w-4 h-4 mr-1" />
        Delete Match
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Match?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the match
              between <strong>{homeName}</strong> and <strong>{awayName}</strong>,
              including all match events and statistics.
              {homeName !== "TBD" && awayName !== "TBD" && (
                <span className="block mt-2 text-destructive">
                  Tournament standings will be recalculated if this match was completed.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete Match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
