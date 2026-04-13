import type { BoardSpace, CandyColor, LandmarkId } from "./types";

const COLORS: CandyColor[] = [
  "red",
  "purple",
  "yellow",
  "blue",
  "orange",
  "green",
];

const LANDMARKS: { landmarkId: LandmarkId; label: string }[] = [
  { landmarkId: "gingerbread", label: "Gingerbread" },
  { landmarkId: "peppermint", label: "Peppermint" },
  { landmarkId: "gumdrop", label: "Gumdrop" },
  { landmarkId: "lollipop", label: "Lollipop" },
  { landmarkId: "cinnamon_bun", label: "Cinnamon bun" },
  { landmarkId: "popsicle", label: "Popsicle" },
];

/** Indices (after start) where a neutral landmark tile sits on the trail */
const LANDMARK_STEPS = new Set([3, 10, 17, 24, 31, 38]);

/**
 * Start → mix of colored path squares and colorless landmark squares → castle.
 * Color cards only stop on `path`; picture cards jump to `landmark` tiles.
 */
export function buildBoard(): BoardSpace[] {
  const spaces: BoardSpace[] = [{ kind: "start", label: "Start" }];

  let landmarkIdx = 0;
  let colorIdx = 0;
  const trailLength = 42;

  for (let step = 0; step < trailLength; step++) {
    if (LANDMARK_STEPS.has(step) && landmarkIdx < LANDMARKS.length) {
      const lm = LANDMARKS[landmarkIdx++];
      spaces.push({
        kind: "landmark",
        landmarkId: lm.landmarkId,
        label: lm.label,
      });
    } else {
      spaces.push({
        kind: "path",
        color: COLORS[colorIdx % COLORS.length],
      });
      colorIdx++;
    }
  }

  spaces.push({ kind: "castle", label: "Castle" });
  return spaces;
}

export function findLandmarkIndex(
  board: BoardSpace[],
  landmark: LandmarkId,
): number {
  const idx = board.findIndex(
    (s) => s.kind === "landmark" && s.landmarkId === landmark,
  );
  return idx === -1 ? board.length - 1 : idx;
}

/**
 * Next nth path square of `color` strictly after `fromIndex`.
 * Candy Land rule: if there is no such square before the castle, move to the
 * castle (last index) instead of staying put.
 */
export function findNthColorAhead(
  board: BoardSpace[],
  fromIndex: number,
  color: CandyColor,
  n: 1 | 2,
): number {
  const end = castleIndex(board);
  let found = 0;
  for (let i = fromIndex + 1; i < board.length; i++) {
    const s = board[i];
    if (s.kind === "castle") break;
    if (s.kind === "path" && s.color === color) {
      found++;
      if (found === n) return i;
    }
  }
  return end;
}

export function applyColorCard(
  board: BoardSpace[],
  fromIndex: number,
  color: CandyColor,
  count: 1 | 2,
): number {
  const castle = castleIndex(board);
  const first = findNthColorAhead(board, fromIndex, color, 1);
  if (count === 1) return first;
  if (first >= castle) return castle;
  return findNthColorAhead(board, first, color, 1);
}

export function castleIndex(board: BoardSpace[]): number {
  return board.length - 1;
}
