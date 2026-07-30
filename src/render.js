// Canvas drawing: white maze lines on black, revealed only inside a soft fog disc around the blob.
//
// This module owns the single cell-units-to-pixels transform, so a resize recomputes `scale` and
// nothing else. Drawing is a pure function of state plus canvas size and never mutates game state.

/** Fraction of the shorter viewport axis the maze fills, leaving a margin. */
export const FIT = 0.92;

/**
 * Ceiling on the canvas backing store's pixel ratio. A phone reporting 3 would fill nine times the
 * pixels every frame for a difference no one can see on flat white lines over black.
 */
export const MAX_DPR = 2;

/** Usable backing-store ratio: capped, and never zero or missing, which would render blank. */
export function backingScale(dpr) {
  return Number.isFinite(dpr) && dpr > 1 ? Math.min(dpr, MAX_DPR) : 1;
}

/** Fraction of the fog radius that is fully clear before the edge starts fading. */
const FOG_CLEAR = 0.75;

/** How far the blob's glow reaches, as a multiple of the blob radius. */
const BLOB_HALO = 2;

/** Milliseconds for one full pulse of the exit marker. Slow on purpose: this is never a strobe. */
export const PULSE_PERIOD = 1400;

/** Amber. Deliberately not wall white, so the marker cannot be read as a piece of maze. */
export const EXIT_COLOR = '#ffb300';

/** Alpha the pulse drives between. The low end stays well clear of zero: the marker never blinks out. */
export const EXIT_ALPHA_MIN = 0.55;
export const EXIT_ALPHA_MAX = 1;

/** Marker radius the pulse drives between, as a multiple of the base radius. Both bounds stay narrow. */
export const EXIT_SCALE_MIN = 0.9;
export const EXIT_SCALE_MAX = 1.15;

/** The pulse itself: 0 to 1 and back, once per `PULSE_PERIOD`, continuous everywhere. */
export function exitPulse(timeMs) {
  return (Math.sin((timeMs / PULSE_PERIOD) * Math.PI * 2) + 1) / 2;
}

/**
 * True when the exit lies inside the fog disc. The marker is drawn only then, which is what keeps
 * the goal invisible from across the maze, and it is also what tells `draw` it cannot idle.
 */
export function exitVisible(pos, exit, fogRadiusCells) {
  return Math.hypot(pos.x - exit.x, pos.y - exit.y) < fogRadiusCells;
}

/**
 * Fit a `cols` x `rows` maze into a viewport. Aspect independent: rotating the device yields the
 * same scale with the offsets swapped.
 */
export function fitTransform(viewW, viewH, cols, rows) {
  const scale = (Math.min(viewW, viewH) * FIT) / Math.max(cols, rows);
  return {
    scale,
    offsetX: (viewW - cols * scale) / 2,
    offsetY: (viewH - rows * scale) / 2,
  };
}

/** Cell units to pixels. */
export function toPixels(cx, cy, t) {
  return { x: t.offsetX + cx * t.scale, y: t.offsetY + cy * t.scale };
}

/** Pixels back to cell units. */
export function toCells(px, py, t) {
  return { cx: (px - t.offsetX) / t.scale, cy: (py - t.offsetY) / t.scale };
}

/** Wall stroke width in pixels: exactly the geometry collision uses, so what you see is what you hit. */
export function strokeWidthPx(level, scale) {
  return level.wallHalfThickness * 2 * scale;
}

/** Fog disc radius in pixels. */
export function fogRadiusPx(level, scale) {
  return level.fogRadius * scale;
}

/** True if a segment's bounding box lies entirely outside the fog disc, so drawing it is wasted. */
function outsideFog(seg, cx, cy, radiusCells) {
  const minX = Math.min(seg.x1, seg.x2) - radiusCells;
  const maxX = Math.max(seg.x1, seg.x2) + radiusCells;
  const minY = Math.min(seg.y1, seg.y2) - radiusCells;
  const maxY = Math.max(seg.y1, seg.y2) + radiusCells;
  return cx < minX || cx > maxX || cy < minY || cy > maxY;
}

