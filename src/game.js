// The whole game as pure functions over a plain state object: phases, movement, wall contact, and
// exit detection.
//
// Nothing here knows about the DOM, the canvas, audio, or the clock. It receives `dt` and an input
// vector and returns the next state, which is what makes the game testable in plain Node.

import { mulberry32 } from './rng.js';
import { generate, toSegments } from './maze.js';
import { sweep } from './collision.js';
import { DIFFICULTY, LEVELS } from './difficulty.js';

/** Seconds. Caps a frame delta so a background tab regaining focus cannot jump the maze. */
export const MAX_DT = 0.05;

/** Seconds the `LEVEL n OF 3` beat holds between two levels. */
export const LEVELUP_DURATION = 1;

/** Seconds the jumpscare image holds before the app returns to the title screen. */
export const SCARE_DURATION = 6;

/** The initial state. Also the state the app returns to after a scare. */
export function createGame() {
  return {
    phase: 'title',
    levelName: null,
    level: null,
    levelIndex: 0,
    seed: null,
    maze: null,
    segments: null,
    pos: null,
    start: null,
    exit: null,
    hits: 0,
    levelupElapsed: 0,
    scareElapsed: 0,
  };
}

/**
 * Title straight into the first level. There is nothing to choose: the three levels are played in
 * `LEVELS` order, every time.
 */
export function pressStart(state, seed) {
  return startLevel(state, LEVELS[0], seed);
}

/** Playing: carve a maze from `seed` and place the blob in the centre of cell (0,0). */
export function startLevel(state, levelName, seed) {
  // Own properties only. `__proto__`, `constructor`, and friends all return something truthy from a
  // plain object, so a bare lookup would pass this guard and fail later with a confusing error.
  const known = Object.prototype.hasOwnProperty.call(DIFFICULTY, levelName);
  if (!known) throw new Error(`Unknown level '${levelName}'`);

  const level = DIFFICULTY[levelName];

  const maze = generate(level.cols, level.rows, mulberry32(seed));
  const start = { x: 0.5, y: 0.5 };

  return {
    ...state,
    phase: 'playing',
    levelName,
    level,
    levelIndex: LEVELS.indexOf(levelName),
    seed,
    maze,
    segments: toSegments(maze),
    pos: { ...start },
    start,
    exit: { x: level.cols - 0.5, y: level.rows - 0.5 },
    hits: 0,
    levelupElapsed: 0,
    scareElapsed: 0,
  };
}

/**
 * The next level's seed, derived from the current one rather than drawn from the clock or a global
 * random source. Keeping the derivation pure is what leaves this module with no dependency on either
 * of those, and it is what lets a whole three-level run be replayed from a single starting seed.
 */
function deriveSeed(seed) {
  return Math.floor(mulberry32(seed)() * 2 ** 32);
}

/** Normalize an input vector longer than 1, so the blob's speed is equal in all eight directions. */
function direction(input) {
  const length = Math.hypot(input.dx, input.dy);
  if (length === 0) return { dx: 0, dy: 0 };
  return length > 1 ? { dx: input.dx / length, dy: input.dy / length } : { dx: input.dx, dy: input.dy };
}

/** One frame of playing: glide one axis at a time, then test the exit on where the blob ended up. */
function stepPlaying(state, dt, input) {
  const { level, pos, segments } = state;
  const dir = direction(input);
  const vx = dir.dx * level.speed * dt;
  const vy = dir.dy * level.speed * dt;

  // Each axis is swept on its own, x first, so a wall blocks only the axis pressed into it and the
  // blob slides along it. `sweep` returns the last clear position, which is exactly the
  // blocked-but-not-teleported position this wants. Contact costs momentum and nothing else: the
  // maze, the seed, and the position are all untouched, so the player keeps their mental map.
  //
  // Resolving x before y biases a diagonal into a corner by well under a pixel at these speeds, so
  // there is no second pass to even it out.
  const r = level.blobRadius;
  const halfThickness = level.wallHalfThickness;
  const slidX = sweep(pos, { x: pos.x + vx, y: pos.y }, r, segments, halfThickness);
  const slidY = sweep(slidX.pos, { x: slidX.pos.x, y: slidX.pos.y + vy }, r, segments, halfThickness);

  const moved = slidY.pos;
  const hits = state.hits + (slidX.hit || slidY.hit ? 1 : 0);
  const reached = Math.hypot(moved.x - state.exit.x, moved.y - state.exit.y) < level.exitRadius;

  if (!reached) return { ...state, pos: moved, hits };

  // The level ends the instant the exit is touched. Only the last level's exit fires the scare;
  // every earlier one hands over through the level-up beat.
  return state.levelIndex + 1 < LEVELS.length
    ? { ...state, pos: moved, hits, phase: 'levelup', levelupElapsed: 0 }
    : { ...state, pos: moved, hits, phase: 'scare', scareElapsed: 0 };
}

/**
 * Advance the game by `dt` seconds under `input` = `{ dx, dy }`. Returns a new state and never
 * mutates its argument. Input is ignored in every phase except `playing`.
 */
export function step(state, dt, input) {
  const clamped = Math.min(dt, MAX_DT);

  if (state.phase === 'playing') return stepPlaying(state, clamped, input);

  if (state.phase === 'levelup') {
    const levelupElapsed = state.levelupElapsed + clamped;
    if (levelupElapsed < LEVELUP_DURATION) return { ...state, levelupElapsed };
    return startLevel(state, LEVELS[state.levelIndex + 1], deriveSeed(state.seed));
  }

  if (state.phase === 'scare') {
    const scareElapsed = state.scareElapsed + clamped;
    // Discarding everything is structural: the app returns to a state identical to a fresh game.
    return scareElapsed >= SCARE_DURATION ? createGame() : { ...state, scareElapsed };
  }

  return state;
}
