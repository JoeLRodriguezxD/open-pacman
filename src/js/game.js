// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED_PER_SEC = 7.32421875; // 5.859375 +25% (antes 0.125 celda/frame, ~7.5 celdas/seg)
const GHOST_SPEED_PER_SEC = 5.859375;   // 4.6875 +25% (antes 0.1 celda/frame, ~6 celdas/seg)

// Paso fijo de simulación, en segundos.
const FIXED_STEP = 1 / 60;

// Retardo de salida de la pen por fantasma, en segundos.
const EXIT_DELAYS_SEC = { blinky: 0, pinky: 1.5, inky: 3, clyde: 4.5 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED_PER_SEC,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED_PER_SEC,
      kind: g.kind,
      exitDelay: EXIT_DELAYS_SEC[ g.kind ] ?? 0,
      exitTimer: 0,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  // Puerta de la pen solo de salida: los fantasmas no bajan a la puerta ni desde ella.
  if ( actor === 'ghost' && dir === 'down' ) {
    const cur = grid[ y ] && grid[ y ][ x ];
    const nxt = grid[ ty ] && grid[ ty ][ tx ];
    if ( cur === 3 || nxt === 3 ) return false;
  }
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

// Distancia al proximo centro de celda en la direccion dada.
// Solo se llama con una direccion cardinal; el otro eje esta clavado.
function distAlCentro( pos, dir ) {
  if ( dir > 0 ) return Math.ceil( pos - 1e-9 ) - pos;
  if ( dir < 0 ) return pos - Math.floor( pos + 1e-9 );
  return Infinity;
}

// Avanza al actor sin saltarse centros: si el paso cruza un centro,
// clava al centro para que la logica de celda (giros, dots, muros)
// se ejecute siempre, con cualquier velocidad.
function avanzarConSnap( a, dir, paso, width ) {
  let restante = paso;
  let guard = 0;
  while ( restante > 1e-9 && guard++ < 4 ) {
    const dx = dir.x || 0;
    const dy = dir.y || 0;
    let dist = Infinity;
    if ( dx !== 0 ) dist = distAlCentro( a.x, dx );
    else if ( dy !== 0 ) dist = distAlCentro( a.y, dy );
    else return restante;
    // En el centro: la distancia al siguiente es 1 celda completa.
    if ( dist < 1e-9 ) dist = 1;
    if ( restante >= dist ) {
      a.x += dx * dist;
      a.y += dy * dist;
      restante -= dist;
      // Clavar para evitar deriva float y envolver el tunel.
      if ( dx !== 0 ) a.x = Math.round( a.x );
      if ( dy !== 0 ) a.y = Math.round( a.y );
      wrapTunnel( a, width );
      // Hemos llegado a un centro: parar para procesarlo.
      return restante;
    }
    a.x += dx * restante;
    a.y += dy * restante;
    restante = 0;
    wrapTunnel( a, width );
  }
  return restante;
}

function movePacman( game, dt = FIXED_STEP ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Clavar deriva float antes de decidir.
  if ( aligned( p.x ) ) p.x = Math.round( p.x );
  if ( aligned( p.y ) ) p.y = Math.round( p.y );

  let restante = p.speed * dt;
  let guard = 0;
  while ( restante > 1e-9 && guard++ < 4 ) {
    const enCentro = p.x === Math.round( p.x ) && p.y === Math.round( p.y );
    if ( enCentro ) {
      // Aplicar giro pendiente si es posible.
      if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
        p.dir = p.nextDir;
        p.nextDir = null;
      }
      // Comer dot.
      if ( grid[ p.y ] && grid[ p.y ][ p.x ] === 2 ) {
        grid[ p.y ][ p.x ] = 0;
        game.score += 10;
        game.dotsRemaining--;
      }
      // Si no puede seguir, se detiene en la celda.
      if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
    }
    const d = DIRS[ p.dir ];
    if ( !d ) return;
    const antes = restante;
    restante = avanzarConSnap( p, d, restante, width );
    // Si no hubo centro por el camino, se consumio todo: fin.
    if ( restante <= 1e-9 ) return;
    // Si avanzarConSnap llego a un centro, el bucle lo procesa.
    // Si no avanzo nada (dist 0), evitar bucle infinito.
    if ( Math.abs( restante - antes ) < 1e-12 ) return;
  }
}

