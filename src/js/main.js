// main.js
// Bucle, teclado y pantallas. Usa createGame/update/draw (globals).

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const actionBtn = document.getElementById( 'action-btn' );

let game = createGame();
let frame = 0;

// Estado del bucle de paso fijo (no persiste entre sesiones).
// Usa FIXED_STEP (global de game.js) como paso de simulación.
let lastTime = 0;
let accumulator = 0;
// Clamp de dt a 100 ms para evitar saltos al volver de pestaña oculta.
const MAX_DT = 0.1;
// Máximo de pasos por frame para evitar la espiral de la muerte.
const MAX_STEPS = 5;

const KEY_DIR = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

document.addEventListener( 'keydown', ( e ) => {
  const dir = KEY_DIR[ e.key ];
  if ( !dir ) return;
  e.preventDefault();
  if ( game.state === 'playing' ) game.pacman.nextDir = dir;
} );

function showOverlay( title, cls, btnLabel ) {
  overlay.innerHTML =
    '<h1' + ( cls ? ' class="' + cls + '"' : '' ) + '>' + title + '</h1>' +
    '<button id="action-btn">' + btnLabel + '</button>';
  overlay.classList.add( 'show' );
  document.getElementById( 'action-btn' ).addEventListener( 'click', startGame );
}

function startGame() {
  game = createGame();
  game.state = 'playing';
  overlay.classList.remove( 'show' );
  // Reiniciar el acumulador para no simular tiempo del menú.
  lastTime = 0;
  accumulator = 0;
}

if ( actionBtn ) actionBtn.addEventListener( 'click', startGame );

function loop( now ) {
  // frame visual: sigue incrementando por rAF, no por paso de simulación.
  frame++;
  if ( now === undefined ) now = ( typeof performance !== 'undefined' ) ? performance.now() : Date.now();
  if ( !lastTime ) lastTime = now;
  let dt = ( now - lastTime ) / 1000;
  lastTime = now;
  // Clamp para evitar teletransportes tras pestaña oculta o tirones.
  if ( dt > MAX_DT ) dt = MAX_DT;
  if ( dt < 0 ) dt = 0;
  if ( game.state === 'playing' ) {
    accumulator += dt;
    let steps = 0;
    while ( accumulator >= FIXED_STEP && steps < MAX_STEPS ) {
      update( game, FIXED_STEP );
      accumulator -= FIXED_STEP;
      steps++;
      if ( game.state !== 'playing' ) break;
    }
    // Si se supera el máximo, se pierde tiempo antes que colgarse.
    if ( steps >= MAX_STEPS ) accumulator = 0;
    if ( game.state === 'won' ) showOverlay( 'GANASTE', 'win', 'Reiniciar' );
    else if ( game.state === 'lost' ) showOverlay( 'PERDISTE', 'lose', 'Reiniciar' );
  }
  draw( ctx, game, frame );
  requestAnimationFrame( loop );
}

requestAnimationFrame( loop );
