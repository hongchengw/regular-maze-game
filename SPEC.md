# SPEC

The source of truth for every behavior of this app. Behavior changes land here first, then in code.
If code and this file disagree, this file wins and the code is a bug.

**Provenance.** This file is derived from `tasks/README.md` and the ten briefs in `tasks/`, whose
product decisions were locked with the user before it existed. It outranks code, not `tasks/`. If
this file and a brief disagree, the brief is right and this file is the bug.

## 1. Overview

A blind maze game whose real payload is a jumpscare.

The player glides a small blob from the top-left of a maze to the bottom-right. Only a small
fog-of-war circle around the blob is visible; the rest of the screen is black. Touching a wall sends
the blob back to the start cell of the same maze. Reaching the exit fires a fullscreen jumpscare
image for 10 seconds with a 4-second scream, after which the app returns to the title screen.

The title screen carries the app's only forewarning: `WARNING: Not suitable for those sensitive to
sudden sounds or visuals.` It must never be removed.

## 2. Screens

Four phases, four screens, nothing else. Visibility is driven by a single `data-phase` attribute on
`<body>`; CSS shows exactly one screen per phase. No imperative show/hide scattered across the code.

| Screen | Contents |
| --- | --- |
| `title` | Full black. The warning text at the bottom in white, a small `START` button centred below it. No title text, no instructions, no branding. |
| `playing` | Canvas only, plus the D-pad on coarse-pointer devices. No HUD. |
| `levelup` | Full black. The text `LEVEL n OF 3` centred, nothing else. Holds for `LEVELUP_DURATION`, then the next maze begins. No buttons: it is a beat, not a screen the player acts on. |
| `scare` | The jumpscare overlay only. See section 13. |

The plainness of the title screen is deliberate: it must read as a bland puzzle game rather than a
prank.

There is **no difficulty select screen**. The three levels are played in order (section 9), so there
is nothing to choose. Naming the levels on a menu would also have given away that the game is about
the fog.

> Sections 2, 8, 9, 10, and 12 describe behaviour agreed after QA and specified ahead of the code.
> Until `tasks/task-11` through `tasks/task-15` are executed, the code implements the previous
> behaviour and is, per the rule at the top of this file, the bug.

## 3. Build and distribution

- `dist/index.html` is a single self-contained file. It runs from the filesystem or any static host.
- Zero external requests: no external scripts, stylesheets, fonts, images, or network calls of any
  kind. Assets are inlined as base64 data URIs.
- The repo has zero npm dependencies, runtime or dev. Tests use the built-in `node:test` runner.
- `dist/index.html` is a committed artifact. It is rebuilt and committed whenever `src/` changes.
- The bundler concatenates every `src/` module body into one scope, so **top-level names across
  `src/` must be globally unique**.
- An unresolvable import fails the build loudly with the offending path, rather than emitting a
  broken bundle.

**Inlining is escaped.** Module bodies land inside a `<script>` block and the stylesheet inside a
`<style>` block, so a source file containing `</script>`, `</style>`, or `<!--` would otherwise close
its own block and inject arbitrary markup into the artifact.

- In the JavaScript payload the bundler rewrites `</script` to `<\/script` and `<!--` to `<\!--`.
  Both forms are valid inside string literals, comments, and regular expressions, so the escape can
  never change the meaning of the code.
- CSS has no equivalent safe escape, so a stylesheet containing `</style` **fails the build** with the
  offending file named, rather than shipping a bundle that can be broken out of.

**The bundle carries a Content-Security-Policy.** A `<meta http-equiv="Content-Security-Policy">` in
`<head>`, before the script, enforces the zero-external-requests rule at runtime rather than leaving
it to a grep in the test suite:

```
default-src 'none'; img-src data:; script-src 'sha256-...'; style-src 'sha256-...';
base-uri 'none'; form-action 'none'
```

The two hashes are computed at build time over exactly the script and style text that ships, so a
tampered or accidentally corrupted bundle refuses to execute rather than running modified code.
`frame-ancestors` is absent from this policy only because it is ignored in a `<meta>` policy. It is
sent as a real response header instead, where a host allows one (see below).

## 3a. Deployment

The artifact is a static file, so any host that can serve one will do. `vercel.json` configures the
one the project deploys to:

- `outputDirectory` is `dist`, `buildCommand` is `npm run build`, and `framework` is null. There is
  nothing to install, since the project has no dependencies.
- The publish directory must always be the directory the build actually writes to. That is asserted
  by running the real build, not by matching a string.

A host can set response headers, which the document cannot set for itself:

- `Content-Security-Policy: frame-ancestors 'none'` stops the game being embedded. This **does**
  protect something real: the title screen's warning is the player's only forewarning, and an
  embedder can size or position an iframe so that only the START button is visible and the warning is
  cropped out of view. Framing is refused rather than trusted. `X-Frame-Options: DENY` says the same
  thing to older clients.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a `Permissions-Policy`
  denying camera, microphone, geolocation, payment, and USB, none of which the game uses.
- `Cache-Control: public, max-age=0, must-revalidate`. The whole app is one HTML file, so a stale
  cached copy is a stale app.

**The header policy is framing-only, deliberately.** Content-Security-Policy headers and meta
policies combine by intersection, so a `script-src` or `style-src` sent by the host would also have
to allow the bundle's hashes, and would silently blank the app if it did not. The hashes belong to
the artifact, which is the only thing that knows them.

## 4. Assets

`assets/jumpscare.jpg` is supplied by the user and is the real scare image, not a placeholder.

Replacing that file and rerunning `npm run build` is the entire swap procedure. The **media type of
the data URI is derived from the file's extension**, so swapping in a different format is also just a
file swap: `.png`, `.jpg`/`.jpeg`, `.webp`, `.gif`, and `.avif` are recognised. An unrecognised
extension fails the build with the offending path, rather than emitting a data URI whose declared
type is a guess the browser will refuse to decode.

No audio file ships. The scream is synthesized at runtime (section 12).

## 5. Coordinate model

All game state is in **cell units**. The maze is `cols` x `rows` cells with the origin at the
top-left. A cell is 1.0 x 1.0, and cell `(c, r)` has centre `(c + 0.5, r + 0.5)`. Blob radius, wall
half-thickness, fog radius, exit radius, and speed are all expressed in cell units.

Only the renderer knows about pixels. It derives a single `scale` (px per cell) plus a centring
offset. A window resize recomputes `scale` only and never touches game state.

Screen coordinates: y grows downward, so `up` is `dy: -1`.

## 6. Maze generation

- Seeded by `mulberry32(seed)`, a deterministic float stream in `[0, 1)`. The same seed always
  produces the same maze.
- Carved by a recursive backtracker: depth-first carve with the four neighbours shuffled by the RNG,
  implemented with an explicit stack.
- The result is a **perfect maze**: exactly one path between any two cells, no loops, no isolated
  cells. Carved passage count equals `cols * rows - 1` and a flood fill from `(0, 0)` reaches every
  cell.
- Start is cell `(0, 0)`. Exit is cell `(cols - 1, rows - 1)`.
- The outer border is always solid. There is no entrance gap and no exit gap; start and exit are
  interior cells.
- Walls are line segments `{ x1, y1, x2, y2 }` in cell units, lying on cell boundaries. Each
  boundary is emitted exactly once, so a wall shared by two cells is never duplicated and no segment
  is the reverse of another. Every coordinate is an integer in `[0, cols]` for x and `[0, rows]` for
  y.
- `generate(0, 5, rng)` and `generate(5, 0, rng)` throw. A 1x1 maze is valid and yields only the four
  border segments.
- `solve` returns the start-to-exit path by BFS over carved passages, visiting no cell twice. It
  serves tests, not gameplay.

`generate(cols, rows, rng)` takes the RNG function rather than a seed, so callers own the seed
policy. A fresh seed is drawn per play.

## 7. Collision

The blob is a circle of radius `blobRadius`. Walls are segments of half-thickness
`wallHalfThickness`.

- **Contact** is the distance from the blob centre to a wall segment being **strictly less than**
  `blobRadius + wallHalfThickness`. Exactly touching is not a hit; the boundary case goes to the
  player.
- Distance to a segment clamps the projection parameter to `[0, 1]`, so the ends are handled
  correctly. A zero-length segment degrades to plain point distance and never yields `NaN`.
- A move is resolved by **sweeping**: the straight path from the old position to the new is divided
  into steps no longer than `blobRadius / 2`, and each intermediate position is tested. The first
  contact stops the move and reports the hit, along with the last position that was itself clear.
  A fast flick or a long frame delta therefore cannot tunnel through a wall.
- A zero-length move tests the current position and returns without looping.
- If the start position is already in contact, the sweep reports a hit immediately and does not move.
- `sweep` itself never slides and never bounces. A hit is a hit, and the game layer decides the
  consequence. Sliding is achieved in section 9 by sweeping each axis separately, which is a decision
  of the game layer and not of this module. `src/collision.js` needs no change to support it.

Broad-phase acceleration is deliberately out of scope. A 24x24 maze has under 1200 segments and this
runs once per frame.

## 8. Difficulty

Three levels, defined in one frozen table. Every tunable number in the game lives there and nowhere
else. Harder means a larger grid, a fatter blob relative to the corridor, and a smaller fog radius.

| Field | Unit | EASY | MEDIUM | HARD |
| --- | --- | --- | --- | --- |
| `cols` x `rows` | cells | 10 x 10 | 16 x 16 | 24 x 24 |
| `blobRadius` | cells | 0.16 | 0.18 | 0.22 |
| `wallHalfThickness` | cells | 0.04 | 0.035 | 0.03 |
| `fogRadius` | cells | 2.4 | 1.8 | 1.3 |
| `speed` | cells per second | 3.2 | 3.4 | 3.6 |
| `exitRadius` | cells | 0.30 | 0.28 | 0.25 |

`LEVELS` is `['EASY', 'MEDIUM', 'HARD']` and is **the order the levels are played in** (section 9),
so the progression cannot drift from the table.

Derived facts and invariants:

- **Corridor clearance** is `0.5 - (blobRadius + wallHalfThickness)`, the slack between the blob's
  edge and a wall when the blob is centred in a corridor: EASY 0.30, MEDIUM 0.285, HARD 0.25. It
  must stay strictly positive at every level and must decrease strictly with difficulty.
- `blobRadius + wallHalfThickness < 0.5` at every level. This is the playability guard.
- `fogRadius > blobRadius * 2` at every level, so the player can always see the passage they occupy.
- `cols === rows` at every level.
- Because the renderer fits the whole maze to the viewport, a larger grid means fewer pixels per
  cell, which is what makes HARD corridors visually tight without changing the cell-unit geometry.
- `fogRadius` maps to roughly 140 px (EASY), 68 px (MEDIUM), and 32 px (HARD) on a 900 px tall
  viewport. These are the intent; the table above is the source of truth if they are retuned.
- `speed` rises slightly with difficulty so harder levels do not feel sluggish across a bigger grid.

## 9. Game phases

```
title --START--> playing(EASY) --exit--> levelup --1s--> playing(MEDIUM) --exit--> levelup --1s-->
playing(HARD) --exit--> scare --after 10s--> title
```

**The three levels are played in order, every time.** There is no level select and no way to skip
ahead: EASY, then MEDIUM, then HARD, and only the exit of HARD fires the scare. `LEVELS` in section 8
is the order.

- `title`: no game state exists yet. START begins EASY directly.
- `playing`: the blob starts at the centre of cell `(0, 0)` and glides at `speed` cells per second
  in the held direction. Movement is resolved by the sweep in section 7, one axis at a time.
- **Wall contact blocks, it does not teleport.** The blob stops against the wall on the blocked axis
  and keeps moving on the other, so it slides along walls. Its position is never reset to the start,
  and the maze, seed, and level are untouched. `hits` counts frames in which a wall blocked movement;
  it is diagnostic only and is displayed nowhere.
- **Exit reached:** when the blob centre is within `exitRadius` of the centre of cell
  `(cols - 1, rows - 1)`, the level ends immediately. If a later level exists the phase becomes
  `levelup`; if the level was HARD the phase becomes `scare`. No win screen and no sound cue before
  the scare.
- `levelup`: holds for exactly `LEVELUP_DURATION`, then generates the next level's maze and returns
  to `playing`. The blob is placed at the new maze's start cell.
- `scare`: lasts exactly `SCARE_DURATION`, then the phase becomes `title` and all game state is
  discarded by returning a fresh initial state.
- Input is ignored in every phase except `playing`.
- An unknown level name throws. The lookup checks **own** properties only, so an inherited key such
  as `__proto__`, `constructor`, or `toString` is an unknown level like any other and raises the same
  error, rather than passing a truthiness guard and failing later with an arithmetic message.

**Seeds are derived, not injected.** Only the first level's seed comes from the caller; each
subsequent level's seed is derived from the previous one. This keeps `step` free of `Date`,
`performance`, and `Math.random`, which is what lets the whole three-level run be replayed from a
single starting seed in a test.

Constants: `MAX_DT = 0.05` seconds, `SCARE_DURATION = 10` seconds, `LEVELUP_DURATION = 1` second.

Movement rules:

- `dt` is clamped to `MAX_DT` before anything else, so a background tab regaining focus cannot let
  the blob jump the maze.
- An input vector longer than 1 is normalized, so the blob's speed is identical in all eight
  directions.
- Movement is frame-rate independent: two steps of `dt = 0.5` land where one step of `dt = 1.0`
  lands.
- **Each axis is swept separately**, x first and then y, which is what produces wall sliding. Both
  sweeps use the same sub-stepping as section 7, so neither axis can tunnel a wall.
- The exit check happens **after** the move, on the post-move position, so a blob passing through at
  full speed still ends the level on that same step. A blob cannot sweep past the exit inside one
  sub-step: sub-steps are at most `blobRadius / 2` (0.11 at most) and `exitRadius` is at least 0.25.
  A future retune must preserve `blobRadius / 2 < exitRadius`.

State shape (plain data, no classes, safe to structured-clone):

```js
{ phase: 'title'|'playing'|'levelup'|'scare',
  levelName: null|'EASY'|'MEDIUM'|'HARD',
  level: null|<frozen difficulty entry>,
  levelIndex: 0,
  seed: null|number,
  maze: null|{ cols, rows, passages },
  segments: null|[{x1,y1,x2,y2}],
  pos: null|{ x, y },
  start: null|{ x, y },
  exit: null|{ x, y },
  hits: 0,
  levelupElapsed: 0,
  scareElapsed: 0 }
