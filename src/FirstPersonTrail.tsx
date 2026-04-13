import { useCallback, useEffect, useRef } from "react";
import { easeOutCubic, lerp } from "./game/fpMath";
import { trailSpaceFill } from "./game/candyColors";
import {
  CASTLE_ICON,
  START_ICON,
  iconForLandmark,
} from "./game/icons";
import type { BoardSpace } from "./game/types";
import "./FirstPersonTrail.css";

export type FirstPersonTrailProps = {
  board: BoardSpace[];
  viewIndex: number;
  /** Pawn emoji for the player whose turn it is (top-right HUD). */
  turnPawnEmoji: string;
  /** Screen reader label, e.g. "Archer's turn". */
  turnLabel?: string;
  animFromIdx: number | null;
  animToIdx: number | null;
  animDurationMs: number | null;
  animKey: number;
  onAnimationComplete?: () => void;
};

const VISIBLE_CELLS = 8;
const ROAD_BANDS = 16;

function halfRoadWidth(f: number, roadTopW: number, roadBotW: number): number {
  return lerp(roadTopW / 2, roadBotW / 2, Math.max(0, Math.min(1, f)));
}

function cellIndexAt(boardLen: number, p: number): number {
  return Math.min(boardLen - 1, Math.max(0, Math.floor(p)));
}

function fpSpaceIcon(space: BoardSpace): string | null {
  switch (space.kind) {
    case "landmark":
      return iconForLandmark(space.landmarkId);
    case "start":
      return START_ICON;
    case "castle":
      return CASTLE_ICON;
    case "path":
      return null;
  }
}

/**
 * Colored FP road: each band maps to a trail index ahead of `idx`, so when
 * `idx` increases, squares scroll toward the horizon like walking the board.
 */