/**
 * Bind a renderer to a canvas. `resize()` recomputes the backing store and the transform; `draw`
 * paints one frame of `state`.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 0;
  let viewH = 0;

  // Gradients are built once per radius and reused by translating the canvas to the blob, rather
  // than rebuilt every frame at a new centre. Both are the same shape wherever the blob is.
  let fogFade = null;
  let fogFadeRadius = 0;
  let blobHalo = null;
  let blobHaloRadius = 0;

  // Last drawn frame, so a frame that would change nothing can be skipped outright.
  let lastX = NaN;
  let lastY = NaN;
  let lastW = 0;
  let lastH = 0;

  function resize() {
    const dpr = backingScale(window.devicePixelRatio);
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastX = NaN;
  }

  /** Transparent at the clear radius, opaque black at the edge. Centred on the origin. */
  function fadeFor(radius) {
    if (fogFade && fogFadeRadius === radius) return fogFade;
    fogFade = ctx.createRadialGradient(0, 0, radius * FOG_CLEAR, 0, 0, radius);
    fogFade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fogFade.addColorStop(1, 'rgba(0, 0, 0, 1)');
    fogFadeRadius = radius;
    return fogFade;
  }

  /** The blob's soft edge, replacing a per-frame `shadowBlur`. Centred on the origin. */
  function haloFor(radius) {
    if (blobHalo && blobHaloRadius === radius) return blobHalo;
    blobHalo = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * BLOB_HALO);
    blobHalo.addColorStop(0, 'rgba(255, 255, 255, 1)');
    blobHalo.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    blobHalo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    blobHaloRadius = radius;
    return blobHalo;
  }

  function draw(state, timeMs) {
    if (state.phase !== 'playing') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, viewW, viewH);
      lastX = NaN;
      return;
    }

    const { level, pos, segments } = state;
    const markerShowing = exitVisible(pos, state.exit, level.fogRadius);

    // Nothing moved, nothing resized, and the marker is not on screen, so the last frame is still
    // correct. The marker is the one exception: idling on it would freeze its pulse.
    if (
      pos.x === lastX &&
      pos.y === lastY &&
      viewW === lastW &&
      viewH === lastH &&
      !markerShowing
    ) {
      return;
    }
    lastX = pos.x;
    lastY = pos.y;
    lastW = viewW;
    lastH = viewH;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, viewW, viewH);

    const t = fitTransform(viewW, viewH, state.maze.cols, state.maze.rows);
    const blobX = t.offsetX + pos.x * t.scale;
    const blobY = t.offsetY + pos.y * t.scale;
    const fog = fogRadiusPx(level, t.scale);

    // Walls, clipped to the fog disc. Everything outside it stays the black already painted.
    ctx.save();
    ctx.beginPath();
    ctx.arc(blobX, blobY, fog, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = strokeWidthPx(level, t.scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const seg of segments) {
      if (outsideFog(seg, pos.x, pos.y, level.fogRadius)) continue;
      // Inline rather than via `toPixels`, to allocate nothing per segment per frame.
      ctx.moveTo(t.offsetX + seg.x1 * t.scale, t.offsetY + seg.y1 * t.scale);
      ctx.lineTo(t.offsetX + seg.x2 * t.scale, t.offsetY + seg.y2 * t.scale);
    }
    ctx.stroke();

    // The exit marker, drawn inside the fog clip and before the fade, so the fade dims it at the
    // edge of the disc exactly as it dims the walls. Drawn after the fade it would glow through the
    // darkness and give the goal away from across the maze.
    if (markerShowing) {
      const pulse = exitPulse(timeMs);
      const base = level.exitRadius * t.scale;

      ctx.globalAlpha = EXIT_ALPHA_MIN + pulse * (EXIT_ALPHA_MAX - EXIT_ALPHA_MIN);
      ctx.fillStyle = EXIT_COLOR;
      ctx.beginPath();
      ctx.arc(
        t.offsetX + state.exit.x * t.scale,
        t.offsetY + state.exit.y * t.scale,
        base * (EXIT_SCALE_MIN + pulse * (EXIT_SCALE_MAX - EXIT_SCALE_MIN)),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // `restore` also puts `globalAlpha` back, so nothing after this inherits the pulse.
    ctx.restore();

    // Everything from here is drawn around the origin, with the canvas translated to the blob, so
    // the cached gradients stay valid wherever the blob is.
    ctx.save();
    ctx.translate(blobX, blobY);

    // Fade the outer quarter of the disc to black, so the fog edge is not a cookie cutter.
    ctx.fillStyle = fadeFor(fog);
    ctx.beginPath();
    ctx.arc(0, 0, fog, 0, Math.PI * 2);
    ctx.fill();

    // The blob. Nothing else is drawn: no HUD, no timer, and no hit counter. The exit marker above
    // is the only other thing on screen, and only from inside the fog.
    const blobRadius = level.blobRadius * t.scale;
    ctx.fillStyle = haloFor(blobRadius);
    ctx.beginPath();
    ctx.arc(0, 0, blobRadius * BLOB_HALO, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, blobRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  return { resize, draw };
}
