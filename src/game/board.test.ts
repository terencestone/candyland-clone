import { describe, expect, it } from "vitest";
import {
  applyColorCard,
  buildBoard,
  castleIndex,
  findNthColorAhead,
} from "./board";
import type { BoardSpace } from "./types";

const miniTrail: BoardSpace[] = [
  { kind: "start", label: "S" },
  { kind: "path", color: "green" },
  { kind: "path", color: "blue" },
  { kind: "castle", label: "C" },
];

describe("findNthColorAhead", () => {
  it("moves to castle when no matching color exists before the castle", () => {
    const c = castleIndex(miniTrail);
    expect(c).toBe(3);
    expect(findNthColorAhead(miniTrail, 0, "red", 1)).toBe(c);
    expect(findNthColorAhead(miniTrail, 1, "red", 1)).toBe(c);
    expect(findNthColorAhead(miniTrail, 1, "purple", 1)).toBe(c);
  });

  it("finds the next path square of the given color", () => {
    expect(findNthColorAhead(miniTrail, 0, "green", 1)).toBe(1);
    expect(findNthColorAhead(miniTrail, 0, "blue", 1)).toBe(2);
    expect(findNthColorAhead(miniTrail, 1, "blue", 1)).toBe(2);
  });

  it("returns castle when second match does not exist", () => {
    const c = castleIndex(miniTrail);
    expect(findNthColorAhead(miniTrail, 0, "green", 2)).toBe(c);
  });
});

describe("applyColorCard", () => {
  it("single: no match ahead sends pawn to castle", () => {
    const c = castleIndex(miniTrail);
    expect(applyColorCard(miniTrail, 1, "orange", 1)).toBe(c);
  });

  it("double: no first match sends to castle", () => {
    const c = castleIndex(miniTrail);
    expect(applyColorCard(miniTrail, 1, "red", 2)).toBe(c);
  });

  it("double: first match then no second match sends to castle", () => {
    const c = castleIndex(miniTrail);
    expect(applyColorCard(miniTrail, 0, "green", 2)).toBe(c);
  });

  it("double: two matches along the trail", () => {
    const twoGreens: BoardSpace[] = [
      { kind: "start", label: "S" },
      { kind: "path", color: "green" },
      { kind: "path", color: "blue" },
      { kind: "path", color: "green" },
      { kind: "castle", label: "C" },
    ];
    expect(applyColorCard(twoGreens, 0, "green", 2)).toBe(3);
  });
});

describe("buildBoard", () => {
  it("from the last trail square, any color reaches the castle (no path past end)", () => {
    const board = buildBoard();
    expect(board[board.length - 1]?.kind).toBe("castle");
    const castle = castleIndex(board);
    const lastTrail = castle - 1;
    const colors = [
      "red",
      "purple",
      "yellow",
      "blue",
      "orange",
      "green",
    ] as const;
    for (const color of colors) {
      expect(applyColorCard(board, lastTrail, color, 1)).toBe(castle);
    }
  });
});
