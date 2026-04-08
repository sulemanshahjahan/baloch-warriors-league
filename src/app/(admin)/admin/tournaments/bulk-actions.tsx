"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteBar } from "@/components/admin/bulk-delete-bar";
import { bulkDeleteTournaments } from "@/lib/actions/tournament";

interface Tournament {
  id: string;
  name: string;
}

export function TournamentBulkSelect({ tournaments }: { tournaments: Tournament[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === tournaments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tournaments.map((t) => t.id)));
    }
  }

  return (
    <>
      {/* Select all checkbox */}
      <div className="flex items-center gap-2 mb-3">
        <Checkbox
          checked={selected.size === tournaments.length && tournaments.length > 0}
          onCheckedChange={toggleAll}
        />
        <span className="text-xs text-muted-foreground">
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </span>
      </div>

      {/* Per-row checkboxes rendered via render prop pattern */}
      {tournaments.map((t) => (
        <div key={t.id} className="hidden">
          <input
            type="checkbox"
            id={`bulk-${t.id}`}
            checked={selected.has(t.id)}
            onChange={() => toggle(t.id)}
          />
        </div>
      ))}

      <BulkDeleteBar
        selectedIds={[...selected]}
        entityName="tournament"
        onClear={() => setSelected(new Set())}
        onDelete={async (ids) => {
          const result = await bulkDeleteTournaments(ids);
          return { success: result.success, error: result.success ? undefined : result.error };
        }}
      />
    </>
  );
}

export function TournamentRowCheckbox({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: () => void;
}) {
  return <Checkbox checked={checked} onCheckedChange={onChange} />;
}