```

API: `createGame()`, `pressStart(state, seed)`, `startLevel(state, levelName, seed)`, and
`step(state, dt, input)` where `input` is `{ dx, dy }`. `step` returns a new state object and never
mutates its input. The module knows nothing of `document`, `window`, `Date`, or `performance`.
`startLevel` remains exported and directly callable, since it is what makes a single level testable
in isolation.

## 10. Rendering and fog

- Background is pure black `#000`. Walls are white `#fff` lines. The blob is a filled white circle of
  radius `blobRadius * scale` with a soft glow.
- The viewport transform is the only place pixels exist:
  `scale = min(width, height) * FIT / max(cols, rows)` with `FIT = 0.92` to leave a margin, plus an
  offset that centres the maze. It is aspect independent: a portrait and a landscape viewport of the
  same dimensions yield the same `scale` with the offsets swapped, and the maze never overflows
  either axis.
- Wall stroke width is `wallHalfThickness * 2 * scale`, so the drawn line matches exactly the
  geometry collision uses. A visible wall the blob passes through, or an invisible wall it hits, is a
  bug.
- **Fog of war:** only the disc of radius `fogRadius * scale` centred on the blob is visible. Outside
  it the screen is fully black, not dimmed. The edge fades over roughly the outer 25% of the radius
  so the boundary is not a hard cookie-cutter.
