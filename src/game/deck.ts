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

/**
 * Build a small but playable deck (singles, doubles, picture cards).
 * Picture ("go to landmark") cards are duplicated so they show up often enough
 * in short sessions — classic Candy Land is picture-card heavy.
 */
export function createDeck(): Card[] {
  const cards: Card[] = [];

  for (const c of COLORS) {
    for (let i = 0; i < 3; i++) cards.push({ kind: "color", color: c, count: 1 });
    for (let i = 0; i < 2; i++) cards.push({ kind: "color", color: c, count: 2 });
  }

  for (const lm of LANDMARKS) {
    cards.push({ kind: "goto", landmark: lm });
    cards.push({ kind: "goto", landmark: lm });
  }

  return shuffle(cards);
}
