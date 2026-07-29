// Canvas drawing: white maze lines on black, revealed only inside a soft fog disc around the blob.
//
// This module owns the single cell-units-to-pixels transform, so a resize recomputes `scale` and
// nothing else. Drawing is a pure function of state plus canvas size and never mutates game state.

/** Fraction of the shorter viewport axis the maze fills, leaving a margin. */
export const FIT = 0.92;

/** Fraction of the fog radius that is fully clear before the edge starts fading. */
const FOG_CLEAR = 0.75;

/** Pixels of glow around the blob, at a scale of 1 cell per pixel. */
const BLOB_GLOW = 0.35;

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

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    viewW = canvas.clientWidth;
    viewH = canvas.clientHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(state) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, viewW, viewH);

    if (state.phase !== 'playing') return;

    const { level, pos, segments } = state;
    const t = fitTransform(viewW, viewH, state.maze.cols, state.maze.rows);
    const blob = toPixels(pos.x, pos.y, t);
    const fog = fogRadiusPx(level, t.scale);

    // Walls, clipped to the fog disc. Everything outside it stays the black already painted.
    ctx.save();
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, fog, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = strokeWidthPx(level, t.scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const seg of segments) {
      if (outsideFog(seg, pos.x, pos.y, level.fogRadius)) continue;
      const a = toPixels(seg.x1, seg.y1, t);
      const b = toPixels(seg.x2, seg.y2, t);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();

    // Fade the outer quarter of the disc to black, so the fog edge is not a cookie cutter.
    const fade = ctx.createRadialGradient(blob.x, blob.y, fog * FOG_CLEAR, blob.x, blob.y, fog);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = fade;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, fog, 0, Math.PI * 2);
    ctx.fill();

    // The blob. Nothing else is drawn: no HUD, no timer, no hit counter, and no exit marker, since
    // marking the exit would leak the goal through the fog.
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = BLOB_GLOW * t.scale;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, level.blobRadius * t.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return { resize, draw };
}
