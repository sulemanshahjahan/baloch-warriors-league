import { describe, it, expect } from "vitest";
import { generateProposedSlots, hasCommonSlot } from "./engine";
import { pktRange, pktInstant } from "./time";
import type { EngineSide, SubstituteOption, AvailabilityStatus } from "./types";

const D = "2026-08-10";

const baseOpts = {
  matchDurationMinutes: 60,
  preMatchBufferMinutes: 10,
  postMatchBufferMinutes: 10,
  windowStart: pktInstant(2026, 8, 1, 0, 0),
  windowEnd: pktInstant(2026, 8, 31, 0, 0),
};

function side(
  sideId: string,
  players: { id: string; ivs: { start: number; end: number; status?: AvailabilityStatus }[] }[]
): EngineSide {
  return {
    sideId,
    players: players.map((p) => ({
      playerId: p.id,
      sideId,
      intervals: p.ivs.map((iv) => ({ start: iv.start, end: iv.end, status: iv.status ?? "CONFIRMED" })),
    })),
  };
}

describe("scheduling engine — 1v1", () => {
  it("finds a slot when two players overlap", () => {
    const a = pktRange(D, "20:00", "23:00");
    const res = generateProposedSlots({
      sides: [side("home", [{ id: "A", ivs: [a] }]), side("away", [{ id: "B", ivs: [a] }])],
      options: baseOpts,
    });
    expect(res.slots.length).toBeGreaterThan(0);
    expect(res.eligibleFullLineup).toBe(true);
    expect(res.slots[0].confirmedCount).toBe(2);
    expect(res.slots[0].isPrimary).toBe(true);
    expect(res.slots[0].eligibility).toBe("ELIGIBLE");
    expect(res.slots[0].kickoff).toBeGreaterThanOrEqual(a.start + 10 * 60000);
    expect(res.slots[0].matchEnd).toBeLessThanOrEqual(a.end);
  });

  it("returns no slots and an analysis when there is no overlap", () => {
    const res = generateProposedSlots({
      sides: [
        side("home", [{ id: "A", ivs: [pktRange(D, "18:00", "20:00")] }]),
        side("away", [{ id: "B", ivs: [pktRange(D, "21:00", "23:00")] }]),
      ],
      options: baseOpts,
    });
    expect(res.slots).toHaveLength(0);
    expect(res.analysis).not.toBeNull();
    expect(res.analysis!.bestPartial?.count).toBe(1);
    expect(res.analysis!.blockingPlayerIds).toHaveLength(2);
  });
});

describe("scheduling engine — overnight & buffers", () => {
  it("handles availability crossing midnight", () => {
    const a = pktRange(D, "23:00", "02:00", true);
    expect(a.end - a.start).toBe(3 * 3600000);
    const res = generateProposedSlots({
      sides: [side("home", [{ id: "A", ivs: [a] }]), side("away", [{ id: "B", ivs: [a] }])],
      options: { ...baseOpts, matchDurationMinutes: 90, preMatchBufferMinutes: 0, postMatchBufferMinutes: 0 },
    });
    expect(res.slots.length).toBeGreaterThan(0);
    expect(res.slots[0].factors.timeOfDay).toBeLessThanOrEqual(65); // late-night penalty
  });

  it("respects match duration plus buffers", () => {
    const opts = { ...baseOpts, matchDurationMinutes: 60, preMatchBufferMinutes: 15, postMatchBufferMinutes: 15 };
    const tooShort = generateProposedSlots({
      sides: [
        side("home", [{ id: "A", ivs: [pktRange(D, "20:00", "21:15")] }]),
        side("away", [{ id: "B", ivs: [pktRange(D, "20:00", "21:15")] }]),
      ],
      options: opts,
    });
    expect(tooShort.slots).toHaveLength(0); // 75 min < 90 min occupied
    const exact = generateProposedSlots({
      sides: [
        side("home", [{ id: "A", ivs: [pktRange(D, "20:00", "21:30")] }]),
        side("away", [{ id: "B", ivs: [pktRange(D, "20:00", "21:30")] }]),
      ],
      options: opts,
    });
    expect(exact.slots).toHaveLength(1);
  });
});

