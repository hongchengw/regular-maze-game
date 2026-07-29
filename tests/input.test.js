import test from 'node:test';
import assert from 'node:assert/strict';

import { KEY_MAP, isGameKey, vectorFrom } from '../src/input.js';

const held = (...codes) => vectorFrom(new Set(codes));

test('empty held set is zero', () => {
  assert.deepEqual(held(), { dx: 0, dy: 0 });
});

test('single directions', () => {
  assert.deepEqual(held('ArrowUp'), { dx: 0, dy: -1 }, 'y grows downward, so up is dy: -1');
  assert.deepEqual(held('ArrowDown'), { dx: 0, dy: 1 });
  assert.deepEqual(held('ArrowLeft'), { dx: -1, dy: 0 });
  assert.deepEqual(held('ArrowRight'), { dx: 1, dy: 0 });
});

test('wasd and arrows are equivalent', () => {
  assert.deepEqual(held('KeyW'), held('ArrowUp'));
  assert.deepEqual(held('KeyA'), held('ArrowLeft'));
  assert.deepEqual(held('KeyS'), held('ArrowDown'));
  assert.deepEqual(held('KeyD'), held('ArrowRight'));
});

test('diagonal is both axes', () => {
  assert.deepEqual(
    held('KeyW', 'KeyD'),
    { dx: 1, dy: -1 },
    'the vector stays raw; normalization is game.step\'s job',
  );
});

test('opposites cancel', () => {
  assert.equal(held('KeyA', 'KeyD').dx, 0);
  assert.equal(held('KeyW', 'KeyS').dy, 0);
  assert.deepEqual(held('KeyW', 'KeyA', 'KeyS', 'KeyD'), { dx: 0, dy: 0 });
});

test('three keys resolve correctly', () => {
  assert.deepEqual(held('KeyA', 'KeyD', 'KeyW'), { dx: 0, dy: -1 });
});

test('unknown codes are ignored', () => {
  assert.deepEqual(held('KeyQ', 'F5', 'ShiftLeft'), { dx: 0, dy: 0 });
});

test('dpad ids map like keys', () => {
  assert.deepEqual(held('dpad-up'), held('KeyW'), 'one map and one code path for both');
  assert.deepEqual(held('dpad-left'), held('KeyA'));
  assert.deepEqual(held('dpad-down'), held('KeyS'));
  assert.deepEqual(held('dpad-right'), held('KeyD'));
});

test('mixed key and dpad', () => {
  assert.deepEqual(held('KeyW', 'dpad-right'), { dx: 1, dy: -1 });
});

test('isGameKey identifies handled codes', () => {
  const movement = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  for (const code of movement) {
    assert.equal(isGameKey(code), true, `${code} should be handled, so the listener preventDefaults`);
  }

  for (const code of ['KeyQ', 'F5', 'Space', 'Escape']) {
    assert.equal(isGameKey(code), false, `${code} must be left to the browser`);
  }
});

test('the key map is frozen', () => {
  assert.ok(Object.isFrozen(KEY_MAP), 'the shared map must not be mutable at runtime');
});
