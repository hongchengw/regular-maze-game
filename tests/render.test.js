import test from 'node:test';
import assert from 'node:assert/strict';

import { DIFFICULTY, LEVELS } from '../src/difficulty.js';
import {
  FIT,
  MAX_DPR,
  PULSE_PERIOD,
  EXIT_COLOR,
  EXIT_ALPHA_MIN,
  EXIT_ALPHA_MAX,
  backingScale,
  fitTransform,
  toPixels,
  toCells,
  strokeWidthPx,
  fogRadiusPx,
  exitPulse,
  exitVisible,
} from '../src/render.js';

test('fitTransform centres a square maze', () => {
  const t = fitTransform(1000, 600, 10, 10);

  assert.equal(t.scale, (600 * FIT) / 10, 'the shorter axis and the margin set the scale');
  assert.equal(t.offsetX, (1000 - 10 * t.scale) / 2, 'the maze is centred horizontally');
  assert.equal(t.offsetY, (600 - 10 * t.scale) / 2, 'and vertically');
});

test('fitTransform is aspect independent', () => {
  const landscape = fitTransform(1000, 600, 16, 16);
  const portrait = fitTransform(600, 1000, 16, 16);

  assert.equal(portrait.scale, landscape.scale, 'rotating the device must not change the scale');
  assert.equal(portrait.offsetX, landscape.offsetY, 'the offsets simply swap');
  assert.equal(portrait.offsetY, landscape.offsetX);
});

test('fitTransform never overflows', () => {
  const viewports = [
    [320, 480],
    [1000, 600],
    [600, 1000],
    [1920, 1080],
    [800, 800],
  ];

  for (const [w, h] of viewports) {
    for (const name of LEVELS) {
      const { cols, rows } = DIFFICULTY[name];
      const t = fitTransform(w, h, cols, rows);

      assert.ok(t.offsetX >= 0 && t.offsetX + cols * t.scale <= w + 1e-9, `${name} overflows ${w}x${h} in x`);
      assert.ok(t.offsetY >= 0 && t.offsetY + rows * t.scale <= h + 1e-9, `${name} overflows ${w}x${h} in y`);
    }
  }
});

test('toPixels round-trips', () => {
  const t = fitTransform(1000, 600, 10, 10);

  for (const [cx, cy] of [[0, 0], [0.5, 0.5], [7.25, 3.75], [10, 10]]) {
    const px = toPixels(cx, cy, t);
    const back = toCells(px.x, px.y, t);

    assert.ok(Math.abs(back.cx - cx) < 1e-9, `x round-trip drifted: ${back.cx} vs ${cx}`);
    assert.ok(Math.abs(back.cy - cy) < 1e-9, `y round-trip drifted: ${back.cy} vs ${cy}`);
  }
});

test('strokeWidth matches collision geometry', () => {
  const scale = 40;
  for (const name of LEVELS) {
    const level = DIFFICULTY[name];
    assert.equal(
      strokeWidthPx(level, scale),
      level.wallHalfThickness * 2 * scale,
      'the drawn line must be exactly the geometry collision uses',
    );
  }
});

test('backingScale caps the device pixel ratio', () => {
  assert.ok(MAX_DPR <= 2, 'the cap itself must stay low enough to matter on a phone');

  assert.equal(backingScale(1), 1, 'an ordinary display passes through untouched');
  assert.equal(backingScale(2), 2, 'a retina display passes through untouched');
  assert.equal(
    backingScale(3),
    MAX_DPR,
    'a DPR-3 phone would otherwise fill nine times the pixels every frame',
  );
  assert.equal(backingScale(4), MAX_DPR);
});

test('backingScale never returns a degenerate ratio', () => {
  // `devicePixelRatio` is missing in some embedded webviews and 0 in a few headless setups. A zero
  // here would collapse the backing store to nothing and the game would render blank.
  for (const bad of [undefined, null, 0, -1, NaN]) {
    const scale = backingScale(bad);
    assert.ok(Number.isFinite(scale) && scale >= 1, `backingScale(${bad}) returned ${scale}`);
  }
});

test('fogRadiusPx scales with the transform', () => {
  const scale = 40;

  for (const name of LEVELS) {
    assert.equal(fogRadiusPx(DIFFICULTY[name], scale), DIFFICULTY[name].fogRadius * scale);
  }

  const [easy, medium, hard] = LEVELS.map((name) => fogRadiusPx(DIFFICULTY[name], scale));
  assert.ok(easy > medium && medium > hard, 'harder levels see less');
});

// --- The exit marker -----------------------------------------------------------------------------

const alphaAt = (pulse) => EXIT_ALPHA_MIN + pulse * (EXIT_ALPHA_MAX - EXIT_ALPHA_MIN);

test('exitPulse stays within gentle bounds', () => {
  assert.ok(EXIT_ALPHA_MIN > 0, 'the marker never reaches full transparency, so it never blinks out');
  assert.ok(EXIT_ALPHA_MAX <= 1);

  // Several periods, sampled finely, so a pulse that overshoots anywhere is caught.
  for (let i = 0; i < 1000; i += 1) {
    const t = (i / 1000) * PULSE_PERIOD * 5;
    const pulse = exitPulse(t);

    assert.ok(pulse >= 0 && pulse <= 1, `exitPulse(${t}) returned ${pulse}, outside 0..1`);

    const alpha = alphaAt(pulse);
    assert.ok(
      alpha >= EXIT_ALPHA_MIN - 1e-9 && alpha <= EXIT_ALPHA_MAX + 1e-9,
      `alpha reached ${alpha}, outside the documented range`,
    );
  }
});

test('exitPulse is periodic', () => {
  for (let t = 0; t < PULSE_PERIOD; t += 37) {
    assert.ok(
      Math.abs(exitPulse(t) - exitPulse(t + PULSE_PERIOD)) < 1e-9,
      `the pulse drifted between t=${t} and one period later`,
    );
  }
});

test('exitPulse is continuous', () => {
  // The anti-strobe guard: a fast or discontinuous pulse fails this outright.
  for (let t = 0; t < PULSE_PERIOD * 2; t += 1) {
    assert.ok(
      Math.abs(exitPulse(t + 1) - exitPulse(t)) < 0.01,
      `the pulse jumped inside one millisecond at t=${t}`,
    );
  }
});

test('the marker is hidden beyond the fog', () => {
  // SPEC.md section 14: the exit is never visible from outside the fog radius.
  const exit = { x: 9.5, y: 9.5 };

  for (const name of LEVELS) {
    const { fogRadius } = DIFFICULTY[name];

    assert.equal(exitVisible({ x: 0.5, y: 0.5 }, exit, fogRadius), false, `${name} leaks the exit from the start cell`);
    assert.equal(exitVisible({ x: exit.x - fogRadius - 0.01, y: exit.y }, exit, fogRadius), false, `${name} draws it a hair too early`);
    assert.equal(exitVisible({ x: exit.x - fogRadius + 0.01, y: exit.y }, exit, fogRadius), true, `${name} hides it once inside the disc`);
    assert.equal(exitVisible({ ...exit }, exit, fogRadius), true, `${name} hides it while standing on it`);
  }
});

test('the marker colour is not wall white', () => {
  for (const white of ['#fff', '#ffffff', 'white']) {
    assert.notEqual(EXIT_COLOR.toLowerCase(), white, 'the marker must not be mistakable for a wall');
  }
});