describe("scheduling engine — 2v2 (four players)", () => {
  it("finds a four-player overlap", () => {
    const w = pktRange(D, "21:00", "22:30");
    const res = generateProposedSlots({
      sides: [
        side("home", [{ id: "P1", ivs: [w] }, { id: "P2", ivs: [w] }]),
        side("away", [{ id: "P3", ivs: [w] }, { id: "P4", ivs: [w] }]),
      ],
      options: baseOpts,
    });
    expect(res.totalParticipants).toBe(4);
    expect(res.slots.length).toBeGreaterThan(0);
    expect(res.slots[0].confirmedCount).toBe(4);
  });

  it("uses a substitute to unlock an otherwise-impossible match", () => {
    const evening = pktRange(D, "21:00", "23:00");
    const morning = pktRange(D, "08:00", "10:00");
    const sub: SubstituteOption = {
      sideId: "away",
      participant: {
        playerId: "S4",
        sideId: "away",
        isSubstitute: true,
        intervals: [{ ...evening, status: "CONFIRMED" }],
      },
    };
    const res = generateProposedSlots({
      sides: [
        side("home", [{ id: "P1", ivs: [evening] }, { id: "P2", ivs: [evening] }]),
        side("away", [{ id: "P3", ivs: [evening] }, { id: "P4", ivs: [morning] }]),
      ],
      substitutes: [sub],
      options: baseOpts,
    });
    expect(res.eligibleFullLineup).toBe(false);
    expect(res.analysis!.blockingPlayerIds).toContain("P4");
    expect(res.analysis!.substituteSolutions.some((s) => s.substitutePlayerId === "S4")).toBe(true);
    expect(res.slots[0].requiresSubstitute).toBe(true);
    expect(res.slots[0].eligibility).toBe("REQUIRES_SUBSTITUTE");
  });
});

describe("scheduling engine — availability weights", () => {
  it("scores a partial (LIKELY) lineup below an all-confirmed one", () => {
    const w = pktRange(D, "20:00", "23:00");
    const confirmed = generateProposedSlots({
      sides: [side("home", [{ id: "A", ivs: [w] }]), side("away", [{ id: "B", ivs: [w] }])],
      options: baseOpts,
    });
    const likely = generateProposedSlots({
      sides: [
        side("home", [{ id: "A", ivs: [w] }]),
        side("away", [{ id: "B", ivs: [{ ...w, status: "LIKELY" }] }]),
      ],
      options: baseOpts,
    });
    expect(likely.slots[0].eligibility).toBe("PARTIAL");
    expect(likely.slots[0].score).toBeLessThan(confirmed.slots[0].score);
  });

  it("never schedules during UNAVAILABLE and excludes SHIFT_UNCONFIRMED unless allowed", () => {
    const w = pktRange(D, "20:00", "23:00");
    const unavailable = generateProposedSlots({
      sides: [
        side("home", [{ id: "A", ivs: [w] }]),
        side("away", [{ id: "B", ivs: [{ ...w, status: "UNAVAILABLE" }] }]),
      ],
      options: baseOpts,
    });
    expect(unavailable.slots).toHaveLength(0);

    const shiftSides = [
      side("home", [{ id: "A", ivs: [w] }]),
      side("away", [{ id: "B", ivs: [{ ...w, status: "SHIFT_UNCONFIRMED" }] }]),
    ];
    expect(generateProposedSlots({ sides: shiftSides, options: baseOpts }).slots).toHaveLength(0);
    expect(
      generateProposedSlots({ sides: shiftSides, options: { ...baseOpts, allowShiftUnconfirmed: true } }).slots.length
    ).toBeGreaterThan(0);
  });
});

describe("scheduling engine — constraints", () => {
  it("treats already-scheduled matches (busy time) as unavailable", () => {
    const w = pktRange(D, "18:00", "23:00");
    const busy = pktRange(D, "19:00", "22:00");
    const res = generateProposedSlots({
      sides: [side("home", [{ id: "A", ivs: [w] }]), side("away", [{ id: "B", ivs: [w] }])],
      options: { ...baseOpts, busyByPlayer: { A: [busy] } },
    });
    expect(res.slots.every((s) => s.kickoff >= busy.end || s.matchEnd <= busy.start)).toBe(true);
  });

  it("hasCommonSlot answers the quick overlap question", () => {
    const w = pktRange(D, "20:00", "23:00");
    expect(
      hasCommonSlot([side("home", [{ id: "A", ivs: [w] }]), side("away", [{ id: "B", ivs: [w] }])], baseOpts)
    ).toBe(true);
    expect(
      hasCommonSlot(
        [side("home", [{ id: "A", ivs: [pktRange(D, "08:00", "09:00")] }]), side("away", [{ id: "B", ivs: [w] }])],
        baseOpts
      )
    ).toBe(false);
  });
});
