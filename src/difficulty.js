// The one tuning table. Every tunable number in the game lives here and nowhere else.
//
// Harder means a larger grid, a fatter blob relative to the corridor, and a smaller fog radius, so
// more of the maze is navigated blind. Because the renderer fits the whole maze to the viewport, a
// larger grid also means fewer pixels per cell, which tightens HARD corridors visually without
// touching the cell-unit geometry.

export const DIFFICULTY = Object.freeze({
  EASY: Object.freeze({
    cols: 10,
    rows: 10,
    blobRadius: 0.16,
    wallHalfThickness: 0.04,
    fogRadius: 2.2,
    speed: 3.2,
    exitRadius: 0.3,
  }),
  MEDIUM: Object.freeze({
    cols: 16,
    rows: 16,
    blobRadius: 0.18,
    wallHalfThickness: 0.035,
    fogRadius: 1.6,
    speed: 3.4,
    exitRadius: 0.28,
  }),
  HARD: Object.freeze({
    cols: 24,
    rows: 24,
    blobRadius: 0.22,
    wallHalfThickness: 0.03,
    fogRadius: 1.1,
    speed: 3.6,
    exitRadius: 0.25,
  }),
});

/** Display order for the select screen, so the UI cannot drift from the table. */
export const LEVELS = Object.freeze(['EASY', 'MEDIUM', 'HARD']);

/** Slack between the blob's edge and a wall when the blob is centred in a corridor. */
export function clearance(level) {
  return 0.5 - (level.blobRadius + level.wallHalfThickness);
}
