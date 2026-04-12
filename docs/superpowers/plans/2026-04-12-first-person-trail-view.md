# First-person trail view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a split-screen first-person Canvas “trail walk” with mist/parallax, a scaled SVG mini map, and unchanged game rules—wired to existing `GameState` / `useReducer`.

**Architecture:** Pure helpers in `fpMath.ts` detect mover and normalize trail progress. `FirstPersonTrail` owns a `<canvas>`, `requestAnimationFrame` easing, and drawing (sky, parallax, road, fog, optional emoji billboards). `MiniMapBoard` wraps existing `CandyRoadBoard` read-only. `App` snapshots `players` before `DRAW`, compares after update to start animation, and lays out FP + mini map + side panel.

**Tech Stack:** Vite 5, React 18, TypeScript, Vitest (unit tests for `fpMath` only), Canvas 2D API, existing SVG board component.

**Spec:** `docs/superpowers/specs/2026-04-12-first-person-trail-view-design.md`

---

## File map

| File | Role |
|------|------|
| `package.json` | Add `vitest`, `jsdom`; script `"test": "vitest run"` |
| `vitest.config.ts` | Vitest project, `environment: "node"` for pure TS tests |
| `src/game/fpMath.ts` | `findMover`, `trailProgress`, `easeOutCubic`, `animationDurationMs` |
| `src/game/fpMath.test.ts` | Tests for the above |
| `src/FirstPersonTrail.tsx` | Canvas FP view + animation loop |
| `src/FirstPersonTrail.css` | Canvas wrapper (min height, border-radius) |
| `src/MiniMapBoard.tsx` | Scaled `CandyRoadBoard` + `aria-label` |
| `src/App.tsx` | Layout, pre-draw snapshot ref, pass props to FP + mini map |
| `src/App.css` | Grid: FP column \| mini map + side panel |

---

### Task 1: Vitest + `fpMath` + tests

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/game/fpMath.ts`
- Create: `src/game/fpMath.test.ts`

- [ ] **Step 1: Add Vitest**

`package.json` scripts add `"test": "vitest run"`. devDependencies add `"vitest": "^2.1.8"`, `"jsdom": "^25.0.1"` (jsdom optional if using `environment: "node"` only—use node for fp tests).

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write failing tests**

Create `src/game/fpMath.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  animationDurationMs,
  easeOutCubic,
  findMover,
  lerp,
  trailProgress,
} from "./fpMath";

describe("findMover", () => {
  it("returns null when no position change", () => {
    const p = [{ name: "A", position: 2 }];
    expect(findMover(p, p)).toBeNull();
  });

  it("detects single player move", () => {
    const prev = [
      { name: "Archer", position: 1 },
      { name: "River", position: 0 },
    ];
    const next = [
      { name: "Archer", position: 5 },
      { name: "River", position: 0 },
    ];
    expect(findMover(prev, next)).toEqual({
      moverIndex: 0,
      from: 1,
      to: 5,
    });
  });

  it("returns null when two players move", () => {
    const prev = [
      { name: "Archer", position: 1 },
      { name: "River", position: 2 },
    ];
    const next = [
      { name: "Archer", position: 2 },
      { name: "River", position: 3 },
    ];
    expect(findMover(prev, next)).toBeNull();
  });
});

describe("trailProgress", () => {
  it("is 0 at start and 1 at last index", () => {
    expect(trailProgress(0, 10)).toBe(0);
    expect(trailProgress(9, 10)).toBe(1);
  });

  it("interpolates mid board", () => {
    expect(trailProgress(5, 11)).toBeCloseTo(0.5, 5);
  });
});

describe("lerp / ease", () => {
  it("lerps", () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });

  it("easeOutCubic endpoints", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
});

describe("animationDurationMs", () => {
  it("caps long jumps", () => {
    const d = animationDurationMs(1, 40);
    expect(d).toBeGreaterThanOrEqual(800);
    expect(d).toBeLessThanOrEqual(2200);
  });
});
```

- [ ] **Step 4: Run tests — expect FAIL**

Run: `npm install` then `npm run test`  
Expected: FAIL (module `./fpMath` missing or exports undefined).

- [ ] **Step 5: Implement `src/game/fpMath.ts`**

```ts
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
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `npm run test`  
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/game/fpMath.ts src/game/fpMath.test.ts
git commit -m "test: add fpMath helpers and Vitest for trail FP view"
```

---

### Task 2: `MiniMapBoard` wrapper

**Files:**
- Create: `src/MiniMapBoard.tsx`
- Create: `src/MiniMapBoard.css` (optional; can use `className` in TSX only)

- [ ] **Step 1: Create wrapper**

`src/MiniMapBoard.tsx`:

```tsx
import { CandyRoadBoard } from "./CandyRoadBoard";
import type { Player } from "./game/types";
import type { BoardSpace } from "./game/types";
import "./MiniMapBoard.css";

