# AGENTS.md

Vanilla JS + HTML + CSS Pac-Man clone. No deps, no build, no tests, no lint, no CI.

## Run

Open `src/index.html` directly in a browser (or `python3 -m http.server` in `src/`). No build step. Entry is `src/index.html`, not repo root.

## Architecture

- `src/js/maze.js` — pristine `MAZE` grid (28x31), `TUNNEL_ROW=14`, `PACMAN_START`, `GHOST_STARTS`. Never mutate `MAZE`; `createGame()` copies it to `game.grid`.
- `src/js/game.js` — state + rules (`createGame`, `update`). Pac-Man speed `0.125`, ghost `0.1` cell/frame; movement snaps via `aligned()` (epsilon `1e-3`).
- `src/js/render.js` — canvas drawing (`draw`), reads `game.grid` for eaten dots. `TILE=20`, so canvas 560x620 must stay `28*20 x 31*20`.
- `src/js/main.js` — loop, arrow-key input (`nextDir` queue), overlay states `start/playing/won/lost`.

## Quirks agents miss

- Scripts are classic (no `import`/`export`); they share globals via `window.*`. Load order in `index.html` matters: `maze.js -> game.js -> render.js -> main.js`. Do not reorder or convert to modules without updating all files.
- Tile codes: `0` empty, `1` wall, `2` dot, `3` ghost-pen door. `isWall` treats door as wall for Pac-Man but passable for ghosts.
- Ghost AI: `kind: 'hunter'` chases Pac-Man (Manhattan), `'random'` picks non-reversing moves (180 turn only in dead ends). `collides` threshold is `0.5` cells.
- Comments and UI strings are in Spanish; keep them that way.
- CSS `#game-wrap` fixed at `560x620` — update together with canvas/`TILE` if maze size changes.

## Spec-driven workflow

- Skills live in `.agents/skills/spec/` and `.agents/skills/spec-impl/` (see `template.md` there for spec shape). Specs go in `specs/NN-slug.md` (folder does not exist yet; start at `01-`).
- `/spec` never writes code; `/spec-impl` only runs on specs whose state means `Approved` (`Aprobado`, etc.), one plan step at a time with user confirmation, branch `spec-NN-slug`. Never commit automatically.
