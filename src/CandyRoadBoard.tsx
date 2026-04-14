import { useId, useMemo } from "react";
import {
  CASTLE_ICON,
  START_ICON,
  iconForLandmark,
  pawnIcon,
} from "./game/icons";
import {
  getRoadPoints,
  offsetNormalFromRoad,
  pointsToSmoothBezierPath,
} from "./game/roadLayout";
import type { BoardSpace, CandyColor, Player } from "./game/types";
import "./CandyRoadBoard.css";

const COLOR_HEX: Record<CandyColor, string> = {
  red: "#e63946",
  purple: "#9b5de5",
  yellow: "#fee440",
  blue: "#00bbf9",
  orange: "#f77f00",
  green: "#06d6a0",
};

type Props = {
  board: BoardSpace[];
  players: Player[];
  castleIndex: number;
};

/** Fallback if geometry is degenerate */
const R_PATH_FALLBACK = 1.2;
const PAWN_BACKPLATE_R = 1.55;
const PAWN_FONT_SIZE = 1.85;
const EDGE_GAP = 0.55;

function dist2(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Radii so adjacent circles do not overlap, with a small gap between edges.
 * Special (start/castle) may be slightly larger when the chain allows.
 */
function computeSpaceRadii(
  points: { x: number; y: number }[],
  board: BoardSpace[],
  castleIndex: number,
): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [R_PATH_FALLBACK];

  const edgeLen: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    edgeLen.push(dist2(points[i], points[i + 1]));
  }
  const minEdge = Math.min(...edgeLen);

  // Uniform cap: 2*r <= L - gap on every edge.
  let rUniform = (minEdge - EDGE_GAP) / 2;
  rUniform = Math.max(0.78, Math.min(1.42, rUniform));

  const radii = board.map((space, i) => {
    const isCastle = i === castleIndex;
    const isStart = space.kind === "start";
    if (isCastle || isStart) {
      return Math.min(1.65, rUniform * 1.12);
    }
    return rUniform;
  });

  // If specials are too big for a tight edge, shrink that pair.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n - 1; i++) {
      const L = edgeLen[i];
      const maxSum = L - EDGE_GAP;
      const sum = radii[i] + radii[i + 1];
      if (sum > maxSum && sum > 0) {
        const s = maxSum / sum;
        radii[i] *= s;
        radii[i + 1] *= s;
      }
    }
  }

  return radii;
}

/** Line from circle edge at p1 toward p2 to circle edge at p2 toward p1 */
function bridgeEndpoints(
  p1: { x: number; y: number },
  r1: number,
  p2: { x: number; y: number },
  r2: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: p1.x + ux * r1,
    y1: p1.y + uy * r1,
    x2: p2.x - ux * r2,
    y2: p2.y - uy * r2,
  };
}

function safeSvgId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned.length ? `i${cleaned}` : `i${Math.random().toString(36).slice(2, 9)}`;
}

/** Scenic treats / characters beside the ribbon (not tied to game spaces). */
const BOARD_SCENERY: {
  t: number;
  side: -1 | 1;
  emojis: string[];
  label: string;
}[] = [
  { t: 0.06, side: -1, emojis: ["🍦"], label: "Ice cream" },
  { t: 0.18, side: 1, emojis: ["🍬", "🍬"], label: "Gummies" },
  { t: 0.32, side: -1, emojis: ["🧁"], label: "Cupcake" },
  { t: 0.46, side: 1, emojis: ["🍭"], label: "Candy" },
  { t: 0.58, side: -1, emojis: ["🎩", "🍫"], label: "Lord Licorice" },
  { t: 0.72, side: 1, emojis: ["🍩"], label: "Donut" },
  { t: 0.86, side: -1, emojis: ["🍡"], label: "Treats" },
];

type ViewBox = { minX: number; minY: number; width: number; height: number };

/**
 * Tight crop around the trail + scenery so the path fills the SVG instead of
 * sitting in a tiny band of a 100×100 canvas (which made spaces look pin-sized).
 */
function computeBoardViewBox(
  points: { x: number; y: number }[],
  radii: number[],
): ViewBox {
  const pad = 2.8;
  const pawnPad = 4.8;
  const sceneryR = 6.5;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const bump = (x: number, y: number, rr: number) => {
    minX = Math.min(minX, x - rr);
    minY = Math.min(minY, y - rr);
    maxX = Math.max(maxX, x + rr);
    maxY = Math.max(maxY, y + rr);
  };

  points.forEach((p, i) => {
    bump(p.x, p.y, (radii[i] ?? R_PATH_FALLBACK) + pawnPad);
  });

  BOARD_SCENERY.forEach((s) => {
    const pos = offsetNormalFromRoad(s.t, 14 * s.side);
    bump(pos.x, pos.y, sceneryR);
  });

  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  let width = maxX - minX;
  let height = maxY - minY;

  if (!Number.isFinite(width) || width < 8) {
    return { minX: 0, minY: 0, width: 100, height: 100 };
  }
  if (!Number.isFinite(height) || height < 8) {
    return { minX: 0, minY: 0, width: 100, height: 100 };
  }

  // Keep a pleasant aspect so ultra-narrow crops don’t look odd.
  const ar = width / height;
  if (ar < 0.42) {
    const mid = (minX + maxX) / 2;
    const targetW = height * 0.42;
    minX = mid - targetW / 2;
    width = targetW;
  } else if (ar > 0.95) {
    const mid = (minY + maxY) / 2;
    const targetH = width / 0.95;
    minY = mid - targetH / 2;
    height = targetH;
  }

  return { minX, minY, width, height };
}

