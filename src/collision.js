// Swept circle collision against wall segments, in cell units.
//
// Contact is strictly closer than `radius + halfThickness`, so exactly touching is not a hit and
// the boundary case goes to the player. Collision never slides and never bounces; the game layer
// decides what a hit costs.
//
// Broad-phase acceleration is deliberately out of scope: a 24x24 maze has under 1200 segments and
// this runs once per frame.

/** Squared distance from a point to a segment, with the projection clamped to the segment. */
function distanceSquaredPointSegment(px, py, seg) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const lengthSquared = dx * dx + dy * dy;

  // A zero-length segment degrades to plain point distance rather than dividing by zero.
  const projection =
    lengthSquared === 0 ? 0 : ((px - seg.x1) * dx + (py - seg.y1) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));

  const nearestX = seg.x1 + t * dx;
  const nearestY = seg.y1 + t * dy;
  return (px - nearestX) ** 2 + (py - nearestY) ** 2;
}

/** Distance from a point to a wall segment. Never returns NaN. */
export function distancePointSegment(px, py, seg) {
  return Math.sqrt(distanceSquaredPointSegment(px, py, seg));
}

/** True if a blob of `radius` centred at (x, y) is in contact with any segment. */
export function hitsWall(x, y, radius, segments, halfThickness) {
  const contact = radius + halfThickness;
  const contactSquared = contact * contact;

  for (const seg of segments) {
    if (distanceSquaredPointSegment(x, y, seg) < contactSquared) return true;
  }
  return false;
}

/**
 * Move a blob from `from` to `to` in sub-steps no longer than `radius / 2`, testing each one, so no
 * frame delta or flick speed can tunnel a wall. Returns the first contact along with the last
 * position that was itself clear.
 */
export function sweep(from, to, radius, segments, halfThickness) {
  if (hitsWall(from.x, from.y, radius, segments, halfThickness)) {
    return { hit: true, pos: { x: from.x, y: from.y }, steps: 0 };
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return { hit: false, pos: { x: from.x, y: from.y }, steps: 0 };
  }

  const steps = Math.max(1, Math.ceil(distance / (radius / 2)));
  let safe = { x: from.x, y: from.y };

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = from.x + dx * t;
    const y = from.y + dy * t;

    if (hitsWall(x, y, radius, segments, halfThickness)) {
      return { hit: true, pos: safe, steps: i };
    }
    safe = { x, y };
  }

  return { hit: false, pos: safe, steps };
}
