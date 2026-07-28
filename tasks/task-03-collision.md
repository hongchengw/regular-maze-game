# Task 03 - Swept circle collision against wall segments

**Depends on:** 01 (02 for realistic fixtures). **Unblocks:** 05.

## Goal

When this is done, `src/collision.js` can answer whether a blob at a position touches any wall, and
can move the blob from A to B in sub-steps so that no speed of movement lets it pass through a wall.
This is the module that makes the game fair, so it gets the most test coverage in the project.

## Spec first

Fill in the `SPEC.md` **Collision** section.

- The blob is a circle of radius `blobRadius` (cell units). Walls are line segments with
  `wallHalfThickness` (cell units).
- **Contact** is defined as the distance from the blob centre to a wall segment being **strictly
  less than** `blobRadius + wallHalfThickness`. Exactly touching is not a hit; the player gets the
  boundary case in their favour.
- A move is resolved by **sweeping**: the straight path from the old position to the new is divided
  into steps no longer than `blobRadius / 2`, and each intermediate position is tested. The first
  contact stops the move and reports a hit. This means a fast flick or a long frame delta cannot
  tunnel through a wall.
- Collision never slides or bounces. A hit is a hit, and the game layer decides the consequence
  (reset to start).

## Failing tests first

Write `tests/collision.test.js` before `src/collision.js` exists. Expected red run:
`ERR_MODULE_NOT_FOUND`.

**`distancePointSegment`**

| Test case | Assertion |
| --- | --- |
| `perpendicular distance` | Point `(0.5, 1)` to segment `(0,0)-(1,0)` is `1`. |
| `clamps past the A end` | Point `(-1, 0)` to segment `(0,0)-(1,0)` is `1`, not the infinite-line distance of `0`. |
| `clamps past the B end` | Point `(3, 0)` to segment `(0,0)-(1,0)` is `2`. |
| `point on the segment` | Point `(0.5, 0)` to segment `(0,0)-(1,0)` is `0`. |
| `degenerate zero-length segment` | Distance to segment `(1,1)-(1,1)` equals plain point distance, and does not produce `NaN`. |

**`hitsWall`**

| Test case | Assertion |
| --- | --- |
| `clear of all walls` | Blob well inside a corridor returns `false`. |
| `overlapping a wall` | Blob centre `0.05` from a wall with `radius 0.2, halfThickness 0.02` returns `true`. |
| `exactly touching is not a hit` | Distance exactly `radius + halfThickness` returns `false` (strict inequality, per spec). |
| `hits the nearest of many walls` | With a full 8x8 maze's segments, a blob placed on a known wall returns `true` and one placed at the start cell centre returns `false`. |
| `empty segment list` | Returns `false` rather than throwing. |

**`sweep`**

| Test case | Assertion |
| --- | --- |
| `clear move returns the destination` | `{ hit: false, pos: to }` for a move along an open corridor. |
| `catches a tunneling move` | Moving from `(0.5, 0.5)` to `(0.5, 5.5)` straight across several horizontal walls returns `hit: true`, even though both endpoints are wall-free. This is the anti-cheat case; it must fail before the sub-stepping exists. |
| `reports the last safe position` | On a hit, the returned `pos` is a position that itself passes `hitsWall === false`. |
| `step count is bounded by radius` | A move of length `L` is tested in at least `ceil(L / (radius / 2))` sub-steps (assert via an injected counter or by exposing the step count in the result). |
| `zero-length move` | `from === to` returns `hit: false` and does not loop forever. |
| `starting already in contact` | If `from` is already in contact, returns `hit: true` immediately without moving. |

## Implementation outline

**`src/collision.js`**

```js
export function distancePointSegment(px, py, seg)                   // -> number
export function hitsWall(x, y, radius, segments, halfThickness)     // -> boolean
export function sweep(from, to, radius, segments, halfThickness)    // -> { hit, pos, steps }
```

- `distancePointSegment`: project onto the segment, clamp `t` to `[0, 1]`, return the distance to the
  clamped point. Guard `len2 === 0` for the degenerate case.
- `hitsWall`: early-return `true` on the first segment closer than `radius + halfThickness`. Compare
  squared distances to avoid `Math.sqrt` in the hot loop, but keep `distancePointSegment` returning a
  real distance since tests assert on it directly.
- `sweep`: compute `dist = |to - from|`; if `0`, test `from` and return. Otherwise
  `steps = max(1, ceil(dist / (radius / 2)))`, then walk `i = 1..steps` lerping and testing each
  position, remembering the last clear one. Return on the first contact.

Broad-phase optimization (spatial hash, AABB rejection) is deliberately **out of scope**. A 24x24
maze has under 1200 segments and this runs once per frame; measure before optimizing.

Keep the module pure: no imports from `maze.js`, no DOM. Tests build segment fixtures by hand and
also import `maze.js` for the realistic cases.

## Files touched

**Created:** `src/collision.js`, `tests/collision.test.js`.

**Modified:** `SPEC.md`, `changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; the tunneling case in particular was observed **red** before sub-stepping was
  implemented. If that test passes on the first write, the test is wrong.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(collision): add swept circle collision against wall segments
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 03 - Swept circle collision - <date> <time> EDT` with Added / Changed / Deleted.
