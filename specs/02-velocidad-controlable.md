# SPEC 02 — Velocidad controlable con delta-tiempo

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-09-13
> **Objective:** Reducir a la mitad la velocidad de Pac-Man y los fantasmas y hacerla independiente de los fps mediante un bucle de paso fijo con delta-tiempo en `main.js`.

## Scope

**In:**

- Reducción de velocidad ~50% respecto a la actual: Pac-Man de `0.125` a equivalente a `≈3.75` celdas/seg, fantasmas de `0.1` a equivalente a `≈3.0` celdas/seg, manteniendo la ventaja de Pac-Man (~25% más rápido).
- Bucle de paso fijo con acumulador en `src/js/main.js`: acumular `dt` real de `requestAnimationFrame`, llamar a `update(game, step)` con `step = 1/60` s mientras el acumulador lo permita, dibujar una vez por `rAF`.
- Conversión de unidades en `src/js/game.js`: velocidades a celdas/segundo y `EXIT_DELAYS` de frames a segundos (`blinky 0`, `pinky 1.5`, `inky 3`, `clyde 4.5` s).
- Clamp de `dt` a `100` ms por frame para evitar saltos al volver de pestaña oculta o tirones.
- Firma `update(game, dt)` donde `dt` es el paso en segundos; valor por defecto `1/60` si se llama sin `dt` para no romper llamadas existentes.

**Out of scope (for future specs):**

- Selector de velocidad o niveles de dificultad (lento/normal/rápido).
- Mejora de la respuesta de giros o de la cola `nextDir`.
- Modos scatter/chase, salida por dots, modo asustado o power pellets.
- Cambios visuales, HUD, sonidos o persistencia.

## Data model

Esta funcionalidad modifica estructuras existentes, no crea archivos nuevos.

