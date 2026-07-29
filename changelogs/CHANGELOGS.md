# Changelog

Newest first. One entry per completed task.

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
