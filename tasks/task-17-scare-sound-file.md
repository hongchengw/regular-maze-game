# Task 17 - The scare sound is the supplied file

**Depends on:** 16. **Unblocks:** nothing. The largest of the three.

## Goal

When this is done the scare plays `assets/regular_sound.mp3`, in sync with the image, at a volume
that cannot hurt anyone, and the four-layer synthesized scream is gone.

This reverses a decision from `tasks/README.md`. See the second "Decisions changed after QA" table
there. The synthesis was never the point: it was a stand-in for a real sound in a repo that had no
asset pipeline for audio, and there is now a real sound.

**The mp3, from its header:** MPEG-1 Layer III, 192 kbps CBR, 44.1 kHz stereo, 116,120 bytes,
**4.83 seconds**. It sits inside the 6-second image with just over a second of silent image after it.

## Spec first

Already written. `SPEC.md` section 12 carries the sample design, the decode-on-unlock rule, the
`PEAK_GAIN` ceiling, and `SCREAM_DURATION` as a ceiling rather than a length. Section 4 carries both
assets and the bundle size. Section 3 records why the CSP needs no `media-src`. Verify the code
matches; do not re-author them.

## The decision this task exists to implement carefully

An `<audio src="data:audio/mpeg;base64,...">` would be fewer lines, and it would also be the only
thing in the app that loads a resource. It would need `media-src data:` added to the bundle's CSP,
which is a policy that currently exists to permit exactly nothing.

Decode through Web Audio instead: `atob` the payload out of the inlined string, copy it into a
`Uint8Array`, and hand the buffer to `ctx.decodeAudioData`. Three things then stay true for free.

- The CSP needs no new directive.
- No `fetch` and no `XMLHttpRequest` appear anywhere, so the never-networks invariant in `SPEC.md`
  section 14 is untouched. `tests/integration.test.js` fails the build if either appears.
- The sound is gated behind the same unlocked `AudioContext` the ambient music already uses, so iOS
  Safari's gesture rule is satisfied by the START click that already satisfies it for the music.

## Failing tests first

Expected red run: `ERR_MODULE_NOT_FOUND` on `decodeScream`, then the bundle case failing because no
audio data URI is emitted.

Extend the hand-written fake context in `tests/audio.test.js` with `decodeAudioData` and give
`createBufferSource` a recorded `buffer` property. Do not install a Web Audio mock; the repo has zero
dependencies. The `audioPath` and `pathGains` helpers added in task 15 are what the gain assertions
should reuse.

| Test case | Assertion |
| --- | --- |
| `the sound is decoded once, on the gesture` | Two `unlock()` calls and two `playScream()` calls produce exactly one `decodeAudioData`. Decoding per scare would stall the one frame that must not stall. |
| `the scare plays the decoded buffer` | The `BufferSource` created by `playScream` carries the buffer `decodeAudioData` returned, not a buffer built in code. |
| `the sound cannot outlive the image` | The source's scheduled `stop` is at or before `startTime + SCREAM_DURATION`, and `SCREAM_DURATION < SCARE_DURATION`. This is the guard that makes swapping in a longer file safe. |
| `the scare is capped at PEAK_GAIN` | No gain on the path to the destination is ever scheduled above `PEAK_GAIN`. Reuses `pathGains`, so a modulation depth is correctly excluded. This is the ear-safety assertion and it must not be a comment. |
| `a limiter sits before the destination` | Already exists. Must still pass: the `DynamicsCompressor` is still the last node. |
| `the scare synthesizes nothing` | `playScream` creates no oscillators at all. After this task the only oscillators in the app are the ambient music's, and this case is what stops the synthesis creeping back. |
| `a failed decode never blocks the image` | `decodeAudioData` rejecting leaves `playScream` throwing nothing, and the jumpscare still shows. Same rule as a missing `AudioContext`. |
| `music still stops before the sound` | Already exists from task 15, including its source scan of `showPhase`. Must still pass unchanged: the ordering rule does not care what the sound is. |

In `tests/build.test.js`:

| Test case | Assertion |
| --- | --- |
| `output inlines the scare sound` | The bundle contains `data:audio/mpeg;base64,` and the decoded bytes equal `assets/regular_sound.mp3` on disk, both in length and content. Mirrors the existing image case exactly. |
| `the media type follows the asset extension` | Already exists. Extend with `.mp3`, `.ogg`, `.wav`, and `.m4a`. The `.tiff` case must still fail the build. |
| `bundle makes no network requests` | Already exists. Must still pass: no `fetch(`, no `XMLHttpRequest`, no `http://` or `https://`. |
| `bundle carries a content security policy matching what it ships` | Already exists. Must still pass, with no `media-src` in the policy. The hashes are computed over the shipped text, so the added base64 is covered automatically. |