- **The exit is marked, but only from close range.** The marker is drawn inside the fog clip like the
  walls, so it is invisible until the player is within `fogRadius` of it, and it never reveals the
  goal from across the maze. It is drawn in a distinct hue rather than wall-white so it cannot be
  mistaken for a wall, and it pulses slowly so arriving at it is unmistakable.
  - The pulse is slow and low-contrast: a period of roughly 1.4 seconds, varying alpha and radius
    between gentle bounds. It never approaches a strobe, and it is confined to `playing`. This has no
    bearing on section 13, whose no-animation and no-flash rules remain absolute.
  - Because the marker animates, the frame-skip rule below does not apply while it is on screen.
- Nothing else is drawn during `playing`: no HUD, no timer, no hit counter, no minimap.
- The canvas backing store accounts for `devicePixelRatio` so lines stay crisp on retina and mobile,
  but the ratio is **capped at 2**. A phone reporting 3 would otherwise allocate and fill 9x the
  pixels every frame for a difference no one can see on a maze drawn in flat white on black.
- Rendering is a pure function of state plus canvas size and never mutates game state. A resize
  recomputes the transform only; the blob keeps its position in the maze.

Frame cost rules, which exist because this runs on phones:

- **Nothing is allocated per frame.** The fog gradient and the blob's halo are built once per radius
  and reused, drawn by translating the canvas rather than by rebuilding a gradient at a new centre.
  Segment drawing computes pixel coordinates inline rather than allocating a point per endpoint.
