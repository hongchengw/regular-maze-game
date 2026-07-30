# Task Backlog

Implementation briefs for the fog-of-war maze prank game. One file per task, one commit per task.
Read this file first, then the task file you are executing. Shared context lives here so the task
files stay short.

## What the app is

A blind maze game whose real payload is a jumpscare. The player glides a small blob from the
top-left of a maze to the bottom-right. Only a small fog-of-war circle around the blob is visible;
the rest of the screen is black. Touching a wall sends the blob back to the start of the same maze.
Reaching the exit fires a fullscreen jumpscare image for 10s with a 4s scream, after which the app
returns to the START screen.

## Product decisions (fixed, do not relitigate)

| Area | Decision |
| --- | --- |
| Desktop controls | WASD and arrow keys only. The mouse is used solely to click the START button, never during gameplay. |
| Touch controls | On-screen 4-button D-pad. Multi-touch two buttons for diagonals. |
| Movement | Continuous glide at constant speed while a direction is held. Diagonals normalized. |
| Collision | Swept in sub-steps along each frame's movement so fast motion cannot tunnel a wall. |
| On collision | The wall blocks the blocked axis and the blob slides along the wall. It is never moved back to the start. |
| Progression | All three levels are played in order, EASY then MEDIUM then HARD, separated by a one-second `LEVEL n OF 3` beat. There is no level select. Only the exit of HARD fires the scare. |
| Exit | Marked with a slowly pulsing marker, drawn inside the fog so it is invisible until the player is near it. |
| Maze | Seeded perfect maze from a recursive backtracker. Fresh seed per play, deterministic under a fixed seed. |
| Audio during play | Very quiet synthesized ambient music, stopped the instant the scare begins. No other sound effects. |
| Jumpscare | User-supplied `assets/jumpscare.jpg` fullscreen for exactly 10s, synthesized scream for 4s. No flashes, no text, no buttons, nothing else on screen. |
| After jumpscare | Overlay removed at 10s, app instantly back at the START screen. There is no "YOU GOT PRANKED" screen and no PLAY AGAIN button. |
| Assets | Inlined as base64 data URIs. `dist/index.html` is one self-contained file with zero external requests. |
| Dependencies | None. No runtime deps, no dev deps. Tests use the built-in `node:test` runner. |

### Decisions changed after QA (2026-07-30)

The table above is current. These four rows previously said the opposite, and were changed by the
user after play-testing the finished game. They are recorded rather than silently overwritten,
because tasks 01 to 10 were executed against the originals and their briefs still describe them.

| Area | Was | Now | Why |
| --- | --- | --- | --- |
| On collision | Blob returns to the start cell | Blocks and slides along the wall | A single graze restarting a 24x24 blind maze was punishing rather than tense |
| Progression | Player picks one difficulty and plays it | All three levels in order, then the scare | Every player should see the whole game before the payload |
| Exit | Never marked, since marking leaks the goal | Marked, but only visible from within the fog | Reaching the exit gave no signal that anything had been achieved |
| Audio during play | Silent, so the scare lands harder | Very quiet ambient music, cut at the scare | Silence read as the game being broken rather than tense |

The reasoning behind the originals still holds and is why each replacement is narrow: the exit marker
is invisible until you are on top of it, and the music is quiet enough and stops early enough that
the scream still lands in silence.

## Coordinate model

All game state is in **cell units**. The maze is `cols` x `rows` cells with the origin at the
top-left. A cell is 1.0 x 1.0. Blob radius, wall half-thickness, fog radius, and speed are all
expressed in cell units.

Only the renderer knows about pixels. It derives a single `scale` (px per cell) plus a centering
offset to fit the maze in the viewport. A window resize recomputes `scale` only and never touches
game state, which is what makes the app responsive for free.

## Module map

Pure and node-testable (no DOM, no Web APIs):

| Module | Responsibility |
| --- | --- |
| `src/rng.js` | `mulberry32(seed)` seeded float stream |
| `src/maze.js` | `generate`, `toSegments`, `solve` |
| `src/collision.js` | `distancePointSegment`, `hitsWall`, `sweep` |
| `src/difficulty.js` | frozen EASY / MEDIUM / HARD tuning table |
| `src/game.js` | phase machine and pure `step(state, dt, input)` |

