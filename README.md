# Candy Land clone

A browser-based **Candy Land–style** path game built with **React**, **TypeScript**, and **Vite**. Draw cards, move pawns along a colorful trail (including a first-person view), and race to the castle.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm install`  | Install dependencies     |
| `npm run dev`  | Start dev server (Vite)  |
| `npm run build`| Typecheck + production build |
| `npm run preview` | Preview production build locally |
| `npm test`     | Run unit tests (Vitest)  |

## Project layout

- `src/App.tsx` — Main UI, players, and card flow
- `src/FirstPersonTrail.tsx` — First-person trail view
- `src/MiniMapBoard.tsx` — Board overview
- `src/game/` — Board definition, rules reducer, math, and tests

## License

This project is for learning and demonstration. Candy Land is a trademark of Hasbro; this is an independent clone and is not affiliated with or endorsed by Hasbro.
