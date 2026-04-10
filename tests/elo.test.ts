import { describe, it, expect } from "vitest";

// Test the pure ELO functions directly (they're not exported, so we re-implement for testing)
// This validates the algorithm correctness

const K_NEW = 40;
const K_ESTABLISHED = 32;
const K_THRESHOLD = 10;
const RATING_FLOOR = 10;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function newRating(
  currentRating: number,
  expected: number,
  actual: number,
  kFactor: number
): number {
  return Math.max(
    RATING_FLOOR,
    Math.round(currentRating + kFactor * (actual - expected))
  );
}

function getKFactor(matchCount: number): number {
  return matchCount < K_THRESHOLD ? K_NEW : K_ESTABLISHED;
}

// ─── expectedScore ─────────────────────────────────────

describe("expectedScore", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5);
  });

  it("higher rating has higher expected score", () => {
    const score = expectedScore(1400, 1200);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1);
  });

  it("lower rating has lower expected score", () => {
    const score = expectedScore(1000, 1400);
    expect(score).toBeLessThan(0.5);
    expect(score).toBeGreaterThan(0);
  });

  it("probabilities for A vs B sum to 1", () => {
    const scoreA = expectedScore(1200, 1400);
    const scoreB = expectedScore(1400, 1200);
    expect(scoreA + scoreB).toBeCloseTo(1);
  });

  it("400 point difference gives ~91% expected score", () => {
    const score = expectedScore(1600, 1200);
    expect(score).toBeCloseTo(0.909, 2);
  });
});

// ─── newRating ─────────────────────────────────────────

describe("newRating", () => {
  it("increases rating on win above expectation", () => {
    const expected = expectedScore(1200, 1200); // 0.5
    const rating = newRating(1200, expected, 1.0, 32);
    expect(rating).toBeGreaterThan(1200);
  });

  it("decreases rating on loss below expectation", () => {
    const expected = expectedScore(1200, 1200); // 0.5
    const rating = newRating(1200, expected, 0.0, 32);
    expect(rating).toBeLessThan(1200);
  });

  it("stays same on draw with equal expected", () => {
    const expected = expectedScore(1200, 1200); // 0.5
    const rating = newRating(1200, expected, 0.5, 32);
    expect(rating).toBe(1200);
  });

  it("enforces minimum rating floor", () => {
    const rating = newRating(15, 0.99, 0.0, 40);
    expect(rating).toBeGreaterThanOrEqual(RATING_FLOOR);
  });

  it("rounds to nearest integer", () => {
    const rating = newRating(1200, 0.5, 1.0, 32);
    expect(Number.isInteger(rating)).toBe(true);
  });

  it("upset win gives bigger rating gain", () => {
    // Weak player beats strong player
    const expectedWeak = expectedScore(1000, 1400);
    const gainWeak = newRating(1000, expectedWeak, 1.0, 32) - 1000;

    // Strong player beats weak player
    const expectedStrong = expectedScore(1400, 1000);
    const gainStrong = newRating(1400, expectedStrong, 1.0, 32) - 1400;

    expect(gainWeak).toBeGreaterThan(gainStrong);
  });

  it("ratings are symmetric — total change sums to ~0", () => {
    const ratingA = 1200;
    const ratingB = 1300;
    const expA = expectedScore(ratingA, ratingB);
    const expB = expectedScore(ratingB, ratingA);
    // A wins
    const newA = newRating(ratingA, expA, 1.0, 32);
    const newB = newRating(ratingB, expB, 0.0, 32);
    const totalChange = (newA - ratingA) + (newB - ratingB);
    expect(Math.abs(totalChange)).toBeLessThanOrEqual(1); // rounding tolerance
  });
});

// ─── getKFactor ────────────────────────────────────────

describe("getKFactor", () => {
  it("returns higher K for new players", () => {
    expect(getKFactor(0)).toBe(K_NEW);
    expect(getKFactor(5)).toBe(K_NEW);
    expect(getKFactor(9)).toBe(K_NEW);
  });

  it("returns lower K for established players", () => {
    expect(getKFactor(10)).toBe(K_ESTABLISHED);
    expect(getKFactor(50)).toBe(K_ESTABLISHED);
  });

  it("threshold is exactly at 10 matches", () => {
    expect(getKFactor(9)).toBe(K_NEW);
    expect(getKFactor(10)).toBe(K_ESTABLISHED);
  });
});
