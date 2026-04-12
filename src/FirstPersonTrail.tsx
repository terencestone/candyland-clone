import { useCallback, useEffect, useRef } from "react";
import { easeOutCubic, lerp } from "./game/fpMath";
import "./FirstPersonTrail.css";

export type FirstPersonTrailProps = {
  boardLength: number;
  /** Idle camera: current turn player’s board index (integer). */
  viewIndex: number;
  /** During draw animation: board indices to lerp between (inclusive). */
  animFromIdx: number | null;
  animToIdx: number | null;
  animDurationMs: number | null;
  animKey: number;
  onAnimationComplete?: () => void;
};

/**
 * Drive visuals from **board index** (not 0–1 trail fraction) so each step
 * produces a visible shift; normalized progress was too subtle on a long board.
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
    const climb = idx / maxI;

    const phase = idx * 0.55;
    const parallax = Math.sin(phase) * 72 + Math.cos(phase * 0.31) * 26;
    const walkPulse = Math.sin(idx * 1.05) * (h * 0.022);
    const forwardScroll = (idx * 26) % 180;
    const horizonLift = climb * h * 0.07;

    ctx.fillStyle = "#120810";
    ctx.fillRect(0, 0, w, h);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#fff5fb");
    sky.addColorStop(0.35, "#ffc9e8");
    sky.addColorStop(0.72, "#c678a8");
    sky.addColorStop(1, "#4a2840");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.62);

    const horizonY = h * 0.36 + horizonLift + walkPulse;

    ctx.save();
    ctx.translate(parallax * 0.14 + walkPulse * 0.4, -forwardScroll * 0.42);

    ctx.fillStyle = "rgba(180, 100, 140, 0.35)";
    ctx.beginPath();
    ctx.moveTo(-80, horizonY + 40);
    ctx.quadraticCurveTo(w * 0.2, horizonY - 30, w * 0.45, horizonY + 20);
    ctx.quadraticCurveTo(w * 0.7, horizonY + 50, w + 120, horizonY);
    ctx.lineTo(w + 120, h + forwardScroll);
    ctx.lineTo(-80, h + forwardScroll);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(120, 70, 110, 0.4)";
    ctx.beginPath();
    ctx.moveTo(-100, horizonY + 55);
    ctx.quadraticCurveTo(w * 0.25, horizonY - 8, w * 0.55, horizonY + 35);
    ctx.quadraticCurveTo(w * 0.85, horizonY + 60, w + 100, horizonY + 25);
    ctx.lineTo(w + 100, h + forwardScroll);
    ctx.lineTo(-100, h + forwardScroll);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const roadGrad = ctx.createLinearGradient(w / 2, horizonY, w / 2, h);
    roadGrad.addColorStop(0, "#ffd6ea");
    roadGrad.addColorStop(0.45, "#ff9ecd");
    roadGrad.addColorStop(1, "#e85d9b");
    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    const roadTopW = w * (0.14 - climb * 0.02);
    const roadBotW = w * 0.46;
    const roadSkew = parallax * 0.08 + walkPulse * 0.15;
    ctx.moveTo(w / 2 - roadBotW / 2, h);
    ctx.lineTo(w / 2 + roadBotW / 2, h);
    ctx.lineTo(w / 2 + roadTopW / 2 + roadSkew, horizonY);
    ctx.lineTo(w / 2 - roadTopW / 2 + roadSkew, horizonY);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(0, -forwardScroll * 0.35);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      const f = i / stripes;
      const f2 = (i + 1) / stripes;
      const y1 = horizonY + (h - horizonY) * f;
      const y2 = horizonY + (h - horizonY) * f2;
      const xMid = w / 2 + parallax * 0.06 * (1 - f) + roadSkew * (1 - f);
      ctx.beginPath();
      ctx.moveTo(xMid, y1);
      ctx.lineTo(xMid, y2);
      ctx.stroke();
    }
    ctx.restore();

    const mist = ctx.createRadialGradient(
      w / 2 + parallax * 0.05,
      horizonY - h * 0.05,
      h * 0.05,
      w / 2,
      horizonY * 0.6,
      h * 0.95,
    );
    mist.addColorStop(0, "rgba(255, 250, 252, 0)");
    mist.addColorStop(0.45, "rgba(255, 240, 248, 0.12)");
    mist.addColorStop(1, "rgba(40, 20, 35, 0.55)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(
      w / 2,
      h / 2,
      h * 0.15,
      w / 2,
      h / 2,
      h * 0.75,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(10, 5, 12, 0.45)");
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
