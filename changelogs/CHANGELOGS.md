# Changelog

Newest first. One entry per completed task.

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
