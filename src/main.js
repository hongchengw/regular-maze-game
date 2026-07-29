// The only stateful file: it owns `state`, the animation loop, and the wiring between the pure
// game and its DOM edges. Every other module is either pure or a thin adapter.
//
// There is no pause, no debug key, and no level skip. Anything that lets a tester reach the exit
// without playing is also something a victim can stumble into.

import { createGame, pressStart, startLevel, step } from './game.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createJumpscare } from './jumpscare.js';

const screensEl = document.getElementById('screens');
const startButton = document.getElementById('start');
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
function showPhase(phase) {
  if (phase === phaseShown) return;

  document.body.dataset.phase = phase;
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
// a user gesture, and a silent scare would defeat the whole app.
startButton.addEventListener('click', () => {
  audio.unlock();
  state = pressStart(state);
});

screensEl.addEventListener('click', (event) => {
  const level = event.target.dataset.level;
  if (level) state = startLevel(state, level, freshSeed());
});

window.addEventListener('resize', () => renderer.resize());

// One loop in every phase, since `step` also advances the scare clock.
function frame(now) {
  const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
  lastFrame = now;

  state = step(state, dt, input.vector());
  showPhase(state.phase);
  if (state.phase === 'playing') renderer.draw(state);

  requestAnimationFrame(frame);
}

input.attach();
renderer.resize();
showPhase(state.phase);
requestAnimationFrame(frame);