- **No `shadowBlur`.** The blob's glow is a cached radial gradient. Canvas shadow blur is among the
  most expensive 2D operations and is worst on exactly the mobile GPUs this needs to run on.
- **A frame that would not change anything is skipped.** If the blob has not moved and the canvas has
  not been resized since the last draw, the draw is skipped entirely. The exit marker's pulse is the
  one exception: while the marker is within the fog and therefore on screen, every frame is drawn,
  because a skipped frame would freeze the pulse.
- Resize events are coalesced into a single `requestAnimationFrame`, because a mobile browser fires
  them continuously while its address bar slides and each one otherwise reallocates the backing
  store.
- Segment culling stays a plain bounding-box scan. Measured at 0.02 ms (EASY) to 0.07 ms (HARD) per
  frame against a 16.7 ms budget, with 625 segments reduced to 6 drawn, so a spatial index would buy
  nothing. Measure before replacing it.

## 11. Input

- **Desktop:** `W`/`A`/`S`/`D` and the four arrow keys, both sets always active, no mode switch. Keys
  are **held**, not tapped: the blob glides while a key is down.
- **The mouse is never used during gameplay.** It clicks the START button and the difficulty buttons
  and nothing else. No mouse-follow, no click-to-move, no drag.
- **Touch:** an on-screen D-pad of four buttons in a cross. Holding a button is equivalent to holding
  the matching key, and two fingers on adjacent buttons give a diagonal. Buttons are real `<button>`
  elements with `aria-label`s and tap targets of at least 56 px.
