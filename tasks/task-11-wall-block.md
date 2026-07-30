# Task 11 - Walls block and slide instead of resetting to the start

**Depends on:** 10. **Unblocks:** nothing, but makes every later task pleasanter to test by hand.

## Goal

When this is done, touching a wall costs the player nothing but their momentum on the blocked axis.
The blob stops against the wall, keeps moving on the other axis so it slides along it, and is never
teleported back to the start cell.

This reverses a decision from `tasks/README.md`. See the "Decisions changed after QA" table there for
what changed and why. The original reasoning, that a reset preserves the mental map, is moot once
there is no reset.

## Spec first

Already written. `SPEC.md` section 9 describes wall contact blocking per axis, `hits` as a count of
blocked frames, and the per-axis sweep under "Movement rules". Section 7 records that
`src/collision.js` is unchanged and that sliding is the game layer's business. Verify the code
matches those, do not re-author them.

## Failing tests first

Rewrite the four cases in `tests/game.test.js` whose subject no longer exists: `wall hit resets to
start`, `wall hit preserves the maze`, `wall hit increments the counter`, and `large dt does not
tunnel`. Also rewrite `wall hits do not change the layout mid-run` in `tests/integration.test.js`.

Expected red run: with the existing reset implementation, the sliding cases fail because `pos`
equals `start` after contact.

| Test case | Assertion |
| --- | --- |
| `a wall never sends the blob back to the start` | Drive straight into the outer border for many frames. `pos` is never equal to `start` after the first frame, and is up against the wall. |
| `a blocked axis still moves on the other` | Against a vertical wall, holding `{dx: -1, dy: 1}` from a position where left is blocked leaves `x` unchanged within tolerance while `y` increases by roughly `speed * dt`. This is the sliding case and is the core of the task. |
| `a head-on press moves on neither axis` | Holding `{dx: -1, dy: 0}` into that same wall leaves both `x` and `y` unchanged. |
| `sliding cannot tunnel` | With `speed` raised to 100 in a copied state, one clamped frame pressed diagonally into a corner ends inside the maze, wall-free per `hitsWall`, never on the far side. This is the guard that per-axis sweeping did not weaken collision. |
| `the maze survives contact` | `segments`, `seed`, `levelName`, and `maze` deep-equal their pre-contact values. |
| `hits counts blocked frames` | `hits` increases while pressed into a wall and does not increase on a clear frame. |
| `contact changes no phase` | The phase is still `playing` after sustained contact. |

## Implementation outline

**`src/game.js`**, in `stepPlaying`, replacing the `move.hit` branch:

```js
const slidX = sweep(pos,       { x: pos.x + vx,      y: pos.y },           r, segments, halfThickness);
const slidY = sweep(slidX.pos, { x: slidX.pos.x,     y: slidX.pos.y + vy }, r, segments, halfThickness);
```

- `vx` and `vy` are the normalized direction times `speed * dt`, exactly as today.
- The new position is `slidY.pos`. `hits` increments when `slidX.hit || slidY.hit`.
- Nothing else changes: the exit check still runs after the move on the post-move position.
- `src/collision.js` is **not** touched. `sweep` already returns the last clear position, which is
  precisely the blocked-but-not-teleported position this needs.

Order matters slightly: sweeping x then y means a diagonal into a corner resolves x first. That is
fine and worth a comment, but do not add a second pass to "fix" it, since the difference is
sub-pixel at these speeds.

## Files touched

**Modified:** `src/game.js`, `tests/game.test.js`, `tests/integration.test.js`,
`changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild).

**Never touched:** `README.md`, `src/collision.js`.

## Done criteria

- `npm test` passes; the sliding case was observed red first against the reset implementation.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- By hand: scrape along a wall and the blob glides down it rather than stopping or restarting.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(game): block on walls and slide instead of resetting
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 11 - Walls block and slide - <date> <time> EDT` with Added / Changed / Deleted.
