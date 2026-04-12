import { useCallback, useEffect, useRef } from "react";
import { easeOutCubic, lerp } from "./game/fpMath";
import "./FirstPersonTrail.css";

export type FirstPersonTrailProps = {
  boardLength: number;
  viewIndex: number;
  animFromIdx: number | null;
  animToIdx: number | null;
  animDurationMs: number | null;
  animKey: number;
  onAnimationComplete?: () => void;
};

/**
 * Forward motion = continuous scroll + smooth progress along the trail.
 * Avoids `%` on index (was causing pops) and large high‑frequency sines (was “wonky”).
 */
export function FirstPersonTrail({
  boardLength,
  viewIndex,
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

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
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

    const idx = displayIdxRef.current;
    const maxI = Math.max(1, boardLength - 1);
    const progress = Math.min(1, Math.max(0, idx / maxI));
    /** Continuous “walked distance” for scrolling — no modulo. */
    const forwardPx = idx * 22;
    /** One slow sway over the whole trail (subtle). */
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

    const roadGrad = ctx.createLinearGradient(cx, horizonY, cx, h);
    roadGrad.addColorStop(0, "#ffe3f2");
    roadGrad.addColorStop(0.55, "#ff9ecd");
    roadGrad.addColorStop(1, "#d9487e");
    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    ctx.moveTo(cx - roadBotW / 2, h);
    ctx.lineTo(cx + roadBotW / 2, h);
    ctx.lineTo(cx + roadTopW / 2, horizonY);
    ctx.lineTo(cx - roadTopW / 2, horizonY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(62, 22, 48, 0.75)";
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

    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 2;
    const band = 38;
    const scroll = forwardPx * 0.32;
    for (let y = horizonY - scroll - 400; y < h + 400; y += band) {
      const t = (y - horizonY) / (h - horizonY);
      if (t < 0 || t > 1.02) continue;
      const hw = lerp(roadTopW / 2, roadBotW / 2, Math.max(0, Math.min(1, t)));
      ctx.beginPath();
      ctx.moveTo(cx - hw, y);
      ctx.lineTo(cx + hw, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 18]);
    ctx.lineDashOffset = forwardPx * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, horizonY + 8);
    ctx.lineTo(cx, h);
    ctx.stroke();
    ctx.setLineDash([]);

    const mist = ctx.createRadialGradient(
      cx,
      horizonY - h * 0.02,
      h * 0.06,
      w / 2,
      horizonY * 0.55,
      h * 0.92,
    );
    mist.addColorStop(0, "rgba(255, 250, 252, 0)");
    mist.addColorStop(0.5, "rgba(255, 235, 246, 0.1)");
    mist.addColorStop(1, "rgba(25, 10, 22, 0.5)");
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
    vignette.addColorStop(1, "rgba(8, 4, 10, 0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }, [boardLength]);

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

  return (
    <div ref={wrapRef} className="fp-trail">
      <canvas ref={canvasRef} className="fp-trail__canvas" aria-hidden />
    </div>
  );
}