- Keyboard codes and D-pad ids share one map and one code path, so desktop and touch produce
  identical movement.
- Opposite directions held simultaneously cancel: `left + right` gives `dx = 0`. Unknown codes are
  ignored, and "unknown" is decided by **own** properties of the key map, so an inherited key such as
  `constructor` or `toString` is ignored like any other unrecognised code.
- The vector is raw, for example `up + right` is `{dx: 1, dy: -1}`. Normalization is `step`'s job.
- The D-pad is visible only during `playing`, and only where a coarse pointer is present. It never
  appears on the title, levelup, or scare screens.
- Held state is cleared whenever gameplay ends and on window blur or `visibilitychange`, so a key
  held across a phase change does not leak in as phantom movement.
- Handled keys call `preventDefault()` so arrow keys never scroll the page. The viewport disables
  pinch-zoom so D-pad taps do not zoom, and the buttons set `touch-action: none` so a hold is not
  read as a scroll.
- The page suppresses `overscroll-behavior` so pull-to-refresh cannot fire mid-glide, and the D-pad
  suppresses the long-press context menu and the iOS callout, both of which otherwise interrupt a
  held direction.
- Full-viewport heights use `dvh` where supported, falling back to `vh`. A mobile browser's sliding
  address bar makes `vh` the wrong height for most of a session.
