export type PlayerPos = { name: string; position: number };

export function findMover(
  prev: PlayerPos[],
  next: PlayerPos[],
): { moverIndex: number; from: number; to: number } | null {
  if (prev.length !== next.length || prev.length === 0) return null;
  let idx = -1;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].position !== next[i].position) {
      if (idx !== -1) return null;
      idx = i;
    }
  }
  if (idx === -1) return null;
  return {
    moverIndex: idx,
    from: prev[idx].position,
    to: next[idx].position,
  };
}

/** Normalized distance along trail: index 0 → 0, last cell → 1 */
export function trailProgress(position: number, boardLength: number): number {
  if (boardLength <= 1) return 0;
  return Math.max(0, Math.min(1, position / (boardLength - 1)));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

const DURATION_MIN = 520;
const DURATION_MAX = 2000;
const PER_STEP_MS = 85;

export function animationDurationMs(from: number, to: number): number {
  const steps = Math.abs(to - from);
  return Math.min(DURATION_MAX, Math.max(DURATION_MIN, 380 + steps * PER_STEP_MS));
}
