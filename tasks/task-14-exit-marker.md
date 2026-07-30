# Task 14 - Mark the exit with a pulsing marker

**Depends on:** 13. **Unblocks:** nothing.

## Goal

When this is done the player can tell they have found the end. The exit carries a slowly pulsing
marker in a distinct colour, drawn inside the fog so it is invisible until they are close to it.

This reverses a decision from `tasks/README.md`, and the replacement is deliberately narrow: the
original reasoning, that marking the exit leaks the goal through the fog, is answered by drawing the
marker inside the fog clip rather than by dropping the concern.

## Spec first

Already written. `SPEC.md` section 10 describes the marker, the reveal distance, the pulse bounds,
and the interaction with the frame-skip. Section 14 replaces the old "no exit marker" absolute with
"the exit is never visible from outside the fog radius". Verify the code matches; do not re-author.

Note that `SPEC.md` section 13's no-animation and no-flash rules are about the jumpscare and are
untouched by this task. The pulse must still be gentle: slow, low-contrast, never a strobe.

## Failing tests first

The drawing itself is the untested DOM edge, as in task 06, so the seam is a pure pulse helper plus
the visibility rule. Add to `tests/render.test.js`.

Expected red run: `ERR_MODULE_NOT_FOUND` on the import until the helper exists, then behavioural
failures on its bounds once it is stubbed.

| Test case | Assertion |
| --- | --- |
| `exitPulse stays within gentle bounds` | For 1000 samples across several periods, the returned factor is within `[0, 1]` and never leaves the documented alpha range when applied. No value ever reaches full transparency, so the marker never blinks out. |
| `exitPulse is periodic` | `exitPulse(t)` and `exitPulse(t + PULSE_PERIOD)` are equal within floating-point tolerance. |
| `exitPulse is continuous` | Between adjacent samples one millisecond apart, the change is small. This is the anti-strobe guard: a fast or discontinuous pulse fails it. |
| `the marker is hidden beyond the fog` | A pure predicate, for example `exitVisible(pos, exit, fogRadius)`, is false when the blob is further from the exit than `fogRadius` and true when it is nearer. This is the invariant from `SPEC.md` section 14 asserted mechanically. |
| `the marker colour is not wall white` | The exported marker colour is not `#fff`, so it cannot be mistaken for a wall. |

## Implementation outline

**`src/render.js`**

```js
export const PULSE_PERIOD = 1400;      // ms
export const EXIT_COLOR = '#ffb300';   // amber, deliberately not wall white
export function exitPulse(timeMs)                       // -> 0..1
export function exitVisible(pos, exit, fogRadiusCells)  // -> boolean
```

- `exitPulse` is a sine mapped to `[0, 1]`. Drive alpha between roughly 0.55 and 1, and the radius
  between roughly 0.9 and 1.15 of the base marker radius. Keep both ranges narrow.
- Draw the marker inside the existing fog clip, before the fog fade is painted, so the fade dims it
  at the edge of the disc exactly as it dims the walls. Do not draw it after the fade or it will
  glow through the darkness.
- Base radius around `exitRadius * scale`, so the marker is the size of the region that actually
  triggers the win.
- `draw` gains a time argument: `draw(state, timeMs)`. `src/main.js` already receives the
  `requestAnimationFrame` timestamp and passes it straight through.
- **The frame-skip must not freeze the pulse.** The skip condition added in the performance pass
  becomes "nothing moved, nothing resized, **and** the marker is not currently visible". Use
  `exitVisible` for that third term so there is one rule and one code path.

## Files touched

**Modified:** `src/render.js`, `src/main.js`, `tests/render.test.js`, `changelogs/CHANGELOGS.md`,
`dist/index.html` (rebuild).

**Never touched:** `README.md`, `src/game.js`.

## Done criteria

- `npm test` passes; the bounds and visibility cases were observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- By hand: the marker is invisible from across the maze at every difficulty, appears as the fog
  reaches it, and pulses slowly rather than blinking. Confirm at HARD, where the fog is tightest.
- Watch the idle frame cost: standing still away from the exit must still skip frames, and standing
  still next to it must not.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(render): mark the exit with a pulsing marker
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 14 - Pulsing exit marker - <date> <time> EDT` with Added / Changed / Deleted.
