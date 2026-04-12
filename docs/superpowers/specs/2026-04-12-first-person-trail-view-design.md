# First-person trail view — design spec

**Status:** Approved (verbal)  
**Date:** 2026-04-12  
**Project:** candyland-clone (Vite + React + TypeScript)

## Goal

Add a **visually richer, Myst-inspired first-person feel** on a large desktop layout: each turn, the active player’s view **moves forward** along the candy trail in a **faked 3D / 2D** scene (perspective road, fog, parallax). This is **not** real WebGL 3D.

## Layout decision (approved)

**Option A — Split screen**

- **Primary:** Large first-person panel (new).
- **Secondary:** **Small mini map** showing the full trail and both pawns (reuse existing top-down board, scaled).
- **Controls:** Keep the existing **side panel** (draw, new game, last card, turn, scores).

Desktop-first; no requirement to optimize for small viewports in this phase.

## POV rule (approved)

**Idle (no animation):** First-person camera is tied to **`state.currentPlayerIndex`** — that player’s pawn, on their current cell, looking **forward** along the trail (toward higher indices / the castle).

**On Draw:** After each `DRAW`, compare previous and next `players[]`. Exactly one player’s `position` changes per turn in this game; that index is the **mover**. Run a **forward walk** animation for the mover from **old position → new position** along the trail ordering.

**When the walk completes:** Return to **idle** using the updated `currentPlayerIndex` (the next player to draw), so the standing POV matches whose turn the UI already shows.

Implementation detail (non-normative): a ref holding pre-draw `players` / positions is enough to detect the mover and old/new indices without changing the reducer contract.

## Technical approach (approved)

**Hybrid**

1. **Canvas 2D** — main FP “window”: road, horizon, fog/mist gradients, 1–2 parallax layers, landmark billboards scaled by fake depth.
2. **Existing SVG board** — mini map: CSS-scaled `CandyRoadBoard` (or thin read-only wrapper) in a fixed-height region.
3. **No new game rules** in v1 — `gameReducer` and `GameState` stay the source of truth; FP is presentation + local animation state only.

## Architecture

| Piece | Responsibility |
|--------|------------------|
| `gameReducer` / types | Unchanged contract for v1. |
| `fpMath.ts` (or `game/fpView.ts`) | Pure helpers: `trailProgress(board, playerIndex)`, `lerp`, segments ahead for drawing, “visible landmarks” list. |
| `FirstPersonTrail.tsx` | `<canvas>`; props from `GameState` + animation tick; `resizeObserver` + `devicePixelRatio`. |
| `MiniMapBoard.tsx` | Wraps `CandyRoadBoard` with scale + `pointer-events: none` if read-only. |
| `App.tsx` | Grid/flex: FP (flex-grow) \| column [mini map, existing side panel]. |

## Data flow

1. User clicks **Draw** → reducer updates positions, `lastCard`, `currentPlayerIndex`, phase, etc.
2. FP component receives update → if **mover’s** `position` changed, start **ease** from previous progress along trail to new progress (duration configurable, e.g. **0.8–1.2s**).
3. If **no position change** (house rule: no matching color ahead), **skip** travel animation; optional subtle feedback only.
4. Mini map re-renders from same `state.board` / `state.players` — no separate sync.

## Visual scope (v1)

- **Road:** Trapezoid / fan of stripes toward a vanishing region; scroll or offset by “depth.”
- **Fog:** Layered gradients (radial vignette + soft horizon haze) drawn each frame.
- **Parallax:** Two low-detail layers (e.g. candy “hills” or clouds) with horizontal offset tied to depth.
- **Landmarks:** When upcoming cells (in trail order from POV) include `kind === "landmark"`, draw icon with scale ∝ `1 / (fakeZ + ε)` and alpha modulated by fog.
- **Castle:** When mover reaches castle index, end animation with **gate / bright horizon** treatment (simple gradient pulse acceptable).

Out of scope for v1: sound, particles beyond simple gradient pulse, mobile layout, WebGL.

## Edge cases

| Case | Behavior |
|------|------------|
| Win (castle) | Complete walk-to-castle animation; respect `phase === "won"`; optional short celebration overlay on canvas. |
| `goto` card | Long jump: longer animation or faster travel so duration stays bounded (e.g. cap distance per second). |
| New game | Reset FP depth/progress immediately to start indices. |
| Window resize | Resize canvas backing store; debounce if needed. |

## Testing

- **Unit tests** (Vitest optional in plan): pure functions for progress along trail index order, lerp bounds, “no movement” detection.
- **Manual:** Large monitor; draw singles, doubles, picture cards; two-player alternation; new game.

## Success criteria

- Split layout: **large FP + visible mini map + side panel** usable on external monitor.
- **Misty / soft** horizon read without WebGL.
- **No rule drift** — board indices and reducer outcomes match current behavior.

## Follow-up (not in v1)

- Sound, footstep sync, richer particles.
- Optional: POV toggle or “always Archer cam” for streaming.
