import { describe, expect, it } from "vitest";
import {
  animationDurationMs,
  easeOutCubic,
  findMover,
  lerp,
  trailProgress,
} from "./fpMath";

describe("findMover", () => {
  it("returns null when no position change", () => {
    const p = [{ name: "A", position: 2 }];
    expect(findMover(p, p)).toBeNull();
  });

  it("detects single player move", () => {
    const prev = [
      { name: "Archer", position: 1 },
      { name: "River", position: 0 },
    ];
    const next = [
      { name: "Archer", position: 5 },
      { name: "River", position: 0 },
    ];
    expect(findMover(prev, next)).toEqual({
      moverIndex: 0,
      from: 1,
      to: 5,
    });
  });

  it("returns null when two players move", () => {
    const prev = [
      { name: "Archer", position: 1 },
      { name: "River", position: 2 },
    ];
    const next = [
      { name: "Archer", position: 2 },
      { name: "River", position: 3 },
    ];
    expect(findMover(prev, next)).toBeNull();
  });
});

describe("trailProgress", () => {
  it("is 0 at start and 1 at last index", () => {
    expect(trailProgress(0, 10)).toBe(0);
    expect(trailProgress(9, 10)).toBe(1);
  });

  it("interpolates mid board", () => {
    expect(trailProgress(5, 11)).toBeCloseTo(0.5, 5);
  });
});

describe("lerp / ease", () => {
  it("lerps", () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });

  it("easeOutCubic endpoints", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
});

describe("animationDurationMs", () => {
  it("is bounded for long jumps", () => {
    const d = animationDurationMs(1, 40);
    expect(d).toBeGreaterThanOrEqual(520);
    expect(d).toBeLessThanOrEqual(2000);
  });
});
