// Seeded pseudo-random float stream. Kept exactly as mulberry32 is published so the same seed
// yields the same maze across Node versions and browsers.

/** Returns a function producing floats in [0, 1), deterministic for a given `seed`. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
