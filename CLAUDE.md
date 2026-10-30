# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas, no dependencies). The README is in Spanish; UI text (`lang="es"`, "Reiniciar", etc.) is mixed Spanish/English.

There is no `package.json`, build step, linter, or test suite. To run it, open `index.html` directly or serve the folder statically (e.g. `python -m http.server 8000`) and browse to `http://localhost:8000`.

## Architecture

Three files, loaded with a plain `<script src="game.js">` (no modules):

- `index.html` — fixed DOM that `game.js` looks up by id at load time: `board` (300×600 canvas), `next-canvas` (120×120), `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `theme-toggle`. Renaming any id breaks the script at startup.
- `style.css` — dark/retro styling and the `.hidden` class used by the overlay.
- `game.js` — all logic, in strict mode, with module-level mutable state (`board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId`) reset by `init()`. The restart button calls `init()` again, and `init()` is also called once at the end of the file.

Key design points in `game.js`:

- Board is a `ROWS × COLS` matrix of `0` or a color index 1–7. The same index selects the entry in both `PIECES` and `COLORS` (index 0 is `null` in both), so adding or reordering a piece means editing both arrays together.
- Pieces are square matrices rotated by `rotateCW` (transpose + reverse rows); `tryRotate` applies wall kicks by trying ±1 and ±2 column offsets.
- `loop(ts)` is a `requestAnimationFrame` loop that accumulates elapsed time into `dropAccum` and drops one row once it passes `dropInterval`. Fall speed is `max(100, 1000 − (level − 1) × 90)` ms; level rises every 10 lines.
- Scoring uses `LINE_SCORES` × level, plus 2 points per cell for hard drop and 1 per row for soft drop.
- `spawn()` ends the game (`endGame()` → overlay) if the new piece collides immediately.

Canvas size is tied to constants: `COLS × BLOCK` by `ROWS × BLOCK` must match the `width`/`height` attributes on `<canvas id="board">` in `index.html`; changing one without the other distorts the board.

## Working in this repo

When viewing `game.js` through tooling that compresses output, function bodies may appear as `/* caveman: body elided */`. This is a display artifact, not file content; read the real file (or retrieve the original) before editing a function.
