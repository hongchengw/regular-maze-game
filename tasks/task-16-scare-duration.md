# Task 16 - The scare holds for six seconds

**Depends on:** 15. **Unblocks:** 17, whose assertions about the sound fitting inside the image are
written against the final duration.

## Goal

When this is done the jumpscare image holds for 6 seconds rather than 10, then the app is back at the
title screen instantly, exactly as before.

This reverses a decision from `tasks/README.md`. See the second "Decisions changed after QA" table
there. The original reasoning, that a long still image is more unsettling than a short one, held only
up to a point: ten seconds stops being frightening and starts being a wait.

## Spec first

Already written. `SPEC.md` section 9 carries the new diagram and constants line, section 13 the new
duration, and section 1 the overview. Verify the code matches; do not re-author them.

## Failing tests first

The change is one number. Everything interesting is in the tests that currently pin the old one, and
they are spread across two files.

Expected red run: the pinned case fails on 10 against 6.

| Test case | Assertion |
| --- | --- |
| `SCARE_DURATION is exactly 6` | In `tests/jumpscare.test.js`, `SCARE_DURATION === 6`. **This is the only place the number 6 appears in the suite.** |
| `the image outlasts the sound` | Replaces `scream ends well before the image`, which pinned the gap at exactly 6. Now an inequality: `SCREAM_DURATION < SCARE_DURATION`, with the margin stated in the message rather than asserted as an equality that a retune of either constant breaks. |
| `phase leaves scare exactly at the duration` | Already exists. The literal `9.999` becomes `SCARE_DURATION - 0.001`, so the case reads the same at any duration. Still asserted from both sides. |
| `scare to title after the full duration` | Renamed from `scare to title after 10s` in `tests/game.test.js`. Both `9.9` literals become expressions over `SCARE_DURATION`, for example `SCARE_DURATION - 0.1`. |
| `the overlay is a function of phase, not of a timer` | Already exists. Only its message mentions "the 10s clock"; reword it. |

**The rule for this task:** exactly one test states the number, every other case derives from
`SCARE_DURATION`. The next retune is then one line in `src/game.js` and one line in the suite. This
is the pattern task 12 used for the fog table, and the reason task 12 needed a pinned case at all.

`tests/integration.test.js` already derives its frame counts from `SCARE_DURATION` and needs no
change. Confirm rather than assume.

## Implementation outline

**`src/game.js`**: `SCARE_DURATION` from 10 to 6.

Nothing else. In particular `SCREAM_DURATION` stays at 4.0 in this task, so the invariant
`SCREAM_DURATION < SCARE_DURATION` still holds at 4 against 6 with the synthesized scream still in
place. Task 17 is what changes the sound.

## Files touched

**Modified:** `src/game.js`, `tests/game.test.js`, `tests/jumpscare.test.js`,
`changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; the pinned case was observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- Grep the suite for the literal `10` in a duration context and for `9.9`: neither should survive.
- By hand: finish HARD and count. The image is up for about six seconds, and the return to the title
  screen is still instant with no fade.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(jumpscare): hold the image for six seconds
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 16 - Six second scare - <date> <time> EDT` with Added / Changed / Deleted.
