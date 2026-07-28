# Task 10 - Title screen, level select, and full app wiring

**Depends on:** 06, 07, 09. **Unblocks:** nothing; this ships the app.

## Goal

When this is done the app is playable end to end: black title screen with the warning and a START
button, a difficulty select, fog-of-war gameplay on all three levels, and the jumpscare on victory
followed by a return to the title. `dist/index.html` is a single self-contained file that runs from
the filesystem or any static host.

## Spec first

Fill in the `SPEC.md` **Screens** section with the final details, and mark every remaining TBD
resolved.

- **Title:** full black screen. The warning sits at the **bottom** in white:
  `WARNING: Not suitable for those sensitive to sudden sounds or visuals.` A small `START` button is
  centred **below** the warning. Nothing else on screen: no title text, no instructions, no branding.
  The plainness is what makes it read as a bland puzzle game rather than a prank.
- **Select:** `EASY`, `MEDIUM`, `HARD` in `LEVELS` order, same visual style as START. No difficulty
  descriptions, since telling the player HARD has a smaller fog would give the game away as being
  about the fog.
- **Playing:** canvas only, plus the D-pad on touch devices. No HUD.
- **Scare:** per task 09.
- Screen visibility is driven by a single `data-phase` attribute on `<body>`; CSS shows exactly one
  screen per phase. There is no imperative show/hide scattered across the code.
- The app never persists anything and never makes a network request.

## Failing tests first

Write these before wiring `src/main.js`. The integration cases run entirely on the pure modules, so
they need no DOM. Add `tests/integration.test.js` and extend `tests/build.test.js`.

**`tests/integration.test.js`** - full playthrough on pure functions:

| Test case | Assertion |
| --- | --- |
| `a solved maze reaches the scare` | For each of the three levels: `startLevel`, then walk the blob along `solve(maze)` cell centres by driving `step` with the appropriate input vector each frame at `dt = 1/60`, and assert the phase becomes `scare` without a single wall hit. This is the proof that the generated mazes are actually traversable by a blob of that radius, which no unit test covers. |
| `the full loop returns to title` | Continuing from the scare, step 10 seconds and assert the state deep-equals `createGame()`. |
| `a second playthrough works` | From that title state, `pressStart` and `startLevel` again succeed, proving no state corruption across a loop. |
| `wall hits do not change the layout mid-run` | Deliberately drive into a wall five times during a run and assert `segments` deep-equals the original each time and `hits === 5`. |
| `no module touches persistence` | Read every file in `src/` as text and assert none contains `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, or `fetch`. Mechanical enforcement of the never-persist and no-network rules. |

**`tests/build.test.js` additions:**

| Test case | Assertion |
| --- | --- |
| `bundle includes every src module` | A known symbol from each of the eleven `src/*.js` modules appears in `dist/index.html`, so a module dropping out of the import graph fails the build rather than silently shipping a broken app. |
| `bundle has the warning text verbatim` | The exact warning string appears in the output. It must never be lost to a refactor. |
| `bundle makes no network requests` | The output contains no `fetch(`, no `XMLHttpRequest`, no `http://`, and no `https://`. |

## Implementation outline

**`src/index.html`** - three screen containers plus the jumpscare overlay:

```html
<div id="screens">
  <section data-screen="title">
    <p class="warning">WARNING: Not suitable for those sensitive to sudden sounds or visuals.</p>
    <button id="start">START</button>
  </section>
  <section data-screen="select">
    <button data-level="EASY">EASY</button>
    <button data-level="MEDIUM">MEDIUM</button>
    <button data-level="HARD">HARD</button>
  </section>
  <section data-screen="playing"><canvas id="maze"></canvas></section>
</div>
<div class="dpad">...</div>
<div class="jumpscare"><img alt=""></div>
```

Order matters on the title screen: the warning is above the button in the DOM so it reads first, and
CSS pins the pair to the lower area of the viewport.

**`src/styles.css`** - black background, white system-ui text, minimal outlined buttons with a
generous tap target. `[data-screen]` hidden by default;
`body[data-phase="title"] [data-screen="title"]` and the equivalents shown. The D-pad is shown only
for `data-phase="playing"`, and only when a coarse pointer is present
(`@media (pointer: coarse)`), so desktop never sees it.

**`src/main.js`** - the only stateful file:

1. Query the elements, `createRenderer(canvas)`, `createInput(dpad)`,
   `createAudio(window.AudioContext || window.webkitAudioContext)`,
   `createJumpscare(overlay, img, audio, onFinish)`.
2. `let state = createGame();` and a `render()` that sets `body.dataset.phase` and shows or hides the
   overlay whenever the phase changes.
3. START click: `audio.unlock()` **inside the handler** (required for the scare to be audible at all),
   then `state = pressStart(state)`.
4. Level click: `state = startLevel(state, level, Date.now() ^ (Math.random() * 2 ** 32))` for a
   fresh maze each play. `Date.now()` is used only for the seed, never for game timing.
5. rAF loop: `dt = (now - last) / 1000`, `state = step(state, dt, input.vector())`, then draw if
   `playing`. Track the previous phase so entering `scare` triggers `jumpscare.show()` and leaving it
   triggers `hide()` plus `input.clear()`.
6. `resize` listener calls `renderer.resize()`. Nothing else responds to resize.
7. The loop runs continuously in every phase, since `step` also advances the scare clock.

Do not add a pause, a debug key, or a level-skip. Anything that lets a tester reach the exit without
playing is also something a victim can stumble into.

## Files touched

**Created:** `tests/integration.test.js`.

**Modified:** `src/main.js`, `src/index.html`, `src/styles.css`, `tests/build.test.js`, `SPEC.md`,
`changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild, committed).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes, including the three-level playthrough; every case observed red first.
- `node build/build.js` succeeds and the committed `dist/index.html` opens directly from the
  filesystem with an empty Network tab apart from the document itself.
- `SPEC.md` has no remaining TBD sections.
- Full manual playthrough of each difficulty, desktop and mobile:
  - Title shows the warning at the bottom with START below it, on black, nothing else.
  - START goes to the three difficulty buttons.
  - Gameplay shows only the fog disc; harder levels are visibly tighter and blinder.
  - Scraping a wall snaps back to the start with the layout unchanged.
  - Reaching the bottom-right fires the image and scream immediately, holds 10 seconds with nothing
    else on screen, then returns to the title.
  - START works again immediately and generates a different maze.
- Confirm the user's real `assets/jumpscare.png` is in place before the final build, or flag clearly
  that the placeholder is still committed.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(ui): add title screen, level select, and app wiring
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 10 - Title screen, level select, and wiring - <date> <time> EDT` with
Added / Changed / Deleted. Note in the entry that the app is playable end to end as of this task.
