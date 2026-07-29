import test from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32 } from '../src/rng.js';
import { generate, toSegments } from '../src/maze.js';
import { distancePointSegment, hitsWall, sweep } from '../src/collision.js';

const UNIT = { x1: 0, y1: 0, x2: 1, y2: 0 };

/** Horizontal walls spanning x in [0,6] at every integer y, so a vertical move must cross them. */
const LADDER = [1, 2, 3, 4, 5].map((y) => ({ x1: 0, y1: y, x2: 6, y2: y }));

// --- distancePointSegment ----------------------------------------------------------------------

test('perpendicular distance', () => {
  assert.equal(distancePointSegment(0.5, 1, UNIT), 1);
});

test('clamps past the A end', () => {
  assert.equal(
    distancePointSegment(-1, 0, UNIT),
    1,
    'the projection must clamp to the segment, not fall back to the infinite line',
  );
});

test('clamps past the B end', () => {
  assert.equal(distancePointSegment(3, 0, UNIT), 2);
});

test('point on the segment', () => {
  assert.equal(distancePointSegment(0.5, 0, UNIT), 0);
});

test('degenerate zero-length segment', () => {
  const point = { x1: 1, y1: 1, x2: 1, y2: 1 };
  const distance = distancePointSegment(4, 5, point);

  assert.ok(!Number.isNaN(distance), 'a zero-length segment must not produce NaN');
  assert.equal(distance, 5, 'it degrades to plain point distance');
});

// --- hitsWall ----------------------------------------------------------------------------------

test('clear of all walls', () => {
  assert.equal(hitsWall(0.5, 0.5, 0.2, [UNIT], 0.02), false);
});

test('overlapping a wall', () => {
  assert.equal(
    hitsWall(0.5, 0.05, 0.2, [UNIT], 0.02),
    true,
    '0.05 is well inside radius + halfThickness of 0.22',
  );
});

test('exactly touching is not a hit', () => {
  assert.equal(
    hitsWall(0.5, 0.22, 0.2, [UNIT], 0.02),
    false,
    'contact is strictly less than radius + halfThickness, so the boundary goes to the player',
  );
});

test('hits the nearest of many walls', () => {
  const maze = generate(8, 8, mulberry32(42));
  const segments = toSegments(maze);

  assert.equal(hitsWall(0, 0, 0.18, segments, 0.035), true, 'the maze corner is a wall');
  assert.equal(
    hitsWall(0.5, 0.5, 0.18, segments, 0.035),
    false,
    'the start cell centre must be clear, or the game is unplayable',
  );
});

test('empty segment list', () => {
  assert.equal(hitsWall(0.5, 0.5, 0.2, [], 0.02), false);
});

// --- sweep -------------------------------------------------------------------------------------

test('clear move returns the destination', () => {
  const to = { x: 3, y: 0.5 };
  const result = sweep({ x: 0.5, y: 0.5 }, to, 0.2, [UNIT], 0.02);

  assert.equal(result.hit, false);
  assert.deepEqual(result.pos, to, 'a clear move lands exactly on the destination');
});

test('catches a tunneling move', () => {
  const from = { x: 0.5, y: 0.5 };
  const to = { x: 0.5, y: 5.5 };

  assert.equal(hitsWall(from.x, from.y, 0.2, LADDER, 0.02), false, 'the start is wall-free');
  assert.equal(hitsWall(to.x, to.y, 0.2, LADDER, 0.02), false, 'the destination is wall-free too');

  assert.equal(
    sweep(from, to, 0.2, LADDER, 0.02).hit,
    true,
    'sub-stepping must catch the five walls crossed between two clear endpoints',
  );
});

test('reports the last safe position', () => {
  const result = sweep({ x: 0.5, y: 0.5 }, { x: 0.5, y: 5.5 }, 0.2, LADDER, 0.02);

  assert.equal(result.hit, true);
  assert.equal(
    hitsWall(result.pos.x, result.pos.y, 0.2, LADDER, 0.02),
    false,
    'the reported position must itself be clear',
  );
});

test('step count is bounded by radius', () => {
  const radius = 0.2;
  const from = { x: 0.5, y: 0.5 };
  const to = { x: 4.5, y: 0.5 };
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  const result = sweep(from, to, radius, [], 0.02);

  assert.ok(
    result.steps >= Math.ceil(length / (radius / 2)),
    `a move of length ${length} needs at least ${Math.ceil(length / (radius / 2))} sub-steps, ` +
      `got ${result.steps}`,
  );
});

test('zero-length move', () => {
  const from = { x: 0.5, y: 0.5 };
  const result = sweep(from, { x: 0.5, y: 0.5 }, 0.2, [UNIT], 0.02);

  assert.equal(result.hit, false);
  assert.deepEqual(result.pos, from);
});

test('starting already in contact', () => {
  const from = { x: 0.5, y: 0.05 };
  const result = sweep(from, { x: 3, y: 0.05 }, 0.2, [UNIT], 0.02);

  assert.equal(result.hit, true);
  assert.deepEqual(result.pos, from, 'a blob already in contact must not move');
});
