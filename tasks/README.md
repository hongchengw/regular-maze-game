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
| Desktop controls | WASD and arrow keys only. The mouse is used solely to click the START and difficulty buttons, never during gameplay. |
| Touch controls | On-screen 4-button D-pad. Multi-touch two buttons for diagonals. |
| Movement | Continuous glide at constant speed while a direction is held. Diagonals normalized. |
| Collision | Swept in sub-steps along each frame's movement so fast motion cannot tunnel a wall. |
| On collision | Same maze layout, blob returns to the start cell. Nothing persists across sessions. |
| Maze | Seeded perfect maze from a recursive backtracker. Fresh seed per play, deterministic under a fixed seed. |
| Jumpscare | User-supplied `assets/jumpscare.png` fullscreen for exactly 10s, synthesized scream for 4s. No flashes, no text, no buttons, nothing else on screen. |
| After jumpscare | Overlay removed at 10s, app instantly back at the START screen. There is no "YOU GOT PRANKED" screen and no PLAY AGAIN button. |
| Assets | Inlined as base64 data URIs. `dist/index.html` is one self-contained file with zero external requests. |
| Dependencies | None. No runtime deps, no dev deps. Tests use the built-in `node:test` runner. |

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
title --START--> select --difficulty--> playing --exit reached--> scare --10s--> title
                                          ^                                        |
                                          +--------- wall hit: pos = start --------+
```

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
