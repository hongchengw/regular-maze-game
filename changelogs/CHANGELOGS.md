# Changelog

Newest first. One entry per completed task.

## Task 18 - Full-screen scare image - 2026-07-30 06:02 AM EDT

**This completes the second round of QA changes, tasks 16 to 18.** The whole jumpscare image is now
on screen, stretched to the viewport, with nothing cropped away.

**Added**
- `tests/jumpscare.test.js`: two cases. The `.jumpscare img` rule declares `object-fit: fill` with
  full width and height, and it declares neither `cover` nor `contain`, since one crops and the other
  letterboxes and both leave part of the screen showing something other than the image.

**Changed**
- `src/styles.css`: `object-fit: cover` becomes `object-fit: fill`, with a comment recording that the
  distortion is deliberate so a later reader does not "correct" it back.

**Deleted**
- Nothing.

**Notes**
- `cover` did fill the screen, which is why it was chosen, but it filled it by cropping whichever
  axis overflows. The replacement jumpscare image is 1080x608 landscape, so on a portrait phone that
  was a narrow vertical strip of the picture.
- Red run observed first: both new cases failed on `cover`.
- The existing no-animation, no-keyframes, and no-text-content scans over the same rules still pass.
  Stretching is a layout property, so `SPEC.md` section 13's no-flash rule is untouched.
- 171 cases pass, up from 169. `node build/build.js` rebuilt `dist/index.html` at 273,354 bytes.

## Task 17 - Supplied scare sound - 2026-07-30 06:01 AM EDT

The scare plays `assets/regular_sound.mp3`, in sync with the image, through the same gain and limiter
the synthesized scream ran through. **The four-layer synthesized scream is deleted.** It was always a
stand-in for a real sound in a repo with no audio pipeline, and there is now a real sound.

**Added**
- `assets/regular_sound.mp3`, committed: MPEG-1 Layer III, 192 kbps, 44.1 kHz stereo, 116,120 bytes,
  4.83 seconds.
- `src/audio.js`: `decodeScream(ctx, dataUri)`, which slices the payload out of the inlined data URI,
  `atob`s it into a `Uint8Array`, and hands the bytes to `decodeAudioData`.
- `build/build.js`: `MEDIA_TYPES` gains `.mp3`, `.ogg`, `.wav`, and `.m4a`; a `dataUri` helper, since
  two assets are now inlined the same way; and a `soundFile` option filling a new `__ASSET_SCREAM__`
  placeholder.
- `src/index.html`: `const SCREAM_SRC = "__ASSET_SCREAM__";` beside `JUMPSCARE_SRC`.
- `tests/audio.test.js`: 7 new cases and a `decodeAudioData` on the fake context. The sound is
  decoded exactly once across two `unlock()` and two `playScream()` calls; the played source carries
  the buffer `decodeAudioData` returned rather than one built in code; every source stops within
  `SCREAM_DURATION` of starting; no gain on the path to the destination exceeds `PEAK_GAIN`; the
  scare creates **zero** oscillators, so the synthesis cannot creep back; `decodeScream` strips the
  base64 prefix and decodes the right byte count; and a rejected decode leaves `playScream`
  harmless.
- `tests/build.test.js`: `output inlines the scare sound`, asserting the bundle's `data:audio/mpeg`
  payload decodes to exactly the bytes on disk, mirroring the image case, plus the four new
  `mimeFor` mappings.

**Changed**
- `src/audio.js`: `buildScream(ctx, startTime)` becomes `buildScream(ctx, buffer, startTime)` and is
  now `source -> master gain -> limiter -> destination`. The exported name is kept, since
  `tests/build.test.js` pins it as this module's symbol and the module's job did not change.
  `SCREAM_DURATION` is 4.0 seconds becomes 5.0 and is redefined as a **ceiling**: the source is
  stopped there whatever the file's own length is, so a longer file swapped in later is cut rather
  than left playing over the title screen.
- `src/audio.js`: `createAudio(Ctor)` becomes `createAudio(Ctor, screamSrc)` and decodes once inside
  `unlock()`, on the START gesture. `playScream` plays the cached buffer or does nothing.
- `src/main.js`: passes `SCREAM_SRC`.
- `SPEC.md` section 4: the bundle size note now carries measured numbers, roughly 267 KB, of which
  under 20 KB is the app. The estimate written before the image was replaced was low.
- `tests/audio.test.js`: `stopMusic before the scream` waits for the decode before asserting the
  ordering. Without that it would have passed vacuously, since a scare with no decoded buffer builds
  no nodes to be ordered against.

**Deleted**
- `src/audio.js`: the four synthesized layers, `noiseBuffer`, `NOISE_SECONDS`, and the `noiseBuffers`
  `WeakMap`. No oscillator, noise buffer, or envelope is left in the scare path.
- `tests/audio.test.js`: `SCREAM_DURATION is exactly 4`, `buildScream schedules every layer`, `every
  scheduled node stops by the duration`, `master gain is capped`, and the `masterGainValues` helper.
  Each is replaced by a case above that asserts the same property of the sample path.

**Notes**
- The sound is decoded through Web Audio rather than played from an `<audio src="data:...">`, and
  that is the whole design. An element would have needed `media-src data:` added to a policy that
  currently exists to permit exactly nothing. Verified on the built bundle: the policy is still
  `default-src 'none'; img-src data:; script-src ...; style-src ...; base-uri 'none'; form-action
  'none'`, with no `media-src` in it.
- Red run observed first: `ERR_MODULE_NOT_FOUND` on `decodeScream`, then the two bundle cases.
- Two failures worth recording, both the same mistake made twice. `no module touches persistence` and
  `bundle makes no network requests` failed because the new doc comments named the forbidden APIs in
  prose, and comments ship in the bundle. Reworded. This is the third time a blunt source scan has
  caught a comment rather than code; the scans stay blunt because that is what makes them reliable.
- 169 cases pass, up from 165. `dist/index.html` is 119,687 bytes becomes 273,065.
- Not yet verified by ear or on iOS Safari. Turn the volume down before the first listen.

## Task 16 - Six second scare - 2026-07-30 05:55 AM EDT

The jumpscare image holds for 6 seconds rather than 10, then the app is back at the title screen
instantly, exactly as before. Ten seconds of a still image stops being frightening and starts being a
wait.

**Added**
- Nothing.

**Changed**
- `src/game.js`: `SCARE_DURATION` from 10 to 6.
- `tests/jumpscare.test.js`: `SCARE_DURATION is exactly 10` becomes `SCARE_DURATION is exactly 6`,
  and is now **the only place in the suite that states the number**. `scream ends well before the
  image`, which pinned the gap at exactly 6, becomes `the image outlasts the sound` and asserts the
  inequality instead, so retuning either constant cannot break a case that was really about a
  subtraction. `phase leaves scare exactly at the duration` derives its boundary from
  `SCARE_DURATION` rather than the literal 9.999.
- `tests/game.test.js`: `scare to title after 10s` becomes `scare to title after the full duration`,
  with both 9.9 literals replaced by expressions over `SCARE_DURATION`.
- `src/audio.js`: the `SCREAM_DURATION` doc comment no longer names the old durations.

**Deleted**
- Nothing.

**Notes**
- Red run observed first: the pinned case failed on 10 against 6, and nothing else did, which was the
  point of pinning it.
- One real failure worth recording. `scare to title` accumulates `MAX_DT` in a loop, and 120
  additions of 0.05 land a float hair **short** of 6 where 200 of them landed a hair **over** 10, so
  the case that passed at ten seconds failed at six. It now steps one frame past the boundary and
  says why. The exact instant is still asserted precisely in `tests/jumpscare.test.js`, which sets
  the clock rather than summing it, so no coverage was traded away.
- `tests/integration.test.js` already derived its frame counts from `SCARE_DURATION` and needed no
  change, as the brief predicted.
- `SCREAM_DURATION` stays at 4.0 and the synthesized scream is untouched. Task 17 is what replaces
  the sound; the invariant holds at 4 against 6 in the meantime.
- 165 cases pass, unchanged. `node build/build.js` rebuilt `dist/index.html` at 119,687 bytes.

## Assets - Ship the replacement jumpscare image - 2026-07-30 05:53 AM EDT

The user replaced `assets/jumpscare.jpg` with a different picture. Per `SPEC.md` section 4 the entire
swap procedure is "replace the file and rebuild", so this entry is the whole change.

**Added**
- Nothing.

**Changed**
- `assets/jumpscare.jpg`: 4,432 bytes becomes 54,215 bytes, and the image is 1080x608, landscape.
- `dist/index.html`: 53,290 bytes becomes 119,666 bytes, all of it the larger base64 payload.

**Deleted**
- Nothing.

**Notes**
- No code changed. The media type is still derived from the extension, so a jpeg swapped for a jpeg
  needed nothing at all, and `tests/build.test.js` still asserts the inlined bytes equal the file on
  disk.
- The new image being 1080x608 landscape is what makes `tasks/task-18-jumpscare-fill.md` worth doing:
  under the current `object-fit: cover`, a landscape image on a portrait phone is cropped to a narrow
  vertical strip of itself.
- 165 cases pass, unchanged.

## Docs - Specify the second round of QA changes and add their task briefs - 2026-07-30 05:49 AM EDT

