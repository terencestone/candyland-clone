import { useCallback, useEffect, useRef } from "react";
import { easeOutCubic, lerp } from "./game/fpMath";
import { trailSpaceFill } from "./game/candyColors";
import {
  CASTLE_ICON,
  START_ICON,
  iconForLandmark,
} from "./game/icons";
import type { BoardSpace } from "./game/types";
import { usePrefersReducedMotion } from "./ui/usePrefersReducedMotion";
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
const TILE_ROWS = 11;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function stripesFill(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.12, "#ffe3f2");
  g.addColorStop(0.24, "#ffffff");
  g.addColorStop(0.36, "#ffd6ea");
  g.addColorStop(0.48, "#ffffff");
  g.addColorStop(0.6, "#ffe3f2");
  g.addColorStop(0.72, "#ffffff");
  g.addColorStop(0.84, "#ffd6ea");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
}

function paperTexturePattern(
  w: number,
  h: number,
  seed: number,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const tw = Math.min(420, Math.max(220, Math.floor(w * 0.6)));
  const th = Math.min(420, Math.max(220, Math.floor(h * 0.6)));
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const img = ctx.createImageData(tw, th);
  let s = seed | 0;
  for (let i = 0; i < img.data.length; i += 4) {
    // Xorshift-ish PRNG (fast, deterministic).
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const r = (s >>> 0) / 0xffffffff;
    const n = (r - 0.5) * 28; // small luminance wiggle
    img.data[i + 0] = 255;
    img.data[i + 1] = 255;
    img.data[i + 2] = 255;
    img.data[i + 3] = Math.max(0, Math.min(255, 18 + n));
  }
  ctx.putImageData(img, 0, 0);

  // Soft fiber streaks.
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "rgba(120, 60, 90, 1)";
  for (let i = 0; i < 70; i++) {
    const y = ((i * 37) % th) + 0.5;
    ctx.lineWidth = 1 + ((i * 13) % 3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(-30, y);
    ctx.quadraticCurveTo(tw * 0.35, y - 10, tw + 30, y + 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return c;
}

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
  const reducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const paperRef = useRef<{
    w: number;
    h: number;
    seed: number;
    canvas: HTMLCanvasElement;
  } | null>(null);

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
    const progress = clamp01(idx / maxI);
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

    // Candy clouds
    ctx.save();
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < 7; i++) {
      const t = (i + 1) / 8;
      const y = horizonY * 0.16 + t * (h * 0.22);
      const x = ((i * 0.37 + progress * 0.55) % 1) * (w + 220) - 110;
      const rx = 54 + t * 40;
      const ry = 18 + t * 14;
      const g = ctx.createRadialGradient(x, y, 6, x, y, rx);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Side scenery: simple candy props tied to upcoming tiles.
    const baseIdx = cellIndexAt(bl, idx);
    const props = [
      { side: -1, ahead: 2, kind: "lollipop" as const },
      { side: 1, ahead: 3, kind: "gumdrop" as const },
      { side: -1, ahead: 5, kind: "cane" as const },
      { side: 1, ahead: 6, kind: "lollipop" as const },
    ];
    for (const p of props) {
      const ci = cellIndexAt(bl, baseIdx + p.ahead);
      const s = boardNow[ci];
      const t = clamp01(p.ahead / (VISIBLE_CELLS + 1)); // farther props are smaller / foggier
      const y = horizonY + (0.24 + t * 0.66) * (h - horizonY);
      const x = cx + p.side * (roadBotW * (0.62 + (1 - t) * 0.24));
      const scale = (1 - t) ** 1.35;
      const alpha = 0.55 * (0.3 + scale);
      const col = trailSpaceFill(s);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(0.9 + scale * 1.5, 0.9 + scale * 1.5);

      // Drop shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(0, 20, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (p.kind === "lollipop") {
        // Stick
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(0, -18);
        ctx.stroke();
        // Candy head
        const g = ctx.createRadialGradient(-6, -26, 6, 0, -26, 24);
        g.addColorStop(0, "rgba(255,255,255,0.75)");
        g.addColorStop(1, col);
        ctx.fillStyle = g;
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -26, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Swirl
        ctx.globalAlpha *= 0.6;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, -26, 14, -Math.PI * 0.2, Math.PI * 1.35);
        ctx.stroke();
      } else if (p.kind === "gumdrop") {
        const g = ctx.createLinearGradient(0, -30, 0, 18);
        g.addColorStop(0, "rgba(255,255,255,0.65)");
        g.addColorStop(1, col);
        ctx.fillStyle = g;
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-22, 12);
        ctx.quadraticCurveTo(-18, -26, 0, -30);
        ctx.quadraticCurveTo(18, -26, 22, 12);
        ctx.quadraticCurveTo(0, 26, -22, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Sugar dots
        ctx.globalAlpha *= 0.55;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 10, -10 + Math.sin(a) * 10, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Candy cane pole
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(0, 22);
        ctx.lineTo(0, -16);
        ctx.quadraticCurveTo(0, -30, 12, -30);
        ctx.stroke();
        ctx.strokeStyle = "rgba(194, 37, 92, 0.8)";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(0, -14);
        ctx.quadraticCurveTo(0, -26, 10, -26);
        ctx.stroke();
      }
      ctx.restore();
    }

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

    type Slice = {
      ci: number;
      yTop: number;
      yBot: number;
      midF: number;
    };
    const slices: Slice[] = [];

    // Tile rows: draw squishy rounded "board squares" with candy-cane edge.
    for (let i = 0; i < TILE_ROWS; i++) {
      const f0 = i / TILE_ROWS;
      const f1 = (i + 1) / TILE_ROWS;
      const midF = (f0 + f1) / 2;
      const y0 = horizonY + f0 * (h - horizonY);
      const y1 = horizonY + f1 * (h - horizonY);

      const hw0 = halfRoadWidth(f0, roadTopW, roadBotW);
      const hw1 = halfRoadWidth(f1, roadTopW, roadBotW);
      const yMid = (y0 + y1) / 2;
      const hw = (hw0 + hw1) / 2;

      const trailPos = idx + VISIBLE_CELLS * (1 - midF);
      const ci = cellIndexAt(bl, trailPos);
      const space = boardNow[ci];

      const pad = Math.max(3, Math.min(12, (y1 - y0) * 0.16));
      const tileW = Math.max(18, hw * 2 - pad * 2);
      const tileH = Math.max(14, (y1 - y0) - pad * 2);
      const x = cx - tileW / 2;
      const y = yMid - tileH / 2;
      const r = Math.max(6, Math.min(18, tileH * 0.38));

      // Soft shadow
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(x, y + Math.max(2, tileH * 0.06), tileW, tileH, r);
      ctx.fill();
      ctx.restore();

      // Tile base fill
      ctx.fillStyle = trailSpaceFill(space);
      ctx.beginPath();
      ctx.roundRect(x, y, tileW, tileH, r);
      ctx.fill();

      // Gloss highlight
      const gloss = ctx.createLinearGradient(0, y, 0, y + tileH);
      gloss.addColorStop(0, "rgba(255,255,255,0.55)");
      gloss.addColorStop(0.35, "rgba(255,255,255,0.08)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss;
      ctx.beginPath();
      ctx.roundRect(x, y, tileW, tileH, r);
      ctx.fill();

      // Candy cane edging (diagonal stripes around each tile)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, tileW, tileH, r);
      ctx.clip();
      ctx.globalAlpha = 0.8;
      stripesFill(ctx, x, y, x + tileW, y + tileH);
      ctx.translate(x, y);
      ctx.rotate(-0.2);
      const stripeW = Math.max(10, tileH * 0.42);
      ctx.globalAlpha = 0.35;
      for (let s = -tileW; s < tileW * 2; s += stripeW) {
        ctx.fillRect(s, -tileH, stripeW * 0.42, tileH * 3);
      }
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = Math.max(1, tileH * 0.07);
      ctx.beginPath();
      ctx.roundRect(x, y, tileW, tileH, r);
      ctx.stroke();

      slices.push({ ci, yTop: y0, yBot: y1, midF });
    }

    // Landmarks/Start/Castle icons: merge identical cells like before (prevents spam).
    let b = 0;
    while (b < slices.length) {
      const ci = slices[b].ci;
      let e = b + 1;
      while (e < slices.length && slices[e].ci === ci) e++;
      const yTop = slices[b].yTop;
      const yBot = slices[e - 1].yBot;
      const midF = (slices[b].midF + slices[e - 1].midF) / 2;
      const icon = fpSpaceIcon(boardNow[ci]);
      if (icon) {
        const cy = (yTop + yBot) / 2;
        const span = yBot - yTop;
        const fontSize = Math.max(16, Math.min(62, span * 0.95 + midF * 22));
        const plaqueR = Math.min(halfRoadWidth(midF, roadTopW, roadBotW), fontSize * 1.05);
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "rgba(255,255,255,0.32)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, plaqueR * 0.92, span * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = Math.max(1, span * 0.06);
        ctx.stroke();
        ctx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "#1a1a2e";
        ctx.fillText(icon, cx, cy);
        ctx.restore();
      }
      b = e;
    }
    ctx.restore();

    // Candy cane borders along the whole lane.
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.setLineDash([14, 18]);
    ctx.lineDashOffset = -forwardPx * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - roadBotW / 2, h);
    ctx.lineTo(cx - roadTopW / 2, horizonY);
    ctx.moveTo(cx + roadBotW / 2, h);
    ctx.lineTo(cx + roadTopW / 2, horizonY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(194, 37, 92, 0.75)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx - roadBotW / 2, h);
    ctx.lineTo(cx - roadTopW / 2, horizonY);
    ctx.moveTo(cx + roadBotW / 2, h);
    ctx.lineTo(cx + roadTopW / 2, horizonY);
    ctx.stroke();
    ctx.restore();

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
    ctx.lineDashOffset = reducedMotionRef.current ? 0 : forwardPx * 0.55;
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

    // Procedural paper texture overlay (subtle).
    if (!reducedMotionRef.current) {
      const seed = Math.floor(progress * 100000) + bl * 97;
      const prev = paperRef.current;
      if (!prev || prev.w !== w || prev.h !== h || prev.seed !== seed) {
        paperRef.current = { w, h, seed, canvas: paperTexturePattern(w, h, seed) };
      }
      const tex = paperRef.current?.canvas;
      if (!tex) return;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.globalCompositeOperation = "overlay";
      ctx.drawImage(tex, 0, 0, w, h);
      ctx.globalAlpha = 0.065;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(tex, 0, 0, w, h);
      ctx.restore();
    }

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

    if (reducedMotionRef.current) {
      displayIdxRef.current = animToIdx;
      paint();
      onAnimationComplete?.();
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
