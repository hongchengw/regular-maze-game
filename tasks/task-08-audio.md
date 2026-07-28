# Task 08 - Synthesized 4-second scream

**Depends on:** 01. **Unblocks:** 09.

## Goal

When this is done, `src/audio.js` can unlock an `AudioContext` on the START click and play a
4-second synthesized scream on demand. No audio file ships, so `dist/index.html` stays small and the
scare is exactly 4 seconds by construction rather than by however long a sourced clip happens to run.

## Spec first

Fill in the `SPEC.md` **Audio** section.

- The scare sound is **synthesized with the Web Audio API**. No audio file, no base64 audio blob.
- Duration is exactly **4.0 seconds**, ending in silence, while the jumpscare image stays up for 10
  seconds. The last 6 seconds are deliberately silent: the image lingering in silence is more
  unsettling than a looping noise, and it guarantees no ear fatigue.
- Peak output is capped by a master gain so the result is startling but not damaging. Target roughly
  `-6 dBFS` peak, with a hard `DynamicsCompressor` before the destination as a safety limiter.
- The `AudioContext` is created **inside the START click handler**. Browsers block audio started
  outside a user gesture, so without this the scare would be silent, which would break the entire
  point of the app.
- If the Web Audio API is unavailable or the context fails to resume, the visual scare still runs.
  Audio failure never blocks the jumpscare or throws into the animation loop.
- No audio plays at any other time. The title, select, and gameplay screens are silent, and there is
  no sound on a wall hit. Silence during play is what makes the scare land.

## Sound design

Four layers over 4 seconds, all scheduled at once, no timers:

| Layer | Description | Envelope |
| --- | --- | --- |
| Impact | Short white-noise burst through a lowpass sweeping 8 kHz down to 200 Hz | 0 to 0.25s, sharp attack |
| Scream body | Two `sawtooth` oscillators detuned about 15 cents, frequency gliding 1200 Hz down to 180 Hz | 0.02s attack, hold to 2.8s, decay to 3.4s |
| Grit | Bandpass-filtered white noise tracking the scream's pitch | Follows the scream, lower gain |
| Sub | Sine at 55 Hz for chest weight | 0 to 1.2s, slow decay |

A tiny convolver with a procedurally generated 1.5s noise impulse response adds a tail. If that feels
like overreach when implementing, drop the convolver rather than adding an asset; it is the one
optional layer.

## Failing tests first

The Web Audio API does not exist in Node and the project has no polyfill, so this module gets a pure
scheduling seam. Write `tests/audio.test.js` first (expect `ERR_MODULE_NOT_FOUND`).

| Test case | Assertion |
| --- | --- |
| `SCREAM_DURATION is exactly 4` | The exported constant is `4.0`, matching the spec. |
| `scream duration is shorter than the scare` | `SCREAM_DURATION < SCARE_DURATION` imported from `game.js`, so the image outlasts the sound. This guards the 4s-versus-10s relationship against a future retune of either number. |
| `buildScream schedules every layer` | `buildScream(fakeCtx, 0)` against a hand-written fake context records at least one node per layer: noise buffer source, two sawtooth oscillators, a sub sine, and filters. |
| `every scheduled node stops by the duration` | No `stop()` time recorded by the fake exceeds `startTime + SCREAM_DURATION`. Nothing may outlive the 4s window. |
| `nothing is scheduled before the start time` | No recorded `start()` or ramp time is earlier than `startTime`. |
| `master gain is capped` | The peak gain value scheduled on the master node is at most `PEAK_GAIN`, and `PEAK_GAIN <= 0.5`. This is the do-not-hurt-anyone guard. |
| `a limiter sits before the destination` | The fake context records a `DynamicsCompressor` connected to `destination`. |
| `missing AudioContext degrades gracefully` | `createAudio(undefined)` returns an object whose `playScream()` is a no-op and does not throw. |

The fake context is a small hand-written object recording calls, roughly 40 lines in the test file.
Do not install a Web Audio mock package; the repo has zero dependencies.

## Implementation outline

```js
export const SCREAM_DURATION = 4.0;
export const PEAK_GAIN = 0.45;

export function buildScream(ctx, startTime)  // pure-ish: only schedules, returns node list
export function createAudio(AudioContextCtor)  // -> { unlock(), playScream(), available }
```

- `createAudio` is passed the constructor so tests can inject a fake or `undefined`. `main.js` passes
  `window.AudioContext || window.webkitAudioContext`.
- `unlock()` constructs the context if needed and calls `resume()`. Called from the START click
  handler. Safe to call repeatedly.
- `playScream()` calls `buildScream(ctx, ctx.currentTime + 0.01)`. Wrap the whole body in a
  `try/catch` that swallows and logs, honouring the graceful-degradation rule.
- Noise buffers are generated once and reused, not regenerated per play.
- Nothing in this module reads game state or touches the DOM.

## Files touched

**Created:** `src/audio.js`, `tests/audio.test.js`.

**Modified:** `SPEC.md`, `changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; every case observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- Manual listen at moderate system volume: it is startling, it does not clip or crackle, it is over at
  4 seconds, and it leaves silence rather than a hanging drone. Turn the volume down before the first
  listen.
- Manual check that the sound plays at all on iOS Safari, which is the strictest about the gesture
  requirement.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(audio): add synthesized four-second scream
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 08 - Synthesized scream - <date> <time> EDT` with Added / Changed / Deleted.
