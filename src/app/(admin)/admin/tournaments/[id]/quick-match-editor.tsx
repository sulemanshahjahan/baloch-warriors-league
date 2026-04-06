"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Check, X, Loader2 } from "lucide-react";
import { updateMatchResult } from "@/lib/actions/match";
import { cn } from "@/lib/utils";

interface QuickMatchEditorProps {
  match: {
    id: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    homePlayer?: { name: string } | null;
    awayPlayer?: { name: string } | null;
    homeTeam?: { name: string } | null;
    awayTeam?: { name: string } | null;
  };
  participantType: "TEAM" | "INDIVIDUAL";
}

const statusOptions = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "LIVE", label: "Live" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "POSTPONED", label: "Postponed" },
];

export function QuickMatchEditor({ match, participantType }: QuickMatchEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [homeScore, setHomeScore] = useState(match.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(match.awayScore ?? 0);
  const [status, setStatus] = useState(match.status);

  const homeName = participantType === "INDIVIDUAL" 
    ? match.homePlayer?.name 
    : match.homeTeam?.name;
  const awayName = participantType === "INDIVIDUAL" 
    ? match.awayPlayer?.name 
    : match.awayTeam?.name;

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("homeScore", homeScore.toString());
      formData.append("awayScore", awayScore.toString());
      formData.append("status", status);
      
      const result = await updateMatchResult(match.id, formData);
      
      if (result.success) {
        setIsEditing(false);
        router.refresh();
      } else {
        console.error("Failed to update match:", result.error);
      }
    } catch (error) {
      console.error("Error updating match:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setHomeScore(match.homeScore ?? 0);
    setAwayScore(match.awayScore ?? 0);
    setStatus(match.status);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center justify-center gap-2">
        <span 
          className={cn(
            "font-bold text-sm min-w-[60px] text-center",
            match.status === "COMPLETED" ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {match.status === "COMPLETED" 
            ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}`
            : "vs"
          }
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setIsEditing(true)}
        >
          <Edit className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 min-w-[140px]">
      {/* Score inputs */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
            {homeName || "Home"}
          </span>
          <Input
            type="number"
            min={0}
            value={homeScore}
            onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
            className="w-14 h-8 text-center text-sm font-bold"
            disabled={isLoading}
          />
        </div>
        <span className="text-muted-foreground font-bold">–</span>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
            {awayName || "Away"}
          </span>
          <Input
            type="number"
            min={0}
            value={awayScore}
            onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
            className="w-14 h-8 text-center text-sm font-bold"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Status select */}
      <Select value={status} onValueChange={setStatus} disabled={isLoading}>
        <SelectTrigger className="h-7 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-green-500 hover:text-green-600 hover:bg-green-500/10"
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
          onClick={handleCancel}
          disabled={isLoading}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
