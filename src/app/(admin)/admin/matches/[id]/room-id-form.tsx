"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Copy, Check } from "lucide-react";
import { setRoomId } from "@/lib/actions/match";
import { useRouter } from "next/navigation";

interface RoomIdFormProps {
  matchId: string;
  currentRoomId: string | null;
  currentRoomPassword: string | null;
  gameCategory: string;
  matchStatus: string;
}

export function RoomIdForm({
  matchId,
  currentRoomId,
  currentRoomPassword,
  gameCategory,
  matchStatus,
}: RoomIdFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only show for online game types and non-completed matches
  const onlineGames = ["EFOOTBALL", "PUBG"];
  if (!onlineGames.includes(gameCategory)) return null;
  if (matchStatus === "COMPLETED" || matchStatus === "CANCELLED") return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    setSuccess(false);

    const fd = new FormData(e.currentTarget);
    const result = await setRoomId(matchId, fd);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  function handleCopy() {
    const text = currentRoomPassword
      ? `Room ID: ${currentRoomId}\nPassword: ${currentRoomPassword}`
      : `Room ID: ${currentRoomId}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isPUBG = gameCategory === "PUBG";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-green-400" />
          Room ID {isPUBG ? "& Password" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentRoomId && (
          <div className="mb-4 p-3 rounded-md bg-green-500/10 border border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-400">
                  Room ID: <span className="font-mono">{currentRoomId}</span>
                </p>
                {currentRoomPassword && (
                  <p className="text-sm font-medium text-green-400 mt-1">
                    Password: <span className="font-mono">{currentRoomPassword}</span>
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`grid gap-4 ${isPUBG ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            <div className="space-y-1.5">
              <Label htmlFor="roomId">Room ID</Label>
              <Input
                id="roomId"
                name="roomId"
                defaultValue={currentRoomId ?? ""}
                placeholder={isPUBG ? "e.g. 12345678" : "e.g. Friend Match code"}
              />
            </div>
            {isPUBG && (
              <div className="space-y-1.5">
                <Label htmlFor="roomPassword">Password</Label>
                <Input
                  id="roomPassword"
                  name="roomPassword"
                  defaultValue={currentRoomPassword ?? ""}
                  placeholder="Room password"
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-green-400">Room ID updated. Players have been notified!</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Saving..." : currentRoomId ? "Update Room ID" : "Set Room ID"}
            </Button>
            {currentRoomId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  const fd = new FormData();
                  fd.set("roomId", "");
                  fd.set("roomPassword", "");
                  await setRoomId(matchId, fd);
                  setLoading(false);
                  router.refresh();
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
