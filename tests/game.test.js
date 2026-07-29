import test from 'node:test';
import assert from 'node:assert/strict';

import { DIFFICULTY } from '../src/difficulty.js';
import { createGame, pressStart, startLevel, step, MAX_DT, SCARE_DURATION } from '../src/game.js';

const NO_INPUT = { dx: 0, dy: 0 };
const RIGHT = { dx: 1, dy: 0 };

/** A playing state on `levelName` with the walls removed, to isolate movement from the maze. */
function openField(levelName = 'EASY', seed = 1) {
  return { ...startLevel(pressStart(createGame()), levelName, seed), segments: [] };
}

/** Run `total` seconds through `step` in `MAX_DT` slices, so the clamp never truncates them. */
function advance(state, total, input = NO_INPUT) {
  const steps = Math.round(total / MAX_DT);
  let current = state;
  for (let i = 0; i < steps; i += 1) current = step(current, MAX_DT, input);
  return current;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// --- Phase transitions -------------------------------------------------------------------------

test('starts at title', () => {
  const state = createGame();
  assert.equal(state.phase, 'title');
  assert.equal(state.maze, null, 'no game state exists at the title screen');
  assert.equal(state.pos, null);
  assert.equal(state.hits, 0);
});

test('title to select', () => {
  assert.equal(pressStart(createGame()).phase, 'select');
});

test('select to playing', () => {
  const state = startLevel(pressStart(createGame()), 'MEDIUM', 7);

  assert.equal(state.phase, 'playing');
  assert.equal(state.levelName, 'MEDIUM');
  assert.equal(state.maze.cols, DIFFICULTY.MEDIUM.cols);
  assert.equal(state.maze.rows, DIFFICULTY.MEDIUM.rows);
  assert.deepEqual(state.pos, { x: 0.5, y: 0.5 }, 'the blob starts at the centre of cell (0,0)');
  assert.deepEqual(state.exit, { x: DIFFICULTY.MEDIUM.cols - 0.5, y: DIFFICULTY.MEDIUM.rows - 0.5 });
});

test('invalid level rejected', () => {
  assert.throws(() => startLevel(pressStart(createGame()), 'NIGHTMARE', 1), /NIGHTMARE/);
});

test('scare to title after 10s', () => {
  const scared = { ...openField('EASY', 4), phase: 'scare', scareElapsed: 0 };

  const almost = advance(scared, 9.9);
  assert.equal(almost.phase, 'scare', 'the image holds for the full duration');
  assert.ok(Math.abs(almost.scareElapsed - 9.9) < 1e-9);

  const done = advance(almost, SCARE_DURATION - 9.9);
  assert.equal(done.phase, 'title');
});

test('title after scare has no maze', () => {
  const scared = { ...openField('EASY', 4), phase: 'scare', scareElapsed: SCARE_DURATION - MAX_DT };
  const done = step(scared, MAX_DT, NO_INPUT);

  assert.equal(done.phase, 'title');
  assert.deepEqual(done, createGame(), 'the app returns to a state identical to a fresh game');
});

test('input ignored outside playing', () => {
  for (const phase of ['title', 'select', 'scare']) {
    const state = { ...openField('EASY', 2), phase };
    const next = step(state, MAX_DT, RIGHT);
    assert.deepEqual(next.pos, state.pos, `input moved the blob during ${phase}`);
  }
});

// --- Movement ----------------------------------------------------------------------------------

test('glides at the level speed', () => {
  const state = openField('EASY');
  const moved = advance(state, 1, RIGHT);

  assert.ok(
    Math.abs(moved.pos.x - (state.pos.x + DIFFICULTY.EASY.speed)) < 1e-9,
    `one second at ${DIFFICULTY.EASY.speed} cells/s should travel exactly that far`,
  );
  assert.equal(moved.pos.y, state.pos.y);
});

test('diagonals are normalized', () => {
  const state = openField('EASY');
  const moved = advance(state, 1, { dx: 1, dy: 1 });

  assert.ok(
    Math.abs(distance(moved.pos, state.pos) - DIFFICULTY.EASY.speed) < 1e-9,
    'a diagonal must cover the same distance as a cardinal move, not speed * sqrt(2)',
  );
});

test('no input means no movement', () => {
  const state = openField('EASY');
  assert.deepEqual(step(state, MAX_DT, NO_INPUT).pos, state.pos);
});

test('movement is frame-rate independent', () => {
  const state = openField('EASY');
  const coarse = step(state, MAX_DT, RIGHT);
  const fine = step(step(state, MAX_DT / 2, RIGHT), MAX_DT / 2, RIGHT);

  assert.ok(distance(coarse.pos, fine.pos) < 1e-9, 'two half steps must land where one full step does');
});

test('large dt does not tunnel', () => {
  // A deliberately absurd speed, so even the clamped dt covers several cells in one step.
  const state = startLevel(pressStart(createGame()), 'EASY', 5);
  const fast = { ...state, level: { ...state.level, speed: 100 } };
  const next = step(fast, 2.0, { dx: 0, dy: 1 });

  assert.equal(next.hits, 1, 'a five-cell plunge through a 10x10 maze must report a wall hit');
  assert.deepEqual(next.pos, state.start, 'and therefore reset to the start cell');
});

test('dt is clamped', () => {
  const state = openField('EASY');
  const catchUp = step(state, 5.0, RIGHT);

  assert.ok(
    Math.abs(catchUp.pos.x - (state.pos.x + DIFFICULTY.EASY.speed * MAX_DT)) < 1e-9,
    `a 5s catch-up frame must move only ${MAX_DT}s worth, not 5s worth`,
  );
});

// --- Reset and exit ----------------------------------------------------------------------------

test('wall hit resets to start', () => {
  const state = startLevel(pressStart(createGame()), 'EASY', 5);
  const hard = { ...state, level: { ...state.level, speed: 100 } };
  const next = step(hard, MAX_DT, { dx: 0, dy: 1 });

  assert.deepEqual(next.pos, { x: 0.5, y: 0.5 });
});

test('wall hit preserves the maze', () => {
  const state = startLevel(pressStart(createGame()), 'EASY', 5);
  const hard = { ...state, level: { ...state.level, speed: 100 } };
  const next = step(hard, MAX_DT, { dx: 0, dy: 1 });

  assert.ok(next.hits > 0, 'fixture check: this step should actually hit a wall');
  assert.deepEqual(next.segments, state.segments, 'the layout must survive, so the mental map does');
  assert.equal(next.seed, state.seed, 'the seed is not regenerated on a hit');
});

test('wall hit increments the counter', () => {
  const state = startLevel(pressStart(createGame()), 'EASY', 5);
  const hard = { ...state, level: { ...state.level, speed: 100 } };

  assert.equal(state.hits, 0);
  assert.equal(step(hard, MAX_DT, { dx: 0, dy: 1 }).hits, 1);
});

test('exit within radius wins', () => {
  const state = openField('EASY');
  const atExit = { ...state, pos: { ...state.exit } };

  assert.equal(step(atExit, MAX_DT, NO_INPUT).phase, 'scare');
});

test('exit just outside radius does not win', () => {
  const state = openField('EASY');
  const nearby = {
    ...state,
    pos: { x: state.exit.x - (DIFFICULTY.EASY.exitRadius + 0.01), y: state.exit.y },
  };

  assert.equal(step(nearby, MAX_DT, NO_INPUT).phase, 'playing');
});

test('reaching the exit does not require stopping', () => {
  const state = openField('EASY');
  const approaching = { ...state, pos: { x: state.exit.x - 0.1, y: state.exit.y } };
  const next = step(approaching, MAX_DT, RIGHT);

  assert.ok(next.pos.x > state.exit.x, 'fixture check: the blob should pass the exit centre');
  assert.equal(next.phase, 'scare', 'a blob at full speed still trips the exit on that same step');
});

test('same seed gives the same maze', () => {
  const first = startLevel(pressStart(createGame()), 'HARD', 99);
  const second = startLevel(pressStart(createGame()), 'HARD', 99);

  assert.deepEqual(first.segments, second.segments);
});

test('step never mutates its input', () => {
  const state = openField('EASY');
  const before = JSON.stringify(state.pos);
  step(state, MAX_DT, RIGHT);

  assert.equal(JSON.stringify(state.pos), before, 'step must return a new state, not edit the old');
});

test('the module knows nothing of the DOM or the clock', async () => {
  const fs = await import('node:fs');
  const url = await import('node:url');
  const source = fs.readFileSync(url.fileURLToPath(new URL('../src/game.js', import.meta.url)), 'utf8');

  for (const forbidden of ['document', 'window', 'Date', 'performance', 'localStorage']) {
    assert.ok(!new RegExp(`\\b${forbidden}\\b`).test(source), `game.js must not reference ${forbidden}`);
  }
});
