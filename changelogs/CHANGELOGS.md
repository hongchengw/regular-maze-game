# Changelog

Newest first. One entry per completed task.

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
