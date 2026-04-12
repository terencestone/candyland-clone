import { applyColorCard, buildBoard, castleIndex, findLandmarkIndex } from "./board";
import { createDeck } from "./deck";
import type { Card, GameState } from "./types";

export type GameAction = { type: "NEW_GAME" } | { type: "DRAW" };

export function initialState(): GameState {
  const board = buildBoard();
  return {
    board,
    drawPile: createDeck(),
    discardPile: [],
    players: [{ name: "Archer", position: 0 }, { name: "River", position: 0 }],
    currentPlayerIndex: 0,
    phase: "play",
    winnerIndex: null,
    lastCard: null,
    log: "Draw a card to begin.",
  };
}

function reshuffleIfNeeded(state: GameState): GameState {
  if (state.drawPile.length > 0) return state;
  if (state.discardPile.length === 0) {
    return { ...state, drawPile: createDeck() };
  }
  const next = shuffle([...state.discardPile]);
  return { ...state, drawPile: next, discardPile: [] };
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function describeCard(card: Card): string {
  if (card.kind === "goto") {
    const names: Record<string, string> = {
      gingerbread: "Gingerbread",
      peppermint: "Peppermint",
      gumdrop: "Gumdrop",
      lollipop: "Lollipop",
      cinnamon_bun: "Cinnamon bun",
      popsicle: "Popsicle",
    };
    return `Go to ${names[card.landmark] ?? card.landmark}`;
  }
  const c = card.color;
  return card.count === 2 ? `Double ${c}` : `${c}`;
}

function resolveCard(
  state: GameState,
  card: Card,
  playerIndex: number,
): { players: GameState["players"]; log: string; winnerIndex: number | null; phase: GameState["phase"] } {
  const board = state.board;
  const pos = state.players[playerIndex].position;
  const castle = castleIndex(board);

  let nextPos = pos;

  if (card.kind === "goto") {
    nextPos = findLandmarkIndex(board, card.landmark);
  } else {
    nextPos = applyColorCard(board, pos, card.color, card.count);
  }

  if (nextPos >= castle) nextPos = castle;

  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, position: nextPos } : p,
  );

  const winnerIndex = nextPos >= castle ? playerIndex : null;
  const phase = winnerIndex !== null ? "won" : "play";
  const name = players[playerIndex].name;
  const log =
    winnerIndex !== null
      ? `${name} reached the castle and wins!`
      : `${name} drew ${describeCard(card)}.`;

  return { players, log, winnerIndex, phase };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "NEW_GAME") {
    return initialState();
  }

  if (action.type === "DRAW") {
    if (state.phase === "won") return state;

    let s = reshuffleIfNeeded(state);
    if (s.drawPile.length === 0) return state;

    const [card, ...rest] = s.drawPile;
    const playerIndex = s.currentPlayerIndex;

    const resolved = resolveCard(s, card, playerIndex);
    const nextPlayerCount = s.players.length;
    const nextPlayerIndex =
      resolved.phase === "won"
        ? playerIndex
        : (playerIndex + 1) % nextPlayerCount;

    return {
      ...s,
      drawPile: rest,
      discardPile: [...s.discardPile, card],
      players: resolved.players,
      currentPlayerIndex: nextPlayerIndex,
      phase: resolved.phase,
      winnerIndex: resolved.winnerIndex,
      lastCard: card,
      log: resolved.log,
    };
  }

  return state;
}
