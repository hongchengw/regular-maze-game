// The only stateful file: it owns `state`, the animation loop, and the wiring between the pure
// game and its DOM edges. Every other module is either pure or a thin adapter.
//
// There is no pause, no debug key, and no level skip. Anything that lets a tester reach the exit
// without playing is also something a victim can stumble into.

import { LEVELS } from './difficulty.js';
import { createGame, pressStart, step } from './game.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createJumpscare } from './jumpscare.js';

const startButton = document.getElementById('start');
const levelupEl = document.getElementById('levelup');
const canvasEl = document.getElementById('canvas');
const dpadEl = document.getElementById('dpad');
const overlayEl = document.getElementById('jumpscare');

const renderer = createRenderer(canvasEl);
const input = createInput(dpadEl);
const audio = createAudio(window.AudioContext || window.webkitAudioContext);
const jumpscare = createJumpscare(overlayEl, overlayEl.querySelector('img'), audio, JUMPSCARE_SRC);

let state = createGame();
let phaseShown = null;
let lastFrame = 0;

/** A fresh seed per play. `Date.now` is read for the seed only, never for game timing. */
function freshSeed() {
  return (Date.now() ^ (Math.random() * 2 ** 32)) >>> 0;
}

/** Screen visibility is one attribute, and the overlay is a function of the phase and nothing else. */
function showPhase(current) {
  const { phase } = current;
  if (phase === phaseShown) return;

  document.body.dataset.phase = phase;

  // The level the player is about to start, counted from one for the player rather than from zero.
  if (phase === 'levelup') {
    levelupEl.textContent = `LEVEL ${current.levelIndex + 2} OF ${LEVELS.length}`;
  }

  if (phase === 'scare') {
    jumpscare.show();
  } else {
    jumpscare.hide();
  }

  // A key held across a phase change would otherwise leak in as phantom movement.
  if (phase !== 'playing') input.clear();
  if (phase === 'playing') renderer.resize();

  phaseShown = phase;
}

// The audio context has to be built inside the click handler: browsers block audio started outside
// a user gesture, and a silent scare would defeat the whole app. START is the only control the app
// has: it draws one seed and begins the first level, and every later level derives its own.
startButton.addEventListener('click', () => {
  audio.unlock();
  state = pressStart(state, freshSeed());
});

// A mobile browser fires resize continuously while its address bar slides, and each one reallocates
// the canvas backing store, so they are coalesced into one per frame.
let resizeQueued = false;
function queueResize() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    renderer.resize();
  });
}

window.addEventListener('resize', queueResize);
window.addEventListener('orientationchange', queueResize);

// One loop in every phase, since `step` also advances the scare clock.
function frame(now) {
  const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
  lastFrame = now;

  state = step(state, dt, input.vector());
  showPhase(state);
  if (state.phase === 'playing') renderer.draw(state);

  requestAnimationFrame(frame);
}

input.attach();
renderer.resize();
showPhase(state);
requestAnimationFrame(frame);
