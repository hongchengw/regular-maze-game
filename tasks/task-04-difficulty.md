# Task 04 - Difficulty tuning table

**Depends on:** 01. **Unblocks:** 05.

## Goal

When this is done, `src/difficulty.js` exports one frozen table defining EASY, MEDIUM, and HARD, and
tests prove the three levels actually get harder along every axis while remaining physically
playable. Every tunable number in the game lives here and nowhere else.

## Spec first

Fill in the `SPEC.md` **Difficulty** section.

Three levels. Harder means: a larger grid (so corridors are narrower on screen), a fatter blob
relative to the corridor, and a smaller fog radius (so more of the maze is navigated blind).

| Field | Unit | EASY | MEDIUM | HARD |
| --- | --- | --- | --- | --- |
| `cols` x `rows` | cells | 10 x 10 | 16 x 16 | 24 x 24 |
| `blobRadius` | cells | 0.16 | 0.18 | 0.22 |
| `wallHalfThickness` | cells | 0.04 | 0.035 | 0.03 |
| `fogRadius` | cells | 2.2 | 1.6 | 1.1 |
| `speed` | cells per second | 3.2 | 3.4 | 3.6 |
| `exitRadius` | cells | 0.30 | 0.28 | 0.25 |

Derived facts the spec should state explicitly, because the tests assert them:

- **Corridor clearance** is `0.5 - (blobRadius + wallHalfThickness)`: the slack between the blob's
  edge and a wall when the blob is centred in a corridor. It must stay strictly positive at every
  level, otherwise the level is unplayable. EASY 0.30, MEDIUM 0.285, HARD 0.25.
- Because the renderer fits the whole maze to the viewport, a larger grid means fewer pixels per
  cell, which is what makes HARD corridors visually tight without changing the cell-unit geometry.
- `fogRadius` in cells maps to roughly 130 px (EASY), 60 px (MEDIUM), and 27 px (HARD) on a 900 px
  tall viewport. The prompt's 80 to 100 px target sits between EASY and MEDIUM by design; these
  numbers are the intent, and the spec table is the source of truth if they are retuned after
  playtesting.
- `speed` rises slightly with difficulty so harder levels do not feel sluggish across a bigger grid.

## Failing tests first

Write `tests/difficulty.test.js` before `src/difficulty.js` exists. Expected red run:
`ERR_MODULE_NOT_FOUND`.

| Test case | Assertion |
| --- | --- |
| `exports exactly three levels` | Keys are exactly `EASY`, `MEDIUM`, `HARD`. |
| `every level has every field` | Each level defines all six fields, all finite numbers, none `undefined`. |
| `table is frozen` | `Object.isFrozen` on the table and on each level object; assigning to `EASY.speed` throws in strict mode and does not mutate. |
| `grid size increases with difficulty` | `EASY.cols < MEDIUM.cols < HARD.cols`, same for rows. |
| `fog radius decreases with difficulty` | `EASY.fogRadius > MEDIUM.fogRadius > HARD.fogRadius`. |
| `corridor clearance decreases with difficulty` | Clearance computed from the table is strictly decreasing across the three levels. |
| `blob fits every corridor` | For each level, `blobRadius + wallHalfThickness < 0.5`. This is the playability guard: if a retune ever breaks it, this test fails loudly. |
| `fog is wide enough to see a corridor` | For each level, `fogRadius > blobRadius * 2`, so the player can always see at least the passage they occupy. |
| `mazes are square` | `cols === rows` at every level (the renderer's fit logic assumes nothing, but the spec fixes squares). |
| `every level generates a solvable maze` | For each level, `generate(cols, rows, mulberry32(1))` then `solve` returns a path, and the start and exit cell centres are both wall-free per `hitsWall` with that level's radii. This is the integration guard that the tuning numbers work against real geometry. |

## Implementation outline

**`src/difficulty.js`**

```js
export const DIFFICULTY = Object.freeze({
  EASY:   Object.freeze({ cols: 10, rows: 10, blobRadius: 0.16, wallHalfThickness: 0.04,  fogRadius: 2.2, speed: 3.2, exitRadius: 0.30 }),
  MEDIUM: Object.freeze({ cols: 16, rows: 16, blobRadius: 0.18, wallHalfThickness: 0.035, fogRadius: 1.6, speed: 3.4, exitRadius: 0.28 }),
  HARD:   Object.freeze({ cols: 24, rows: 24, blobRadius: 0.22, wallHalfThickness: 0.03,  fogRadius: 1.1, speed: 3.6, exitRadius: 0.25 }),
});

export const LEVELS = Object.freeze(['EASY', 'MEDIUM', 'HARD']);  // display order
export function clearance(level) { return 0.5 - (level.blobRadius + level.wallHalfThickness); }
```

`LEVELS` drives the button order on the select screen so the UI cannot drift from the table. No
imports, no DOM.

## Files touched

**Created:** `src/difficulty.js`, `tests/difficulty.test.js`.

**Modified:** `SPEC.md`, `changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; every case observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- The `SPEC.md` table and the code table agree number for number. If they diverge later, the spec
  wins and the code is the bug.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(difficulty): add easy, medium, and hard tuning table
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 04 - Difficulty tuning table - <date> <time> EDT` with Added / Changed / Deleted.
