function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Horizontal margin (viewBox units) so pawns stay inside the SVG. */
const SNAKE_X_MIN = 12;
const SNAKE_X_MAX = 88;
/** t = 0 bottom, t = 1 top (SVG y increases downward). */
const SNAKE_Y_BOTTOM = 90;
const SNAKE_Y_TOP = 11;
/** Number of horizontal bands; path alternates L→R and R→L with vertical joins. */
const SNAKE_ROWS = 6;

const SNAKE_W = SNAKE_X_MAX - SNAKE_X_MIN;

function yAtSnakeRow(i: number): number {
  if (SNAKE_ROWS <= 1) return (SNAKE_Y_BOTTOM + SNAKE_Y_TOP) / 2;
  return (
    SNAKE_Y_BOTTOM -
    (i / (SNAKE_ROWS - 1)) * (SNAKE_Y_BOTTOM - SNAKE_Y_TOP)
  );
}

/**
 * Vertical candy road: t = 0 at **bottom** (start), t = 1 at **top** (castle).
 * Serpentine (boustrophedon): horizontal sweeps across the width, alternating
 * direction, joined by short vertical segments at the sides — classic “snake”
 * up the board (not a single diagonal or one S-curve).
 */
function sampleCurve(t: number): { x: number; y: number } {
  const u = Math.max(0, Math.min(1, t));

  if (SNAKE_ROWS <= 1) {
    return {
      x: SNAKE_X_MIN + u * SNAKE_W,
      y: SNAKE_Y_BOTTOM + u * (SNAKE_Y_TOP - SNAKE_Y_BOTTOM),
    };
  }

  const lens: number[] = [];
  for (let i = 0; i < SNAKE_ROWS; i++) {
    lens.push(SNAKE_W);
    if (i < SNAKE_ROWS - 1) {
      lens.push(Math.abs(yAtSnakeRow(i + 1) - yAtSnakeRow(i)));
    }
  }
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let s = u * total;
  let segIdx = 0;
  while (segIdx < lens.length && s > lens[segIdx]) {
    s -= lens[segIdx];
    segIdx++;
  }
  const segLen = lens[segIdx] ?? total;
  const frac = segLen > 0 ? Math.min(1, s / segLen) : 0;

  if (segIdx % 2 === 0) {
    const row = segIdx / 2;
    const yt = yAtSnakeRow(row);
    const leftToRight = row % 2 === 0;
    const x = leftToRight
      ? SNAKE_X_MIN + frac * SNAKE_W
      : SNAKE_X_MAX - frac * SNAKE_W;
    return { x, y: yt };
  }

  const k = (segIdx - 1) / 2;
  const xEdge = k % 2 === 0 ? SNAKE_X_MAX : SNAKE_X_MIN;
  const y0 = yAtSnakeRow(k);
  const y1 = yAtSnakeRow(k + 1);
  const y = y0 + frac * (y1 - y0);
  return { x: xEdge, y };
}

/** Sample the road at normalized t ∈ [0,1] for decorations (not tied to cell count). */
export function sampleCandyRoadAt(t: number): { x: number; y: number } {
  const u = Math.max(0, Math.min(1, t));
  return sampleCurve(u);
}

/** Offset perpendicular to the road for scenery (dist >0 = one side, <0 = other). */
export function offsetNormalFromRoad(
  t: number,
  dist: number,
): { x: number; y: number } {
  const p0 = sampleCandyRoadAt(t);
  const p1 = sampleCandyRoadAt(Math.min(1, t + 0.018));
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return { x: p0.x + nx * dist, y: p0.y + ny * dist };
}

/**
 * Positions along the candy road, evenly spaced by arc length.
 */
export function getRoadPoints(count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 50, y: 50 }];

  const resolution = Math.max(360, count * 48);
  const dense: { x: number; y: number }[] = [];
  for (let i = 0; i <= resolution; i++) {
    dense.push(sampleCurve(i / resolution));
  }

  const segmentLens: number[] = [];
  let total = 0;
  for (let i = 1; i < dense.length; i++) {
    const d = dist(dense[i - 1], dense[i]);
    segmentLens.push(d);
    total += d;
  }

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const targetDist = (i / (count - 1)) * total;
    let walked = 0;
    let j = 0;
    while (j < segmentLens.length && walked + segmentLens[j] < targetDist) {
      walked += segmentLens[j];
      j++;
    }
    const segLen = segmentLens[j] ?? 0;
    const segFrac = segLen > 0 ? (targetDist - walked) / segLen : 0;
    const p0 = dense[j];
    const p1 = dense[j + 1] ?? dense[j];
    points.push({
      x: p0.x + segFrac * (p1.x - p0.x),
      y: p0.y + segFrac * (p1.y - p0.y),
    });
  }
  return points;
}

export function pointsToPolylinePath(
  points: { x: number; y: number }[],
): string {
  if (points.length === 0) return "";
  const [p0, ...rest] = points;
  let d = `M ${p0.x} ${p0.y}`;
  for (const p of rest) {
    d += ` L ${p.x} ${p.y}`;
  }
  return d;
}

/**
 * Smooth Catmull-Rom–style curve through the same points (nicer trail than a raw polyline).
 */
export function pointsToSmoothBezierPath(
  points: { x: number; y: number }[],
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const at = (i: number) =>
    points[Math.max(0, Math.min(points.length - 1, i))];
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}