Documentation only. **No source, test, or build file was touched and nothing was implemented.** A
second round of play testing produced three changes, all in the jumpscare payload; they are specified
here first and executed later, which is the repo's normal spec-first order.

**Read this before reading a green test run as agreement:** the code now knowingly trails `SPEC.md`
again. `npm test` still passes with 165 cases because the tests match the code, and both now describe
the previous behaviour until tasks 16 to 18 are executed. Per the rule at the top of `SPEC.md`, the
code is the bug.

**Added**
- `tasks/task-16-scare-duration.md`: `SCARE_DURATION` from 10s to 6s. 5 test cases, and the rule that
  exactly one of them may state the number while every other derives from the constant, so the next
  retune is one line plus one pinned assertion.
- `tasks/task-17-scare-sound-file.md`: `assets/regular_sound.mp3` replaces the synthesized scream.
  12 test cases across `tests/audio.test.js` and `tests/build.test.js`, including the ear-safety cap,
  the ceiling that stops a longer file outliving the image, and a case asserting the scare
  synthesizes nothing at all so the four layers cannot creep back.
- `tasks/task-18-jumpscare-fill.md`: `object-fit: cover` becomes `fill`. 4 cases, two of them
  existing ones that must still pass.
- `tasks/README.md`: a second "Decisions changed after QA" table and a tasks 16 to 18 execution order
  table. The first table is unchanged, since tasks 09 and 10 were executed against the originals and
  their briefs still describe them.

**Changed**
- `SPEC.md` section 1: the overview's 10 seconds and 4-second scream become 6 seconds and the
  supplied sound. Also corrects a line left stale by task 11, which still said a wall sends the blob
  back to the start cell.
- `SPEC.md` section 3: records that the policy carries no `media-src` and why. The sound is decoded
  out of a string already in the document rather than loaded by an element, so nothing requests it.
- `SPEC.md` section 4: both assets now ship, with the audio extensions the build recognises, and the
  bundle size this costs, roughly 53 KB to roughly 208 KB.
- `SPEC.md` section 9: the diagram's `--after 10s-->` and the constants line's `SCARE_DURATION = 10`.
- `SPEC.md` section 12: the four-layer sound design table is replaced by the sample design, the
  decode-once-on-unlock rule, and `SCREAM_DURATION` redefined as a 5-second **ceiling** rather than
  the sound's length. The ambient music subsection is untouched.
- `SPEC.md` section 13: 10 seconds becomes 6, `object-fit: cover` becomes `fill` with the distortion
  recorded as deliberate, and the scream bullet becomes the file.
- `SPEC.md` section 14: `SCREAM_DURATION < SCARE_DURATION` is now 5 against 6, and "never networks"
  states that the inlined sound is not an exception to it.
- The note pinning which sections run ahead of the code now names sections 3, 4, 9, 12, and 13 and
  tasks 16 to 18, and records that the first round has landed.

**Deleted**
- `SPEC.md` section 12's four-layer sound design table, and the optional convolver tail with it.

**Notes**
- The mp3 was read rather than assumed: MPEG-1 Layer III, 192 kbps CBR, 44.1 kHz stereo, 116,120
  bytes, 4.83 seconds. That it fits inside a 6-second image with room to spare is what lets
  `SCREAM_DURATION` stay a ceiling and the image keep ending in silence.
- `assets/regular_sound.mp3` is deliberately **not** committed here. Task 17 adds it, so the asset
  arrives with the code that reads it.
- Confirmed with the user before writing task 17: the file replaces the synthesized scream rather
  than layering with it or falling back to it.

## Task 15 - Ambient music - 2026-07-30 05:01 AM EDT

**This completes the QA changes from tasks 11 to 15.** The maze now has a quiet synthesized drone
under it, at the edge of hearing, which stops the instant the jumpscare begins. The original
reasoning, that silence during play is what makes the scare land, is preserved rather than discarded:
the music is very quiet, and it is cut **before** the scream is scheduled, so the scream still
arrives into silence.

