"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PlayerPickerProps {
  players: { slug: string; name: string }[];
  slot: "p1" | "p2";
  current: string;
}

export function PlayerPicker({ players, slot, current }: PlayerPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(slot, slug);
    // Don't allow same player on both sides
    const other = slot === "p1" ? "p2" : "p1";
    if (params.get(other) === slug) return;
    router.push(`/players/compare?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-full max-w-[180px] h-8 text-xs mx-auto">
        <SelectValue placeholder="Select player..." />
      </SelectTrigger>
      <SelectContent>
        {players.map((p) => (
          <SelectItem key={p.slug} value={p.slug}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
