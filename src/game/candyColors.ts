import type { BoardSpace, CandyColor } from "./types";

export const CANDY_COLOR_HEX: Record<CandyColor, string> = {
  red: "#e63946",
  purple: "#9b5de5",
  yellow: "#fee440",
  blue: "#00bbf9",
  orange: "#f77f00",
  green: "#06d6a0",
};

/** Solid fill for FP / map visuals */
export function trailSpaceFill(space: BoardSpace): string {
  switch (space.kind) {
    case "path":
      return CANDY_COLOR_HEX[space.color];
    case "landmark":
      return "#ede9fe";
    case "start":
      return "#ffd6e8";
    case "castle":
      return "#ffe066";
  }
}
