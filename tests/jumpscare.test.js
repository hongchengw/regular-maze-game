import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGame, startLevel, step, MAX_DT, SCARE_DURATION } from '../src/game.js';
import { SCREAM_DURATION } from '../src/audio.js';
import { createJumpscare } from '../src/jumpscare.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..', 'src');
const read = (file) => fs.readFileSync(path.join(src, file), 'utf8');

/** A scare-phase state with `scareElapsed` seconds already on the clock. */
function scaring(scareElapsed = 0) {
  const playing = startLevel(createGame(), 'EASY', 1);
  return { ...playing, phase: 'scare', scareElapsed };
}

test('SCARE_DURATION is exactly 10', () => {
  assert.equal(SCARE_DURATION, 10);
});

test('scream ends well before the image', () => {
  assert.equal(
    SCARE_DURATION - SCREAM_DURATION,
    6,
    'the six silent seconds are intentional: the image lingering in silence is what unsettles',
  );
});

test('phase leaves scare exactly at the duration', () => {
  const almost = step(scaring(9.999 - MAX_DT), MAX_DT, { dx: 0, dy: 0 });
  assert.equal(almost.phase, 'scare', 'still up at 9.999s');

  const done = step(scaring(SCARE_DURATION - MAX_DT), MAX_DT, { dx: 0, dy: 0 });
  assert.equal(done.phase, 'title', 'gone at exactly 10.0s');
});

test('returning to title discards all state', () => {
  const done = step(scaring(SCARE_DURATION - MAX_DT), MAX_DT, { dx: 0, dy: 0 });

  assert.deepEqual(done, createGame(), 'no maze, no hits, no level, no seed: nothing leaks');
});

test('scare cannot be re-entered from title', () => {
  let state = step(scaring(SCARE_DURATION - MAX_DT), MAX_DT, { dx: 0, dy: 0 });

  for (let i = 0; i < 200; i += 1) state = step(state, MAX_DT, { dx: 1, dy: 1 });

  assert.equal(state.phase, 'title', 'the title screen is inert until START is pressed');
});

test('no animation properties in the stylesheet', () => {
  const css = read('styles.css');
  const rules = css.slice(css.indexOf('.jumpscare'));

  assert.ok(rules.length > 0, 'fixture check: the jumpscare rules should exist');
  assert.ok(!/\banimation\b/.test(rules), 'no animation: a flash could trigger a photosensitive reaction');
  assert.ok(!/\btransition\b/.test(rules), 'no transition: the image appears and holds perfectly still');
  assert.ok(!/@keyframes/.test(css), 'no keyframes anywhere in the stylesheet');
});

test('overlay markup has no text content', () => {
  const html = read('index.html');
  const overlay = html.match(/<div class="jumpscare"[\s\S]*?<\/div>/);

  assert.ok(overlay, 'the overlay element should exist');

  const inner = overlay[0].replace(/^<div class="jumpscare"[^>]*>/, '').replace(/<\/div>$/, '');
  assert.ok(/<img\b[^>]*alt=""/.test(inner), 'exactly one decorative img, with an empty alt');
  assert.ok(!/<button/.test(inner), 'no buttons: there is no PLAY AGAIN and no PRANKED screen');
  assert.equal(inner.replace(/<[^>]*>/g, '').trim(), '', 'no text nodes at all');
});

test('the overlay is a function of phase, not of a timer', () => {
  const source = read('jumpscare.js');

  assert.ok(!/setTimeout|setInterval/.test(source), 'the 10s clock is game.step\'s, so one clock and no drift');
});

test('show paints the image and plays the scream once', () => {
  const overlay = { classList: { added: [], removed: [], add(c) { this.added.push(c); }, remove(c) { this.removed.push(c); } } };
  const img = { src: '' };
  let screams = 0;
  const audio = { playScream: () => { screams += 1; } };

  const jumpscare = createJumpscare(overlay, img, audio, 'data:image/jpeg;base64,AAAA');
  assert.equal(img.src, 'data:image/jpeg;base64,AAAA', 'the image is preloaded at startup, not on show');

  jumpscare.show();
  assert.ok(overlay.classList.added.includes('visible'));
  assert.equal(screams, 1);

  jumpscare.hide();
  assert.ok(overlay.classList.removed.includes('visible'), 'hide removes the overlay outright');
});

test('a failing audio layer never blocks the image', () => {
  const overlay = { classList: { add() {}, remove() {} } };
  const audio = { playScream: () => { throw new Error('no audio device'); } };

  const jumpscare = createJumpscare(overlay, { src: '' }, audio, 'data:,');
  assert.doesNotThrow(() => jumpscare.show(), 'the visual scare runs even when the sound cannot');
});
