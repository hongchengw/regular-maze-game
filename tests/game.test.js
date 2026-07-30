import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DIFFICULTY, LEVELS } from '../src/difficulty.js';
import { hitsWall } from '../src/collision.js';
import {
  createGame,
  pressStart,
  startLevel,
  step,
  MAX_DT,
  LEVELUP_DURATION,
  SCARE_DURATION,
} from '../src/game.js';

const NO_INPUT = { dx: 0, dy: 0 };
const RIGHT = { dx: 1, dy: 0 };
const LEFT = { dx: -1, dy: 0 };
const DOWN_LEFT = { dx: -1, dy: 1 };

const gameSource = fs.readFileSync(fileURLToPath(new URL('../src/game.js', import.meta.url)), 'utf8');

/** A playing state on `levelName` with the walls removed, to isolate movement from the maze. */
function openField(levelName = 'EASY', seed = 1) {
  return { ...startLevel(createGame(), levelName, seed), segments: [] };
}

/**
 * A playing state whose only wall is the vertical line x = 0, so pressing left is blocked while y
 * stays free. One wall keeps the sliding cases about the sweep rather than about whichever corridor
 * a seed happened to carve.
 */
function walledField(levelName = 'EASY') {
  const state = startLevel(createGame(), levelName, 1);
  return { ...state, segments: [{ x1: 0, y1: -1, x2: 0, y2: 99 }] };
}

/** The same field with the blob already pressed up against that wall under `input`. */
function settled(input, levelName = 'EASY') {
  let state = walledField(levelName);
  for (let i = 0; i < 40; i += 1) state = step(state, MAX_DT, input);
  return state;
}

