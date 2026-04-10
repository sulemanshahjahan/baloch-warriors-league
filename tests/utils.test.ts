import { describe, it, expect } from "vitest";
import {
  slugify,
  gameLabel,
  statusLabel,
  gameColor,
  statusColor,
  formatDate,
  formatDateTime,
  formatLabel,
  getInitials,
  getRoundDisplayName,
} from "@/lib/utils";

// ─── slugify ───────────────────────────────────────────

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips special characters", () => {
    expect(slugify("Team A! @#$")).toBe("team-a-dollar");
  });

  it("trims whitespace", () => {
    expect(slugify("  spaced  ")).toBe("spaced");
  });
});

// ─── gameLabel / statusLabel ───────────────────────────

describe("gameLabel", () => {
  it("maps known categories", () => {
    expect(gameLabel("FOOTBALL")).toBe("Football");
    expect(gameLabel("EFOOTBALL")).toBe("eFootball");
    expect(gameLabel("PUBG")).toBe("PUBG");
    expect(gameLabel("SNOOKER")).toBe("Snooker");
    expect(gameLabel("CHECKERS")).toBe("Checkers");
  });

  it("returns raw value for unknown category", () => {
    expect(gameLabel("CRICKET")).toBe("CRICKET");
  });
});

describe("statusLabel", () => {
  it("maps tournament statuses", () => {
    expect(statusLabel("ACTIVE")).toBe("Active");
    expect(statusLabel("COMPLETED")).toBe("Completed");
    expect(statusLabel("DRAFT")).toBe("Draft");
  });

  it("maps match statuses", () => {
    expect(statusLabel("LIVE")).toBe("Live");
    expect(statusLabel("SCHEDULED")).toBe("Scheduled");
    expect(statusLabel("POSTPONED")).toBe("Postponed");
  });

  it("returns raw value for unknown status", () => {
    expect(statusLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

// ─── gameColor / statusColor ───────────────────────────

describe("gameColor", () => {
  it("returns color classes for known games", () => {
    expect(gameColor("FOOTBALL")).toContain("green");
    expect(gameColor("PUBG")).toContain("orange");
  });

  it("returns gray fallback for unknown game", () => {
    expect(gameColor("UNKNOWN")).toContain("gray");
  });
});

describe("statusColor", () => {
  it("returns pulse animation for LIVE", () => {
    expect(statusColor("LIVE")).toContain("animate-pulse");
  });

  it("returns gray fallback for unknown status", () => {
    expect(statusColor("UNKNOWN")).toContain("gray");
  });
});

// ─── formatDate / formatDateTime ───────────────────────

describe("formatDate", () => {
  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-04-10T00:00:00Z"));
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/2026/);
  });

  it("formats a date string", () => {
    const result = formatDate("2025-01-15");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2025/);
  });

  it("returns empty string for null/undefined", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });
});

describe("formatDateTime", () => {
  it("includes time component", () => {
    const result = formatDateTime(new Date("2026-04-10T14:30:00Z"));
    expect(result).toMatch(/Apr/);
    // Should contain some time format
    expect(result.length).toBeGreaterThan(8);
  });

  it("returns empty string for null", () => {
    expect(formatDateTime(null)).toBe("");
  });
});

// ─── formatLabel ───────────────────────────────────────

describe("formatLabel", () => {
  it("converts SNAKE_CASE to Title Case", () => {
    expect(formatLabel("GROUP_KNOCKOUT")).toBe("Group Knockout");
    expect(formatLabel("LEAGUE")).toBe("League");
  });

  it("handles single word", () => {
    expect(formatLabel("ACTIVE")).toBe("Active");
  });
});

// ─── getInitials ───────────────────────────────────────

describe("getInitials", () => {
  it("extracts first letters of words", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("caps at 2 characters", () => {
    expect(getInitials("John A Doe")).toBe("JA");
  });

  it("handles single name", () => {
    expect(getInitials("John")).toBe("J");
  });
});

// ─── getRoundDisplayName ───────────────────────────────

describe("getRoundDisplayName", () => {
  it("recognizes 'Final' in round name", () => {
    expect(getRoundDisplayName("Final", 3, 1)).toBe("Final 1");
  });

  it("recognizes 'Semi Final' in round name (preserves original casing)", () => {
    expect(getRoundDisplayName("semi-final", 2, 1)).toBe("semi-final 1");
  });

  it("recognizes 'Quarter Final'", () => {
    expect(getRoundDisplayName("Quarter Final", 1, 3)).toBe("Quarter Final 3");
  });

  it("keeps group stage names as-is", () => {
    expect(getRoundDisplayName("Group A", 1, 1)).toBe("Group A");
  });

  it("infers Final from total rounds context", () => {
    expect(getRoundDisplayName(null, 3, 1, 3)).toBe("Final");
  });

  it("infers Semi Final from total rounds context", () => {
    expect(getRoundDisplayName(null, 2, 1, 3)).toBe("Semi Final 1");
  });

  it("infers Quarter Final from total rounds context", () => {
    expect(getRoundDisplayName(null, 1, 2, 3)).toBe("Quarter Final 2");
  });

  it("returns default Match for no data", () => {
    expect(getRoundDisplayName(null, null, null)).toBe("Match");
  });

  it("returns Match N when only matchNumber is given", () => {
    expect(getRoundDisplayName(null, null, 5)).toBe("Match 5");
  });

  it("handles Round X format — Round 2 match 1 as Final heuristic", () => {
    expect(getRoundDisplayName("Round 2", 2, 1)).toBe("Final");
  });

  it("uses round number 4 as Final heuristic", () => {
    expect(getRoundDisplayName(null, 4, 1)).toBe("Final");
  });
});