- `pointerup` and `pointercancel` are bound on `window` as well as on the buttons, because a finger
  released outside a button's bounds would otherwise leave the blob stuck moving. That window-level
  release clears **only the D-pad codes**, never held keyboard keys: a mouse click anywhere on the
  page must not stop a blob being glided with WASD.

## 12. Audio

- The scare sound is **synthesized with the Web Audio API**. No audio file, no base64 audio blob.
- `SCREAM_DURATION` is exactly **4.0 seconds**, ending in silence, while the image stays up for
  `SCARE_DURATION` (10 seconds). The last 6 seconds are deliberately silent: the image lingering in
  silence is more unsettling than a looping noise. `SCREAM_DURATION < SCARE_DURATION` always holds.
- Peak output is capped by a master gain of `PEAK_GAIN = 0.45` (at most 0.5), with a
  `DynamicsCompressor` before the destination as a safety limiter. Startling, not damaging.
- Nothing is scheduled before the start time and nothing outlives `startTime + SCREAM_DURATION`.
- The `AudioContext` is created **inside the START click handler**, because browsers block audio
  started outside a user gesture. `unlock()` is safe to call repeatedly.
- If the Web Audio API is unavailable or the context fails to resume, the visual scare still runs.
  Audio failure never blocks the jumpscare and never throws into the animation loop.
- The title screen is silent, and wall contact makes no sound. There are no other sound effects of
  any kind.

**Background music.** Very quiet ambient music plays while the player is in the maze:

- **Synthesized too.** No audio file and no base64 audio, for the same reason as the scream: the
  bundle stays one self-contained file with zero external requests.
- `MUSIC_GAIN` is at most `0.06`, against the scream's `PEAK_GAIN` of `0.45`. It is meant to sit at
  the edge of hearing and set unease, never to be listened to. It must be quiet enough that the
  scream is still a shock and not merely the next loud thing.
- A sustained drone rather than a melody or a loop: low detuned oscillators through a lowpass, with
  slow LFOs moving the filter and the gain so it breathes without ever restarting. No timers, no
  scheduling loop, and no loop point to hear.
- It plays during `playing` and continues through `levelup`, so the handover between levels is not
  punctuated by silence.
- **It stops the instant the phase becomes `scare`**, before the scream is scheduled. The scream
  landing into sudden silence is the contrast the whole app is built around, and music bleeding under
  it would blunt exactly that.
- Starting it twice must not stack a second voice, and stopping ramps down rather than clicking off.
- Like the scream, it fails silently: music that cannot start must never block the jumpscare or throw
  into the animation loop.

Sound design, four layers scheduled at once over the 4 seconds, no timers:

| Layer | Description | Envelope |
| --- | --- | --- |
| Impact | Short white-noise burst through a lowpass sweeping 8 kHz down to 200 Hz | 0 to 0.25s, sharp attack |
| Scream body | Two `sawtooth` oscillators detuned about 15 cents, gliding 1200 Hz down to 180 Hz | 0.02s attack, hold to 2.8s, decay to 3.4s |
| Grit | Bandpass-filtered white noise tracking the scream's pitch | Follows the scream, lower gain |
| Sub | Sine at 55 Hz for chest weight | 0 to 1.2s, slow decay |

