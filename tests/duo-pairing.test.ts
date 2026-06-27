import { describe, it, expect } from "vitest";
import { defaultDuoName, pairBySkill, type PairablePlayer } from "@/lib/duo-pairing";

// ─── defaultDuoName ────────────────────────────────────

describe("defaultDuoName", () => {
  it("joins names with an ampersand", () => {
    expect(defaultDuoName("Haroon", "Suleman")).toBe("Haroon & Suleman");
  });

  it("trims surrounding whitespace", () => {
    expect(defaultDuoName("  Haroon ", " Suleman  ")).toBe("Haroon & Suleman");
  });
});

// ─── pairBySkill ───────────────────────────────────────

const p = (id: string, skillLevel: number | null): PairablePlayer => ({ id, name: id, skillLevel });

describe("pairBySkill", () => {
  it("pairs strongest with weakest (the documented example)", () => {
    const players = [p("A", 95), p("B", 88), p("C", 74), p("D", 60)];
    const { duos, unpaired } = pairBySkill(players);

    expect(unpaired).toBeNull();
    expect(duos).toHaveLength(2);
    // A(95) + D(60), B(88) + C(74)
    expect([duos[0].player1.id, duos[0].player2.id]).toEqual(["A", "D"]);
    expect([duos[1].player1.id, duos[1].player2.id]).toEqual(["B", "C"]);
  });

  it("keeps each duo's combined skill balanced", () => {
    const players = [p("A", 95), p("B", 88), p("C", 74), p("D", 60)];
    const { duos } = pairBySkill(players);
    const totals = duos.map((d) => (d.player1.skillLevel ?? 0) + (d.player2.skillLevel ?? 0));
    // 155 vs 162 — closer than naive strong+strong (183) vs weak+weak (134)
    expect(Math.abs(totals[0] - totals[1])).toBeLessThanOrEqual(10);
  });

  it("reports the odd player out instead of dropping them", () => {
    const players = [p("A", 95), p("B", 88), p("C", 74), p("D", 60), p("E", 50)];
    const { duos, unpaired } = pairBySkill(players);

    expect(duos).toHaveLength(2);
    expect(unpaired).not.toBeNull();
    // Median-skill player (C, 74) is the one left over.
    expect(unpaired?.id).toBe("C");
  });

  it("treats missing skill as the default (50)", () => {
    const players = [p("A", null), p("B", 90), p("C", null), p("D", 90)];
    const { duos, unpaired } = pairBySkill(players);
    expect(unpaired).toBeNull();
    // Each duo should pair a 90 with a default-50 player.
    for (const d of duos) {
      const skills = [d.player1.skillLevel ?? 50, d.player2.skillLevel ?? 50].sort();
      expect(skills).toEqual([50, 90]);
    }
  });

  it("returns no duos for fewer than two players", () => {
    expect(pairBySkill([p("A", 80)]).duos).toHaveLength(0);
    expect(pairBySkill([p("A", 80)]).unpaired?.id).toBe("A");
    expect(pairBySkill([]).duos).toHaveLength(0);
    expect(pairBySkill([]).unpaired).toBeNull();
  });

  it("does not mutate the input array", () => {
    const players = [p("A", 60), p("B", 95)];
    const copy = [...players];
    pairBySkill(players);
    expect(players).toEqual(copy);
  });
});
