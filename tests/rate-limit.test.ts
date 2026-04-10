import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  const config = { limit: 3, windowMs: 1000 };

  it("allows requests under the limit", () => {
    const key = `test-allow-${Date.now()}`;
    const r1 = checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it("blocks after exceeding limit", () => {
    const key = `test-block-${Date.now()}`;
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const r4 = checkRateLimit(key, config);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks remaining count correctly", () => {
    const key = `test-remaining-${Date.now()}`;
    expect(checkRateLimit(key, config).remaining).toBe(2);
    expect(checkRateLimit(key, config).remaining).toBe(1);
    expect(checkRateLimit(key, config).remaining).toBe(0);
  });

  it("isolates different keys", () => {
    const ts = Date.now();
    const keyA = `test-a-${ts}`;
    const keyB = `test-b-${ts}`;
    checkRateLimit(keyA, config);
    checkRateLimit(keyA, config);
    checkRateLimit(keyA, config);

    const resultB = checkRateLimit(keyB, config);
    expect(resultB.allowed).toBe(true);
    expect(resultB.remaining).toBe(2);
  });
});