type Props = {
  board: BoardSpace[];
  players: Player[];
  castleIndex: number;
};

export function MiniMapBoard({ board, players, castleIndex }: Props) {
  return (
    <div className="mini-map" aria-label="Trail overview map">
      <div className="mini-map__inner">
        <CandyRoadBoard board={board} players={players} castleIndex={castleIndex} />
      </div>
    </div>
  );
}
```

`src/MiniMapBoard.css`:

```css
.mini-map {
  width: 100%;
  max-height: 280px;
  overflow: hidden;
  border-radius: 14px;
  border: 2px solid rgba(255, 160, 200, 0.45);
  background: rgba(255, 255, 255, 0.55);
}

.mini-map__inner {
  transform: scale(0.42);
  transform-origin: top center;
  width: 238%;
  margin: 0 auto;
  pointer-events: none;
}
```

Tune `scale` / `width` so the scaled board fits without clipping badly.

- [ ] **Step 2: Commit**

```bash
git add src/MiniMapBoard.tsx src/MiniMapBoard.css
git commit -m "feat: add MiniMapBoard wrapper for scaled trail overview"
```

---

### Task 3: `FirstPersonTrail` Canvas component

**Files:**
- Create: `src/FirstPersonTrail.tsx`
- Create: `src/FirstPersonTrail.css`

- [ ] **Step 1: Define props**

```ts
export type FirstPersonTrailProps = {
  boardLength: number;
  /** 0..1 along trail for camera “feet” */
  trailT: number;
  /** When set, ease trailT from `animFromT` to `animToT` over durationMs */
  animFromT: number | null;
  animToT: number | null;
  animDurationMs: number | null;
  animKey: number;
};
```

`animKey` increments each new animation so the effect restarts cleanly.

- [ ] **Step 2: Canvas resize**

Use `useRef<HTMLCanvasElement>(null)`, `ResizeObserver` on canvas parent, set `canvas.width = rect.width * dpr`, `canvas.height = rect.height * dpr`, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.

- [ ] **Step 3: Animation clock**

`useEffect` on `[animKey, animFromT, animToT, animDurationMs]`: if any anim param null, set internal `displayT = trailT`. Else `requestAnimationFrame` loop: `t = (now - start) / duration`, `u = easeOutCubic(t)`, `displayT = lerp(animFromT, animToT, u)`; on complete call optional `onAnimationComplete` callback prop.

Expose `onAnimationComplete?: () => void` in props.

- [ ] **Step 4: Draw frame (v1 visuals)**

Each rAF + when resize: clear rect; draw vertical gradient sky (top lighter pink → bottom deeper); draw two parallax “hills” as filled quadratic curves with `offsetX = sin(trailT * π * 2) * 40`; draw road trapezoid (four `lineTo` from bottom corners to near-horizon center pinch); stripe the road with alternating rgba white lines using clipped path; draw radial fog (`createRadialGradient` center above horizon, alpha); draw subtle vignette (`createLinearGradient` edges).

- [ ] **Step 5: Wire `trailT` from parent**

Parent computes idle `trailProgress(players[currentPlayerIndex].position, board.length)` and passes as `trailT`.

- [ ] **Step 6: Commit**

```bash
git add src/FirstPersonTrail.tsx src/FirstPersonTrail.css
git commit -m "feat: add FirstPersonTrail canvas with mist road and animation hook"
```

---

### Task 4: `App` integration — snapshot, animation, layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Refs and snapshot before draw**

```tsx
const playersSnapshotRef = useRef(state.players);
const [anim, setAnim] = useState<{
  key: number;
  fromT: number;
  toT: number;
  durationMs: number;
} | null>(null);