**Deleted with the synthesis:** `SCREAM_DURATION is exactly 4`, `buildScream schedules every layer`,
`every scheduled node stops by the duration`, and `nothing is scheduled before the start time`.
`master gain is capped` is superseded by `the scare is capped at PEAK_GAIN`; keep whichever name
reads better, but keep exactly one of them.

## Implementation outline

**`assets/regular_sound.mp3`** is committed by this task. It is currently untracked. Confirm it is
not caught by `.gitignore` before committing.

**`build/build.js`**

- `MEDIA_TYPES` gains `.mp3` to `audio/mpeg`, `.ogg` to `audio/ogg`, `.wav` to `audio/wav`, and
  `.m4a` to `audio/mp4`. `mimeFor`'s error message widens from "unknown image type" to cover any
  asset, since it now serves both.
- `build()` gains a `soundFile` option defaulting to `assets/regular_sound.mp3`, and fills a new
  `__ASSET_SCREAM__` placeholder the same way `__ASSET_JUMPSCARE__` is filled. Use the function form
  of `replace` for it as well: a base64 payload containing `$&` would otherwise be mangled.

**`src/index.html`**: `const SCREAM_SRC = "__ASSET_SCREAM__";` beside the existing `JUMPSCARE_SRC`.

**`src/audio.js`**

```js
export const SCREAM_DURATION = 5.0;                 // a ceiling, not the file's length
export function decodeScream(ctx, dataUri)          // -> Promise<AudioBuffer>
export function buildScream(ctx, buffer, startTime) // -> the scheduled source
```

- Delete `buildScream`'s four layers, `noiseBuffer`, `NOISE_SECONDS`, and the `noiseBuffers`
  `WeakMap`. Keep the exported name `buildScream`: `tests/build.test.js` pins it as this module's
  symbol, and the module's job has not changed even though its contents have.
- `buildScream` wires `BufferSource -> gain(PEAK_GAIN) -> DynamicsCompressor -> destination`, starts
  at `startTime`, and stops at `startTime + SCREAM_DURATION`.
- `createAudio(AudioContextCtor, dataUri)` keeps its shape. `unlock()` kicks off the decode once and
  caches the resulting buffer; `playScream()` plays the cached buffer if it is there and does nothing
  if it is not. Decoding takes milliseconds and the player is minutes from the scare, so "not there"
  means a decode that failed, which is the graceful-degradation path and not a race worth engineering
  around.
- Everything stays inside `try/catch` as it is today. Audio must never throw into the animation loop.
- The ambient music from task 15 is untouched, including `showPhase` stopping it before
  `jumpscare.show()` schedules the sound.

**`src/main.js`**: pass `SCREAM_SRC` into `createAudio`.

## Files touched

**Added:** `assets/regular_sound.mp3` (committed, 113 KB).

**Modified:** `src/audio.js`, `src/main.js`, `src/index.html`, `build/build.js`,
`tests/audio.test.js`, `tests/build.test.js`, `changelogs/CHANGELOGS.md`, `dist/index.html`
(rebuild).

**Never touched:** `README.md`, `src/game.js`, `vercel.json`.

## Done criteria

- `npm test` passes; the decode and cap cases were observed red first.
- `node build/build.js` succeeds. `dist/index.html` grows from roughly 53 KB to roughly 208 KB, which
  is expected and is recorded in `SPEC.md` section 4. Commit the rebuilt bundle.
- The bundle test that pins every `src/*.js` module still passes; no module was added or dropped.
- By hand, **with the system volume turned down first**: finish HARD and the supplied sound plays
  with the image, ends before the image does, and is loud without being painful. Then raise the
  volume to normal and confirm it is startling rather than damaging.
- By hand: open `dist/index.html` from the filesystem with the Network tab open. The only entry is
  the document itself, and no console error mentions the Content-Security-Policy.
- On iOS Safari, confirm the sound plays at all. It is subject to the same gesture rule as the music
  and starts from the same unlocked context, so if the music works this should, but it is the one
  platform where audio silently does nothing.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(audio): play the supplied scare sound instead of a synthesized scream
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 17 - Supplied scare sound - <date> <time> EDT` with Added / Changed / Deleted. Note
the bundle size change and that the synthesized scream was deleted.
