"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface TeamsSearchProps {
  initialSearch?: string;
}

export function TeamsSearch({ initialSearch }: TeamsSearchProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearch ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    } else {
      params.delete("search");
    }
    params.delete("page");
    router.push(`/admin/teams?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full sm:w-auto">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search teams..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-9 w-full sm:w-[250px]"
      />
    </form>
  );
}
