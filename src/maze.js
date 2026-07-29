// Seeded perfect maze generation and its wall geometry, in cell units.
//
// A maze is `{ cols, rows, passages }` where `passages` is a Set of canonical keys naming the two
// cells a carved passage joins. A perfect maze is a spanning tree, so `passages.size` is always
// `cols * rows - 1`: exactly one path between any two cells, no loops, no isolated cells.

/** The four orthogonal neighbour offsets, in screen order: up, right, down, left. */
const MAZE_NEIGHBOURS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Canonical key for the boundary between two adjacent cells, smaller cell first. */
function passageKey(c1, r1, c2, r2) {
  const a = `${c1},${r1}`;
  const b = `${c2},${r2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** True if a passage has been carved between two adjacent cells. */
function isCarved(maze, c1, r1, c2, r2) {
  return maze.passages.has(passageKey(c1, r1, c2, r2));
}

/** In-place Fisher-Yates shuffle driven by the seeded `rng`. */
function shuffle(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Carve a perfect maze with a recursive backtracker, using an explicit stack so a large grid
 * cannot overflow the call stack. `rng` is the seed policy's business, not this function's.
 */
export function generate(cols, rows, rng) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
    throw new Error(`Invalid maze size ${cols}x${rows}: cols and rows must be integers >= 1`);
  }

  const passages = new Set();
  const visited = new Set(['0,0']);
  const stack = [[0, 0]];

  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const options = shuffle([...MAZE_NEIGHBOURS], rng)
      .map(([dc, dr]) => [c + dc, r + dr])
      .filter(([nc, nr]) => nc >= 0 && nr >= 0 && nc < cols && nr < rows)
      .filter(([nc, nr]) => !visited.has(`${nc},${nr}`));

    if (!options.length) {
      stack.pop();
      continue;
    }

    const [nc, nr] = options[0];
    passages.add(passageKey(c, r, nc, nr));
    visited.add(`${nc},${nr}`);
    stack.push([nc, nr]);
  }

  return { cols, rows, passages };
}

/**
 * Flatten a maze into wall line segments on cell boundaries. Each boundary is emitted at most once:
 * a cell contributes its top and left edges, and the last column and row close the outer border.
 */
export function toSegments(maze) {
  const { cols, rows } = maze;
  const segments = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (r === 0 || !isCarved(maze, c, r, c, r - 1)) {
        segments.push({ x1: c, y1: r, x2: c + 1, y2: r });
      }
      if (c === 0 || !isCarved(maze, c, r, c - 1, r)) {
        segments.push({ x1: c, y1: r, x2: c, y2: r + 1 });
      }
    }
  }

  for (let r = 0; r < rows; r += 1) {
    segments.push({ x1: cols, y1: r, x2: cols, y2: r + 1 });
  }
  for (let c = 0; c < cols; c += 1) {
    segments.push({ x1: c, y1: rows, x2: c + 1, y2: rows });
  }

  return segments;
}

/**
 * Breadth-first path from the start cell (0,0) to the exit cell (cols-1, rows-1) across carved
 * passages. Serves tests, not gameplay.
 */
export function solve(maze) {
  const { cols, rows } = maze;
  const parents = new Map([['0,0', null]]);
  const queue = [[0, 0]];
  const goal = `${cols - 1},${rows - 1}`;

  for (let head = 0; head < queue.length; head += 1) {
    const [c, r] = queue[head];
    if (`${c},${r}` === goal) break;

    for (const [dc, dr] of MAZE_NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (parents.has(`${nc},${nr}`) || !isCarved(maze, c, r, nc, nr)) continue;
      parents.set(`${nc},${nr}`, `${c},${r}`);
      queue.push([nc, nr]);
    }
  }

  const path = [];
  for (let at = goal; at !== null && at !== undefined; at = parents.get(at)) {
    const [c, r] = at.split(',').map(Number);
    path.unshift({ c, r });
  }
  return path;
}
