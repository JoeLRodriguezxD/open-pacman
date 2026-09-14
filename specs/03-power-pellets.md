# SPEC 03 — Power pellets en esquinas con modo asustado

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-14
> **Objective:** Añadir 4 power pellets en las esquinas del laberinto actual que activan el modo asustado clásico simplificado con fantasmas comestibles.

## Scope

**In:**

- 4 power pellets en celdas `(1,1)`, `(26,1)`, `(1,29)`, `(26,29)` de `MAZE_STR` (las `'.'` más cercanas a cada esquina), con carácter `'o'` → tile `4`.
- Pellet vale `50` pts y cuenta en `dotsRemaining` para victoria como un dot.
- Modo asustado de `7` s: fantasmas a `~50%` velocidad, IA aleatoria sin-reversa, azules con parpadeo blanco los últimos `2` s.
- Inversión de `180°` de todos los fantasmas fuera de la pen al activar.
- Comer fantasmas en cadena `200/400/800/1600`; el fantasma comido reaparece en su `GHOST_STARTS` con `exitDelay 0`.
- Segundo pellet con modo activo reinicia timer a `7` s y cadena a `200`.
- Render del pellet grande (`~6px` vs `2.5px`) con parpadeo `~2Hz`.

**Out of scope (for future specs):**

- Ojos viajando a la pen.
- Niveles, fruta, scatter/chase global, salida por dots.
- Selector de duración o dificultad.
- Sonidos, HUD extra, persistencia.

## Data model

Modifica estructuras existentes, no crea archivos nuevos.

```js
// src/js/maze.js — parseo
// '#'→1, '.'→2, '-'→3, 'o'→4
// MAZE_STR filas 1 y 29 con 'o' en (1,1), (26,1), (1,29), (26,29)

// src/js/game.js — estado en partida
const game = {
  frightTimer: 0,   // segundos restantes de modo asustado
  frightChain: 0,   // índice 0-3 para 200/400/800/1600
};
const FRIGHT_DURATION = 7;
const FRIGHT_SCORES = [200, 400, 800, 1600];
const POWER_PELLET_POINTS = 50;
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda (como SPEC 01/02).
- Tiempos en segundos, velocidades en celdas/segundo (como SPEC 02).
- `frightTimer` se decrementa con `dt` en `update`; `frightChain` se reinicia a `0` con cada pellet.
- Comentarios y UI en español.

## Implementation plan

1. Marcar las 4 esquinas en `MAZE_STR` con `'o'` y añadir `parseTile('o')→4` en `src/js/maze.js`. Verificación: `MAZE[1][1]===4` y `createGame().dotsRemaining` incluye los 4.
2. Comer pellet en `movePacman` en `src/js/game.js`: si celda `===4` → `grid=0`, `score+=50`, `dotsRemaining--`, activar `frightTimer=7`, `frightChain=0`, invertir dirs. Verificación: comer esquina suma 50 y pone timer.
3. Timer y velocidad en `update`/`moveGhost`: decrementar `frightTimer-=dt`, velocidad fantasma `*0.5` si activo, `decideGhost` aleatorio si activo. Verificación: 7 s lentos y huyen.
4. Colisiones y respawn en `update`/`resetPositions`: si `frightTimer>0` comer fantasma (`score+=FRIGHT_SCORES[chain++]`, teleport a `GHOST_STARTS` con `exitDelay 0`), si no perder vida como antes; `resetPositions` limpia `frightTimer/chain`. Verificación: cadena 200/400/800/1600 y revive en pen.
5. Visual en `src/js/render.js`: `drawDots` dibuja tile `4` con radio `~6` y parpadeo por `frame`; `drawGhost` azul `#2121ff` y blanco intermitente últimos 2 s si `frightTimer>0`. Verificación: se ven grandes parpadeando y fantasmas azules.

## Acceptance criteria

- [ ] Abrir `src/index.html` muestra 4 pellets grandes parpadeando en las 4 esquinas, visiblemente mayores que el dot de `2.5px`.
- [ ] Comer un pellet suma exactamente `50` pts y lo borra del grid.
- [ ] Comer un pellet activa `7` s (±0.5 s) de modo asustado con inversión inmediata de fantasmas fuera de la pen.
- [ ] En modo asustado los fantasmas van ~mitad de velocidad y se mueven aleatorio sin-reversa.
- [ ] Comer fantasmas asustados suma `200`, luego `400`, `800`, `1600` en orden dentro del mismo modo.
- [ ] El fantasma comido reaparece en su inicio de la pen en modo normal sin bloquear la puerta (tile `3`).
- [ ] Comer un segundo pellet con modo activo reinicia el timer a `7` s y la cadena a `200`.
- [ ] Los fantasmas asustados se ven azules y parpadean en blanco los últimos `2` s.
- [ ] Comer los 4 pellets cuenta para victoria (`dotsRemaining` llega a 0).
- [ ] La consola no muestra errores durante 60 s de juego.
- [ ] `main.js` y `maze.js` (salvo `MAZE_STR`+`parseTile`) no cambian de lógica.

## Decisions

- **Sí:** posiciones `(1,1),(26,1),(1,29),(26,29)` (esquinas reales del MAZE actual). Motivo: lo elegido por el usuario frente a arcade clásico.
- **No:** arcade clásico `(1,3),(26,3),(1,23),(26,23)`. Motivo: descartado por el usuario.
- **Sí:** clásico simplificado 7s/50%/200-1600. Motivo: fidelidad suficiente sin ojos viajando ni niveles.
- **No:** solo puntos sin modo asustado. Motivo: el usuario pidió propiedades del original.
- **Sí:** tile `4` con `'o'`. Motivo: reutiliza grid, conteo y render sin sincronía extra.
- **No:** lista `POWER_PELLETS` separada. Motivo: más código de sincronía.
- **Sí:** respawn por teleport con `exitDelay 0`. Motivo: simple y sin animación de ojos.
- **No:** ojos viajando. Motivo: sobredimensiona el spec, va a otro si se quiere.
- **Sí:** segundo pellet reinicia timer y cadena. Motivo: comportamiento arcade.
- **Sí:** inversión de 180° al activar. Motivo: fiel al original y confirmado.
- **Sí:** azul + blanco últimos 2s. Motivo: aviso de fin arcade con cambio mínimo.
- **Definición con clarificación en 2 bloques.** Motivo: posiciones, timer, respawn y visual obligaban a cerrar para no asumir.

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Una `'o'` cae en muro si cambia `MAZE_STR` | Elegir solo celdas `'.'` actuales; verificación `MAZE[y][x]===4` en plan paso 1 |
| `dotsRemaining` no cuenta tile `4` y el juego no se puede ganar | Contar `v===2 \|\| v===4` en `createGame` |
| Fantasma comido revive sobre la puerta y se bloquea | Revivir en `GHOST_STARTS` (interior pen, fila 14) con `exitDelay 0`, nunca sobre tile `3` |
| Parpadeo acoplado a `frame` visual varía con fps | Usar `frame` de `rAF` solo para visual, nunca para lógica de `frightTimer` (que usa `dt`) |

## What is **not** in this spec

- Ojos viajando a la pen.
- Fruta, niveles, puntos por nivel.
- Modos scatter/chase globales.
- Sonidos, HUD extra, persistencia.

Cada uno de esos, si llega, va en su propio spec.
