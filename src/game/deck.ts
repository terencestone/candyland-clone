import type { CandyColor, Card, LandmarkId } from "./types";

const COLORS: CandyColor[] = [
  "red",
  "purple",
  "yellow",
  "blue",
  "orange",
  "green",
];

const LANDMARKS: LandmarkId[] = [
  "gingerbread",
  "peppermint",
  "gumdrop",
  "lollipop",
  "cinnamon_bun",
  "popsicle",
];

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createDeck(opts?: {
  /** Landmark ids whose picture cards should not be included. */
  excludeLandmarks?: ReadonlySet<LandmarkId>;
}): Card[] {
  const cards: Card[] = [];

  for (const c of COLORS) {
    for (let i = 0; i < 3; i++) cards.push({ kind: "color", color: c, count: 1 });
    for (let i = 0; i < 2; i++) cards.push({ kind: "color", color: c, count: 2 });
  }

  for (const lm of LANDMARKS) {
    if (opts?.excludeLandmarks?.has(lm)) continue;
    // Landmark cards are single-use per game.
    cards.push({ kind: "goto", landmark: lm });
  }

  return shuffle(cards);
}