Thin DOM and Web API edges (not unit tested, verified by hand):

| Module | Responsibility |
| --- | --- |
| `src/render.js` | canvas draw plus radial fog compositing |
| `src/input.js` | keyboard and D-pad reduced to one `{dx, dy}` vector |
| `src/audio.js` | `unlock()` on the START gesture, 4s synthesized scream |
| `src/jumpscare.js` | 10s fullscreen overlay, then return to title |
| `src/main.js` | requestAnimationFrame loop, screen switching, wiring |

The reason all logic is kept out of the DOM modules is that there is no jsdom. Anything worth
testing must be importable in plain Node.

## Phase machine

```
title --START--> playing(EASY) --exit--> levelup --1s--> playing(MEDIUM) --exit--> levelup --1s-->
playing(HARD) --exit--> scare --10s--> title
```

A wall no longer changes the phase or the position: it blocks the axis being pressed into it and the
blob slides along it.

## Process rules

1. **Spec first.** `SPEC.md` is the source of truth. Write or extend the relevant spec section
   before touching code. If code and spec disagree, the spec wins and the code is a bug.
2. **Failing tests first.** Write the tests from the spec, run them, and confirm they fail for the
   reason you expect. Only then implement. A task is complete only when its tests pass.
3. **Before every commit:** `npm test` and `node build/build.js` must both succeed. `dist/index.html`
   is a committed artifact, so rebuild and commit it whenever `src/` changes.
4. **Changelog.** On completing a task, prepend an entry to `changelogs/CHANGELOGS.md` (newest
   first) with the task number, a summary of everything added, changed, or deleted, and the real
   current date and time in EDT.
5. **Commits.** One commit per task. Use the `git-commit-formatter` skill to write the message.
   **Never add a `Co-Authored-By` trailer, and never list Claude as a co-author.**
6. **Never edit `README.md`.** No task touches it.

## Changelog entry format

```markdown
## Task 03 - Swept circle collision - 2026-07-28 09:15 AM EDT

**Added**
- `src/collision.js` with `distancePointSegment`, `hitsWall`, and `sweep`.
- `tests/collision.test.js`, 7 cases covering grazing contact and anti-tunneling.

**Changed**
- `SPEC.md`: new "Collision" section defining contact as centre-to-segment distance below
  `blobRadius + wallHalfThickness`.

**Deleted**
- None.
```

## Execution order

| Task | File | Depends on |
| --- | --- | --- |
| 01 | `task-01-scaffold.md` | none |
| 02 | `task-02-maze.md` | 01 |
| 03 | `task-03-collision.md` | 01 |
| 04 | `task-04-difficulty.md` | 01 |
| 05 | `task-05-game-state.md` | 02, 03, 04 |
| 06 | `task-06-render-fog.md` | 05 |
| 07 | `task-07-input.md` | 05 |
| 08 | `task-08-audio.md` | 01 |
| 09 | `task-09-jumpscare.md` | 05, 08 |
| 10 | `task-10-ui-wiring.md` | 06, 07, 09 |

Critical path: 01 -> 02 -> 03 -> 05 -> 06 -> 10. Task 04 and task 08 can be done any time after 01.
The app is only playable end to end after task 10.

### QA changes (tasks 11 to 15)

Tasks 01 to 10 shipped the game. These five come from play-testing it and are specified in `SPEC.md`
before any of them is executed, so the code trails the spec until they are done.

| Task | File | Depends on | Changes |
| --- | --- | --- | --- |
| 11 | `task-11-wall-block.md` | 10 | Walls block and are slid along instead of resetting to the start |
| 12 | `task-12-fog-widen.md` | 10 | `fogRadius` up to 2.4 / 1.8 / 1.3 |
| 13 | `task-13-level-progression.md` | 10 | Three levels in order, `levelup` beat, select screen removed |
| 14 | `task-14-exit-marker.md` | 13 | Pulsing exit marker, visible only within the fog |
| 15 | `task-15-ambient-music.md` | 13 | Very quiet synthesized music during play |

Tasks 11 and 12 are independent of each other and of 13. Task 14 depends on 13 only because it draws
into a level flow that 13 reshapes; task 15 depends on 13 for the phase it starts and stops on. Doing
them in numerical order is the simple choice.
