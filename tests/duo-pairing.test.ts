import { describe, it, expect } from "vitest";
import {
  defaultDuoName,
  pairBySkill,
  pairBalancedRandom,
  type PairablePlayer,
} from "@/lib/duo-pairing";

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

const p = (id: string, rating: number | null): PairablePlayer => ({ id, name: id, rating });

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

  it("keeps each duo's combined rating balanced", () => {
    const players = [p("A", 95), p("B", 88), p("C", 74), p("D", 60)];
    const { duos } = pairBySkill(players);
    const totals = duos.map((d) => (d.player1.rating ?? 0) + (d.player2.rating ?? 0));
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

  it("treats missing rating as the default (70)", () => {
    const players = [p("A", null), p("B", 90), p("C", null), p("D", 90)];
    const { duos, unpaired } = pairBySkill(players);
    expect(unpaired).toBeNull();
    // Each duo should pair a 90 with a default-70 player.
    for (const d of duos) {
      const ratings = [d.player1.rating ?? 70, d.player2.rating ?? 70].sort();
      expect(ratings).toEqual([70, 90]);
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

// ─── pairBalancedRandom ────────────────────────────────

describe("pairBalancedRandom", () => {
  // 8 players: strong half = 99,97,96,95 · weak half = 62,60,55,50
  const make = () => [
    p("A", 99), p("B", 97), p("C", 96), p("D", 95),
    p("E", 62), p("F", 60), p("G", 55), p("H", 50),
  ];
  const strongIds = new Set(["A", "B", "C", "D"]);
  const weakIds = new Set(["E", "F", "G", "H"]);

  it("uses every player exactly once and pairs strong-half with weak-half", () => {
    const { duos, unpaired } = pairBalancedRandom(make());
    expect(unpaired).toBeNull();
    expect(duos).toHaveLength(4);

    const seen = new Set<string>();
    for (const d of duos) {
      // player1 always from the strong half, player2 from the weak half
      expect(strongIds.has(d.player1.id)).toBe(true);
      expect(weakIds.has(d.player2.id)).toBe(true);
      // stronger rating never below the partner's
      expect(d.player1.rating! >= d.player2.rating!).toBe(true);
      seen.add(d.player1.id);
      seen.add(d.player2.id);
    }
    expect(seen.size).toBe(8);
  });

  it("is random — the top player does not always get the same partner", () => {
    const partners = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { duos } = pairBalancedRandom(make());
      const top = duos.find((d) => d.player1.id === "A");
      partners.add(top!.player2.id);
    }
    // Across 50 runs the 99-rated player should see more than one weak partner.
    expect(partners.size).toBeGreaterThan(1);
  });

  it("leaves the median player unpaired on odd counts", () => {
    const players = [...make(), p("I", 70)]; // 9 players → median is rank 5
    const { duos, unpaired } = pairBalancedRandom(players);
    expect(duos).toHaveLength(4);
    expect(unpaired?.id).toBe("I"); // 70 is the median of 99,97,96,95,70,62,60,55,50
  });

  it("does not mutate the input array", () => {
    const players = make();
    const copy = [...players];
    pairBalancedRandom(players);
    expect(players).toEqual(copy);
  });
});