A small convolver with a procedurally generated 1.5s noise impulse response may add a tail. It is
the one optional layer and is dropped rather than replaced with an asset. Noise buffers are generated
once and reused.

## 13. Jumpscare

- The image is `assets/jumpscare.jpg`, inlined as a base64 data URI. It is preloaded at app startup,
  not on show, so the first frame is never blank.
- It covers the **entire screen**: fixed position, full viewport, `object-fit: cover`, black behind
  it so any letterboxing reads as black.
- Duration is exactly 10 seconds, then the overlay is removed and the app is at the title screen
  **instantly**. No fade, no transition, no intermediate screen.
- **No flashes.** The image appears once and holds perfectly still. No strobing, shaking, jitter,
  opacity animation, scale animation, or filter animation. This is a hard requirement, not a
  stylistic preference: the `.jumpscare` styles contain no `animation`, no `transition`, and no
  `@keyframes`.
- **No other UI.** While the scare is up there is no text, no buttons, no D-pad, no canvas, and no
  cursor. The overlay markup contains exactly one `<img alt="">` and no text nodes. Every other
  screen element is hidden, not merely covered.
- **There is no "YOU GOT PRANKED" screen and no PLAY AGAIN button.** The app returns straight to the
  title screen, whose START button is the replay path.
- The scream starts with the image and runs 4 seconds, leaving 6 seconds of silent image.
- The 10-second timing is owned by `step`, not by a `setTimeout` in the overlay. The overlay is
  purely a function of `state.phase`, so there is one clock, no drift, and no orphaned timer.
- After the return to title the app is in its initial state, identical to a fresh `createGame()`.

## 14. Invariants

Absolutes that hold across the whole app and are enforced mechanically by tests. This section states
no new rule: every item is asserted by a test specified in `tasks/`, collected here so the absolutes
are readable in one place.

- **Never persists.** No `localStorage`, `sessionStorage`, `indexedDB`, or `document.cookie` anywhere
  in `src/`. No scores, no settings, no progress.
- **Never networks.** No `fetch`, no `XMLHttpRequest`, no `http://` or `https://` in the bundle.
  Opening `dist/index.html` shows only the document itself in the Network tab. The Content-Security-
  Policy in section 3 enforces this at runtime as well as in the tests.
- **Never breaks out of its own blocks.** No inlined source can terminate the `<script>` or `<style>`
  block that carries it. The bundle's inline script and style match the CSP hashes that ship with it.
- **Never trusts an inherited key.** Every lookup of a caller-supplied string against a map checks
  own properties only.
- **Never framed.** The deployment refuses embedding, so the warning cannot be cropped out of view by
  a host page.
- **The deployment's header policy never carries `script-src` or `style-src`**, which would blank the
  app by intersecting away the bundle's own hashes.
- **No flashes** in the jumpscare styles.
- **No HUD** during `playing`, and **the exit is never visible from outside the fog radius**. The
  marker exists, but a player who has not reached its neighbourhood cannot see where it is.
- **Music never overlaps the scream.** It is stopped before the scream is scheduled.
- **Every level is played, in order.** There is no level select, no skip, and no way to reach the
  scare without finishing HARD.
- The warning text appears verbatim in the bundle.
- `SCREAM_DURATION < SCARE_DURATION`.
- `blobRadius / 2 < exitRadius` at every level, so a moving blob cannot skip the exit.
- `blobRadius + wallHalfThickness < 0.5` at every level, so every corridor is passable.
- Every `src/*.js` module appears in the bundle, so a module dropping out of the import graph fails
  the build rather than shipping a broken app.
- There is no pause, no debug key, and no level skip. Anything that lets a tester reach the exit
  without playing is something a victim can stumble into.