/** Run `total` seconds through `step` in `MAX_DT` slices, so the clamp never truncates them. */
function advance(state, total, input = NO_INPUT) {
  const steps = Math.round(total / MAX_DT);
  let current = state;
  for (let i = 0; i < steps; i += 1) current = step(current, MAX_DT, input);
  return current;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Drop the blob on the exit and step, so the current level ends on that frame. */
function finish(state) {
  return step({ ...state, pos: { ...state.exit } }, MAX_DT, NO_INPUT);
}

/** Hold through the level-up beat, returning the state on the other side of it. */
function handover(state) {
  let current = state;
  for (let i = 0; i < 200 && current.phase === 'levelup'; i += 1) current = step(current, MAX_DT, NO_INPUT);
  return current;
}

/** Every level's `segments`, in play order, from one starting seed. */
function segmentsPerLevel(seed) {
  const perLevel = [];
  let state = pressStart(createGame(), seed);

  for (let i = 0; i < LEVELS.length; i += 1) {
    perLevel.push(state.segments);
    state = handover(finish(state));
  }
  return perLevel;
}

// --- Phase transitions -------------------------------------------------------------------------

test('starts at title', () => {
  const state = createGame();
  assert.equal(state.phase, 'title');
  assert.equal(state.maze, null, 'no game state exists at the title screen');
  assert.equal(state.pos, null);
  assert.equal(state.hits, 0);
});

test('START begins EASY', () => {
  const state = pressStart(createGame(), 1);

  assert.equal(state.phase, 'playing', 'there is no screen between the title and the first maze');
  assert.equal(state.levelName, 'EASY');
  assert.equal(state.levelIndex, 0);
  assert.ok(!/'select'/.test(gameSource), 'no select phase exists anywhere in the machine');
});

test('startLevel carves the named level', () => {
  const state = startLevel(createGame(), 'MEDIUM', 7);

  assert.equal(state.phase, 'playing');
  assert.equal(state.levelName, 'MEDIUM');
  assert.equal(state.maze.cols, DIFFICULTY.MEDIUM.cols);
  assert.equal(state.maze.rows, DIFFICULTY.MEDIUM.rows);
  assert.deepEqual(state.pos, { x: 0.5, y: 0.5 }, 'the blob starts at the centre of cell (0,0)');
  assert.deepEqual(state.exit, { x: DIFFICULTY.MEDIUM.cols - 0.5, y: DIFFICULTY.MEDIUM.rows - 0.5 });
});

test('invalid level rejected', () => {
  assert.throws(() => startLevel(createGame(), 'NIGHTMARE', 1), /NIGHTMARE/);
});

test('finishing EASY goes to levelup, not the scare', () => {
  const done = finish(pressStart(createGame(), 3));

  assert.equal(done.phase, 'levelup', 'a level with one after it hands over rather than ending the run');
  assert.equal(done.levelupElapsed, 0);
});

test('levelup advances to the next level', () => {
  const next = handover(finish(pressStart(createGame(), 3)));

  assert.equal(next.phase, 'playing');
  assert.equal(next.levelName, 'MEDIUM');
  assert.deepEqual(next.pos, { x: 0.5, y: 0.5 }, 'the blob is placed in the new maze\'s start cell');
  assert.deepEqual(next.pos, next.start);
  assert.equal(next.hits, 0, 'the new level starts with a clean counter');
});

test('levelup holds for its full duration', () => {
  const levelup = finish(pressStart(createGame(), 3));

  const held = step({ ...levelup, levelupElapsed: LEVELUP_DURATION - MAX_DT * 2 }, MAX_DT, NO_INPUT);
  assert.equal(held.phase, 'levelup', `still holding at ${LEVELUP_DURATION - MAX_DT}s`);

  assert.equal(step(held, MAX_DT, NO_INPUT).phase, 'playing', 'and gone at exactly LEVELUP_DURATION');
});

test('only HARD fires the scare', () => {
  let state = pressStart(createGame(), 11);

  assert.equal(finish(state).phase, 'levelup', 'EASY hands over');
  state = handover(finish(state));
  assert.equal(finish(state).phase, 'levelup', 'MEDIUM hands over');
  state = handover(finish(state));

  assert.equal(state.levelName, 'HARD');
  assert.equal(finish(state).phase, 'scare', 'only the last level ends the run');
});

test('levelIndex tracks the order', () => {
  let state = pressStart(createGame(), 11);
  const seen = [];

  for (let i = 0; i < LEVELS.length; i += 1) {
    seen.push([state.levelIndex, state.levelName]);
    assert.equal(state.levelIndex, LEVELS.indexOf(state.levelName), 'the index and the name cannot drift');
    state = handover(finish(state));
  }

  assert.deepEqual(seen, [[0, 'EASY'], [1, 'MEDIUM'], [2, 'HARD']]);
});

test('a run is reproducible from one seed', () => {
  // This is what the derived seed buys, and it is what makes an automated playthrough assertable.
  assert.deepEqual(segmentsPerLevel(2026), segmentsPerLevel(2026));
});

test('each level gets a different maze', () => {
  const [easy, medium, hard] = segmentsPerLevel(2026);

  assert.notDeepEqual(easy, medium);
  assert.notDeepEqual(medium, hard);
  assert.notDeepEqual(easy, hard);
  assert.notDeepEqual(
    medium,
    startLevel(createGame(), 'MEDIUM', 2026).segments,
    'the second level runs on a derived seed, not on the one the run started from',
  );
});

test('input is ignored during levelup', () => {
  const levelup = finish(pressStart(createGame(), 3));
  const pressed = step(levelup, MAX_DT, { dx: 1, dy: 1 });

  assert.deepEqual(pressed.pos, levelup.pos, 'the beat is not a phase the player can act in');
});

test('an inherited key is not a level', () => {
  // These all return something truthy from a plain object, so a bare truthiness guard would let
  // them through and fail later with an arithmetic error from the maze generator instead.
  for (const key of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
    assert.throws(
      () => startLevel(pressStart(createGame()), key, 1),
      /Unknown level/,
      `${key} should be rejected as an unknown level, by the level guard itself`,
    );
  }
});

test('scare to title after the full duration', () => {
  const scared = { ...openField('EASY', 4), phase: 'scare', scareElapsed: 0 };
  const nearlyDone = SCARE_DURATION - 0.1;

  const almost = advance(scared, nearlyDone);
  assert.equal(almost.phase, 'scare', 'the image holds for the full duration');
  assert.ok(Math.abs(almost.scareElapsed - nearlyDone) < 1e-9);

  // One frame past the boundary: accumulating MAX_DT lands a float hair either side of it depending
  // on the duration. The exact instant is asserted in tests/jumpscare.test.js, which sets the clock
  // rather than summing it.
  const done = advance(almost, 0.1 + MAX_DT);
  assert.equal(done.phase, 'title');
});

test('title after scare has no maze', () => {
  const scared = { ...openField('EASY', 4), phase: 'scare', scareElapsed: SCARE_DURATION - MAX_DT };
  const done = step(scared, MAX_DT, NO_INPUT);

  assert.equal(done.phase, 'title');
  assert.deepEqual(done, createGame(), 'the app returns to a state identical to a fresh game');
});

test('input ignored outside playing', () => {
  for (const phase of ['title', 'levelup', 'scare']) {
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

test('dt is clamped', () => {
  const state = openField('EASY');
  const catchUp = step(state, 5.0, RIGHT);

  assert.ok(
    Math.abs(catchUp.pos.x - (state.pos.x + DIFFICULTY.EASY.speed * MAX_DT)) < 1e-9,
    `a 5s catch-up frame must move only ${MAX_DT}s worth, not 5s worth`,
  );
});

// --- Wall contact and exit -----------------------------------------------------------------------

test('a wall never sends the blob back to the start', () => {
  const open = walledField();
  const contact = open.level.blobRadius + open.level.wallHalfThickness;
  let state = open;

  for (let i = 0; i < 60; i += 1) {
    state = step(state, MAX_DT, LEFT);
    assert.notDeepEqual(state.pos, state.start, `frame ${i + 1} teleported the blob back to the start`);
  }

  assert.ok(state.pos.x >= contact, 'the blob never crosses into the wall');
  assert.ok(
    state.pos.x - contact <= open.level.blobRadius / 2,
    'and comes to rest against it, within one sub-step',
  );
});

test('a blocked axis still moves on the other', () => {
  const state = settled(DOWN_LEFT);
  const next = step(state, MAX_DT, DOWN_LEFT);
  // A diagonal is normalized, so each axis carries speed * dt / sqrt(2).
  const perAxis = (DIFFICULTY.EASY.speed * MAX_DT) / Math.SQRT2;

  assert.equal(next.pos.x, state.pos.x, 'the blocked axis must not move');
  assert.ok(
    Math.abs(next.pos.y - (state.pos.y + perAxis)) < 1e-9,
    'the free axis keeps its full speed, which is what makes the blob slide along the wall',
  );
  assert.equal(next.hits, state.hits + 1, 'the frame still counts as blocked');
});

test('a head-on press moves on neither axis', () => {
  const state = settled(LEFT);
  assert.deepEqual(step(state, MAX_DT, LEFT).pos, state.pos);
});

test('sliding cannot tunnel', () => {
  // A deliberately absurd speed, so even the clamped dt covers several cells in one step.
  const state = startLevel(pressStart(createGame()), 'EASY', 5);
  const fast = { ...state, level: { ...state.level, speed: 100 } };
  const next = step(fast, 2.0, { dx: -1, dy: -1 });
  const { blobRadius, wallHalfThickness } = state.level;

  assert.equal(next.hits, 1, 'a five-cell plunge into the corner must report a blocked frame');
  assert.ok(
    !hitsWall(next.pos.x, next.pos.y, blobRadius, state.segments, wallHalfThickness),
    'per-axis sweeping must not weaken collision: the blob ends clear of every wall',
  );
  assert.ok(next.pos.x > 0 && next.pos.y > 0, 'and inside the maze, not on the far side of the border');
  assert.ok(next.pos.x < state.maze.cols && next.pos.y < state.maze.rows);
});

test('the maze survives contact', () => {
  const before = walledField();
  let state = before;
  for (let i = 0; i < 30; i += 1) state = step(state, MAX_DT, LEFT);

  assert.ok(state.hits > 0, 'fixture check: the wall should actually have blocked the blob');
  assert.deepEqual(state.segments, before.segments, 'the layout must survive, so the mental map does');
  assert.equal(state.seed, before.seed, 'the seed is not regenerated on contact');
  assert.equal(state.levelName, before.levelName);
  assert.deepEqual(state.maze, before.maze);
});

test('hits counts blocked frames', () => {
  const state = settled(LEFT);

  assert.equal(step(state, MAX_DT, LEFT).hits, state.hits + 1, 'a blocked frame counts');
  assert.equal(step(state, MAX_DT, RIGHT).hits, state.hits, 'a clear frame does not');
});

test('contact changes no phase', () => {
  const state = settled(LEFT);
  assert.equal(step(state, MAX_DT, LEFT).phase, 'playing', 'contact is not a loss and not an ending');
});

test('exit within radius ends the level', () => {
  const state = openField('EASY');
  const atExit = { ...state, pos: { ...state.exit } };

  assert.equal(step(atExit, MAX_DT, NO_INPUT).phase, 'levelup');
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
  assert.equal(next.phase, 'levelup', 'a blob at full speed still trips the exit on that same step');
});

test('same seed gives the same maze', () => {
  const first = startLevel(createGame(), 'HARD', 99);
  const second = startLevel(createGame(), 'HARD', 99);

  assert.deepEqual(first.segments, second.segments);
});

test('step never mutates its input', () => {
  const state = openField('EASY');
  const before = JSON.stringify(state.pos);
  step(state, MAX_DT, RIGHT);

  assert.equal(JSON.stringify(state.pos), before, 'step must return a new state, not edit the old');
});

test('the module still knows nothing of the clock', () => {
  for (const forbidden of ['document', 'window', 'Date', 'performance', 'localStorage']) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`).test(gameSource),
      `game.js must not reference ${forbidden}`,
    );
  }

  // The level-up seed is derived from the previous seed rather than drawn fresh, which is exactly
  // what keeps this true and what makes a whole run replayable from one number.
  assert.ok(!gameSource.includes('Math.random'), 'game.js must not reference Math.random');
});
