import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEVELS } from '../src/difficulty.js';
import { solve } from '../src/maze.js';
import { createGame, pressStart, startLevel, step, SCARE_DURATION } from '../src/game.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '..', 'src');
const FRAME = 1 / 60;

/**
 * Steer towards a cell centre one axis at a time, so the blob never cuts a corner diagonally and
 * stays centred in its corridor. `reached` is one frame's travel, since the blob cannot land on a
 * point exactly.
 */
function steer(pos, target, reached) {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;

  if (Math.abs(dx) < reached && Math.abs(dy) < reached) return { dx: 0, dy: 0 };
  return Math.abs(dx) >= Math.abs(dy)
    ? { dx: Math.sign(dx), dy: 0 }
    : { dx: 0, dy: Math.sign(dy) };
}

/** Walk the blob along the solved path's cell centres. Returns the final state and frame count. */
function playThrough(initial, maxFrames = 100000) {
  const waypoints = solve(initial.maze).map((cell) => ({ x: cell.c + 0.5, y: cell.r + 0.5 }));
  const reached = initial.level.speed * FRAME;
  let state = initial;
  let frames = 0;

  for (const target of waypoints) {
    while (state.phase === 'playing' && frames < maxFrames) {
      const input = steer(state.pos, target, reached);
      if (input.dx === 0 && input.dy === 0) break;
      state = step(state, FRAME, input);
      frames += 1;
    }
    if (state.phase !== 'playing') break;
  }

  return { state, frames };
}

/** Sit through the level-up beat, if that is where the state is. */
function holdLevelup(state) {
  let current = state;
  for (let i = 0; i < 1000 && current.phase === 'levelup'; i += 1) {
    current = step(current, FRAME, { dx: 0, dy: 0 });
  }
  return current;
}

/** Walk all three mazes along their own solutions, from one starting seed. */
function fullRun(seed) {
  let state = pressStart(createGame(), seed);
  const names = [];

  for (let i = 0; i < LEVELS.length; i += 1) {
    names.push(state.levelName);
    ({ state } = playThrough(state));
    state = holdLevelup(state);
  }

  return { state, names };
}

test('a full run reaches the scare', () => {
  let state = pressStart(createGame(), 2026);
  const names = [];

  for (let i = 0; i < LEVELS.length; i += 1) {
    names.push(state.levelName);
    ({ state } = playThrough(state));

    assert.equal(state.hits, 0, `${names[i]} clipped a wall while centred in the corridor`);
    if (i + 1 < LEVELS.length) {
      assert.equal(state.phase, 'levelup', `${names[i]} was not traversable along its own solution`);
      state = holdLevelup(state);
    }
  }

  assert.deepEqual(names, [...LEVELS], 'the levels are played in order, every time');
  assert.equal(state.phase, 'scare', 'and only the exit of HARD ends the run');
});

test('the full loop returns to title', () => {
  let { state } = fullRun(2026);
  assert.equal(state.phase, 'scare', 'fixture check: the run should reach the scare');

  const frames = Math.ceil(SCARE_DURATION / FRAME) + 1;
  for (let i = 0; i < frames; i += 1) state = step(state, FRAME, { dx: 0, dy: 0 });

  assert.deepEqual(state, createGame(), 'ten seconds later the app is in its initial state');
});

test('a second playthrough works', () => {
  let { state } = fullRun(2026);

  const frames = Math.ceil(SCARE_DURATION / FRAME) + 1;
  for (let i = 0; i < frames; i += 1) state = step(state, FRAME, { dx: 0, dy: 0 });

  const second = pressStart(state, 7);
  assert.equal(second.phase, 'playing', 'no state corruption survives a full loop');
  assert.equal(second.levelName, 'EASY', 'and the next run starts from the first level again');
  assert.equal(second.hits, 0);
  assert.deepEqual(second.pos, { x: 0.5, y: 0.5 });
});

test('wall contact does not change the layout mid-run', () => {
  let state = startLevel(createGame(), 'EASY', 2026);
  const layout = state.segments;

  // Drive straight up into the solid outer border and keep pressing.
  for (let i = 0; i < 40; i += 1) {
    state = step(state, FRAME, { dx: 0, dy: -1 });

    assert.deepEqual(state.segments, layout, `the maze changed on frame ${i + 1}`);
    assert.equal(state.seed, 2026, 'the seed is never regenerated on contact');
  }

  assert.ok(state.hits > 0, 'fixture check: the border should have blocked the blob');
  assert.ok(state.pos.y < state.start.y, 'the blob rests against the border rather than back at the start');
  assert.equal(state.phase, 'playing');
});

test('no module touches persistence', () => {
  const forbidden = ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'fetch', 'XMLHttpRequest'];

  for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(srcDir, file), 'utf8');
    for (const name of forbidden) {
      assert.ok(!source.includes(name), `src/${file} references ${name}; the app never persists or networks`);
    }
  }
});

test('there is no pause, debug key, or level skip', () => {
  // Comments are stripped first, so prose about the absence of a debug key does not read as one.
  const sources = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

  for (const name of ['debug', 'cheat', 'skip', 'pause']) {
    assert.ok(
      !new RegExp(`\\b${name}\\b`, 'i').test(sources),
      `a ${name} affordance is something a victim can stumble into`,
    );
  }
});
