function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Vertical candy road: t = 0 at **bottom** (start), t = 1 at **top** (castle).
 * Lateral sine waves move left/right as you climb.
 */
function sampleCurve(t: number): { x: number; y: number } {
  const yBase = 90 - t * 79;
  const yWiggle =
    Math.sin(t * Math.PI * 3.4) * 3.2 + Math.sin(t * Math.PI * 6.9) * 1.6;
  const y = yBase + yWiggle;
  const x =
    50 +
    Math.sin(t * Math.PI * 3.4) * 26 +
    Math.sin(t * Math.PI * 6.9) * 10;
  return { x, y };
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