const onDrawClick = () => {
  playersSnapshotRef.current = state.players.map((p) => ({ ...p }));
  dispatch({ type: "DRAW" });
};
```

Wire Draw button to `onDrawClick` instead of inline dispatch.

- [ ] **Step 2: `useLayoutEffect` after `state.players` change**

Compare `playersSnapshotRef.current` to `state.players` with `findMover`. If mover and `from !== to`, compute `fromT = trailProgress(from, state.board.length)`, `toT = trailProgress(to, state.board.length)`, `durationMs = animationDurationMs(from, to)`, `setAnim({ key: Date.now(), fromT, toT, durationMs })`. If `from === to`, do not set anim. Always update snapshot ref to current `state.players` at end of effect so idle transitions track.

**Idle `trailT`:** `trailProgress(state.players[state.currentPlayerIndex].position, state.board.length)`.

**While animating:** pass `anim.fromT` / `anim.toT` / duration to `FirstPersonTrail`; on complete, `setAnim(null)` so idle uses new `currentPlayerIndex` position.

- [ ] **Step 3: `NEW_GAME`**

When `dispatch({ type: "NEW_GAME" })`, clear `anim` null and reset snapshot in same click handler or effect when `state.log` / positions detect reset—simplest: `useEffect` if both players at 0 and start—actually on NEW_GAME full `initialState`—effect can `setAnim(null)` when `state.players.every(p => p.position===0)`.

- [ ] **Step 4: Layout CSS**

```css
.main-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  grid-template-rows: minmax(220px, 280px) 1fr;
  gap: 1rem 1.25rem;
  align-items: start;
}

.fp-wrap {
  grid-column: 1;
  grid-row: 1 / -1;
  min-height: min(72vh, 820px);
}

.mini-map-wrap {
  grid-column: 2;
  grid-row: 1;
}

.side-panel {
  grid-column: 2;
  grid-row: 2;
}
```

Remove old flex-only rules that conflict; keep mobile optional loose stacking if desired.

- [ ] **Step 5: Render tree**

```tsx
<div className="main-layout">
  <div className="fp-wrap">
    <FirstPersonTrail
      boardLength={state.board.length}
      trailT={idleT}
      animFromT={anim ? anim.fromT : null}
      animToT={anim ? anim.toT : null}
      animDurationMs={anim ? anim.durationMs : null}
      animKey={anim?.key ?? 0}
      onAnimationComplete={() => setAnim(null)}
    />
  </div>
  <div className="mini-map-wrap">
    <MiniMapBoard board={...} players={...} castleIndex={castle} />
  </div>
  <aside className="side-panel">...</aside>
</div>
```

Remove the old `board-wrap` that hosted full-size `CandyRoadBoard` only.

- [ ] **Step 6: Run `npm run build` and `npm run test`**

Expected: PASS / no TS errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: split layout with FP canvas, mini map, and draw animation"
```

---

### Task 5: Landmark / castle hints on canvas (optional v1 polish)

**Files:**
- Modify: `src/FirstPersonTrail.tsx`

- [ ] **Step 1:** Accept optional `board: BoardSpace[]` prop (read-only). From `Math.floor(trailT * (board.length - 1))` scan forward 1–4 cells; if `landmark` or `castle`, `ctx.font = "48px sans-serif"` and `ctx.fillText(icon, cx, cy)` with alpha tied to `(1 - trailT)` fog—keep icons small near horizon.

- [ ] **Step 2:** Commit `feat: draw upcoming landmark hints on FP canvas`

---

### Task 6: Self-review vs spec

- [ ] Split layout + mini map + side panel: Tasks 2–4.
- [ ] POV idle = `currentPlayerIndex`: Task 4 idle `trailT`.
- [ ] Animate mover on draw: Task 4 snapshot + `findMover`.
- [ ] No reducer change: verified.
- [ ] Resize / DPR: Task 3.
- [ ] Win / long jump: `animationDurationMs` caps; castle visual optional Task 5.

---

## Plan self-review

| Spec item | Task |
|-----------|------|
| Split FP + mini map + panel | 2, 4 |
| Hybrid Canvas + SVG | 2, 3 |
| POV + animation rules | 4 |
| Fog / road / parallax | 3 |
| Landmarks on FP | 5 optional |
| Tests for pure math | 1 |
| No rule drift | 4 (reducer untouched) |

No TBD placeholders in executable steps above.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-12-first-person-trail-view.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration.  
2. **Inline Execution** — Run tasks in this session with checkpoints between tasks.

**Which approach?** (If you do not care, say **inline** and implementation can proceed here.)
