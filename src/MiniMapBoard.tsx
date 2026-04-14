import { useEffect, useId, useRef, useState } from "react";
import { CandyRoadBoard } from "./CandyRoadBoard";
import type { BoardSpace, Player } from "./game/types";
import { usePrefersReducedMotion } from "./ui/usePrefersReducedMotion";
import "./MiniMapBoard.css";

type Props = {
  board: BoardSpace[];
  players: Player[];
  castleIndex: number;
};

export function MiniMapBoard({ board, players, castleIndex }: Props) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!expanded) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return (
    <>
      <div className="mini-map" aria-label="Trail overview map">
        <div className="mini-map__header">
          <div className="mini-map__title">Map</div>
          <button
            type="button"
            className="mini-map__expand"
            onClick={() => setExpanded(true)}
          >
            Expand
          </button>
        </div>

        <div
          className="mini-map__inner"
          data-reduced-motion={reducedMotion ? "true" : "false"}
          aria-hidden
        >
          <CandyRoadBoard
            board={board}
            players={players}
            castleIndex={castleIndex}
          />
        </div>
      </div>
      {expanded ? (
        <div
          className="mini-map-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setExpanded(false);
          }}
        >
          <div className="mini-map-modal__panel">
            <div className="mini-map-modal__header">
              <h2 id={titleId} className="mini-map-modal__title">
                Big Map
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                className="mini-map-modal__close"
                onClick={() => setExpanded(false)}
                aria-label="Close map"
              >
                ✕
              </button>
            </div>

            <div className="mini-map-modal__body" aria-hidden>
              <CandyRoadBoard
                board={board}
                players={players}
                castleIndex={castleIndex}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
