# Task 13 - Play the three levels in order, with a level-up beat

**Depends on:** 10. **Unblocks:** 14, 15.

## Goal

When this is done a play session is EASY, then MEDIUM, then HARD, then the jumpscare. The difficulty
select screen is gone, START begins EASY, and each completed level hands over through a one-second
`LEVEL n OF 3` beat so the player knows they progressed rather than glitched.

This is the largest of the QA changes: it reshapes the phase machine, so do it before tasks 14 and
15, which both attach to the phases it defines.

## Spec first

Already written. `SPEC.md` section 2 defines the `levelup` screen and records that no select screen
exists, section 9 carries the new machine, the derived-seed rule, `LEVELUP_DURATION`, and the state
shape with `levelIndex` and `levelupElapsed`. Verify the code matches; do not re-author.

## Failing tests first

Rewrite `select to playing` in `tests/game.test.js` and the per-level runs in
`tests/integration.test.js`, whose subject no longer exists.

Expected red run: `pressStart` still yields `select`, so every progression case fails on the phase.

| Test case | Assertion |
| --- | --- |
| `START begins EASY` | `pressStart(createGame(), 1).phase === 'playing'` and `levelName === 'EASY'`. There is no `select` phase anywhere in the machine. |
| `finishing EASY goes to levelup, not the scare` | Reaching the exit on EASY yields `phase === 'levelup'`, never `scare`. |
| `levelup advances to the next level` | After `LEVELUP_DURATION` of stepping, the phase is `playing`, `levelName` is `MEDIUM`, and `pos` is the new maze's start cell. |
| `levelup holds for its full duration` | Still `levelup` at `LEVELUP_DURATION - MAX_DT`, `playing` at `LEVELUP_DURATION`. Boundary asserted from both sides. |
| `only HARD fires the scare` | Reaching the exit on HARD yields `phase === 'scare'`. |
| `levelIndex tracks the order` | `levelIndex` is 0, 1, 2 across the run and matches `LEVELS.indexOf(levelName)` at every point. |
| `a run is reproducible from one seed` | Two runs from the same starting seed produce deep-equal `segments` for all three levels. This is what the derived seed buys, and it is what makes the integration playthrough assertable. |
| `each level gets a different maze` | The three levels' `segments` are not equal to each other, so the derivation is not returning the same seed. |
| `input is ignored during levelup` | Stepping `levelup` with a full-speed vector never changes `pos`. |
| `the module still knows nothing of the clock` | Existing source scan must still pass: no `Date`, `performance`, or `Math.random` in `src/game.js`. This is why the seed is derived rather than injected. |
| `a full run reaches the scare` | In `tests/integration.test.js`, one automated run walks all three mazes along their own solutions and ends in `scare`, replacing today's three independent per-level runs. |

## Implementation outline

**`src/game.js`**

```js
export const LEVELUP_DURATION = 1;
export function pressStart(state, seed)   // -> playing at LEVELS[0]
```

- `createGame()` gains `levelIndex: 0` and `levelupElapsed: 0`.
- `startLevel(state, levelName, seed)` stays exported and unchanged in signature. It sets
  `levelIndex` from `LEVELS.indexOf(levelName)`.
- On the exit being reached in `stepPlaying`: if `levelIndex + 1 < LEVELS.length`, return
  `{ phase: 'levelup', levelupElapsed: 0 }`; otherwise `{ phase: 'scare', scareElapsed: 0 }`.
- New `levelup` branch in `step`: accumulate `levelupElapsed`; at or past `LEVELUP_DURATION`, call
  `startLevel` for `LEVELS[levelIndex + 1]` with the derived seed.
- **Derive the next seed** rather than taking one: `Math.floor(mulberry32(state.seed)() * 2 ** 32)`,
  or any pure function of the current seed. `mulberry32` is already imported. Do not reach for
  `Date.now` or `Math.random`: a source scan in `tests/game.test.js` fails the build if you do, and
  the reproducible-run case above depends on this.

**`src/index.html`**: delete the `select` section. Add a `levelup` section holding one element for
the `LEVEL n OF 3` text.

**`src/styles.css`**: drop the `select` rules, add `body[data-phase='levelup'] [data-screen='levelup']`
to the visibility group. The D-pad's `playing`-only rule already hides it during `levelup`; confirm
rather than assume.

**`src/main.js`**: delete the `[data-level]` click handler. START calls `audio.unlock()` then
`pressStart(state, freshSeed())`. The level-up text is written from `state.levelIndex` when the phase
becomes `levelup`, in `showPhase`, alongside the existing overlay handling.

## Files touched

**Modified:** `src/game.js`, `src/main.js`, `src/index.html`, `src/styles.css`,
`tests/game.test.js`, `tests/integration.test.js`, `changelogs/CHANGELOGS.md`, `dist/index.html`
(rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; the progression cases were observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- The bundle test that pins every `src/*.js` module still passes; no module was added or dropped.
- By hand: START goes straight into a small maze, finishing it shows `LEVEL 2 OF 3` briefly, and the
  third exit fires the jumpscare.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(game): play the three levels in sequence with a level-up beat
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 13 - Sequential levels - <date> <time> EDT` with Added / Changed / Deleted. Note
that the difficulty select screen was deleted.
