import {
  useCallback,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { FirstPersonTrail } from "./FirstPersonTrail";
import { MiniMapBoard } from "./MiniMapBoard";
import { castleIndex } from "./game/board";
import { gameReducer, initialState } from "./game/gameReducer";
import { animationDurationMs, findMover } from "./game/fpMath";
import {
  CASTLE_ICON,
  START_ICON,
  iconForLandmark,
  pawnIcon,
} from "./game/icons";
import type { BoardSpace, CandyColor, Card, Player } from "./game/types";
import "./App.css";

const COLOR_HEX: Record<CandyColor, string> = {
  red: "#e63946",
  purple: "#9b5de5",
  yellow: "#fee440",
  blue: "#00bbf9",
  orange: "#f77f00",
  green: "#06d6a0",
};

function CardFace({ card }: { card: Card }) {
  if (card.kind === "goto") {
    return (
      <div
        className="last-card__face last-card__face--goto last-card__face--visual"
        aria-label={`Go to ${card.landmark}`}
      >
        <span className="last-card__emoji" aria-hidden>
          {iconForLandmark(card.landmark)}
        </span>
      </div>
    );
  }
  const n = card.count;
  return (
    <div
      className="last-card__face last-card__face--visual last-card__face--colors"
      aria-label={n === 2 ? `Double ${card.color}` : card.color}
    >
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className="last-card__swatch"
          style={{ background: COLOR_HEX[card.color] }}
        />
      ))}
    </div>
  );
}

function WherePawn({ space }: { space: BoardSpace }) {
  if (space.kind === "castle") {
    return (
      <span className="where__icon" aria-hidden>
        {CASTLE_ICON}
      </span>
    );
  }
  if (space.kind === "start") {
    return (
      <span className="where__icon" aria-hidden>
        {START_ICON}
      </span>
    );
  }
  if (space.kind === "landmark") {
    return (
      <span className="where__icon" aria-hidden>
        {iconForLandmark(space.landmarkId)}
      </span>
    );
  }
  if (space.kind === "path") {
    return (
      <span
        className="where__blob"
        style={{ background: COLOR_HEX[space.color] }}
        aria-hidden
      />
    );
  }
  return null;
}

type TrailAnim = {
  key: number;
  fromIdx: number;
  toIdx: number;
  durationMs: number;
};

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, initialState);
  const castle = castleIndex(state.board);
  const current = state.players[state.currentPlayerIndex];

  const playersSnapshotRef = useRef<Player[] | null>(null);
  const [trailAnim, setTrailAnim] = useState<TrailAnim | null>(null);

  const idleViewIndex =
    state.players[state.currentPlayerIndex]?.position ?? 0;

  useLayoutEffect(() => {
    const next = state.players.map((p) => ({ ...p }));
    if (playersSnapshotRef.current === null) {
      playersSnapshotRef.current = next;
      return;
    }
    const prev = playersSnapshotRef.current;
    playersSnapshotRef.current = next;
    const move = findMover(prev, next);
    if (!move || move.from === move.to) return;
    setTrailAnim({
      key: Date.now(),
      fromIdx: move.from,
      toIdx: move.to,
      durationMs: animationDurationMs(move.from, move.to),
    });
  }, [state.players, state.board.length]);

  const onAnimDone = useCallback(() => {
    setTrailAnim(null);
  }, []);

  const onNewGame = () => {
    setTrailAnim(null);
    dispatch({ type: "NEW_GAME" });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Candy Land</h1>
        <p className="sub">Same screen — Archer &amp; River take turns</p>
      </header>

      <div className="main-layout">
        <div className="fp-wrap">
          <FirstPersonTrail
            boardLength={state.board.length}
            viewIndex={idleViewIndex}
            animFromIdx={trailAnim?.fromIdx ?? null}
            animToIdx={trailAnim?.toIdx ?? null}
            animDurationMs={trailAnim?.durationMs ?? null}
            animKey={trailAnim?.key ?? 0}
            onAnimationComplete={onAnimDone}
          />
        </div>

        <div className="mini-map-wrap">
          <MiniMapBoard
            board={state.board}
            players={state.players}
            castleIndex={castle}
          />
        </div>

        <aside className="side-panel" aria-label="Game controls">
          <div className="status">
            <p className="log">{state.log}</p>
            {state.phase === "play" && (
              <p className="turn">
                <span className="turn__label">Whose turn</span>{" "}
                <strong className="turn__name">{current?.name}</strong>
              </p>
            )}
          </div>

          <div className="actions actions--stack">
            <button
              type="button"
              className="btn btn--primary btn--large btn--block"
              disabled={state.phase === "won"}
              onClick={() => dispatch({ type: "DRAW" })}
            >
              Draw card
            </button>
            <button
              type="button"
              className="btn btn--large btn--block"
              onClick={onNewGame}
            >
              New game
            </button>
          </div>

          {state.lastCard && (
            <div className="last-card last-card--side" aria-live="polite">
              <span className="last-card__label">Card</span>
              <CardFace card={state.lastCard} />
            </div>
          )}

          <ul className="scores">
            {state.players.map((p, i) => (
              <li key={p.name}>
                <span className="scores__pawn" aria-hidden title="Pawn">
                  {pawnIcon(p.name)}
                </span>
                <span className="scores__name">{p.name}</span>
                <span className="scores__where" title="Where on the road">
                  <WherePawn space={state.board[p.position]} />
                </span>
                {state.winnerIndex === i && (
                  <span className="scores__win" aria-hidden>
                    {" "}
                    {CASTLE_ICON}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
