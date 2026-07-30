# Task 15 - Very quiet ambient music during play

**Depends on:** 13. **Unblocks:** nothing. Ships the last of the QA changes.

## Goal

When this is done the maze has a quiet synthesized drone under it, at the edge of hearing, which
stops the instant the jumpscare begins.

This reverses a decision from `tasks/README.md`. The original reasoning, that silence during play is
what makes the scare land, is preserved by two constraints rather than discarded: the music is very
quiet, and it is cut **before** the scream is scheduled, so the scream still arrives into silence.

## Spec first

Already written. `SPEC.md` section 12 carries `MUSIC_GAIN`, the drone design, the phases it plays in,
the stop-before-scream rule, and the graceful-degradation rule. Verify the code matches; do not
re-author.

## Failing tests first

Extend `tests/audio.test.js`, reusing the hand-written fake context already there. Do not install a
Web Audio mock; the repo has zero dependencies.

Expected red run: `ERR_MODULE_NOT_FOUND` on the new exports, then behavioural failures against stubs.

| Test case | Assertion |
| --- | --- |
| `MUSIC_GAIN is very low` | `MUSIC_GAIN <= 0.06`, and `MUSIC_GAIN * 4 < PEAK_GAIN`, so the music can never approach the scream. This is the "barely there" guard. |
| `music schedules no gain above its cap` | Against the fake context, no gain value scheduled anywhere in the music graph exceeds `MUSIC_GAIN`. |
| `music runs without an end` | Nothing in the music graph schedules a `stop` at build time. It is a drone held until stopped, not a clip that has to be relaunched. |
| `starting twice does not stack` | Two `startMusic()` calls create one set of oscillators, not two. Doubling the voices would double the volume, which is exactly what must not happen. |
| `stopMusic stops everything it started` | After `stopMusic()`, every oscillator the music created has a recorded `stop`, and the gain was ramped down rather than set to zero in one step. |
| `stopMusic before the scream` | Driving the audio object through a scare, the music's `stop` is recorded at a time no later than the scream's first scheduled node. Asserted on the fake context's ordering, since this is the rule the whole scare depends on. |
| `music degrades without Web Audio` | `createAudio(undefined).startMusic()` and `.stopMusic()` do not throw. |
| `nothing plays before it is asked to` | Constructing the audio object schedules no nodes at all. Music starts only on `startMusic`. |

## Implementation outline

**`src/audio.js`**, extending the existing module rather than adding a new one, so the bundle's
module list and the build test that pins it are unchanged.

```js
export const MUSIC_GAIN = 0.05;
export function buildMusic(ctx)   // -> { nodes, gain } , schedules nothing that ends
```

`createAudio` gains `startMusic()` and `stopMusic()` alongside `unlock()` and `playScream()`.

- Two oscillators an octave or a fifth apart, detuned a few cents, low in the register, through a
  lowpass. Two slow LFOs, one on the filter frequency and one on the master music gain, so it
  breathes. There is no loop point because nothing loops: the oscillators simply run.
- `startMusic` is idempotent: keep the node set in a closure variable and return early if it exists.
- `stopMusic` ramps the music gain to near zero over roughly 0.3s, then calls `stop` on the
  oscillators shortly after. Ramping avoids the click that an abrupt stop produces.
- Both wrapped in `try/catch` like `playScream`, since audio must never throw into the animation
  loop.

**`src/main.js`**: in `showPhase`, start the music when entering `playing`, leave it running through
`levelup`, and stop it when entering `scare` **before** `jumpscare.show()` is called, since that is
what schedules the scream. Stop it on the return to `title` as well.

The ordering in `showPhase` is the whole point of the task. Write it so the stop cannot be reordered
after the scream by accident, and let the test above hold it in place.

## Files touched

**Modified:** `src/audio.js`, `src/main.js`, `tests/audio.test.js`, `changelogs/CHANGELOGS.md`,
`dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; the cap and ordering cases were observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- Manual listen at a normal system volume: the music is noticeable only if you attend to it, there is
  no audible loop point, and it is gone the moment the image appears. Turn the volume down before the
  first listen, since the scream follows.
- Manual check on iOS Safari that the music starts at all, since it is subject to the same gesture
  rule as the scream and starts from the same unlocked context.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(audio): add very quiet ambient music during play
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 15 - Ambient music - <date> <time> EDT` with Added / Changed / Deleted. Note that
this completes the QA changes from tasks 11 to 15.