// Celda objetivo por personalidad (distancia Manhattan en decideGhost).
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  if ( g.kind === 'pinky' ) {
    // Emboscador: 4 celdas por delante de Pac-Man segun su direccion.
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }
  if ( g.kind === 'inky' ) {
    // Flanqueador: espejo de blinky respecto a 2 celdas delante de Pac-Man.
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    const ax = px + d.x * 2;
    const ay = py + d.y * 2;
    const b = game.ghosts.find( ( gh ) => gh.kind === 'blinky' );
    if ( !b ) {
      // Fallback: sin blinky, actua como pinky.
      const dp = DIRS[ p.dir ] || { x: 0, y: 0 };
      return { x: px + dp.x * 4, y: py + dp.y * 4 };
    }
    return { x: ax * 2 - Math.round( b.x ), y: ay * 2 - Math.round( b.y ) };
  }
  if ( g.kind === 'clyde' ) {
    // Timido: persigue como blinky lejos (>8 celdas), si no a su esquina.
    const gx = Math.round( g.x );
    const gy = Math.round( g.y );
    const dist = Math.hypot( px - gx, py - gy );
    if ( dist > 8 ) return { x: px, y: py };
    return { x: 0, y: 30 }; // esquina abajo-izquierda
  }
  // blinky: perseguidor agresivo, objetivo directo a Pac-Man.
  return { x: px, y: py };
}

// Dentro de la pen (rect interior x 11-16, y 13-15)?
function isInPen( g ) {
  const rx = Math.round( g.x );
  const ry = Math.round( g.y );
  return rx >= 11 && rx <= 16 && ry >= 13 && ry <= 15;
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Salida forzada: dentro de la pen, centrar en x 13-14 y subir a la puerta.
  if ( isInPen( g ) ) {
    const rx = Math.round( g.x );
    let want = 'up';
    if ( rx < 13 ) want = 'right';
    else if ( rx > 14 ) want = 'left';
    if ( choices.includes( want ) ) {
      g.dir = want;
      return;
    }
    // Si el camino directo esta bloqueado, cualquier salida valida.
    if ( choices.includes( 'up' ) ) {
      g.dir = 'up';
      return;
    }
  }

  // Sobre la puerta (tile 3): seguir subiendo, nunca bajar.
  const rx0 = Math.round( g.x );
  const ry0 = Math.round( g.y );
  if ( grid[ ry0 ] && grid[ ry0 ][ rx0 ] === 3 ) {
    if ( choices.includes( 'up' ) ) {
      g.dir = 'up';
      return;
    }
    const noDown = choices.filter( ( dir ) => dir !== 'down' );
    if ( noDown.length ) {
      g.dir = noDown[ 0 ];
      return;
    }
  }

  if ( g.kind === 'blinky' || g.kind === 'pinky' || g.kind === 'inky' || g.kind === 'clyde' ) {
    const t = ghostTarget( game, g );
    let best = choices[ 0 ];
    let bestDist = Infinity;
    for ( const dir of choices ) {
      const d = DIRS[ dir ];
      const nx = g.x + d.x;
      const ny = g.y + d.y;
      const dist = Math.abs( nx - t.x ) + Math.abs( ny - t.y );
      if ( dist < bestDist ) {
        bestDist = dist;
        best = dir;
      }
    }
    g.dir = best;
  } else {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

function moveGhost( game, g, dt = FIXED_STEP ) {
  // Bloqueo de salida: quieto dentro de la pen hasta cumplir exitDelay (segundos).
  if ( ( g.exitTimer ?? 0 ) < ( g.exitDelay ?? 0 ) ) {
    g.exitTimer = ( g.exitTimer ?? 0 ) + dt;
    return;
  }
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Clavar deriva float antes de decidir.
  if ( aligned( g.x ) ) g.x = Math.round( g.x );
  if ( aligned( g.y ) ) g.y = Math.round( g.y );

  let restante = g.speed * dt;
  let guard = 0;
  while ( restante > 1e-9 && guard++ < 4 ) {
    const enCentro = g.x === Math.round( g.x ) && g.y === Math.round( g.y );
    if ( enCentro ) {
      decideGhost( game, g );
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
    }
    const d = DIRS[ g.dir ];
    if ( !d ) return;
    const antes = restante;
    restante = avanzarConSnap( g, d, restante, width );
    if ( restante <= 1e-9 ) return;
    if ( Math.abs( restante - antes ) < 1e-12 ) return;
  }
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.kind = GHOST_STARTS[ i ].kind;
    g.exitDelay = EXIT_DELAYS_SEC[ g.kind ] ?? 0;
    g.exitTimer = 0;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game, dt = FIXED_STEP ) {
  movePacman( game, dt );
  game.ghosts.forEach( ( g ) => moveGhost( game, g, dt ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
