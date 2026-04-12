import type { LandmarkId } from "./types";

/** Big emoji markers for spaces a toddler can match to cards */
export const LANDMARK_ICON: Record<LandmarkId, string> = {
  gingerbread: "🍪",
  peppermint: "🍬",
  gumdrop: "🟣",
  lollipop: "🍭",
  cinnamon_bun: "🥐",
  popsicle: "🍡",
};

export const START_ICON = "🌈";
export const CASTLE_ICON = "🏰";

export const PAWN_ARCHER = "🐕";
export const PAWN_LIZARD = "🦎";

export function iconForLandmark(id: LandmarkId): string {
  return LANDMARK_ICON[id];
}

/** Archer = dog; everyone else = lizard (dad’s piece). */
export function pawnIcon(playerName: string): string {
  return playerName.trim().toLowerCase() === "archer"
    ? PAWN_ARCHER
    : PAWN_LIZARD;
}
