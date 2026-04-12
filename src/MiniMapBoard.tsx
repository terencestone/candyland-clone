import { CandyRoadBoard } from "./CandyRoadBoard";
import type { BoardSpace, Player } from "./game/types";
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
