import test from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32 } from '../src/rng.js';
import { generate, toSegments, solve } from '../src/maze.js';
import { hitsWall } from '../src/collision.js';
import { DIFFICULTY, LEVELS, clearance } from '../src/difficulty.js';

const FIELDS = ['cols', 'rows', 'blobRadius', 'wallHalfThickness', 'fogRadius', 'speed', 'exitRadius'];
const ordered = () => LEVELS.map((name) => DIFFICULTY[name]);

test('exports exactly three levels', () => {
  assert.deepEqual(Object.keys(DIFFICULTY), ['EASY', 'MEDIUM', 'HARD']);
  assert.deepEqual([...LEVELS], ['EASY', 'MEDIUM', 'HARD'], 'LEVELS drives the button order');
});

test('every level has every field', () => {
  for (const name of LEVELS) {
    for (const field of FIELDS) {
      const value = DIFFICULTY[name][field];
      assert.ok(Number.isFinite(value), `${name}.${field} should be a finite number, got ${value}`);
    }
  }
});

test('table is frozen', () => {
  assert.ok(Object.isFrozen(DIFFICULTY), 'the table itself should be frozen');
  for (const name of LEVELS) {
    assert.ok(Object.isFrozen(DIFFICULTY[name]), `${name} should be frozen`);
  }

  const before = DIFFICULTY.EASY.speed;
  assert.throws(() => {
    DIFFICULTY.EASY.speed = 99;
  }, TypeError);
  assert.equal(DIFFICULTY.EASY.speed, before, 'the assignment must not mutate the table');
});

test('grid size increases with difficulty', () => {
  const [easy, medium, hard] = ordered();
  assert.ok(easy.cols < medium.cols && medium.cols < hard.cols, 'cols should increase');
  assert.ok(easy.rows < medium.rows && medium.rows < hard.rows, 'rows should increase');
});

test('fog radius matches the spec table', () => {
  // Pinned values rather than only their ordering, so the fog cannot be retuned silently without
  // SPEC.md section 8 being updated in the same commit.
  assert.equal(DIFFICULTY.EASY.fogRadius, 2.4);
  assert.equal(DIFFICULTY.MEDIUM.fogRadius, 1.8);
  assert.equal(DIFFICULTY.HARD.fogRadius, 1.3);
});

test('fog radius decreases with difficulty', () => {
  const [easy, medium, hard] = ordered();
  assert.ok(easy.fogRadius > medium.fogRadius && medium.fogRadius > hard.fogRadius);
});

test('corridor clearance decreases with difficulty', () => {
  const [easy, medium, hard] = ordered().map(clearance);
  assert.ok(easy > medium && medium > hard, `clearance should shrink, got ${easy}, ${medium}, ${hard}`);
});

test('blob fits every corridor', () => {
  for (const name of LEVELS) {
    const level = DIFFICULTY[name];
    assert.ok(
      level.blobRadius + level.wallHalfThickness < 0.5,
      `${name} is unplayable: the blob cannot fit a corridor`,
    );
    assert.ok(clearance(level) > 0, `${name} clearance should stay strictly positive`);
  }
});

test('fog is wide enough to see a corridor', () => {
  for (const name of LEVELS) {
    const level = DIFFICULTY[name];
    assert.ok(
      level.fogRadius > level.blobRadius * 2,
      `${name} fog is too tight to show the passage the blob occupies`,
    );
  }
});

test('a wider fog does not reveal the exit early', () => {
  // The point of the widening is visibility; the point of the game is that the exit is not visible.
  // This bounds one against the other, and is SPEC.md section 14 asserted mechanically.
  for (const name of LEVELS) {
    const level = DIFFICULTY[name];
    const startToExit = Math.hypot(level.cols - 1, level.rows - 1);

    assert.ok(
      level.fogRadius * 4 < startToExit,
      `${name} fog of ${level.fogRadius} is not far enough inside the ${startToExit.toFixed(1)} cells to the exit`,
    );
  }
});

test('mazes are square', () => {
  for (const name of LEVELS) {
    assert.equal(DIFFICULTY[name].cols, DIFFICULTY[name].rows, `${name} should be square`);
  }
});

test('a moving blob cannot skip the exit', () => {
  for (const name of LEVELS) {
    const level = DIFFICULTY[name];
    assert.ok(
      level.blobRadius / 2 < level.exitRadius,
      `${name} sub-steps are longer than the exit radius, so the blob could sweep past the exit`,
    );
  }
});

test('every level generates a solvable maze', () => {
  for (const name of LEVELS) {
    const level = DIFFICULTY[name];
    const maze = generate(level.cols, level.rows, mulberry32(1));
    const segments = toSegments(maze);
    const path = solve(maze);

    assert.ok(path.length > 0, `${name} should be solvable`);
    assert.deepEqual(path[path.length - 1], { c: level.cols - 1, r: level.rows - 1 });

    const clear = (x, y) => !hitsWall(x, y, level.blobRadius, segments, level.wallHalfThickness);
    assert.ok(clear(0.5, 0.5), `${name} start cell centre should be wall-free`);
    assert.ok(
      clear(level.cols - 0.5, level.rows - 0.5),
      `${name} exit cell centre should be wall-free`,
    );
  }
});