**Added**
- `src/audio.js`: `MUSIC_GAIN` (0.05, against the scream's 0.45) and `buildMusic(ctx)`, which returns
  `{ nodes, gain }`. Two sawtooth voices a fifth apart at 55 Hz and 82.5 Hz, detuned a few cents so
  they beat slowly, through a lowpass at 240 Hz. Two slow LFOs, one swinging the cutoff by 120 Hz at
  0.06 Hz and one breathing the master music gain by a fifth of its base at 0.09 Hz. Nothing
  schedules a stop and nothing loops, so there is no loop point to hear.
- `src/audio.js`: `startMusic()` and `stopMusic()` on the object `createAudio` returns, alongside
  `unlock()` and `playScream()`. `startMusic` keeps the node set in a closure and returns early if it
  exists, since a second set of voices would simply double the volume. `stopMusic` ramps the gain to
  near silence over 0.3s and ends the oscillators just after, because an abrupt stop clicks. Both are
  wrapped in `try/catch` like `playScream`.
- `tests/audio.test.js`: 8 cases, on the hand-written fake context already there rather than a Web
  Audio mock. `MUSIC_GAIN <= 0.06` and `MUSIC_GAIN * 4 < PEAK_GAIN`; no gain on the path to the
  destination is ever scheduled above the cap; the graph schedules no `stop` at build time; a second
  `startMusic` creates no second set of oscillators; after `stopMusic` every oscillator it started
  has a recorded stop and the gain arrived at silence by a ramp rather than in one step;
  `createAudio(undefined)` starts and stops without throwing; and constructing the audio object
  schedules nothing at all.

**Changed**
- `src/main.js`, `showPhase`: the music starts on entering `playing`, is left running through
  `levelup` so the handover is not punctuated by silence, and is stopped on the return to `title`.
  On entering `scare` the stop comes **first**, before `jumpscare.show()`, which is what schedules
  the scream.
- `tests/audio.test.js`: the fake context now stamps every logged event with a monotonic sequence
  number and records which `AudioParam` method was called. Ordering is what this task turns on, and
  the music and the scream are deliberately scheduled for different times, so the times alone could
  not express it.

**Deleted**
- Nothing.

**Notes**
- `stopMusic before the scream` asserts the rule twice, because one assertion could not hold it. On
  the fake context, every music `stop` is recorded before the first scream node is built. In the
  source, `showPhase`'s `audio.stopMusic()` appears before its `jumpscare.show()`. The call site is a
  DOM edge no test can drive, so without the second assertion the first would only be testing the
  order the test itself called them in.
- "No gain above the cap" is asserted over the nodes that actually reach the destination. An LFO's
  depth feeds an `AudioParam` and is measured in Hz for the filter sweep, so it is deliberately
  outside that set: the audio path is where a gain means loudness.
- Red run observed first: `ERR_MODULE_NOT_FOUND` on `MUSIC_GAIN` and `buildMusic`. The source-order
  assertion then failed for a reason worth recording: the comment above the stop names
  `jumpscare.show()` in prose, so the scan matched the comment. The test now strips comments first,
  as the no-debug-affordance scan in `tests/integration.test.js` already did.
- 165 cases pass, up from 157. `node build/build.js` rebuilt `dist/index.html` at 53,290 bytes.
- Not yet verified by ear or on iOS Safari: the manual listen and the mobile gesture check in the
  task's done criteria are the two remaining items and need a person and a device.

## Task 14 - Pulsing exit marker - 2026-07-30 04:56 AM EDT

The player can now tell they have found the end. The exit carries a slowly pulsing amber marker,
drawn inside the fog clip so it is invisible until they are close to it. The original concern, that
marking the exit leaks the goal through the fog, is answered by where the marker is drawn rather than
by dropping it.

**Added**
- `src/render.js`: `PULSE_PERIOD` (1400 ms), `EXIT_COLOR` (`#ffb300`), `EXIT_ALPHA_MIN` and
  `EXIT_ALPHA_MAX` (0.55 to 1), `EXIT_SCALE_MIN` and `EXIT_SCALE_MAX` (0.9 to 1.15 of the base
  radius), `exitPulse(timeMs)`, and `exitVisible(pos, exit, fogRadiusCells)`. The base radius is
  `exitRadius * scale`, so the marker is the size of the region that actually triggers the win.
- `src/render.js`: the marker itself, drawn inside the existing fog clip and **before** the fog fade
  is painted, so the fade dims it at the edge of the disc exactly as it dims the walls. Drawn after
  the fade it would glow through the darkness.
- `tests/render.test.js`: 5 cases. The pulse stays inside 0 to 1 over 1000 samples across five
  periods and never leaves the documented alpha range, with the low end well clear of zero so the
  marker cannot blink out; it repeats exactly one `PULSE_PERIOD` later; it moves by under 0.01 per
  millisecond, which is the anti-strobe guard; `exitVisible` is false from the start cell and a hair
  outside the disc and true just inside it and on the exit, at every level; and the colour is none of
  `#fff`, `#ffffff`, or `white`.

**Changed**
- `src/render.js`: `draw(state)` becomes `draw(state, timeMs)`. The frame-skip condition gains a
  third term, "and the marker is not currently visible", expressed with `exitVisible` so there is one
  rule and one code path. Standing still away from the exit still skips frames; standing still next
  to it no longer does, because that would freeze the pulse.
- `src/main.js`: passes the `requestAnimationFrame` timestamp it already receives straight through to
  `renderer.draw`.

**Deleted**
- The `src/render.js` comment asserting there is no exit marker.

**Notes**
- Red run observed first: `ERR_MODULE_NOT_FOUND` on the new imports, since none of the exports
  existed.
- `draw` is the untested DOM edge, as in task 06, so it was additionally driven through a throwaway
  fake 2D context outside the suite: the marker is not drawn and the frame is skipped outright from
  across the maze; it is drawn amber next to the exit; idle frames next to it are no longer skipped;
  and the alpha and radius walk 0.775, 1.0, 0.775, 0.55 across one 1400 ms cycle.
- `SPEC.md` section 13's no-animation and no-flash rules are about the jumpscare and are untouched.
  The pulse is confined to `playing`, is slow, and is low-contrast.
- 157 cases pass, up from 152. `node build/build.js` rebuilt `dist/index.html` at 49,016 bytes.

## Task 13 - Sequential levels - 2026-07-30 04:53 AM EDT

A play session is now EASY, then MEDIUM, then HARD, then the jumpscare. **The difficulty select
screen was deleted**: the levels are played in order, every time, so there is nothing to choose, and
naming them on a menu also gave away that the game is about the fog. Each completed level hands over
through a one-second `LEVEL n OF 3` beat, so the player knows they progressed rather than glitched.

**Added**
- `src/game.js`: `LEVELUP_DURATION = 1`, a `levelup` branch in `step`, and `levelIndex` and
  `levelupElapsed` on the state. `pressStart(state, seed)` now goes straight into `LEVELS[0]`.
- `src/game.js`: `deriveSeed`, a private pure derivation, `Math.floor(mulberry32(seed)() * 2 ** 32)`.
  Only the first level's seed comes from the caller. This is what keeps the module free of the clock
  and of any global random source, and it is what makes a whole three-level run replayable from one
  number.
- `src/index.html` and `src/styles.css`: the `levelup` screen, one centred line of text on black.
- `tests/game.test.js`: 10 cases, plus the `finish`, `handover`, and `segmentsPerLevel` fixtures.
  START goes straight to `playing` on EASY with no `select` phase left anywhere in the module; EASY's
  exit yields `levelup` and never `scare`; the beat holds at `LEVELUP_DURATION - MAX_DT` and is gone
  at `LEVELUP_DURATION`, asserted from both sides; the handover places the blob in the new maze's
  start cell with a clean counter; only HARD fires the scare; `levelIndex` matches
  `LEVELS.indexOf(levelName)` at every point; two runs from one seed are deep-equal across all three
  levels; the three mazes differ from each other and the second differs from what the starting seed
  alone would have carved; and input during `levelup` never moves the blob.
- `tests/integration.test.js`: `a full run reaches the scare`, one automated run walking all three
  mazes along their own solutions, asserting the order, zero wall contact per level, a `levelup`
  between each pair, and `scare` only at the end.

**Changed**
- `src/main.js`: START calls `audio.unlock()` then `pressStart(state, freshSeed())`. `showPhase` takes
  the state rather than the phase, since the `LEVEL n OF 3` text is written from `state.levelIndex`
  when the phase becomes `levelup`.
- `src/styles.css`: the `select` rules become `levelup` rules, plus a `.levelup` text rule. The
  D-pad's `playing`-only rule already hides it during `levelup`; confirmed rather than assumed.
- `tests/game.test.js`: `select to playing` becomes `startLevel carves the named level`, since
  `startLevel` is still exported and is what makes one level testable in isolation. `exit within
  radius wins` becomes `exit within radius ends the level`. The `input ignored outside playing` list
  swaps `select` for `levelup`. The source scan moved to a module-level constant and now also
  forbids a global random source.
- `tests/integration.test.js`: the three independent per-level runs become the single full run.
  `the full loop returns to title` and `a second playthrough works` now run through all three levels.
- `tests/jumpscare.test.js`: its fixture calls `startLevel` directly rather than through
  `pressStart`, which no longer takes a state alone.

**Deleted**
- `src/index.html`: the `select` section and its three level buttons.
- `src/main.js`: the `[data-level]` click handler and the `screensEl` lookup it needed.
- `tests/game.test.js`: `title to select`.
- `tests/integration.test.js`: `a solved maze reaches the scare`, replaced by the full run.

**Notes**
- Red run observed first: `tests/game.test.js` would not even load, since `LEVELUP_DURATION` did not
  exist, and the three integration cases failed on `pressStart` still yielding `select`.
- One failure worth recording: the source scan for the clock initially failed on the new
  `deriveSeed` doc comment, which named the two forbidden globals in prose. The comment was reworded.
  The scan is deliberately blunt and this is the second time prose has tripped it.
- The bundle test that pins one symbol per `src/*.js` module still passes: no module was added or
  dropped, and `src/main.js` now imports `LEVELS` from the already-bundled `difficulty.js`.
- 152 cases pass, up from 144. `node build/build.js` rebuilt `dist/index.html` at 46,805 bytes, with
  no `data-level` left in it and the three screens now `title`, `levelup`, and `playing`.

## Task 12 - Wider fog radius - 2026-07-30 04:47 AM EDT

A tuning change and nothing else: the player sees slightly more of the maze at every difficulty. No
new code, no new function, three numbers.

**Added**
- `tests/difficulty.test.js`: `fog radius matches the spec table`, pinning `fogRadius` to exactly
  2.4, 1.8, and 1.3 rather than only their ordering, so the fog cannot be retuned silently without
  `SPEC.md` section 8 moving in the same commit.
- `tests/difficulty.test.js`: `a wider fog does not reveal the exit early`, asserting
  `fogRadius * 4 < distance(start, exit)` at every level. The point of this change is visibility and
  the point of the game is that the exit is not visible, so one is bounded against the other. This is
  the `SPEC.md` section 14 invariant asserted mechanically.

**Changed**
- `src/difficulty.js`: `fogRadius` 2.2 to 2.4 (EASY), 1.6 to 1.8 (MEDIUM), and 1.1 to 1.3 (HARD).
  Roughly 140 px, 68 px, and 32 px on a 900 px tall viewport.

**Deleted**
- Nothing.

**Notes**
- `blobRadius`, `speed`, and `exitRadius` were deliberately not adjusted to compensate. If the game
  now feels too easy that is a separate tuning decision with its own spec change.
- The three existing invariants still hold at the new values: 2.4 > 1.8 > 1.3, `fogRadius >
  blobRadius * 2` at every level (tightest at HARD, 1.3 against 0.44), and the exit stays well
  outside the disc.
- Red run observed first: `fog radius matches the spec table` failed on 2.2 against 2.4. The other
  three fog cases passed before and after, which is the point of pinning the values.
- 144 cases pass, up from 142. `node build/build.js` rebuilt `dist/index.html`.

## Task 11 - Walls block and slide - 2026-07-30 04:46 AM EDT

The first of the five QA changes. Touching a wall now costs the player their momentum on the blocked
axis and nothing else: the blob stops against the wall, keeps moving on the other axis so it slides
along it, and is never teleported back to the start cell.

**Added**
- `tests/game.test.js`: two fixtures, `walledField` (a playing state whose only wall is the vertical
  line `x = 0`, so left is blocked and y is free) and `settled` (the same field with the blob already
  pressed up against that wall), plus seven cases. The blob never equals `start` on any of 60 frames
  driven into the wall and comes to rest within one sub-step of the contact distance; a diagonal into
  the wall leaves `x` exactly unchanged while `y` advances the full `speed * dt / sqrt(2)`; a head-on
  press moves neither axis; a `speed = 100` frame pressed diagonally into the corner ends wall-free
  per `hitsWall` and inside the maze; `segments`, `seed`, `levelName`, and `maze` survive contact;
  `hits` rises on a blocked frame and not on a clear one; and the phase is still `playing` after
  sustained contact.

**Changed**
- `src/game.js`, `stepPlaying`: the single sweep and its reset branch become two sweeps, x then y,
  with the second starting from the first's result. The new position is the second sweep's, and
  `hits` increments when either axis was blocked. The exit check is unchanged and still runs after
  the move on the post-move position.
- `tests/integration.test.js`: `wall hits do not change the layout mid-run` becomes `wall contact
  does not change the layout mid-run`. It now drives 40 frames into the outer border and asserts the
  layout and seed hold on every one of them, and that the blob rests against the border rather than
  back at the start.

**Deleted**
- `tests/game.test.js`: `wall hit resets to start`, `wall hit preserves the maze`, `wall hit
  increments the counter`, and `large dt does not tunnel`, whose subject no longer exists. The
  tunneling guard is not lost, it is rewritten as `sliding cannot tunnel` against the new per-axis
  sweep, which is where tunneling could plausibly have been reintroduced.

**Notes**
- `src/collision.js` was not touched, as the brief requires. `sweep` already returns the last clear
  position, which is precisely the blocked-but-not-teleported position this needed.
- Red run observed first: `a wall never sends the blob back to the start`, `a blocked axis still
  moves on the other`, `a head-on press moves on neither axis`, and `hits counts blocked frames` all
  failed against the reset implementation, with `pos` equal to `start` after contact. `sliding cannot
  tunnel`, `the maze survives contact`, and `contact changes no phase` passed before the change, as
  expected: they pin behaviour the reset also had.
- 142 cases pass, up from 139. `node build/build.js` rebuilt `dist/index.html` at 45,325 bytes.

## Docs - Specify the QA changes and add their task briefs - 2026-07-30 01:28 AM EDT

Documentation only. **No source, test, or build file was touched and nothing was implemented.** Play
testing produced five changes; they are specified here first and executed later, which is the repo's
normal spec-first order.

**Read this before reading a green test run as agreement:** the code now knowingly trails `SPEC.md`.
`npm test` still passes with 139 cases because the tests match the code, and both now describe the
previous behaviour until tasks 11 to 15 are executed. Per the rule at the top of `SPEC.md`, the code
is the bug.

**Added**
- `tasks/task-11-wall-block.md`: per-axis sweeping so a wall blocks the pressed axis and the blob
  slides along it instead of being returned to the start. 7 test cases, including the sliding case
  and a guard that per-axis sweeping did not weaken anti-tunneling.
- `tasks/task-12-fog-widen.md`: `fogRadius` to 2.4, 1.8, and 1.3. 4 cases, including one bounding the
  wider fog against the invariant that the exit is never visible from the start.
- `tasks/task-13-level-progression.md`: the three levels in order with a `levelup` beat, the select
  screen deleted, and seeds derived rather than injected so `step` stays free of the clock. 11 cases.
- `tasks/task-14-exit-marker.md`: a slowly pulsing exit marker drawn inside the fog clip. 5 cases,
  including an anti-strobe continuity guard and the visibility predicate that keeps the exit hidden
  from outside the fog.
- `tasks/task-15-ambient-music.md`: a synthesized drone at `MUSIC_GAIN <= 0.06`, idempotent start,
  ramped stop, and a case pinning the stop to happen before the scream is scheduled. 8 cases.
- `tasks/README.md`: a "Decisions changed after QA" table recording what each reversed decision was,
  what it is now, and why, since tasks 01 to 10 were executed against the originals and their briefs
  still describe them. Plus the tasks 11 to 15 execution order.

**Changed**
- `SPEC.md` section 2: `select` removed, `levelup` added, and a note that sections 2, 8, 9, 10, and
  12 are specified ahead of the code.
- `SPEC.md` section 7: records that `sweep` still never slides, and that sliding is the game layer's
  business, so `src/collision.js` needs no change.
- `SPEC.md` section 8: `fogRadius` 2.2, 1.6, 1.1 becomes 2.4, 1.8, 1.3, with the approximate pixel
  mapping updated to 140, 68, and 32 px. `LEVELS` is now described as the play order rather than the
  select-screen button order.
- `SPEC.md` section 9: the new phase machine, wall contact blocking per axis, `hits` redefined as
  frames blocked, `LEVELUP_DURATION`, the derived-seed rule, and `levelIndex` and `levelupElapsed` in
  the state shape.
- `SPEC.md` section 10: the pulsing exit marker, its reveal distance, and the rule that the
  performance pass's frame-skip must not freeze the pulse.
- `SPEC.md` section 12: background music, its gain cap, and the requirement that it stops before the
  scream is scheduled.
- `SPEC.md` section 14: the "no exit marker" absolute becomes "never visible from outside the fog
  radius", plus new absolutes for music never overlapping the scream and every level being played in
  order.
- `tasks/README.md`: the product decisions table and phase diagram.

**Deleted**
- Nothing.

**Notes**
- Four of the five changes reverse decisions marked "fixed, do not relitigate". Each replacement is
  deliberately narrow so the original reasoning still holds where it can: the exit marker is
  invisible until the player is on top of it, and the music is quiet enough and stops early enough
  that the scream still lands in silence.
- `SPEC.md` section 13 is untouched on purpose. The jumpscare's no-animation and no-flash rules are
  absolute and are unrelated to the new exit pulse, which is confined to `playing` and is slow and
  low-contrast by specification.
- Verified that the rebuild produces a byte-identical `dist/index.html`, which is the proof this pass
  changed nothing executable.
- Checked that the difficulty numbers in `SPEC.md` and in `tasks/task-12-fog-widen.md` agree, since
  the two disagreeing is the exact failure the spec's provenance note warns about.

## Deploy - Ready the project for Vercel - 2026-07-30 12:47 AM EDT

**Added**
- `vercel.json`: `buildCommand` `npm run build`, `outputDirectory` `dist`, `framework` null. Nothing
  to install, since the project has no dependencies. Without this the platform would guess an output
  directory and publish nothing.
- Response headers the document cannot set for itself:
  `Content-Security-Policy: frame-ancestors 'none'` with `X-Frame-Options: DENY` for older clients,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a `Permissions-Policy` denying
  camera, microphone, geolocation, payment, and USB, and
  `Cache-Control: public, max-age=0, must-revalidate`, since the whole app is one HTML file and a
  stale cached copy is a stale app.
- `tests/deploy.test.js`, 8 cases: the build command names a script that exists, the publish
  directory is where the build **actually writes** (asserted by running the real build, not by
  matching a string), no framework, the header set, a cache policy that revalidates, `.vercelignore`
  never excluding something the build needs, and a `.gitignore` that keeps `dist/` committed while
  dropping `.vercel`.
- A guard that the **header policy stays framing-only**. CSP policies combine by intersection, so a
  `script-src` or `style-src` sent by the host would also have to allow the bundle's hashes and would
  silently blank the app if it did not. The hashes belong to the artifact, which is the only thing
  that knows them.
- `README.md`: a Deploy section.

**Changed**
- `.gitignore`: adds `.vercel`, `.env` files, logs, and OS and editor noise including `desktop.ini`,
  which OneDrive scatters through this tree. The note that `dist/` is deliberately not ignored is
  promoted to the top of the file, where it is harder to miss.
- `SPEC.md`: new section 3a covering deployment, and two new invariants in section 14.

**Deleted**
- Nothing.

**Notes**
- **Correction to the security audit of 2026-07-29.** That audit dismissed iframe embedding on the
  grounds that "an embedder still gets the title screen and its warning, and nothing is bypassed."
  That reasoning was incomplete: an embedder controls the iframe's size and position, so it can crop
  the warning out of view and leave only the START button visible. The warning is the player's only
  forewarning, so framing is now refused rather than trusted. The other half of the dismissal still
  holds, which is why this is a header rather than a `<meta>` directive: `frame-ancestors` is ignored
  in a meta policy, and a host was needed before it could be sent at all.
- Verified against a local server that reads `vercel.json` and replays the real output directory and
  headers, rather than a retyped approximation. Over HTTP with every header applied: title to select
  to playing, the canvas sized, the fog painting, and zero console errors or CSP violations, so the
  header policy and the bundle's meta policy do not conflict. The app had only ever been exercised
  over `file://` before this.
- Framing verified as actually blocked, not merely configured: a page embedding the app in a
  400x120 iframe, which is exactly the warning-cropping attack, gets
  `Framing ... violates the following Content Security Policy directive: "frame-ancestors 'none'"`
  and a null `contentDocument`.
- Checked that no tracked file became ignored by the new rules, and that `dist/index.html` is still
  tracked.

## Assets - Ship the real jumpscare image - 2026-07-30 12:36 AM EDT

The user supplied `assets/jumpscare.jpg` and removed the placeholder PNG, which left the build broken
on `ENOENT` and one test failing. The scare now ships the real image.

**Added**
- `build/build.js`: `mimeFor(file)`, deriving the data URI's media type from the asset's extension,
  with `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, and `.avif` recognised case-insensitively. An
  unrecognised extension fails the build naming the offending path. Guessing instead would ship a
  data URI the browser refuses to decode, and the scare would be a blank screen with nothing logged.
- `tests/build.test.js`: four cases covering the extension-to-media-type mapping, the unknown-type
  failure, a full build against a PNG fixture proving a format swap needs no code change, and a
  byte-for-byte comparison of the decoded payload against the file on disk, which the old
  length-only assertion would have missed.
- `tests/fixtures/asset/swap.png`, a 69-byte hand-assembled PNG for the format-swap case.

**Changed**
- `build/build.js`: the default asset is `assets/jumpscare.jpg`, and the media type comes from
  `mimeFor` rather than a hardcoded `image/png`.
- `SPEC.md` section 4: the asset is the user's real image rather than a placeholder, and the media
  type is documented as following the extension. Section 13 names the `.jpg`.
- `README.md`: the swap procedure names the `.jpg` and no longer calls the committed image a
  placeholder, which stopped being true.
- `tests/jumpscare.test.js`: the fake data URI in the preload case is a jpeg, matching production.

**Deleted**
- Nothing by this change. `assets/jumpscare.png`, the generated placeholder, was already removed by
  the user when the real image landed.

**Notes**
- Verified in real Chrome against the built artifact: the overlay reports `data:image/jpeg`, decodes
  to 292x239 (exactly the source file's dimensions, so the browser really did decode it rather than
  silently failing), `complete` is true, `#screens` is `display: none`, the cursor is hidden, and
  there are zero errors and zero CSP violations. A screenshot confirms it covers the viewport with no
  letterboxing.
- **Full end-to-end playthrough of the shipped bundle, won for real.** The seed was pinned by stubbing
  `Date.now` and `Math.random` before any page script ran, making the maze known in advance; the blob
  was then driven along that maze's own solution with real dispatched WASD key events, closed loop,
  reading its position back by locating it on the canvas rather than from game state, so the bundle
  was exercised as a black box. Timeline: `title`, START to `select`, EASY to `playing`, 54 of 55
  waypoints driven in 17.1 seconds, exit reached, `scare` with the image up and every other element
  hidden, still up at 9 seconds, back at `title` by 11 seconds with the overlay gone, and START
  working again. Zero console errors, exceptions, or CSP violations throughout.
- The blob tripped the exit one waypoint before the final cell centre, which is correct: `exitRadius`
  is 0.30 cells, so the scare fires on approach rather than on arrival.
- The source image is 292x239 and 4.3 KB, so it is heavily upscaled on a desktop display and looks
  soft. That suits the aesthetic, but a higher-resolution source would sharpen it at a cost of a
  larger bundle. The bundle is 44,790 bytes.
- `tasks/*.md` still refers to `assets/jumpscare.png` throughout. Those briefs are the historical
  record carrying the user's sign-off and are deliberately left unedited, as with the earlier defects
  found in them.

## Docs - Document the real build command - 2026-07-30 12:10 AM EDT

**Changed**
- `README.md` build section: leads with `npm run build`, the script that has existed in
  `package.json` since task 01 but which the README never mentioned, showing the raw
  `node build/build.js` instead. States that there is no `npm install` step, since the project has no
  dependencies of either kind, and that there is no `npm run dev` or dev server because the output is
  a static self-contained file with nothing to serve. The dev loop is build, then reload.

**Added**
- Nothing.

**Deleted**
- Nothing.

**Notes**
- Verified `npm run build` runs and reproduces `dist/index.html` byte for byte, so the build is
  deterministic and the committed artifact was already current.
- Left unfixed and worth a later look: the `test` script uses `node --test "tests/**/*.test.js"`,
  and glob support in the test runner arrived well after Node 18, which is the version the README
  claims. `node --test tests/` would work everywhere and would still skip the fixtures, none of which
  are named `*.test.js`.

## Performance - Cut per-frame canvas cost and harden the mobile viewport - 2026-07-29 11:50 PM EDT

Measured before and after in real Chrome, HARD level, 625 segments, rather than asserted.

| Metric | Before | After |
| --- | --- | --- |
| Draw cost, DPR 1 | 0.0555 ms | 0.0380 ms (1.46x) |
| Draw cost, DPR 3 | 0.0443 ms | 0.0353 ms (1.26x) |
| Idle frame, blob not moving | 0.0355 ms | 0.0005 ms (~70x) |
| Backing store at DPR 3 | 2700x2700 | 1800x1800 (2.25x fewer pixels) |

**Added**
- `src/render.js`: `MAX_DPR` and `backingScale(dpr)`, capping the backing store at 2x. A phone
  reporting 3 was allocating and filling 2.25x the pixels for a difference invisible on flat white
  lines over black. `backingScale` also floors a missing, zero, or negative ratio at 1, which some
  embedded webviews report and which would otherwise render a blank canvas.
- `tests/render.test.js`: two cases covering the cap at DPR 3 and 4, pass-through at 1 and 2, and the
  degenerate inputs `undefined`, `null`, `0`, `-1`, and `NaN`.

**Changed**
- `src/render.js`: the fog fade and the blob halo are built once per radius and reused, drawn by
  translating the canvas to the blob rather than rebuilding a gradient at a new centre every frame.
- `src/render.js`: `shadowBlur` is gone, replaced by the cached halo gradient. Canvas shadow blur is
  among the slowest 2D operations and is worst on the mobile GPUs this has to run on. The glow reads
  the same; the screenshot confirms it.
- `src/render.js`: segment endpoints are computed inline instead of through `toPixels`, so a frame
  allocates nothing per segment. `toPixels` stays exported for tests and other callers.
- `src/render.js`: a frame whose blob has not moved and whose canvas has not resized is skipped
  entirely. This is where most of the battery saving is, since a player pausing to think currently
  costs the same as one sprinting.
- `src/main.js`: resize events are coalesced into a single `requestAnimationFrame`, and
  `orientationchange` is handled too. A mobile browser fires resize continuously while its address
  bar slides, and each one reallocated the backing store.
- `src/input.js`: the D-pad suppresses `contextmenu`, so a long press cannot raise the menu, steal
  the pointer, and leave a direction stuck on.
- `src/styles.css`: `overscroll-behavior: none` and `touch-action: none` so pull-to-refresh cannot
  fire mid-glide; `100dvh` alongside the `100vh` fallback for the canvas and the title and select
  screens; `-webkit-touch-callout: none` and `user-select: none` on the D-pad.
- `src/index.html`: `type="button"` on the four D-pad buttons.
- `SPEC.md`: section 10 gains the DPR cap and the frame-cost rules, section 11 the mobile viewport
  rules.

**Deleted**
- The `BLOB_GLOW` constant, replaced by `BLOB_HALO` now that the glow is a gradient rather than a
  shadow.

**Notes**
- Red run first: both `backingScale` cases failed against a stub that returned its argument.
- **A spatial index was considered and deliberately rejected.** Measured, the bounding-box cull costs
  0.019 ms (EASY) to 0.072 ms (HARD) per frame against a 16.7 ms budget, and already reduces 625
  segments to 6 drawn. `SPEC.md` now records the measurement so the next person does not rebuild it
  on instinct.
- The benchmark harness measures JavaScript-side command submission, not rasterization, since canvas
  work is deferred. The DPR figure above is therefore stated as a pixel count, which is exact, rather
  than as a millisecond saving, which that harness cannot honestly claim.
- Verified after the rewrite in real Chrome: title to select to playing, no console errors, no CSP
  violations, and a screenshot at an emulated 390x844 phone viewport confirming the halo, the fog
  fade, and correct centring.

## Security - Audit, escape inlined sources, and add a CSP - 2026-07-29 11:43 PM EDT

Full audit of the app and its build. The attack surface is genuinely small and worth stating plainly:
the app reads nothing from its environment (no `location`, `URLSearchParams`, `window.name`,
`postMessage`, `referrer`, cookies, or storage), makes no network calls, and never touches
`innerHTML`, `document.write`, `eval`, or `new Function`. One real finding, in the bundler.

**Added**
- `build/build.js`: `escapeInlineScript(js)` rewrites `</script` to `<\/script` and `<!--` to
  `<\!--`, both valid inside string literals, comments, and regular expressions, so the meaning of
  the code cannot change. `assertInlineStyleSafe(css, file)` throws with the offending file named,
  since CSS has no escape that survives `</style`. Without these, any source file containing those
  sequences closed its own block and injected arbitrary markup into the shipped artifact. Reproduced
  before the fix: a module string containing `</script><img src=x onerror=alert(1)>` escaped into
  the document as live markup.
- `build/build.js`: a `<meta http-equiv="Content-Security-Policy">` emitted into `<head>` ahead of
  the script, with `default-src 'none'; img-src data:; script-src 'sha256-...'; style-src
  'sha256-...'; base-uri 'none'; form-action 'none'`. The two hashes are computed over exactly the
  text that ships, so a tampered bundle refuses to run. This enforces the zero-external-requests
  invariant at runtime rather than only in a test grep.
- `src/input.js`: `isPointerCode(code)`, true only for the four `dpad-*` ids.
- `tests/build.test.js`: six cases covering the script-block breakout, the escape preserving both
  syntax and string values, the `</style` build failure, the CSP hashes matching the emitted script
  and style, and the policy preceding the script it governs. `tests/fixtures/hostile-js` and
  `tests/fixtures/hostile-css` are complete source trees built to a temp directory, so `dist/` is
  never touched by these cases.
- `tests/game.test.js` and `tests/input.test.js`: inherited-key cases for `__proto__`,
  `constructor`, `toString`, `valueOf`, and `hasOwnProperty`, plus `isPointerCode` coverage.

**Changed**
- `src/game.js`: `startLevel` checks own properties before the lookup. `DIFFICULTY['__proto__']` and
  friends all return something truthy, so the old truthiness guard passed them through and the run
  died deeper with `Invalid maze size undefinedxundefined` instead of `Unknown level`.
- `src/input.js`: `vectorFrom` filters through `isGameKey` rather than a bare lookup, for the same
  reason. The window-level `pointerup`/`pointercancel` handler now clears only D-pad codes. It
  previously cleared everything, so on desktop **a mouse click anywhere stopped a blob being glided
  with WASD**. That was a real gameplay bug, found while probing the input edge.
- `src/main.js`: the level-click handler uses `closest('[data-level]')` rather than the raw event
  target.
- `build/build.js`: output is normalized to LF before hashing and writing. An HTML parser normalizes
  CRLF to LF before hashing an inline block, so a CRLF checkout would otherwise have shipped a policy
  whose hashes never matched, silently blocking the entire script.
- `SPEC.md`: section 3 gains the escaping and CSP rules, section 9 the own-property level lookup,
  section 11 the own-property key lookup and the pointer-release rule, section 14 three new
  invariants.

**Deleted**
- Nothing.

**Notes**
- Red run first: 6 cases failed on their assertions, including the reproduced injection and
  `startLevel('__proto__')` throwing the wrong error. `isPointerCode` was stubbed to return `false`
  so its failure was behavioural rather than a missing export.
- Verified in real Chrome over the DevTools Protocol against the built artifact on `file://`, since a
  wrong CSP hash silently blocks the whole script and no unit test would notice: title to select to
  playing all work, the canvas resizes to 984x605, 3952 canvas pixels are lit (the fog actually
  paints), and there are zero console errors, exceptions, and CSP violations.
- One benign warning in that run: `The AudioContext was not allowed to start`. That is the synthetic
  CDP click not counting as a user gesture, not a defect. A real click satisfies the gesture rule,
  which is exactly why `unlock()` lives in the START handler.
- Considered and dismissed, so they are not re-litigated: iframe embedding (an embedder still gets
  the title screen and its warning, and `frame-ancestors` is ignored in a meta policy); seed
  predictability (it seeds a maze, not a secret); and the disabled pinch-zoom, which is a WCAG 1.4.4
  smell but a locked product decision.

## Task 10 - Title screen, level select, and wiring - 2026-07-29 11:38 PM EDT

**The app is playable end to end as of this task.** `dist/index.html` is a single self-contained
file that runs from the filesystem or any static host.

**Added**
- `tests/integration.test.js`, 7 cases run entirely on the pure modules, no DOM required. The
  headline case walks the blob along `solve(maze)` at `dt = 1/60` on all three levels and asserts the
  phase reaches `scare` with zero wall hits, which is the only proof that the generated mazes are
  actually traversable by a blob of that radius. Also: the full loop returning to a state
  deep-equalling `createGame()`, a second playthrough after that loop, five deliberate wall hits
  leaving `segments` and the seed untouched, a scan of every `src/*.js` for `localStorage`,
  `sessionStorage`, `indexedDB`, `document.cookie`, `fetch`, and `XMLHttpRequest`, and a scan for any
  pause, debug, cheat, or skip affordance.
- `tests/build.test.js`: three cases. A known symbol from each of the ten `src/*.js` modules appears
  in the bundle, with the symbol list checked against the directory listing so a new module cannot be
  added without one; the warning text appears verbatim; and the bundle contains no `fetch(`, no
  `XMLHttpRequest`, and no `http://` or `https://`.
- `src/index.html`: the three screen sections. The title screen carries the warning above the START
  button in the DOM as well as on screen, the select screen carries EASY, MEDIUM, and HARD, and the
  playing screen carries the canvas.

**Changed**
- `src/main.js`: the wiring, and the only stateful file. It builds the renderer, input, audio, and
  jumpscare, holds `state`, and runs one `requestAnimationFrame` loop in every phase, since `step`
  also advances the scare clock. `audio.unlock()` is called inside the START click handler, level
  clicks draw a fresh seed per play, and the phase drives `body.dataset.phase`, the overlay, the
  input clear, and nothing else. `Date.now()` is read for the seed only, never for game timing.
- `src/styles.css`: `[data-screen]` hidden by default with one selector per phase revealing exactly
  one screen, plus the title and select layout and the outlined white-on-black buttons.
- `tests/integration.test.js`: the no-debug-affordance scan strips comments before searching, since
  `main.js` states in prose that there is no pause, debug key, or level skip.

**Deleted**
- The `src/main.js` placeholder body.

**Notes**
- Red run: the two new bundle cases failed on their assertions, since the old placeholder `main.js`
  pulled in no modules and the warning text did not exist. The playthrough case initially failed for
  a real reason worth recording: steering both axes at once cut corners into walls, and a deadzone
  smaller than one frame's travel made the blob oscillate around a waypoint forever. Steering one
  axis at a time with a one-frame deadzone fixed both.
- Verified headlessly against the built `dist/index.html` in Chrome: the title screen shows the
  warning and START on black and nothing else, clicking through START and EASY reaches `playing` with
  the fog disc, the maze, and the blob rendering correctly, and zero console errors are raised.
- **`assets/jumpscare.png` is still the committed placeholder**, a small solid dark PNG. Replacing
  that file and rerunning `node build/build.js` is the entire swap procedure.
- Outstanding manual checks that need a real device or a person: the stopwatch timing of the
  10-second scare, the audio listen, iOS Safari's gesture requirement, and the D-pad on a phone in
  both orientations.

## Task 09 - Fullscreen jumpscare overlay - 2026-07-29 11:29 PM EDT

**Added**
- `src/jumpscare.js`: `createJumpscare(overlayEl, imgEl, audio, imageSrc)` returning `show()` and
  `hide()`. The image source is assigned at construction, not on `show()`, so the first frame is
  never blank. `show()` reveals the overlay and plays the scream inside a `try/catch`, so a failing
  audio layer never takes the image down with it. There is no timer in the module: the 10-second
  clock is `game.step`'s, which means one clock, no drift, and no orphaned timer.
- `src/index.html`: the overlay element containing exactly one `<img alt="" />`. The empty alt is
  correct, since the image is decorative in the accessibility tree.
- `tests/jumpscare.test.js`, 10 cases: `SCARE_DURATION === 10`, the six silent seconds asserted
  rather than left incidental, the phase boundary checked from both sides at 9.999s and 10.0s, the
  post-scare state deep-equalling a fresh game, the title screen staying inert under movement input,
  a stylesheet scan for `animation`, `transition`, and `@keyframes`, a markup scan proving the
  overlay holds no text and no buttons, a source scan for `setTimeout`/`setInterval`, the preload and
  scream behaviour of `show`, and a throwing audio layer not blocking the image.

**Changed**
- `src/styles.css`: `cursor: none` during the scare, and `#screens` and `.dpad` hidden under
  `body[data-phase='scare']`, so every other element is hidden rather than merely covered.

**Deleted**
- Nothing. There is no "YOU GOT PRANKED" screen and no PLAY AGAIN button to remove; neither was ever
  built. The title screen's START button is the replay path.

**Notes**
- Red run against a stub that owned the duration with a `setTimeout`, loaded the image on show, and
  let an audio failure escape: 4 of 10 cases failed on their assertions. The six that passed were the
  cross-module timing guards already satisfied by `game.js` and `audio.js` from tasks 05 and 08.
- The no-flashes and no-other-UI guards read `src/styles.css` and `src/index.html` as text on
  purpose. They encode absolutes, so they should fail the build rather than rely on someone
  re-reading the spec.
- The stopwatch check, the nothing-else-visible check, and the phone orientation check are still
  outstanding: there is no entry point to open until task 10 wires it.

## Task 08 - Synthesized scream - 2026-07-29 11:21 PM EDT

**Added**
- `src/audio.js`: `SCREAM_DURATION` (4.0s), `PEAK_GAIN` (0.45), `buildScream(ctx, startTime)`, and
  `createAudio(AudioContextCtor)`. `buildScream` schedules all four layers at once with no timers:
  the noise impact through a lowpass sweeping 8 kHz to 200 Hz, two sawtooths detuned 15 cents gliding
  1200 Hz to 180 Hz, bandpass grit tracking that same glide, and a 55 Hz sub. Everything runs through
  a master gain capped at `PEAK_GAIN` into a `DynamicsCompressor` limiter, which is the last node
  before the destination.
- `createAudio` takes the constructor by injection so tests can pass a fake or `undefined`. `unlock`
  builds the context once and resumes it, safe to call repeatedly, and is called from the START click
  handler because browsers block audio outside a user gesture. Both entry points swallow failures, so
  audio never blocks the jumpscare or throws into the animation loop.
- `tests/audio.test.js`, 9 cases with a roughly 80-line hand-written fake context: the exact 4s
  duration, `SCREAM_DURATION < SCARE_DURATION` imported from `game.js`, every layer scheduled,
  nothing stopping after `startTime + SCREAM_DURATION`, nothing scheduled before `startTime`, the
  master gain capped, the limiter connected to the destination, graceful degradation without Web
  Audio, and the context being constructed only once across repeated unlocks.

**Changed**
- Nothing. `SPEC.md` section 12 already carried the audio rules and the layer table.

**Deleted**
- Nothing.

**Notes**
- Red run against a stub of one bare oscillator wired straight to the destination with a tail two
  seconds past the window: 6 of 9 cases failed on their assertions.
- The convolver tail was dropped. The brief calls it the one optional layer, to be dropped rather
  than replaced with an asset.
- The fake identifies the master gain as the gain node feeding the limiter, rather than having the
  production code label its nodes for the test's benefit.
- Noise buffers are generated once per context and held in a `WeakMap`, not regenerated per play.
- The manual listening check and the iOS Safari gesture check are still outstanding: there is no
  entry point to open until task 10 wires it.

## Task 07 - Keyboard and d-pad input - 2026-07-29 11:14 PM EDT

**Added**
- `src/input.js`: the frozen `KEY_MAP` covering WASD, the arrow keys, and the four D-pad ids;
  `isGameKey(code)` so the listener knows exactly when to `preventDefault`; and `vectorFrom(heldSet)`
  reducing held codes to a raw `{ dx, dy }`. Opposites cancel and unknown codes are ignored. The
  vector is left unnormalized on purpose, since that is `game.step`'s job.
- `createInput(dpadElement)` with `vector()`, `clear()`, `attach()`, and `detach()`. Keys are held,
  not tapped. `blur` and `visibilitychange` clear the held set so a key held across a phase change
  cannot leak in as phantom movement, and `pointerup`/`pointercancel` are bound on `window` as well
  as on each button so a finger released off a button's edge still stops the blob.
- `tests/input.test.js`, 11 cases: the empty set, each single direction with `up` as `dy: -1`, WASD
  and arrows agreeing, diagonals, opposites cancelling in all three combinations, a three-key case,
  unknown codes, D-pad ids matching their keys, a mixed key and D-pad diagonal, `isGameKey` on the
  eight movement codes and four non-game codes, and the map being frozen.
- `src/index.html`: D-pad markup, four real `<button>` elements with `aria-label`s and `data-code`
  attributes, plus `data-phase="title"` on `<body>` as the single visibility switch.

**Changed**
- `src/styles.css`: the D-pad as a 3x3 grid fixed bottom-centre with safe-area inset, 56 px minimum
  tap targets, `touch-action: none` so a hold is not read as a scroll, and `user-select: none`. It is
  displayed only under `@media (pointer: coarse)` and only while `body[data-phase='playing']`, so it
  never appears on the title, select, or scare screens.

**Deleted**
- Nothing.

**Notes**
- Red run against a stub with a last-key-wins reducer, no arrow or D-pad entries, and an unfrozen
  map: 8 of 11 cases failed on their assertions, including diagonals and every opposites case.
- The listeners are the untested DOM edge, per the brief. The manual desktop and mobile checklist is
  still outstanding: there is no entry point to open until task 10 wires it.

## Task 06 - Canvas rendering with fog of war - 2026-07-29 11:08 PM EDT

**Added**
- `src/render.js`: the pure transform helpers `fitTransform`, `toPixels`, `toCells`,
  `strokeWidthPx`, and `fogRadiusPx`, plus the `FIT` constant. `strokeWidthPx` is exactly
  `wallHalfThickness * 2 * scale`, so the drawn line is the geometry collision uses.
- `createRenderer(canvas)` with `resize()` and `draw(state)`. `resize` sizes the backing store by
  `devicePixelRatio` and `draw` fills black, clips to the fog disc, strokes the walls white, paints a
  radial gradient over the outer 25% of the disc so the fog edge fades, and draws the blob with a
  glow. Segments whose bounding box lies outside the fog disc are culled, which on HARD drops roughly
  1100 draw calls to a handful.
- `tests/render.test.js`, 6 cases: centring, aspect independence with swapped offsets, a
  no-overflow sweep across five viewports and all three grid sizes, the pixel round-trip, the stroke
  width identity, and fog radius ordering.

**Changed**
- `src/styles.css`: full-height black page with `overflow: hidden`, and a `#canvas` rule filling the
  viewport as a block element.

**Deleted**
- Nothing.

**Notes**
- Red run against a stub fitting the longer axis with no margin and no offsets: 5 of 6 cases failed
  on their assertions.
- No canvas mock. Compositing, the gradient, and the glow are on the manual checklist in the brief,
  which is still outstanding: the app has no entry point to open until task 10 wires it.
- Nothing is drawn during `playing` but maze, blob, and black. There is no exit marker, which would
  leak the goal through the fog, and no HUD.

## Task 05 - Game phase machine - 2026-07-29 11:05 PM EDT

**Added**
- `src/game.js`: `createGame`, `pressStart`, `startLevel`, and `step`, plus the `MAX_DT` (0.05s) and
  `SCARE_DURATION` (10s) constants. `step` clamps `dt` first, normalizes any input vector longer than
  1, resolves the move with `sweep`, and checks the exit on the post-move position. A wall hit resets
  the blob to the start cell centre and increments `hits` while leaving the maze and seed untouched.
  The scare phase accumulates elapsed time and, at `SCARE_DURATION`, returns a fresh `createGame()`
  so discarding state is structural rather than a field-by-field reset.
- `tests/game.test.js`, 22 cases: seven phase-transition cases including input being ignored outside
  `playing` and the post-scare state deep-equalling a fresh game; six movement cases covering exact
  speed, diagonal normalization, frame-rate independence, the `dt` clamp, and a fast plunge that
  reports a hit rather than tunneling; seven reset and exit cases; plus a guard that `step` never
  mutates its input and a source scan proving the module names no `document`, `window`, `Date`,
  `performance`, or `localStorage`.

**Changed**
- Nothing. `SPEC.md` section 9 already carried the phase machine, the state shape, and the movement
  rules.

**Deleted**
- Nothing.

**Notes**
- Red run against a stub that moved straight to the destination with no clamp and no sweep: 14 of 22
  cases failed on their assertions.
- The anti-tunneling and wall-hit cases raise the level's `speed` to 100 in a copied state so a
  single clamped frame covers five cells. Testing them with the shipped speed would be impossible:
  `speed * MAX_DT` is at most 0.18 cells, far short of a wall.
- Movement tests run on a copied state with `segments: []` so an open corridor is guaranteed and the
  assertions are about the movement maths, not about which seed happens to carve a straight run.

## Task 04 - Difficulty tuning table - 2026-07-29 11:03 PM EDT

**Added**
- `src/difficulty.js`: the frozen `DIFFICULTY` table for EASY, MEDIUM, and HARD, matching `SPEC.md`
  section 8 number for number; `LEVELS` in display order so the select screen cannot drift from the
  table; and `clearance(level)`, the corridor slack `0.5 - (blobRadius + wallHalfThickness)`.
- `tests/difficulty.test.js`, 11 cases: exactly three levels in `LEVELS` order, every field finite,
  the table and each level frozen against a strict-mode assignment, grid size rising and fog radius
  and clearance falling across the three levels, the `blobRadius + wallHalfThickness < 0.5`
  playability guard, `fogRadius > blobRadius * 2`, square grids, `blobRadius / 2 < exitRadius`, and
  an integration case generating and solving a real maze at each level with both the start and exit
  cell centres wall-free under that level's radii.

**Changed**
- Nothing. `SPEC.md` section 8 already carried the table and its derived invariants.

**Deleted**
- Nothing.

**Notes**
- Red run against a stub whose three levels were identical and unfrozen: 7 of 11 cases failed on
  their assertions, including every monotonicity case and the frozen-table case. The four that
  passed vacuously are covered by the real table.
- The brief lists 10 cases. An eleventh was added for `blobRadius / 2 < exitRadius`, which `SPEC.md`
  section 14 lists as an invariant but which no other task's tests assert.

## Task 03 - Swept circle collision - 2026-07-29 11:01 PM EDT

**Added**
- `src/collision.js` with `distancePointSegment`, `hitsWall`, and `sweep`. Contact is the blob
  centre-to-segment distance strictly below `blobRadius + wallHalfThickness`, so exactly touching is
  not a hit. The hot path compares squared distances while `distancePointSegment` still returns a
  real distance, since tests assert on it directly. A zero-length segment degrades to plain point
  distance instead of dividing by zero.
- `sweep` divides the move into steps no longer than `radius / 2` and tests each one, returning the
  first contact plus the last position that was itself clear. A start already in contact reports a
  hit without moving, and a zero-length move tests the current position without looping.
- `tests/collision.test.js`, 16 cases: five distance cases covering both end clamps and the
  degenerate segment, five `hitsWall` cases including the strict-inequality boundary and a real 8x8
  maze, and six `sweep` cases covering the anti-tunneling guard, the last-safe-position report, the
  sub-step count bound, the zero-length move, and starting in contact.

**Changed**
- Nothing. `SPEC.md` section 7 already carried the collision rules, so this task verified them
  against the brief rather than authoring them.

**Deleted**
- Nothing.

**Notes**
- Red run against a stub whose `sweep` tested only the destination: 10 of 16 cases failed on their
  assertions. The anti-tunneling case behaved as the brief predicts, confirmed separately against a
  point-only sweep built on the finished `hitsWall`: it reports `hit: false` for the move from
  `(0.5, 0.5)` to `(0.5, 5.5)` across five walls while still passing the clear-move case.
- No broad phase. Under 1200 segments per frame at HARD, so measure before optimizing.

## Task 02 - Seeded maze generation - 2026-07-29 10:59 PM EDT

**Added**
- `src/rng.js`: `mulberry32(seed)`, the published float stream, kept verbatim so a seed yields the
  same maze across Node versions and browsers.
- `src/maze.js`: `generate(cols, rows, rng)` carves a perfect maze with a recursive backtracker over
  an explicit stack, `toSegments(maze)` flattens it into `{x1,y1,x2,y2}` wall segments in cell units,
  and `solve(maze)` returns the BFS start-to-exit path. Passages are a `Set` of canonical
  `"c,r|c2,r2"` keys with the smaller cell first, which makes "is this boundary open" an O(1) lookup
  and makes the no-duplicate-segment property fall out of the emit order.
- `tests/maze.test.js`: 15 cases. RNG determinism, seed divergence, and range; the spanning-tree
  passage count, flood-fill reachability, and a solid border; `solve` path adjacency and no repeats;
  degenerate sizes throwing while 1x1 stays valid; and five segment cases covering the 1x1 border,
  duplicate and reversed segments, integer cell-unit coordinates, the boundary-count identity, and a
  carved passage leaving no wall behind.

**Changed**
- Nothing. `SPEC.md` sections 5 and 6 already carried the coordinate model and the generation rules,
  so this task verified them against the brief rather than authoring them.

**Deleted**
- Nothing.

**Notes**
- Red run against stub exports: 9 of 15 cases failed on their assertions, including the spanning-tree
  count (0 vs 63) and the 1x1 border segments (empty vs four). The 6 that passed vacuously were
  covered once generation was real.
- `generate` rejects any non-integer or sub-1 dimension, which covers the brief's `generate(0, 5)`
  and `generate(5, 0)` cases.
- A 24x24 maze generates in 12 ms, so the explicit stack is doing its job.
- `src/main.js` still does not import these modules; task 10 wires them, so `dist/index.html` is
  unchanged by this task.

## Task 01 - Scaffold - 2026-07-29 10:57 PM EDT

**Added**
- `package.json`: private ES-module manifest with `test` and `build` scripts and no dependency
  fields, runtime or dev.
- `build/build.js`: dependency-free bundler exporting `resolveGraph`, `stripModuleSyntax`, and
  `build`. Walks the relative-import graph depth first from `src/main.js`, emits dependencies before
  dependents, throws on an unresolvable import or a cycle with the offending path in the message, and
  substitutes `__STYLES__`, `__SCRIPT__`, and `__ASSET_JUMPSCARE__` into the HTML template. Importing
  the module never builds; only running it does.
- `src/index.html`: template with the pinch-zoom-disabled viewport meta and a
  `const JUMPSCARE_SRC` line carrying the inlined asset.
- `src/styles.css`: black page plus the `.jumpscare` overlay rules, which carry no `animation`,
  `transition`, or `@keyframes`.
- `src/main.js`: placeholder entry point so the graph walk has a root.
- `assets/jumpscare.png`: small placeholder PNG. Replacing it and rerunning `node build/build.js` is
  the entire swap procedure.
- `tests/build.test.js`: 9 cases covering output existence, zero external references, stripped module
  syntax, the inlined stylesheet, the decoded asset byte length, dependency ordering, diamond
  deduplication, unresolvable imports, and cycles.
- `tests/fixtures/{graph,diamond,missing,cycle}`: module fixtures so the ordering cases do not depend
  on the real app's module list.
- `dist/index.html`: generated, committed artifact.

**Changed**
- `.gitignore`: ignore `node_modules/`, with a note that `dist/` is deliberately not ignored.

**Deleted**
- Nothing.

**Notes**
- `SPEC.md` sections 1 to 4 were already written by the earlier consolidation pass, so this task
  verified them rather than authoring them.
- The `test` script globs `tests/**/*.test.js` so the fixture modules under `tests/fixtures/` are
  never picked up as test files.

## Docs - Audit SPEC.md against the task briefs - 2026-07-29 07:34 AM EDT

**Added**
- `SPEC.md` provenance note: the file is derived from `tasks/README.md` and the ten briefs, it
  outranks code but not `tasks/`, and a disagreement with a brief means the spec is the bug. The
  briefs carry product decisions locked with the user; `SPEC.md` did not exist when they were
  agreed.
- `SPEC.md` section 14 preamble stating the section introduces no new rule and only collects
  absolutes already asserted by tests specified in `tasks/`.

**Changed**
- `SPEC.md` section 6: replaced "a zero or negative dimension throws" with the exact cases
  `tasks/task-02-maze.md` specifies, `generate(0, 5, rng)` and `generate(5, 0, rng)`. Negative
  dimensions were an extrapolation not present in the brief.
- `SPEC.md` section 9: restored `tasks/task-05-game-state.md`'s wording for the hit counter, "tracked
  in state for possible display but is not shown by default", replacing the harder "tracked in state
  but is not displayed".

**Deleted**
- Nothing.

**Notes**
- Full audit of all fourteen sections against their briefs found no other drift. The six-column
  difficulty table, the derived clearances, `MAX_DT`, `SCARE_DURATION`, `SCREAM_DURATION`,
  `PEAK_GAIN`, `FIT`, the state shape, and all ten invariants trace to a brief.
- Two defects found in `tasks/` itself and deliberately left unfixed, since those documents carry
  the user's sign-off: `tasks/task-10-ui-wiring.md:49` asserts a build test over "eleven `src/*.js`
  modules" while the module map in `tasks/README.md` lists ten; and `tasks/task-02-maze.md:90` keeps
  `solve` available for "potentially a debug key later" while `tasks/task-10-ui-wiring.md:100`
  forbids a debug key outright.
- The earlier proposal to trim the overlapping sections out of `tasks/README.md` was dropped.

## Docs - Consolidate the task backlog into SPEC.md - 2026-07-29 07:17 AM EDT

**Added**
- `SPEC.md`, the single source of truth `AGENTS.md` and `tasks/README.md` both reference but which
  did not exist. Fourteen sections consolidating every behavioral decision from the ten task briefs:
  overview, screens, build and distribution, assets, coordinate model, maze generation, collision,
  difficulty, game phases, rendering and fog, input, audio, jumpscare, and a closing invariants list.
- The full EASY/MEDIUM/HARD tuning table with derived corridor clearance and the playability guards
  (`blobRadius + wallHalfThickness < 0.5`, `fogRadius > blobRadius * 2`, `cols === rows`).
- An "Invariants" section collecting the absolutes tests enforce mechanically: never persists, never
  networks, no flashes, no exit marker, no HUD, verbatim warning text,
  `SCREAM_DURATION < SCARE_DURATION`, and `blobRadius / 2 < exitRadius`.

**Changed**
- Nothing. No source, build, or test files were touched; `src/` is still empty.

**Deleted**
- Nothing.

**Notes**
- Every section is written rather than stubbed. `tasks/task-01-scaffold.md` expected sections 5
  onward to be TBD and filled in per task; later tasks now verify against the spec instead of
  authoring it.
- Process content stays in `tasks/`. `SPEC.md` carries behavior and numbers only: no test tables, no
  commit subjects, no changelog rules, no files-touched lists.

## Chore - Clarify AGENTS.md failing-test rationale and commit tooling - 2026-07-28 06:54 AM EDT

**Added**
- `AGENTS.md` "Commits": the `git-commit-formatter` skill requirement, and the rule that no commit
  ever carries a `Co-Authored-By` trailer or lists Claude as a co-author.

**Changed**
- `AGENTS.md` "Failing tests before features": expanded beyond the three mechanical steps to state
  that the red run is evidence the implementer understood the task's core functionality. Adds four
  practical rules: derive tests from `SPEC.md` rather than from written code, require the failure to
  be behavioral rather than a missing-module error, cover each task's core functionality with at
  least one test that would fail against a plausible wrong implementation (citing the anti-tunneling
  case in `tasks/task-03-collision.md`), and treat passing tests as the definition of done.
- `AGENTS.md` "Commits": corrected the changelog path from `changelogs/CHANGELOG.md` to
  `changelogs/CHANGELOGS.md`, which is the file that actually exists.

**Deleted**
- Nothing.

## Task 00 - Author the implementation task backlog - 2026-07-28 05:55 AM EDT

**Added**
- `tasks/README.md`: shared context for every task. Product decisions table, cell-unit coordinate
  model, module map split into pure versus DOM-edge modules, the phase machine diagram, the six
  process rules, the changelog entry format, and the execution order with dependencies.
- `tasks/task-01-scaffold.md`: `SPEC.md` skeleton, dependency-free `package.json`, `build/build.js`
  bundler, placeholder `assets/jumpscare.png`, 7 build test cases.
- `tasks/task-02-maze.md`: `src/rng.js` mulberry32 and `src/maze.js` recursive backtracker with
  `generate`, `toSegments`, `solve`. 15 test cases across RNG, generation, and segments.
- `tasks/task-03-collision.md`: `src/collision.js` with `distancePointSegment`, `hitsWall`, and
  swept `sweep`. 16 test cases including the anti-tunneling guard.
- `tasks/task-04-difficulty.md`: `src/difficulty.js` frozen EASY/MEDIUM/HARD table with the full
  number set, plus 10 test cases asserting monotonic difficulty and corridor playability.
- `tasks/task-05-game-state.md`: `src/game.js` pure phase machine, glide movement, reset-on-hit
  preserving the layout, exit detection. 20 test cases.
- `tasks/task-06-render-fog.md`: `src/render.js` canvas drawing plus the fog disc, with 6 pure
  transform test cases and a manual visual checklist.
- `tasks/task-07-input.md`: `src/input.js` keyboard and D-pad reduced to one vector, 10 test cases.
- `tasks/task-08-audio.md`: `src/audio.js` 4-second synthesized scream with a fake-context test
  seam, 8 test cases including a peak-gain safety cap.
- `tasks/task-09-jumpscare.md`: `src/jumpscare.js` 10-second fullscreen overlay, 7 test cases
  including mechanical no-flashes and no-other-UI guards that read the source as text.
- `tasks/task-10-ui-wiring.md`: title screen, level select, `src/main.js` wiring, and 8 integration
  and build test cases including a three-level automated playthrough.
- `changelogs/CHANGELOGS.md`: this file, with its header and entry format.

**Changed**
- Nothing. No source, spec, manifest, build, or test files were created in this task by design; the
  session scope was the backlog only.

**Deleted**
- Nothing.

**Notes**
- Product decisions locked with the user and encoded in the backlog: WASD/arrow and D-pad control
  only with the mouse limited to menu buttons, continuous glide with swept collision, wall hits
  resetting position while preserving the maze, seeded perfect mazes, a user-supplied jumpscare PNG
  held fullscreen for 10s with a 4s synthesized scream and no flashes, an instant return to the
  title screen, and no "YOU GOT PRANKED" screen.
- `AGENTS.md` refers to `changelogs/CHANGELOG.md` while the file in the repo is
  `changelogs/CHANGELOGS.md`. The existing filename was kept and `AGENTS.md` was left unchanged.
