// The whole game as pure functions over a plain state object: phases, movement, reset on a wall
// hit, and exit detection.
//
// Nothing here knows about the DOM, the canvas, audio, or the clock. It receives `dt` and an input
// vector and returns the next state, which is what makes the game testable in plain Node.

import { mulberry32 } from './rng.js';
import { generate, toSegments } from './maze.js';
import { sweep } from './collision.js';
import { DIFFICULTY } from './difficulty.js';

/** Seconds. Caps a frame delta so a background tab regaining focus cannot jump the maze. */
export const MAX_DT = 0.05;

/** Seconds the jumpscare image holds before the app returns to the title screen. */
export const SCARE_DURATION = 10;

/** The initial state. Also the state the app returns to after a scare. */
export function createGame() {
  return {
    phase: 'title',
    levelName: null,
    level: null,
    seed: null,
    maze: null,
    segments: null,
    pos: null,
    start: null,
    exit: null,
    hits: 0,
    scareElapsed: 0,
  };
}

/** Title to select. */
export function pressStart(state) {
  return { ...state, phase: 'select' };
}

/** Select to playing: carve a maze from `seed` and place the blob in the centre of cell (0,0). */
export function startLevel(state, levelName, seed) {
  const level = DIFFICULTY[levelName];
  if (!level) throw new Error(`Unknown level '${levelName}'`);

  const maze = generate(level.cols, level.rows, mulberry32(seed));
  const start = { x: 0.5, y: 0.5 };

  return {
    ...state,
    phase: 'playing',
    levelName,
    level,
    seed,
    maze,
    segments: toSegments(maze),
    pos: { ...start },
    start,
    exit: { x: level.cols - 0.5, y: level.rows - 0.5 },
    hits: 0,
    scareElapsed: 0,
  };
}

/** Normalize an input vector longer than 1, so the blob's speed is equal in all eight directions. */
function direction(input) {
  const length = Math.hypot(input.dx, input.dy);
  if (length === 0) return { dx: 0, dy: 0 };
  return length > 1 ? { dx: input.dx / length, dy: input.dy / length } : { dx: input.dx, dy: input.dy };
}

/** One frame of playing: glide, resolve the move by sweeping, then test the exit. */
function stepPlaying(state, dt, input) {
  const { level, pos, segments } = state;
  const dir = direction(input);

  const to = {
    x: pos.x + dir.dx * level.speed * dt,
    y: pos.y + dir.dy * level.speed * dt,
  };
  const move = sweep(pos, to, level.blobRadius, segments, level.wallHalfThickness);

  // A hit costs the blob its progress but never the maze: the layout and seed are untouched, so
  // the player keeps the mental map they built.
  if (move.hit) {
    return { ...state, pos: { ...state.start }, hits: state.hits + 1 };
  }

  const reached = Math.hypot(move.pos.x - state.exit.x, move.pos.y - state.exit.y) < level.exitRadius;
  return {
    ...state,
    pos: move.pos,
    phase: reached ? 'scare' : state.phase,
    scareElapsed: 0,
  };
}

/**
 * Advance the game by `dt` seconds under `input` = `{ dx, dy }`. Returns a new state and never
 * mutates its argument. Input is ignored in every phase except `playing`.
 */
export function step(state, dt, input) {
  const clamped = Math.min(dt, MAX_DT);

  if (state.phase === 'playing') return stepPlaying(state, clamped, input);

  if (state.phase === 'scare') {
    const scareElapsed = state.scareElapsed + clamped;
    // Discarding everything is structural: the app returns to a state identical to a fresh game.
    return scareElapsed >= SCARE_DURATION ? createGame() : { ...state, scareElapsed };
  }

  return state;
}
