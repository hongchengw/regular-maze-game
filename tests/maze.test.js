import test from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32 } from '../src/rng.js';
import { generate, toSegments, solve } from '../src/maze.js';

/** Canonical passage key: the lexicographically smaller cell first, per SPEC.md section 6. */
function key(c1, r1, c2, r2) {
  const a = `${c1},${r1}`;
  const b = `${c2},${r2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function isOpen(maze, c1, r1, c2, r2) {
  return maze.passages.has(key(c1, r1, c2, r2));
}

const NEIGHBOURS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// --- RNG ---------------------------------------------------------------------------------------

test('mulberry32 is deterministic', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 100; i += 1) {
    assert.equal(a(), b(), `draw ${i} should match across two generators from the same seed`);
  }
});

test('mulberry32 differs by seed', () => {
  assert.notEqual(mulberry32(1)(), mulberry32(2)(), 'different seeds should not open alike');
});

test('mulberry32 stays in range', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 1000; i += 1) {
    const value = rng();
    assert.ok(value >= 0 && value < 1, `draw ${i} was ${value}, outside [0, 1)`);
  }
});

// --- Generation --------------------------------------------------------------------------------

test('generate is deterministic for a seed', () => {
  const first = generate(8, 8, mulberry32(42));
  const second = generate(8, 8, mulberry32(42));

  assert.deepEqual(
    [...first.passages].sort(),
    [...second.passages].sort(),
    'the same seed should carve the same maze',
  );
});

test('generate is a perfect maze', () => {
  const maze = generate(8, 8, mulberry32(42));
  assert.equal(
    maze.passages.size,
    maze.cols * maze.rows - 1,
    'a perfect maze is a spanning tree: exactly cells - 1 carved passages, so no loops',
  );
});

test('every cell is reachable', () => {
  const maze = generate(8, 8, mulberry32(3));
  const seen = new Set(['0,0']);
  const stack = [[0, 0]];

  while (stack.length) {
    const [c, r] = stack.pop();
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= maze.cols || nr >= maze.rows) continue;
      if (!isOpen(maze, c, r, nc, nr)) continue;
      if (seen.has(`${nc},${nr}`)) continue;
      seen.add(`${nc},${nr}`);
      stack.push([nc, nr]);
    }
  }

  assert.equal(seen.size, maze.cols * maze.rows, 'a flood fill from (0,0) should reach every cell');
});

test('border is always solid', () => {
  const maze = generate(6, 6, mulberry32(9));

  for (const passage of maze.passages) {
    const cells = passage.split('|').map((cell) => cell.split(',').map(Number));
    for (const [c, r] of cells) {
      assert.ok(
        c >= 0 && r >= 0 && c < maze.cols && r < maze.rows,
        `passage ${passage} leads outside the grid, so the border is not solid`,
      );
    }
  }
});

test('solve finds a start-to-exit path', () => {
  const maze = generate(8, 8, mulberry32(42));
  const path = solve(maze);

  assert.deepEqual(path[0], { c: 0, r: 0 }, 'the path should start at cell (0,0)');
  assert.deepEqual(
    path[path.length - 1],
    { c: maze.cols - 1, r: maze.rows - 1 },
    'the path should end at the exit cell',
  );

  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1];
    const cur = path[i];
    const stepDistance = Math.abs(cur.c - prev.c) + Math.abs(cur.r - prev.r);
    assert.equal(stepDistance, 1, `step ${i} is not orthogonally adjacent`);
    assert.ok(isOpen(maze, prev.c, prev.r, cur.c, cur.r), `step ${i} crosses an uncarved wall`);
  }
});

test('solve path has no repeats', () => {
  const path = solve(generate(10, 10, mulberry32(11)));
  const seen = new Set(path.map((cell) => `${cell.c},${cell.r}`));
  assert.equal(seen.size, path.length, 'the path should visit no cell twice');
});

test('rejects degenerate sizes', () => {
  assert.throws(() => generate(0, 5, mulberry32(1)), /cols|rows|size|dimension/i);
  assert.throws(() => generate(5, 0, mulberry32(1)), /cols|rows|size|dimension/i);

  const tiny = generate(1, 1, mulberry32(1));
  assert.equal(tiny.passages.size, 0, 'a 1x1 maze has no passages to carve');
  assert.equal(toSegments(tiny).length, 4, 'a 1x1 maze yields only its four border segments');
});

// --- Segments ----------------------------------------------------------------------------------

test('toSegments emits the outer border', () => {
  const segments = toSegments(generate(1, 1, mulberry32(1)));
  const normalized = segments.map((s) => `${s.x1},${s.y1}-${s.x2},${s.y2}`).sort();

  assert.deepEqual(
    normalized,
    ['0,0-0,1', '0,0-1,0', '0,1-1,1', '1,0-1,1'].sort(),
    'the four border segments and nothing else',
  );
});

test('toSegments has no duplicates', () => {
  const segments = toSegments(generate(8, 8, mulberry32(42)));
  const seen = new Set();

  for (const s of segments) {
    const forward = `${s.x1},${s.y1}-${s.x2},${s.y2}`;
    const reverse = `${s.x2},${s.y2}-${s.x1},${s.y1}`;
    assert.ok(!seen.has(forward), `duplicate segment ${forward}`);
    assert.ok(!seen.has(reverse), `segment ${forward} is the reverse of one already emitted`);
    seen.add(forward);
  }
});

test('toSegments coordinates are in cell units', () => {
  const maze = generate(8, 8, mulberry32(42));

  for (const s of toSegments(maze)) {
    for (const x of [s.x1, s.x2]) {
      assert.ok(Number.isInteger(x) && x >= 0 && x <= maze.cols, `x ${x} outside [0, cols]`);
    }
    for (const y of [s.y1, s.y2]) {
      assert.ok(Number.isInteger(y) && y >= 0 && y <= maze.rows, `y ${y} outside [0, rows]`);
    }
  }
});

test('segment count matches wall count', () => {
  const maze = generate(8, 8, mulberry32(42));
  const boundaries = (maze.cols + 1) * maze.rows + maze.cols * (maze.rows + 1);

  assert.equal(
    toSegments(maze).length,
    boundaries - maze.passages.size,
    'every boundary is a wall unless a passage was carved through it',
  );
});

test('carved passages have no segment', () => {
  // Find a seed whose maze carves (0,0)-(1,0), then check that shared edge is absent.
  let maze = null;
  for (let seed = 1; seed < 50 && !maze; seed += 1) {
    const candidate = generate(8, 8, mulberry32(seed));
    if (isOpen(candidate, 0, 0, 1, 0)) maze = candidate;
  }
  assert.ok(maze, 'fixture check: some seed under 50 should carve (0,0)-(1,0)');

  const onSharedEdge = toSegments(maze).filter(
    (s) => s.x1 === 1 && s.x2 === 1 && Math.min(s.y1, s.y2) === 0 && Math.max(s.y1, s.y2) === 1,
  );
  assert.equal(onSharedEdge.length, 0, 'a carved passage must not leave a wall segment behind');
});
