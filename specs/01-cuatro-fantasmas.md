# SPEC 01 — Cuatro fantasmas con personalidades arcade

> **Status:** Implemented
> **Depends on:** Ninguna (primer spec del repo).
> **Date:** 2026-09-13
> **Objective:** Dotar al juego de cuatro fantasmas con personalidades arcade diferenciadas, una de ellas persiguiendo agresivamente a Pac-Man.

## Scope

**In:**

- Cuatro fantasmas activos con `kind` distintos: `blinky` (perseguidor agresivo), `pinky` (emboscador), `inky` (flanqueador), `clyde` (tímido).
- Ampliación de `GHOST_STARTS` en `src/js/maze.js` a 4 entradas dentro de la pen con retardo de salida por fantasma.
- Lógica de `target` por `kind` en `decideGhost` en `src/js/game.js` manteniendo regla sin-reversa salvo callejón.
- Salida escalonada por contador de frames (`exitDelay`).
- Misma velocidad `0.1` celda/frame para los 4.

**Out of scope (for future specs):**

- Modos globales scatter/chase con temporizador.
- Salida por dots comidos estilo arcade original.
- Modo asustado / comer fantasmas / power pellets.
- Cambios visuales, HUD, sonidos o persistencia.

## Data model

Esta funcionalidad modifica estructuras existentes, no crea archivos nuevos.

```js
// src/js/maze.js — 4 arranques dentro de la pen
const GHOST_STARTS = [
  { x: 11, y: 14, kind: 'blinky' },
  { x: 13, y: 14, kind: 'pinky' },
  { x: 14, y: 14, kind: 'inky' },
  { x: 16, y: 14, kind: 'clyde' },
];

// src/js/game.js — fantasma en partida (se añade exitTimer)
const ghost = {
  x: 13, y: 14, dir: 'up', speed: 0.1,
  kind: 'blinky', exitDelay: 0, exitTimer: 0,
};
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda.
- `target` es la celda objetivo para distancia Manhattan en `decideGhost`.
- `exitDelay` en frames (ej. `blinky: 0, pinky: 90, inky: 180, clyde: 270`).
- Colores por índice en `GHOST_COLORS` de `render.js`: rojo, rosa, cian, naranja. Sin cambio en `render.js`.

Targets simplificados (sin scatter global):

- `blinky` → `(pacman.x, pacman.y)`.
- `pinky` → 4 celdas delante de Pac-Man según `pacman.dir`.
- `inky` → espejo de `blinky` respecto a 2 celdas delante de Pac-Man.
- `clyde` → si distancia a Pac-Man > 8 celdas persigue como `blinky`, si no apunta a su esquina (abajo-izquierda).

## Implementation plan

1. Ampliar `GHOST_STARTS` a 4 entradas con `kind` en `src/js/maze.js`. Verificación: abrir `src/index.html`, 4 fantasmas existen en `createGame()`.
2. Propagar `kind` + `exitDelay`/`exitTimer` en `createGame` y `resetPositions` en `src/js/game.js`. Verificación: reiniciar tras perder vida recoloca a los 4.
3. Implementar targets de `blinky` y `pinky` en `decideGhost`. Verificación: el rojo persigue, el rosa corta por delante.
4. Implementar targets de `inky` y `clyde` en `decideGhost`. Verificación: comportamientos distintos visibles en juego.
5. Implementar bloqueo de salida por `exitDelay` (fantasma quieto dentro hasta cumplir frames). Verificación: salen escalonados, ninguno queda atrapado en la puerta.

## Acceptance criteria

- [ ] Abrir `src/index.html` muestra 4 fantasmas con colores rojo, rosa, cian y naranja.
- [ ] El fantasma rojo reduce su distancia Manhattan a Pac-Man en cruces abiertos.
- [ ] El fantasma rosa apunta a 4 celdas delante de Pac-Man (verificable girando a Pac-Man y viendo el giro del rosa).
- [ ] Los 4 salen de la pen de forma escalonada sin quedarse bloqueados en la puerta (tile `3`).
- [ ] La consola del navegador no muestra errores durante 60 segundos de juego.
- [ ] Perder una vida recoloca a Pac-Man y a los 4 fantasmas en sus inicios.
- [ ] `render.js` no cambia salvo que sea estrictamente necesario.

## Decisions

- **Sí:** personalidades arcade simplificadas sin modo scatter/chase global. Motivo: fidelidad suficiente con cambio mínimo y verificable.
- **No:** Inky arcade exacto con vector completo ni Clyde con scatter dedicado. Motivo: sobredimensiona el primer spec.
- **Sí:** salida por contador de frames. Motivo: determinista y simple frente a salida por dots que acopla progreso.
- **No:** salida por dots comidos. Motivo: va a otro spec si se quiere fidelidad total.
- **Sí:** misma velocidad `0.1` para los 4. Motivo: la diferencia la pone la IA, balance fácil.
- **No:** agresivo más rápido. Motivo: endurece sin aportar variedad de comportamiento.
- **Sí:** reutilizar `GHOST_COLORS` existente. Motivo: ya soporta 4, cero cambios visuales.
- **Definición rápida con clarificación en 2 bloques.** Motivo: el usuario respondió todo lo necesario para no asumir targets ni salida.

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Los 4 se apilan al salir por la misma puerta | Delays distintos (0/90/180/270) y posiciones iniciales separadas |
| Inky depende de Blinky y falla si Blinky no existe | Fallback: si no hay `blinky`, Inky actúa como `pinky` |
| Posiciones iniciales dentro de muro por error de coordenadas | Usar solo celdas `0` del interior de la pen (fila 14) |

## What is **not** in this spec

- Modo scatter/chase global con temporizador.
- Salida de la pen por dots comidos.
- Fantasmas comestibles, power pellets y puntuación extra.
- Cambios en `render.js`, HUD, sonidos o persistencia.

Cada uno de esos, si llega, va en su propio spec.
