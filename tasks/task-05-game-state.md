# Task 05 - Game phase machine, movement, reset, and exit detection

**Depends on:** 02, 03, 04. **Unblocks:** 06, 07, 09.

## Goal

When this is done, `src/game.js` holds the entire game as pure functions over a plain state object:
phase transitions, per-frame movement, reset-to-start on a wall hit, and exit detection. Nothing in
this module knows about the DOM, canvas, audio, or time-of-day; it receives `dt` and an input vector
and returns the next state. That is what makes the whole game testable in plain Node.

## Spec first

Fill in the `SPEC.md` **Game phases** section.

Phases and transitions:

```
title --START pressed--> select --level chosen--> playing --exit reached--> scare --after 10s--> title
                                                    ^                                             |
                                                    +---------- wall hit: pos = start ------------+
```

- `title`: black screen, warning text, START button. No game state exists yet.
- `select`: EASY / MEDIUM / HARD buttons in `LEVELS` order. Choosing one generates a maze from a
  fresh seed and enters `playing`.
- `playing`: the blob starts at the centre of cell `(0, 0)`. It glides at `speed` cells per second
  in the held direction. Movement is resolved by `sweep`.
- **Wall hit:** the blob's position resets to the start cell centre. **The maze layout is unchanged**
  and the seed is not regenerated, so the player keeps the mental map they built. The hit count is
  tracked in state for possible display but is not shown by default.
- **Exit reached:** when the blob centre is within `exitRadius` of the centre of cell
  `(cols - 1, rows - 1)`, the phase becomes `scare` immediately. There is no win screen, no delay,
  and no sound cue before the scare.
- `scare`: lasts exactly 10 seconds, then the phase becomes `title` and all game state is discarded.
  Nothing is persisted anywhere, ever: no `localStorage`, no cookies, no scores.
- Input is ignored in every phase except `playing`.

## Failing tests first

Write `tests/game.test.js` before `src/game.js` exists. Expected red run: `ERR_MODULE_NOT_FOUND`.

**Phase transitions**

| Test case | Assertion |
| --- | --- |
| `starts at title` | `createGame().phase === 'title'` and there is no maze. |
| `title to select` | `pressStart(state).phase === 'select'`. |
| `select to playing` | `startLevel(state, 'MEDIUM', 7).phase === 'playing'`, and the maze has MEDIUM's dimensions. |
| `invalid level rejected` | `startLevel(state, 'NIGHTMARE', 1)` throws. |
| `scare to title after 10s` | Stepping the scare phase with `dt` summing to `9.9` stays `scare`; crossing `10.0` becomes `title`. |
| `title after scare has no maze` | The returned state has no maze, no blob position, and no level. |
| `input ignored outside playing` | Stepping `title`, `select`, and `scare` with a full-speed input vector never changes any position. |

**Movement**

| Test case | Assertion |
| --- | --- |
| `glides at the level speed` | One second of `{dx: 1, dy: 0}` in an open corridor moves exactly `speed` cells, within floating-point tolerance. |
| `diagonals are normalized` | `{dx: 1, dy: 1}` for one second moves `speed` cells of total distance, not `speed * sqrt(2)`. |
| `no input means no movement` | `{dx: 0, dy: 0}` leaves the position identical. |
| `movement is frame-rate independent` | Two steps of `dt = 0.5` land in the same place as one step of `dt = 1.0` (open corridor, tolerance-based). |
| `large dt does not tunnel` | A single `dt = 2.0` step aimed straight down through several walls reports a hit rather than crossing them. |
| `dt is clamped` | A pathological `dt` (for example 5s after a background tab regains focus) is clamped to a maximum before use, so the blob cannot jump the maze. Assert the clamp constant is applied. |

**Reset and exit**

| Test case | Assertion |
| --- | --- |
| `wall hit resets to start` | After a hit, the position equals the centre of cell `(0,0)`. |
| `wall hit preserves the maze` | The `segments` array after a hit is the identical reference (or deep-equals) the one before, and the seed is unchanged. |
| `wall hit increments the counter` | `hits` goes from 0 to 1. |
| `exit within radius wins` | Placing the blob at the exit cell centre and stepping yields `phase === 'scare'`. |
| `exit just outside radius does not win` | A blob at `exitRadius + 0.01` from the exit centre stays in `playing`. |
| `reaching the exit does not require stopping` | A blob moving at full speed that passes within `exitRadius` triggers the scare on that same step. |
| `same seed gives the same maze` | `startLevel(s, 'HARD', 99)` twice produces deep-equal segment lists. |

## Implementation outline

**State shape** (plain data, no classes, safe to structured-clone):

```js
{ phase: 'title'|'select'|'playing'|'scare',
  levelName: null|'EASY'|'MEDIUM'|'HARD',
  level: null|<frozen difficulty entry>,
  seed: null|number,
  maze: null|{ cols, rows, passages },
  segments: null|[{x1,y1,x2,y2}],
  pos: null|{ x, y },
  start: null|{ x, y },
  exit: null|{ x, y },
  hits: 0,
  scareElapsed: 0 }
```

**API**

```js
export const MAX_DT = 0.05;        // seconds; clamp for background-tab catch-up
export const SCARE_DURATION = 10;  // seconds

export function createGame()
export function pressStart(state)
export function startLevel(state, levelName, seed)
export function step(state, dt, input)   // input = { dx, dy }
```

- `step` returns a **new** state object; never mutate the input. Keeping it immutable is what lets
  tests assert "before" and "after" side by side.
- Clamp `dt` to `MAX_DT` first thing.
- In `playing`: normalize `input` if its length exceeds 1, compute
  `to = pos + dir * speed * dt`, call `sweep(pos, to, blobRadius, segments, wallHalfThickness)`.
  On `hit`, set `pos = start` and `hits + 1`. Otherwise set `pos = result.pos`, then test the exit
  distance and flip to `scare` if inside `exitRadius`.
- In `scare`: accumulate `scareElapsed`; at or past `SCARE_DURATION`, return a fresh `createGame()`
  state so discarding everything is structural rather than a manual field-by-field reset.
- Exit check happens **after** the move, and on the post-move position, so a fast pass-through still
  registers. Note that a blob could in principle sweep past the exit inside one sub-step; with
  `exitRadius >= 0.25` and sub-steps of at most `blobRadius / 2 = 0.11`, that cannot happen. State
  that reasoning in `SPEC.md` so a future retune knows the constraint.

Imports: `maze.js`, `collision.js`, `difficulty.js`, `rng.js`. No DOM.

## Files touched

**Created:** `src/game.js`, `tests/game.test.js`.

**Modified:** `SPEC.md`, `changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; every case observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- `game.js` contains no reference to `document`, `window`, `Date`, or `performance`.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(game): add phase machine, movement, reset, and exit detection
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 05 - Game phase machine - <date> <time> EDT` with Added / Changed / Deleted.