export function FirstPersonTrail({
  board,
  viewIndex,
  turnPawnEmoji,
  turnLabel,
  animFromIdx,
  animToIdx,
  animDurationMs,
  animKey,
  onAnimationComplete,
}: FirstPersonTrailProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayIdxRef = useRef(viewIndex);
  const viewIndexRef = useRef(viewIndex);
  viewIndexRef.current = viewIndex;
  const boardRef = useRef(board);
  boardRef.current = board;
  const turnPawnEmojiRef = useRef(turnPawnEmoji);
  turnPawnEmojiRef.current = turnPawnEmoji;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const boardNow = boardRef.current;
    if (!canvas || !wrap || boardNow.length === 0) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bl = boardNow.length;
    const idx = displayIdxRef.current;
    const maxI = Math.max(1, bl - 1);
    const progress = Math.min(1, Math.max(0, idx / maxI));
    const forwardPx = idx * 22;

    const lateral = Math.sin(progress * Math.PI * 2) * 10;
    const cx = w / 2 + lateral;
    const horizonY = h * (0.33 + progress * 0.1);
    const roadTopW = w * (0.11 + progress * 0.02);
    const roadBotW = w * 0.44;

    ctx.fillStyle = "#120810";
    ctx.fillRect(0, 0, w, h);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#fff5fb");
    sky.addColorStop(0.38, "#ffc9e8");
    sky.addColorStop(0.75, "#a85d7a");
    sky.addColorStop(1, "#2d1528");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.58);

    ctx.save();
    ctx.translate(lateral * 0.08, 0);
    ctx.fillStyle = "rgba(140, 80, 110, 0.28)";
    ctx.beginPath();
    ctx.moveTo(-60, horizonY + 50);
    ctx.quadraticCurveTo(w * 0.25, horizonY - 20, w * 0.55, horizonY + 28);
    ctx.lineTo(w + 80, horizonY + 10);
    ctx.lineTo(w + 80, h);
    ctx.lineTo(-60, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - roadBotW / 2, h);
    ctx.lineTo(cx + roadBotW / 2, h);
    ctx.lineTo(cx + roadTopW / 2, horizonY);
    ctx.lineTo(cx - roadTopW / 2, horizonY);
    ctx.closePath();
    ctx.clip();

    type Band = {
      f0: number;
      f1: number;
      y0: number;
      y1: number;
      midF: number;
      ci: number;
    };
    const bands: Band[] = [];
    for (let i = 0; i < ROAD_BANDS; i++) {
      const f0 = i / ROAD_BANDS;
      const f1 = (i + 1) / ROAD_BANDS;
      const y0 = horizonY + f0 * (h - horizonY);
      const y1 = horizonY + f1 * (h - horizonY);
      const midF = (f0 + f1) / 2;
      const trailPos = idx + VISIBLE_CELLS * (1 - midF);
      const ci = cellIndexAt(bl, trailPos);
      const space = boardNow[ci];
      ctx.fillStyle = trailSpaceFill(space);
      const hw0 = halfRoadWidth(f0, roadTopW, roadBotW);
      const hw1 = halfRoadWidth(f1, roadTopW, roadBotW);
      ctx.beginPath();
      ctx.moveTo(cx - hw0, y0);
      ctx.lineTo(cx + hw0, y0);
      ctx.lineTo(cx + hw1, y1);
      ctx.lineTo(cx - hw1, y1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1;
      ctx.stroke();
      bands.push({ f0, f1, y0, y1, midF, ci });
    }

    let b = 0;
    while (b < bands.length) {
      const ci = bands[b].ci;
      let e = b + 1;
      while (e < bands.length && bands[e].ci === ci) e++;
      const yTop = bands[b].y0;
      const yBot = bands[e - 1].y1;
      const midF = (bands[b].f0 + bands[e - 1].f1) / 2;
      const icon = fpSpaceIcon(boardNow[ci]);
      if (icon) {
        const cy = (yTop + yBot) / 2;
        const span = yBot - yTop;
        const fontSize = Math.max(
          14,
          Math.min(52, span * 0.92 + midF * 18),
        );
        const plaqueR = Math.min(halfRoadWidth(midF, roadTopW, roadBotW), fontSize * 0.95);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, plaqueR * 0.92, span * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 1;
        ctx.fillText(icon, cx, cy);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }
      b = e;
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(62, 22, 48, 0.78)";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - roadBotW / 2, h);
    ctx.lineTo(cx - roadTopW / 2, horizonY);
    ctx.moveTo(cx + roadBotW / 2, h);
    ctx.lineTo(cx + roadTopW / 2, horizonY);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - roadBotW / 2, h);
    ctx.lineTo(cx + roadBotW / 2, h);
    ctx.lineTo(cx + roadTopW / 2, horizonY);
    ctx.lineTo(cx - roadTopW / 2, horizonY);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 16]);
    ctx.lineDashOffset = forwardPx * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, horizonY + 6);
    ctx.lineTo(cx, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const mist = ctx.createRadialGradient(
      cx,
      horizonY - h * 0.02,
      h * 0.06,
      w / 2,
      horizonY * 0.55,
      h * 0.92,
    );
    mist.addColorStop(0, "rgba(255, 250, 252, 0)");
    mist.addColorStop(0.5, "rgba(255, 235, 246, 0.08)");
    mist.addColorStop(1, "rgba(25, 10, 22, 0.45)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(
      w / 2,
      h / 2,
      h * 0.12,
      w / 2,
      h / 2,
      h * 0.78,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(8, 4, 10, 0.38)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    const turnEmoji = turnPawnEmojiRef.current.trim();
    if (turnEmoji) {
      const pad = 12;
      const fontSize = Math.min(46, Math.max(26, w * 0.082));
      const box = fontSize * 1.42;
      const cxT = w - pad - box / 2;
      const cyT = pad + box / 2;
      const x0 = cxT - box / 2;
      const y0 = cyT - box / 2;

      ctx.save();
      ctx.fillStyle = "rgba(32, 16, 28, 0.55)";
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x0, y0, box, box, 14);
      ctx.fill();
      ctx.stroke();

      ctx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillText(turnEmoji, cxT, cyT);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    const idle =
      animFromIdx == null ||
      animToIdx == null ||
      animDurationMs == null ||
      animDurationMs <= 0;
    if (idle) {
      displayIdxRef.current = viewIndexRef.current;
      paint();
    }
  }, [viewIndex, animFromIdx, animToIdx, animDurationMs, paint]);

  useEffect(() => {
    if (
      animFromIdx == null ||
      animToIdx == null ||
      animDurationMs == null ||
      animDurationMs <= 0
    ) {
      return;
    }
    displayIdxRef.current = animFromIdx;
    paint();
    const start = performance.now();
    let raf = 0;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const raw = (now - start) / animDurationMs;
      const u = Math.min(1, raw);
      displayIdxRef.current = lerp(animFromIdx, animToIdx, easeOutCubic(u));
      paint();
      if (u < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onAnimationComplete?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [
    animKey,
    animFromIdx,
    animToIdx,
    animDurationMs,
    onAnimationComplete,
    paint,
  ]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(el);
    paint();
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => {
    paint();
  }, [turnPawnEmoji, paint]);

  return (
    <div ref={wrapRef} className="fp-trail">
      {turnLabel ? (
        <span className="fp-trail__sr-only">{turnLabel}</span>
      ) : null}
      <canvas ref={canvasRef} className="fp-trail__canvas" aria-hidden />
    </div>
  );
}