```js
// src/js/game.js — velocidades en celdas/segundo (50% de lo actual a 60fps)
const PACMAN_SPEED_PER_SEC = 3.75; // antes 0.125 celda/frame (~7.5 celdas/seg)
const GHOST_SPEED_PER_SEC = 3.0;   // antes 0.1 celda/frame (~6 celdas/seg)
const FIXED_STEP = 1 / 60;         // paso fijo en segundos

// src/js/game.js — retardos de salida en segundos (mismo tiempo visible que antes)
const EXIT_DELAYS_SEC = { blinky: 0, pinky: 1.5, inky: 3, clyde: 4.5 };

// src/js/game.js — fantasma en partida (exitTimer pasa a segundos)
const ghost = {
  x: 13, y: 14, dir: 'up', speed: 3.0,
  kind: 'blinky', exitDelay: 0, exitTimer: 0, // tiempos en segundos
};

// src/js/main.js — estado del bucle (no persiste entre sesiones)
const loopState = {
  lastTime: 0,      // timestamp del rAF anterior (ms)
  accumulator: 0,   // tiempo acumulado pendiente de simular (segundos)
};
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda (como SPEC 01).
- Velocidades en celdas/segundo; el desplazamiento por paso es `speed * dt`.
- `exitDelay` y `exitTimer` en segundos; se incrementa `exitTimer += dt` en `moveGhost`.
- `FIXED_STEP = 1/60` s; `MAX_DT = 0.1` s (clamp de 100 ms).
- Comentarios y textos de UI en español.

## Implementation plan

1. Convertir `EXIT_DELAYS` de frames a segundos en `src/js/game.js` y cambiar `exitTimer` a segundos (`exitTimer += dt`). Mantener `update(game)` funcionando con `dt = FIXED_STEP` por defecto. Verificación: abrir `src/index.html`, los 4 salen escalonados como antes (0/1.5/3/4.5 s).
2. Convertir `PACMAN_SPEED` y `GHOST_SPEED` a celdas/segundo (`3.75` y `3.0`) y cambiar `update(game, dt)`, `movePacman` y `moveGhost` a `desplazamiento = speed * dt`. Verificación: con el bucle antiguo el juego va visiblemente más lento pero sin errores en consola.
3. Reescribir el bucle en `src/js/main.js` con acumulador: calcular `dt` real por `rAF`, aplicar clamp a `100` ms, acumular y consumir con `while (accumulator >= FIXED_STEP) update(game, FIXED_STEP)`, dibujar una vez por frame. Verificación: abrir `src/index.html`, el juego es controlable y la consola no muestra errores.
4. Verificar independencia de fps y retorno de pestaña oculta: forzar limitación de fps desde DevTools (o monitor 120 Hz si disponible) y ocultar la pestaña 5 s. Verificación: la velocidad en celdas/seg es la misma y al volver no hay teletransportes.

## Acceptance criteria

- [ ] Abrir `src/index.html` muestra el juego sin errores en la consola durante 60 segundos.
- [ ] Pac-Man avanza a `≈3.75` celdas/seg (cruza un pasillo recto de 10 celdas en `2.5–3` s).
- [ ] Los fantasmas avanzan a `≈3.0` celdas/seg (visiblemente algo más lentos que Pac-Man en recta).
- [ ] Los 4 fantasmas salen de la pen de forma escalonada a `0 / 1.5 / 3 / 4.5` s (±0.3 s) sin quedarse bloqueados en la puerta (tile `3`).
- [ ] Limitar los fps a la mitad desde DevTools no cambia la velocidad en celdas/seg más de un `±15%`.
- [ ] Ocultar la pestaña 5 s y volver no teletransporta a Pac-Man ni a los fantasmas (ninguno atraviesa más de 1 celda de golpe).
- [ ] La cola de giro `nextDir` con flechas funciona igual que antes (sin cambios de comportamiento).
- [ ] `render.js` y `maze.js` no cambian salvo que sea estrictamente necesario.

## Decisions

- **Sí:** reducción ~50% (`3.75` / `3.0` celdas/seg). Motivo: lo pedido por el usuario, cambio mínimo y verificable con cronómetro.
- **No:** reducción ligera del 25%. Motivo: el usuario confirmó que sigue siendo difícil de controlar.
- **Sí:** mantener la ventaja de Pac-Man (~25% más rápido). Motivo: no cambia el balance de SPEC 01.
- **Sí:** paso fijo con acumulador a `60` pasos/seg en `main.js`. Motivo: determinista, respeta el snap `aligned()` con épsilon `1e-3` y las colisiones con umbral `0.5`; el escalado directo por `dt` rompería el alineado de `1/8` y `1/10`.
- **No:** escalado simple por `dt` ni throttle cada N ms. Motivo: el primero rompe el snap a celda, el segundo se entrecorta en monitores de 120 Hz.
- **Sí:** velocidades en celdas/segundo. Motivo: independientes de fps y legibles frente a celda/frame.
- **Sí:** `EXIT_DELAYS` a segundos. Motivo: mismo tiempo visible que antes pero independiente del paso.
- **Sí:** clamp de `dt` a `100` ms. Motivo: evita teletransportes al volver de pestaña oculta.
- **Sí:** solo velocidad, sin tocar giros. Motivo: el usuario confirmó que el problema es solo la rapidez.
- **Definición con clarificación en 2 bloques.** Motivo: el enfoque delta-tiempo obligaba a cerrar paso fijo, unidades, retardos y clamp para no asumir nada en implementación.

## Risks

| Riesgo | Mitigación |
| ------ | ---------- |
| Deriva de punto flotante con `speed * dt` rompe el snap `aligned()` (épsilon `1e-3`) | Paso fijo `1/60` exacto y redondeo a celda entera al alinear, como ya hace `movePacman`/`moveGhost` |
| Espiral de la muerte si el paso es más costoso que el tiempo real | Clamp a `100` ms y número máximo de pasos por frame (p. ej. 5); se pierde tiempo antes que colgarse |
| En monitores de 120/144 Hz el acumulador alterna 1-2 pasos por frame | Comportamiento esperado del paso fijo; la velocidad media en celdas/seg no cambia |
| `draw(ctx, game, frame)` usa contador `frame` para animación | Seguir incrementando `frame` por `rAF` (visual), no por paso de simulación |

## What is **not** in this spec

- Selector de velocidad o niveles de dificultad.
- Mejora de giros o de la cola `nextDir`.
- Modos scatter/chase, salida por dots, fantasmas comestibles o power pellets.
- Cambios en `render.js`, `maze.js`, HUD, sonidos o persistencia.

Cada uno de esos, si llega, va en su propio spec.
