# Task 09 - Fullscreen jumpscare overlay and return to title

**Depends on:** 05, 08. **Unblocks:** 10.

## Goal

When this is done, reaching the exit puts the user-supplied image across the entire screen for
exactly 10 seconds with the 4-second scream, with absolutely nothing else visible, and then the app
is instantly back at the START screen with all state discarded.

## Spec first

Fill in the `SPEC.md` **Jumpscare** section. These requirements are exact; the user was specific.

- The image is `assets/jumpscare.png`, **supplied by the user**, inlined into `dist/index.html` as a
  base64 data URI. The committed placeholder is swapped by replacing the file and rerunning
  `node build/build.js`.
- It covers the **entire screen**: fixed position, full viewport, `object-fit: cover`, black behind it
  so any aspect-ratio letterboxing reads as black rather than page background.
- Duration is exactly **10 seconds**, then the overlay is removed and the app is at the title screen
  **instantly**. No fade out, no transition, no intermediate screen.
- **No flashes.** The image appears once and holds perfectly still. No strobing, no shaking, no
  jitter, no opacity animation, no scale animation, no filter animation, nothing that could trigger a
  photosensitive reaction. This is a hard requirement, not a stylistic preference.
- **No other UI.** While the scare is up: no text, no buttons, no D-pad, no canvas, no cursor. The
  overlay sits above everything, and every other screen element is hidden, not merely covered.
- **There is no "YOU GOT PRANKED" screen and no PLAY AGAIN button.** The original brief had one; it is
  removed. The app returns straight to the title screen, whose existing START button is the replay
  path.
- The scream starts with the image and runs 4 seconds, leaving 6 seconds of silent image.
- Nothing is persisted. After the return to title the app is byte-for-byte in its initial state.
- The title screen's warning text ("WARNING: Not suitable for those sensitive to sudden sounds or
  visuals.") is the user's only forewarning and must never be removed.

## Failing tests first

The overlay is DOM, but the timing contract is pure and is the part that can actually break. Write
`tests/jumpscare.test.js` first (expect `ERR_MODULE_NOT_FOUND`).

| Test case | Assertion |
| --- | --- |
| `SCARE_DURATION is exactly 10` | The constant exported from `game.js` is `10`. |
| `scream ends well before the image` | `SCARE_DURATION - SCREAM_DURATION === 6`, so the silent tail is intentional and asserted rather than incidental. |
| `phase leaves scare exactly at the duration` | Driving `game.step` in `dt` slices, the phase is still `scare` at `9.999` and is `title` at `10.0`. Boundary asserted from both sides. |
| `returning to title discards all state` | The post-scare state deep-equals `createGame()`, proving nothing leaks: no maze, no hits, no level, no seed. |
| `scare cannot be re-entered from title` | Stepping the returned title state with a movement input never re-enters `scare`. |
| `no animation properties in the stylesheet` | Read `src/styles.css` and assert the `.jumpscare` rules contain no `animation`, no `transition`, and no `@keyframes` reference. This is the no-flashes guard, enforced mechanically so a future style tweak cannot quietly reintroduce strobing. |
| `overlay markup has no text content` | Read `src/index.html` and assert the jumpscare overlay element contains only an `<img>`, no text nodes and no `<button>`. This is the no-other-UI guard. |

The last two read source files as text rather than exercising a DOM. That is deliberate: they encode
requirements that are stated as absolutes, so they should fail the build if violated rather than rely
on someone re-reading the spec.

## Implementation outline

```js
export function createJumpscare(overlayEl, imgEl, audio, onFinish)
// -> { show(), hide() }
```

- `show()`: set `imgEl.src = JUMPSCARE_SRC` (the build-inlined constant) if not already set, add the
  `visible` class to `overlayEl`, set `document.body.dataset.phase = 'scare'`, and call
  `audio.playScream()`.
- Preload: set `imgEl.src` at app startup, not on `show()`. A data URI decodes fast but not
  instantly, and a blank first frame would deflate the scare. Because it is a data URI there is no
  network request either way.
- `hide()`: remove the `visible` class. Called when the phase leaves `scare`.
- **The 10-second timing is owned by `game.step`, not by a `setTimeout` here.** The main loop already
  advances `scareElapsed`, so the overlay is purely a function of `state.phase`. One clock, no drift,
  no orphaned timer if something else changes phase.
- `onFinish` is not a timer callback; it is whatever `main.js` does when it observes the phase flip
  back to `title` (reset the input's held set, clear the canvas).

**`src/styles.css`**

```css
.jumpscare { position: fixed; inset: 0; background: #000; display: none; z-index: 9999; }
.jumpscare.visible { display: block; }
.jumpscare img { width: 100%; height: 100%; object-fit: cover; display: block; }
```

No `transition`, no `animation`, no `opacity` ramp. Also hide the cursor
(`body[data-phase="scare"] { cursor: none; }`) and hide every other screen element via the phase
attribute so nothing peeks out at the edges.

**`src/index.html`** - the overlay element containing exactly one `<img alt="">`. Empty `alt` is
correct: it is decorative in the accessibility tree and there is no useful text to give a screen
reader here.

## Files touched

**Created:** `src/jumpscare.js`, `tests/jumpscare.test.js`.

**Modified:** `src/index.html`, `src/styles.css`, `SPEC.md`, `changelogs/CHANGELOGS.md`,
`dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; every case observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- Manual check, timed with a stopwatch: image appears the instant the exit is reached, fills the whole
  screen with no white edges and no scrollbars, holds perfectly still for 10 seconds, the sound stops
  at about 4, and at 10 the title screen is back with the START button working again.
- Manual check that nothing else is visible during the scare: no D-pad on mobile, no canvas edge, no
  cursor, no text.
- Manual check on a phone in both orientations that the image still covers fully.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(jumpscare): add fullscreen overlay and return to title
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 09 - Fullscreen jumpscare overlay - <date> <time> EDT` with
Added / Changed / Deleted.
