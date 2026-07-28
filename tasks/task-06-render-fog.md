# Task 06 - Canvas rendering with fog of war

**Depends on:** 05. **Unblocks:** 10.

## Goal

When this is done, `src/render.js` draws the maze as white lines on black and reveals only a soft
circular region around the blob, leaving the rest of the screen fully black. It also owns the single
cell-units-to-pixels transform, so a window resize changes nothing but `scale`.

## Spec first

Fill in the `SPEC.md` **Rendering and fog** section.

- Background is pure black `#000`. Walls are white `#fff` lines. The blob is white with a soft edge.
- The viewport transform: `scale = min(width, height) * FIT / max(cols, rows)` where `FIT` is about
  `0.92` to leave a margin, plus an offset that centres the maze. This is the only place pixels
  exist.
- Wall stroke width in pixels is `wallHalfThickness * 2 * scale`, so the drawn line matches exactly
  the geometry collision uses. A visible wall the blob passes through, or an invisible wall it hits,
  is a bug.
- **Fog of war:** only the disc of radius `fogRadius` (cell units, times `scale`) centred on the blob
  is visible. Outside it the screen is black, not dimmed. The edge fades over roughly the outer 25%
  of the radius so the boundary does not look like a hard cookie-cutter.
- The exit is **not** marked or highlighted. The player finds it by reaching the bottom-right corner.
  Marking it would leak the goal through the fog and weaken the prank.
- Nothing else is drawn during `playing`: no HUD, no timer, no hit counter, no minimap.
- Rendering is a pure function of state plus canvas size. It never mutates game state.

## Failing tests first

This module touches the canvas API, and the project has no jsdom, so it gets **one** node-testable
seam rather than full coverage. Extract the maths into pure helpers and test those; verify the actual
drawing by hand.

Add to `tests/render.test.js` (write first, expect `ERR_MODULE_NOT_FOUND`):

| Test case | Assertion |
| --- | --- |
| `fitTransform centres a square maze` | For a 1000x600 viewport and a 10x10 maze, the returned `scale` fits within the shorter axis with margin, and `offsetX`/`offsetY` centre the maze exactly. |
| `fitTransform is aspect independent` | Portrait `600x1000` and landscape `1000x600` yield the same `scale`, with the offsets swapped. |
| `fitTransform never overflows` | For a range of viewport sizes and all three difficulty grid sizes, `offset + cols * scale <= viewport` on both axes. |
| `toPixels round-trips` | `toPixels` then `toCells` returns the original cell coordinate within floating-point tolerance. |
| `strokeWidth matches collision geometry` | `strokeWidthPx(level, scale) === level.wallHalfThickness * 2 * scale`. |
| `fogRadiusPx scales with the transform` | `fogRadiusPx(level, scale) === level.fogRadius * scale`, and it is strictly ordered EASY > MEDIUM > HARD at a fixed scale. |

The compositing itself (`globalCompositeOperation`, gradients) is verified in the manual checklist
under Done criteria, not by unit test. Do not add a canvas mock; a mock would test the mock.

## Implementation outline

**Pure helpers, exported and tested:**

```js
export const FIT = 0.92;
export function fitTransform(viewW, viewH, cols, rows)  // -> { scale, offsetX, offsetY }
export function toPixels(cx, cy, t)                     // -> { x, y }
export function toCells(px, py, t)                      // -> { cx, cy }
export function strokeWidthPx(level, scale)
export function fogRadiusPx(level, scale)
```

**Drawing, untested:**

```js
export function createRenderer(canvas)   // -> { resize(), draw(state) }
```

- On `resize()`: set the canvas backing store to `clientWidth * devicePixelRatio` (same for height)
  and cache the transform. Handle DPR so the lines are crisp on retina and mobile.
- `draw(state)`:
  1. Fill the whole canvas black.
  2. Save, then clip to the fog disc: `arc(blobPx, fogRadiusPx)`.
  3. Stroke every wall segment white with `lineCap: 'round'` and `strokeWidthPx`.
  4. Restore, then paint the fade: a radial gradient from `transparent` at 75% of the radius to
     opaque black at 100%, drawn over the disc. Simple, and it avoids needing an offscreen canvas or
     `destination-in` compositing entirely.
  5. Draw the blob as a filled white circle at `blobRadius * scale`, with a small
     `shadowBlur` glow so it reads clearly against the walls.
- Segment culling: skip segments whose bounding box lies entirely outside the fog disc. On HARD that
  drops roughly 1100 segments to a handful, which keeps the frame cheap on mobile. This is a real
  win, unlike the broad-phase skipped in task 03, because it runs against the draw call cost.

## Files touched

**Created:** `src/render.js`, `tests/render.test.js`.

**Modified:** `src/styles.css` (canvas fills the viewport, `display: block`, no scrollbars),
`SPEC.md`, `changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; the helper cases were observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- Manual check in a browser, all three difficulties:
  - Only the fog disc is visible; everything outside it is fully black, not merely dark.
  - The fog edge fades rather than cutting hard.
  - Walls line up with collision: scrape along a wall and the visible line is where the blob stops.
  - Resizing the window and rotating a phone rescales the maze while the blob keeps its position in
    the maze.
  - No HUD, no exit marker, nothing on screen but maze, blob, and black.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(render): add canvas maze rendering with fog of war
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 06 - Canvas rendering with fog of war - <date> <time> EDT` with
Added / Changed / Deleted.
