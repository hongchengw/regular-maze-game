// Held keys and held D-pad buttons reduced to one `{ dx, dy }` vector.
//
// Keyboard codes and D-pad ids share one map and one code path, so desktop and touch produce
// identical movement and there is only one behavior to reason about.
//
// The mouse is never used during gameplay. It clicks START and the difficulty buttons, nothing else.

export const KEY_MAP = Object.freeze({
  KeyW: 'up',
  ArrowUp: 'up',
  'dpad-up': 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  'dpad-down': 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  'dpad-left': 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  'dpad-right': 'right',
});

/** True for the codes the game handles, so the listener knows exactly when to `preventDefault`. */
export function isGameKey(code) {
  return Object.prototype.hasOwnProperty.call(KEY_MAP, code);
}

/**
 * True for the D-pad ids, which are the only codes a pointer can hold. A window-level pointer
 * release clears these and nothing else, so a mouse click anywhere on the page cannot stop a blob
 * being glided with the keyboard.
 */
export function isPointerCode(code) {
  return isGameKey(code) && code.startsWith('dpad-');
}

/**
 * Reduce a Set of held codes to a raw direction vector. Opposites cancel and unknown codes are
 * ignored. The vector is left unnormalized on purpose: that is `game.step`'s job.
 */
export function vectorFrom(heldCodes) {
  const dirs = { up: false, down: false, left: false, right: false };
  for (const code of heldCodes) {
    if (!isGameKey(code)) continue;
    dirs[KEY_MAP[code]] = true;
  }

  return {
    dx: (dirs.right ? 1 : 0) - (dirs.left ? 1 : 0),
    dy: (dirs.down ? 1 : 0) - (dirs.up ? 1 : 0),
  };
}

/**
 * Bind keyboard and D-pad listeners. Returns the current `vector()`, plus `clear()` for phase
 * changes, and `attach`/`detach` for the listeners themselves.
 */
export function createInput(dpadElement) {
  const heldCodes = new Set();

  const onKeyDown = (event) => {
    if (!isGameKey(event.code)) return;
    event.preventDefault();
    heldCodes.add(event.code);
  };

  const onKeyUp = (event) => {
    if (!isGameKey(event.code)) return;
    event.preventDefault();
    heldCodes.delete(event.code);
  };

  const clear = () => heldCodes.clear();

  // A finger released outside a button's bounds would otherwise never clear its direction, leaving
  // the blob stuck moving, so pointer release is also watched on the window. It releases only the
  // D-pad: clearing everything here would mean a stray mouse click stopped a keyboard glide.
  const onPointerRelease = () => {
    for (const code of heldCodes) {
      if (isPointerCode(code)) heldCodes.delete(code);
    }
  };

  const buttons = dpadElement ? [...dpadElement.querySelectorAll('button[data-code]')] : [];
  const bound = buttons.map((button) => {
    const code = button.dataset.code;
    const press = (event) => {
      event.preventDefault();
      heldCodes.add(code);
    };
    const release = () => heldCodes.delete(code);
    return { button, press, release };
  });

  // A long press on a D-pad button would otherwise raise the context menu on mobile, which steals
  // the pointer and leaves the direction held.
  const onContextMenu = (event) => event.preventDefault();

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    window.addEventListener('pointerup', onPointerRelease);
    window.addEventListener('pointercancel', onPointerRelease);

    if (dpadElement) dpadElement.addEventListener('contextmenu', onContextMenu);

    for (const { button, press, release } of bound) {
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
    }
  }

  function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', clear);
    window.removeEventListener('pointerup', onPointerRelease);
    window.removeEventListener('pointercancel', onPointerRelease);

    if (dpadElement) dpadElement.removeEventListener('contextmenu', onContextMenu);

    for (const { button, press, release } of bound) {
      button.removeEventListener('pointerdown', press);
      button.removeEventListener('pointerup', release);
      button.removeEventListener('pointercancel', release);
      button.removeEventListener('pointerleave', release);
    }
    clear();
  }

  return { vector: () => vectorFrom(heldCodes), clear, attach, detach };
}
