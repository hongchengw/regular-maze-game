# Task 12 - Widen the fog radius at every level

**Depends on:** 10. **Unblocks:** nothing.

## Goal

When this is done the player can see slightly more of the maze at every difficulty. This is a tuning
change and nothing else: no new code, no new function, three numbers.

## Spec first

Already written. `SPEC.md` section 8 carries the new table. Verify the code matches it number for
number; if they disagree, the spec wins and the code is the bug.

| Field | EASY | MEDIUM | HARD |
| --- | --- | --- | --- |
| `fogRadius` was | 2.2 | 1.6 | 1.1 |
| `fogRadius` is | **2.4** | **1.8** | **1.3** |

Nothing else in the table moves. The approximate pixel mapping in section 8 was updated to roughly
140 px, 68 px, and 32 px on a 900 px tall viewport.

## Failing tests first

`tests/difficulty.test.js` already asserts the invariants that matter, and they all still hold, so
this task's red run comes from a test that pins the actual values rather than only their ordering.

Expected red run: the pinned-values case fails on 2.2 versus 2.4.

| Test case | Assertion |
| --- | --- |
| `fog radius matches the spec table` | `fogRadius` is exactly 2.4, 1.8, and 1.3. A pinned value, so a retune cannot happen silently without the spec being updated in the same commit. |
| `fog radius decreases with difficulty` | Already exists. Must still pass: 2.4 > 1.8 > 1.3. |
| `fog is wide enough to see a corridor` | Already exists. Must still pass: `fogRadius > blobRadius * 2` at every level, tightest at HARD with 1.3 against 0.44. |
| `a wider fog does not reveal the exit early` | For each level, `fogRadius` is less than the maze's diagonal by a wide margin, so widening never makes the exit visible from the start cell. Guards the invariant in `SPEC.md` section 14. |

The last case is the one worth thinking about: the point of the change is visibility, and the point
of the game is that the exit is not visible. It bounds one against the other.

## Implementation outline

**`src/difficulty.js`**: three numbers in the frozen `DIFFICULTY` table.

Nothing else. Do not adjust `blobRadius`, `speed`, or `exitRadius` to compensate. If the game then
feels too easy, that is a separate tuning decision with its own spec change.

## Files touched

**Modified:** `src/difficulty.js`, `tests/difficulty.test.js`, `changelogs/CHANGELOGS.md`,
`dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; the pinned-values case was observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- By hand at HARD: the visible disc is noticeably but not dramatically larger, and the maze is still
  navigated mostly blind.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(difficulty): widen the fog radius at every level
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 12 - Wider fog radius - <date> <time> EDT` with Added / Changed / Deleted.
