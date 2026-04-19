export type CandyColor =
  | "red"
  | "purple"
  | "yellow"
  | "blue"
  | "orange"
  | "green";

export type LandmarkId =
  | "gingerbread"
  | "peppermint"
  | "gumdrop"
  | "lollipop"
  | "cinnamon_bun"
  | "popsicle";

/** Colored trail square (matches color cards). */
export type PathSpace = {
  kind: "path";
  color: CandyColor;
};

/** Dedicated picture stop (matches “go to” cards only; no trail color). */
export type LandmarkSpace = {
  kind: "landmark";
  landmarkId: LandmarkId;
  label: string;
};

export type BoardSpace =
  | { kind: "start"; label: string }
  | PathSpace
  | LandmarkSpace
  | { kind: "castle"; label: string };

export type Card =
  | { kind: "color"; color: CandyColor; count: 1 | 2 }
  | { kind: "goto"; landmark: LandmarkId };

export type Player = {
  name: string;
  position: number;
};

export type GameState = {
  board: BoardSpace[];
  drawPile: Card[];
  discardPile: Card[];
  /** Landmark ids whose picture card has already been drawn this game. */
  drawnLandmarks: LandmarkId[];
  players: Player[];
  currentPlayerIndex: number;
  phase: "play" | "won";
  winnerIndex: number | null;
  lastCard: Card | null;
  log: string;
};
