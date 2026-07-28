# Task 07 - Keyboard and on-screen D-pad input

**Depends on:** 05. **Unblocks:** 10.

## Goal

When this is done, `src/input.js` turns held keys and held D-pad buttons into a single `{dx, dy}`
vector that `game.step` consumes. Desktop and mobile drive the exact same code path, so there is only
one movement behavior to reason about and test.

## Spec first

Fill in the `SPEC.md` **Input** section.

- **Desktop:** `W`/`A`/`S`/`D` and the four arrow keys. Both sets are always active; no mode switch.
  Keys are **held**, not tapped: the blob glides while a key is down.
- **Mouse is never used during gameplay.** It clicks the START button and the difficulty buttons and
  nothing else. There is no mouse-follow, no click-to-move, no drag.
- **Touch:** an on-screen D-pad of four buttons (up, left, down, right) in a cross. Holding a button
  is equivalent to holding the matching key. Pressing two adjacent buttons with two fingers gives a
  diagonal.
- Opposite directions held simultaneously cancel: `left + right` is `dx = 0`.
- Diagonals are normalized by `game.step`, so the blob's speed is the same in all eight directions.
- The D-pad is visible only during `playing`. It never appears on the title, select, or scare
  screens, which matters because the scare must have nothing else on screen.
- Held state is cleared whenever gameplay ends or the window loses focus, so a key held during a
  phase change does not leak into the next one as phantom movement.
- Keys handled by the game call `preventDefault()` so arrow keys never scroll the page, and the
  viewport disables pinch-zoom so D-pad taps do not zoom on mobile.

## Failing tests first

The event listeners need a DOM, but the state reduction does not. Extract a pure held-set-to-vector
function and test that exhaustively; verify the listeners by hand.

Write `tests/input.test.js` first (expect `ERR_MODULE_NOT_FOUND`).

| Test case | Assertion |
| --- | --- |
| `empty held set is zero` | `vectorFrom(new Set())` is `{dx: 0, dy: 0}`. |
| `single directions` | Each of up/down/left/right alone gives the right unit vector, with `up` being `dy: -1` (screen coordinates, y grows downward). |
| `wasd and arrows are equivalent` | `vectorFrom(new Set(['KeyW']))` deep-equals `vectorFrom(new Set(['ArrowUp']))`. |
| `diagonal is both axes` | `up + right` gives `{dx: 1, dy: -1}` (normalization is `game.step`'s job, not this module's). |
| `opposites cancel` | `left + right` gives `dx: 0`; `up + down` gives `dy: 0`; all four gives `{0, 0}`. |
| `three keys resolve correctly` | `left + right + up` gives `{dx: 0, dy: -1}`. |
| `unknown codes are ignored` | `new Set(['KeyQ', 'F5', 'ShiftLeft'])` gives `{0, 0}`. |
| `dpad ids map like keys` | `vectorFrom(new Set(['dpad-up']))` deep-equals the `KeyW` result, proving one code path. |
| `mixed key and dpad` | `KeyW + dpad-right` gives `{dx: 1, dy: -1}`. |
| `isGameKey identifies handled codes` | True for the eight movement codes, false for `KeyQ`, so the listener knows exactly when to `preventDefault`. |

## Implementation outline

**Pure, exported and tested:**

```js
export const KEY_MAP = Object.freeze({
  KeyW: 'up', ArrowUp: 'up', 'dpad-up': 'up',
  KeyS: 'down', ArrowDown: 'down', 'dpad-down': 'down',
  KeyA: 'left', ArrowLeft: 'left', 'dpad-left': 'left',
  KeyD: 'right', ArrowRight: 'right', 'dpad-right': 'right',
});
export function isGameKey(code)
export function vectorFrom(heldCodes)   // Set -> { dx, dy }
```

`vectorFrom` maps each held code through `KEY_MAP` into a direction set, then sums:
`dx = (right ? 1 : 0) - (left ? 1 : 0)`, `dy = (down ? 1 : 0) - (up ? 1 : 0)`.

**DOM edge, untested:**

```js
export function createInput(dpadElement)  // -> { vector(), clear(), attach(), detach() }
```

- One `Set` of held codes. `keydown` adds, `keyup` deletes, both filtered by `isGameKey` and calling
  `preventDefault` when handled.
- `blur` and `visibilitychange` call `clear()`. Without this, alt-tabbing mid-move leaves the blob
  gliding into a wall.
- D-pad buttons use `pointerdown`/`pointerup`/`pointercancel`/`pointerleave` rather than click, since
  the game needs press-and-hold. Set `touch-action: none` on the buttons so the browser does not
  interpret a hold as a scroll or a double-tap zoom.
- `pointerup` and `pointercancel` are also bound on `window`, not just the button, because a finger
  released outside the button's bounds would otherwise never clear the held direction, leaving the
  blob stuck moving.
- Buttons get `aria-label`s and are real `<button>` elements, so keyboard users are not fighting the
  D-pad and screen readers describe it.

**`src/styles.css`** - D-pad as a 3x3 CSS grid with the four buttons in the cross positions, fixed to
the bottom-centre with safe-area insets, large tap targets (at least 56 px), `user-select: none`.
Shown only when the body carries the `playing` phase class.

## Files touched

**Created:** `src/input.js`, `tests/input.test.js`.

**Modified:** `src/styles.css`, `src/index.html` (D-pad markup), `SPEC.md`,
`changelogs/CHANGELOGS.md`, `dist/index.html` (rebuild).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes; every case observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- Manual check: WASD and arrows both work; two keys glide diagonally at the same speed as straight;
  arrow keys do not scroll the page; alt-tab mid-glide stops the blob.
- Manual mobile check in device emulation and on a real phone if possible: D-pad reachable by thumb,
  hold-to-glide works, two-finger diagonal works, releasing a finger off the edge of a button still
  stops movement, no pinch-zoom or double-tap zoom, no text selection highlight.

## Commit

Run the `git-commit-formatter` skill with subject:

```
feat(input): add keyboard and on-screen d-pad controls
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 07 - Keyboard and d-pad input - <date> <time> EDT` with Added / Changed / Deleted.