export function CandyRoadBoard({ board, players, castleIndex }: Props) {
  const gradId = safeSvgId(useId());
  const linkGradId = safeSvgId(useId() + "-link");

  const { points, radii, pathD } = useMemo(() => {
    const pts = getRoadPoints(board.length);
    const r = computeSpaceRadii(pts, board, castleIndex);
    const pd = pointsToSmoothBezierPath(pts);
    return { points: pts, radii: r, pathD: pd };
  }, [board, castleIndex]);

  const viewBox = useMemo(
    () => computeBoardViewBox(points, radii),
    [points, radii],
  );
  const viewBoxStr = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;

  return (
    <div
      className="candy-road"
      style={{
        aspectRatio: `${viewBox.width} / ${viewBox.height}`,
      }}
    >
      <svg
        className="candy-road__svg"
        viewBox={viewBoxStr}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Candy road from start at the bottom to the castle at the top"
      >
        <defs>
          <linearGradient id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ffe8f7" />
            <stop offset="35%" stopColor="#ffc9e6" />
            <stop offset="70%" stopColor="#fff0fb" />
            <stop offset="100%" stopColor="#e8f4ff" />
          </linearGradient>
          <radialGradient id={`${gradId}-blob`} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.55)" />
            <stop offset="55%" stopColor="rgba(255, 214, 236, 0.35)" />
            <stop offset="100%" stopColor="rgba(255, 182, 220, 0)" />
          </radialGradient>
          {/* userSpaceOnUse: objectBoundingBox breaks for horizontal strokes (0-height bbox → white). */}
          <linearGradient
            id={linkGradId}
            gradientUnits="userSpaceOnUse"
            x1={viewBox.minX}
            y1={viewBox.minY + viewBox.height * 0.5}
            x2={viewBox.minX + viewBox.width}
            y2={viewBox.minY + viewBox.height * 0.5}
          >
            <stop offset="0%" stopColor="#ffd6ea" />
            <stop offset="50%" stopColor="#ff9ecd" />
            <stop offset="100%" stopColor="#ff7eb9" />
          </linearGradient>
          <linearGradient id={`${gradId}-start`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd6e8" />
            <stop offset="100%" stopColor="#ffb3d9" />
          </linearGradient>
          <linearGradient id={`${gradId}-castle`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe066" />
            <stop offset="100%" stopColor="#fcc419" />
          </linearGradient>
        </defs>

        <rect
          x={viewBox.minX}
          y={viewBox.minY}
          width={viewBox.width}
          height={viewBox.height}
          fill={`url(#${gradId})`}
          rx={Math.min(viewBox.width, viewBox.height) * 0.025}
        />
        <ellipse
          cx={viewBox.minX + viewBox.width * 0.5}
          cy={viewBox.minY + viewBox.height * 0.38}
          rx={viewBox.width * 0.52}
          ry={viewBox.height * 0.48}
          fill={`url(#${gradId}-blob)`}
          opacity="0.9"
        />
        <ellipse
          cx={viewBox.minX + viewBox.width * 0.18}
          cy={viewBox.minY + viewBox.height * 0.78}
          rx={viewBox.width * 0.22}
          ry={viewBox.height * 0.18}
          fill="rgba(255, 255, 255, 0.35)"
        />
        <ellipse
          cx={viewBox.minX + viewBox.width * 0.84}
          cy={viewBox.minY + viewBox.height * 0.72}
          rx={viewBox.width * 0.18}
          ry={viewBox.height * 0.14}
          fill="rgba(186, 230, 253, 0.35)"
        />

        {/* Faint guide along the spine (no thick “merged” ribbon) */}
        <path
          d={pathD}
          fill="none"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.5 2.8"
          opacity="0.55"
        />

        {/* Links between spaces (bridges from circle edge to circle edge) */}
        <g className="candy-road__links" aria-hidden>
          {points.slice(0, -1).map((p, i) => {
            const p2 = points[i + 1];
            const r1 = radii[i] ?? R_PATH_FALLBACK;
            const r2 = radii[i + 1] ?? R_PATH_FALLBACK;
            const b = bridgeEndpoints(p, r1, p2, r2);
            return (
              <g key={`link-${i}`}>
                <line
                  x1={b.x1}
                  y1={b.y1}
                  x2={b.x2}
                  y2={b.y2}
                  stroke="rgba(255, 255, 255, 0.92)"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                />
                <line
                  x1={b.x1}
                  y1={b.y1}
                  x2={b.x2}
                  y2={b.y2}
                  stroke={`url(#${linkGradId})`}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
                <line
                  x1={b.x1}
                  y1={b.y1}
                  x2={b.x2}
                  y2={b.y2}
                  stroke="rgba(255, 255, 255, 0.75)"
                  strokeWidth={0.55}
                  strokeLinecap="round"
                  strokeDasharray="0.6 1.8"
                  opacity="0.5"
                />
              </g>
            );
          })}
        </g>

        {BOARD_SCENERY.map((s, i) => {
          const pos = offsetNormalFromRoad(s.t, 14 * s.side);
          const fs = s.emojis.length > 1 ? 2.35 : 2.75;
          return (
            <g
              key={`scenery-${i}`}
              transform={`translate(${pos.x}, ${pos.y})`}
              aria-hidden
            >
              <title>{s.label}</title>
              <ellipse cx="0" cy="1.2" rx="5.2" ry="2.4" fill="rgba(0,0,0,0.08)" />
              {s.emojis.map((em, j) => (
                <text
                  key={j}
                  x={(j - (s.emojis.length - 1) / 2) * 3.1}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fs}
                  style={{
                    userSelect: "none",
                    fontFamily:
                      '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif',
                  }}
                >
                  {em}
                </text>
              ))}
            </g>
          );
        })}

        {board.map((space, index) => {
          const p = points[index] ?? { x: 50, y: 50 };

          let centerEmoji: string | null = null;
          if (space.kind === "landmark") {
            centerEmoji = iconForLandmark(space.landmarkId);
          } else if (space.kind === "start") {
            centerEmoji = START_ICON;
          } else if (space.kind === "castle") {
            centerEmoji = CASTLE_ICON;
          }

          const isCastle = index === castleIndex;
          const isStart = space.kind === "start";
          const isLandmark = space.kind === "landmark";
          const isSpecial = isCastle || isStart;
          const r = radii[index] ?? R_PATH_FALLBACK;

          let fill = "#dee2e6";
          let stroke = "rgba(0,0,0,0.18)";
          if (space.kind === "path") {
            fill = COLOR_HEX[space.color];
            stroke = "rgba(255,255,255,0.65)";
          } else if (space.kind === "start") {
            fill = `url(#${gradId}-start)`;
            stroke = "#ff85b3";
          } else if (space.kind === "castle") {
            fill = `url(#${gradId}-castle)`;
            stroke = "#fab005";
          } else if (isLandmark) {
            fill = "#ede9fe";
            stroke = "#845ef7";
          }

          return (
            <g key={index} transform={`translate(${p.x}, ${p.y})`}>
              <circle
                r={r + 0.35}
                fill="rgba(255,255,255,0.35)"
                stroke="none"
                aria-hidden
              />
              <circle
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={isLandmark ? 0.5 : 0.35}
                style={{ filter: "drop-shadow(0 0.15 0.25 rgba(0,0,0,0.12))" }}
              />
              {space.kind === "path" && (
                <circle r={r * 0.32} fill="rgba(255,255,255,0.65)" aria-hidden />
              )}
              {centerEmoji && (
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isSpecial ? 3.15 : isLandmark ? 2.85 : 2.65}
                  fill="#1a1a2e"
                  style={{
                    userSelect: "none",
                    fontFamily:
                      '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif',
                  }}
                  aria-hidden
                >
                  {centerEmoji}
                </text>
              )}
            </g>
          );
        })}

        {/* Pawns on top so later trail spaces never paint over them */}
        <g className="candy-road__pawns" aria-hidden>
          {board.map((_, index) => {
            const p = points[index] ?? { x: 50, y: 50 };
            const playersHere = players.filter((pl) => pl.position === index);
            if (playersHere.length === 0) return null;
            const r = radii[index] ?? R_PATH_FALLBACK;
            return (
              <g key={`pawns-${index}`} transform={`translate(${p.x}, ${p.y})`}>
                {playersHere.map((pl, ti) => {
                  const n = Math.max(1, playersHere.length);
                  const angle = (-Math.PI / 2) + (ti * (Math.PI * 2)) / n;
                  const ringR = Math.max(
                    PAWN_BACKPLATE_R + 0.85,
                    r + 1.15,
                  );
                  const ox = Math.cos(angle) * ringR;
                  const oy = Math.sin(angle) * ringR;
                  return (
                    <g key={pl.name} transform={`translate(${ox}, ${oy})`}>
                      <circle
                        r={PAWN_BACKPLATE_R + 0.28}
                        fill="rgba(0,0,0,0.18)"
                        stroke="none"
                        aria-hidden
                      />
                      <circle
                        r={PAWN_BACKPLATE_R}
                        fill="#fffdf8"
                        stroke="rgba(0,0,0,0.25)"
                        strokeWidth={0.2}
                        aria-hidden
                      />
                      <text
                        x={0}
                        y={0.1}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={PAWN_FONT_SIZE}
                        style={{
                          userSelect: "none",
                          fontFamily:
                            '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif',
                        }}
                        aria-hidden
                      >
                        {pawnIcon(pl.name)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
