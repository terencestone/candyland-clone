import { useId } from "react";
import { CASTLE_ICON, START_ICON, iconForLandmark, pawnIcon } from "./game/icons";
import { getRoadPoints, pointsToPolylinePath } from "./game/roadLayout";
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

const R_PATH = 2.15;
const R_SPECIAL = 2.75;
const PAWN_RING_R = 3.55;
const PAWN_BACKPLATE_R = 1.75;
const PAWN_FONT_SIZE = 2.05;

function safeSvgId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned.length ? `i${cleaned}` : `i${Math.random().toString(36).slice(2, 9)}`;
}

export function CandyRoadBoard({ board, players, castleIndex }: Props) {
  const gradId = safeSvgId(useId());
  const points = getRoadPoints(board.length);
  const pathD = pointsToPolylinePath(points);

  return (
    <div className="candy-road">
      <svg
        className="candy-road__svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Candy road from start at the bottom to the castle at the top"
      >
        <defs>
          <linearGradient id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ffc2e0" />
            <stop offset="50%" stopColor="#ffa6d5" />
            <stop offset="100%" stopColor="#ffe8f4" />
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

        <rect x="0" y="0" width="100" height="100" fill={`url(#${gradId})`} rx="3" />

        <path
          d={pathD}
          fill="none"
          stroke="#fff5fb"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#ff9ecd"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2.2 5"
          opacity="0.55"
        />

        {board.map((space, index) => {
          const p = points[index] ?? { x: 50, y: 50 };
          const playersHere = players
            .map((pl, pi) => ({ pl, pi }))
            .filter(({ pl }) => pl.position === index);

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
          const r = isSpecial ? R_SPECIAL : R_PATH;

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
              {playersHere.map(({ pl }, ti) => {
                const n = Math.max(1, playersHere.length);
                const angle = (-Math.PI / 2) + (ti * (Math.PI * 2)) / n;
                const ringR = Math.max(PAWN_RING_R, r + 2.3);
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
      </svg>
    </div>
  );
}
