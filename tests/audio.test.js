import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SCARE_DURATION } from '../src/game.js';
import {
  SCREAM_DURATION,
  PEAK_GAIN,
  MUSIC_GAIN,
  buildScream,
  buildMusic,
  decodeScream,
  createAudio,
} from '../src/audio.js';

/** A one-byte payload in the shape the bundler emits, so `decodeScream` has something to slice. */
const SCREAM_SRC = 'data:audio/mpeg;base64,QQ==';

// Comments are stripped, so prose about the ordering below does not read as the ordering itself.
const mainSource = fs
  .readFileSync(fileURLToPath(new URL('../src/main.js', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

// A hand-written fake Web Audio context. It records what was created, scheduled, and connected, so
// the scheduling can be asserted in plain Node. No mock package: the repo has zero dependencies.
function fakeContext() {
  const log = { created: [], starts: [], stops: [], ramps: [], connections: [], decodes: [] };
  let counter = 0;
  let sequence = 0;

  // One monotonic counter across every log, so the order calls were made in is assertable and not
  // only the times they schedule for. The music must stop before the scream is built, and the two
  // are scheduled at different times by design.
  const seq = () => {
    sequence += 1;
    return sequence;
  };

  const param = (label) => {
    const record = (method) => (value, time) => {
      log.ramps.push({ label, method, value, time, seq: seq() });
    };
    return {
      value: 0,
      setValueAtTime: record('setValueAtTime'),
      linearRampToValueAtTime: record('linearRampToValueAtTime'),
      exponentialRampToValueAtTime: record('exponentialRampToValueAtTime'),
      setTargetAtTime: record('setTargetAtTime'),
      cancelScheduledValues: () => {},
    };
  };

  const node = (kind) => {
    counter += 1;
    const label = `${kind}#${counter}`;
    const self = {
      kind,
      label,
      connect(target) {
        log.connections.push({ from: label, to: target ? target.label : 'unknown' });
        return target;
      },
      disconnect() {},
    };
    log.created.push(self);
    return self;
  };

  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: { label: 'destination', connect() {} },
    resume: async () => {},
    createGain() {
      const self = node('gain');
      self.gain = param(self.label);
      return self;
    },
    createOscillator() {
      const self = node('oscillator');
      self.type = 'sine';
      self.detune = param(self.label);
      self.frequency = param(self.label);
      self.start = (time) => log.starts.push({ label: self.label, time, seq: seq() });
      self.stop = (time) => log.stops.push({ label: self.label, time, seq: seq() });
      return self;
    },
    createBufferSource() {
      const self = node('buffer-source');
      self.buffer = null;
      self.start = (time) => log.starts.push({ label: self.label, time, seq: seq() });
      self.stop = (time) => log.stops.push({ label: self.label, time, seq: seq() });
      return self;
    },
    createBiquadFilter() {
      const self = node('filter');
      self.type = 'lowpass';
      self.frequency = param(self.label);
      self.Q = param(self.label);
      return self;
    },
    createDynamicsCompressor() {
      const self = node('compressor');
      for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) self[key] = param(self.label);
      return self;
    },
    // Resolves to a marker object, so a test can tell the played buffer came from here and was not
    // built in code.
    decodeAudioData(bytes) {
      log.decodes.push({ byteLength: bytes.byteLength, seq: seq() });
      return Promise.resolve(DECODED);
    },
  };

  return { ctx, log };
}

/** The object the fake's `decodeAudioData` resolves to. */
const DECODED = { decoded: true, duration: 4.83 };

/** Let the decode promise settle, since `unlock` starts it and does not wait for it. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Every node whose signal reaches the destination. An LFO's depth feeds an AudioParam rather than a
 * node, so a modulation depth, which is measured in Hz for a filter sweep, is deliberately outside
 * this set: the audio path is where a gain means loudness.
 */
function audioPath(log) {
  const reaching = new Set(['destination']);

  // The graph is a handful of nodes, so iterating to a fixed point reads better than a proper walk.
  for (let pass = 0; pass <= log.connections.length; pass += 1) {
    for (const connection of log.connections) {
      if (reaching.has(connection.to)) reaching.add(connection.from);
    }
  }
  return reaching;
}

/** The labels of the gain nodes that carry loudness to the destination. */
function pathGains(log) {
  const path = audioPath(log);
  return log.created.filter((n) => n.kind === 'gain' && path.has(n.label)).map((n) => n.label);
}

/** An audio object wired to a fake context, plus that context's log. */
function fakeAudio() {
  const { ctx, log } = fakeContext();
  function FakeAudioContext() {
    return ctx;
  }
  return { audio: createAudio(FakeAudioContext, SCREAM_SRC), log };
}

/** An audio object that has been unlocked and whose sound has finished decoding. */
async function readyAudio() {
  const wired = fakeAudio();
  wired.audio.unlock();
  await settle();
  return wired;
}

test('SCREAM_DURATION is a ceiling under the image', () => {
  assert.equal(SCREAM_DURATION, 5.0);
  assert.ok(
    SCREAM_DURATION < SCARE_DURATION,
    'the image must outlast the sound, leaving silence rather than a cut-off',
  );
});

test('the sound is decoded once, on the gesture', async () => {
  const { audio, log } = await readyAudio();

  audio.unlock();
  audio.playScream();
  audio.playScream();
  await settle();

  assert.equal(log.decodes.length, 1, 'decoding per scare would stall the one frame that must not');
});

test('the scare plays the decoded buffer', async () => {
  const { audio, log } = await readyAudio();
  audio.playScream();

  const sources = log.created.filter((n) => n.kind === 'buffer-source');
  assert.equal(sources.length, 1, 'the scare is one source, not a stack of synthesized layers');
  assert.equal(sources[0].buffer, DECODED, 'it plays what decodeAudioData returned');
});

test('the sound cannot outlive the image', async () => {
  const { audio, log } = await readyAudio();
  audio.playScream();

  assert.ok(log.stops.length > 0, 'fixture check: the source should be scheduled to stop');
  for (const stop of log.stops) {
    const started = log.starts.find((s) => s.label === stop.label);
    assert.ok(
      stop.time - started.time <= SCREAM_DURATION + 1e-9,
      `${stop.label} runs ${stop.time - started.time}s, past the ceiling`,
    );
  }
  // The ceiling is enforced whatever the file's own length is, so a longer file swapped in later is
  // cut rather than left playing over a title screen.
  assert.ok(SCREAM_DURATION < SCARE_DURATION);
});

test('the scare is capped at PEAK_GAIN', async () => {
  const { audio, log } = await readyAudio();
  audio.playScream();

  assert.ok(PEAK_GAIN <= 0.5, 'the cap itself must stay startling rather than damaging');

  const gains = pathGains(log);
  assert.ok(gains.length > 0, 'fixture check: the sound should reach the destination through a gain');
  for (const ramp of log.ramps.filter((r) => gains.includes(r.label))) {
    assert.ok(ramp.value <= PEAK_GAIN + 1e-9, `the scare scheduled ${ramp.value}, above PEAK_GAIN`);
  }
});

test('the scare synthesizes nothing', async () => {
  const { audio, log } = await readyAudio();
  audio.playScream();

  assert.equal(
    log.created.filter((n) => n.kind === 'oscillator').length,
    0,
    'the only oscillators the app creates are the ambient music\'s',
  );
});

test('a limiter sits before the destination', async () => {
  const { audio, log } = await readyAudio();
  audio.playScream();

  const compressor = log.created.find((n) => n.kind === 'compressor');
  assert.ok(compressor, 'a DynamicsCompressor should be created as a safety limiter');
  assert.ok(
    log.connections.some((c) => c.from === compressor.label && c.to === 'destination'),
    'the limiter should be the last node before the destination',
  );
});

test('nothing is scheduled before the start time', async () => {
  const { ctx, log } = fakeContext();
  const startTime = 3;
  buildScream(ctx, DECODED, startTime);

  for (const event of [...log.starts, ...log.ramps]) {
    assert.ok(event.time >= startTime - 1e-9, `${event.label} fires at ${event.time}, before the start`);
  }
});

test('decodeScream reads the payload out of the data URI', async () => {
  const { ctx, log } = fakeContext();
  await decodeScream(ctx, SCREAM_SRC);

  assert.equal(log.decodes.length, 1);
  assert.equal(log.decodes[0].byteLength, 1, 'the base64 prefix is stripped and the bytes decoded');
});

test('a failed decode never blocks the image', async () => {
  const { ctx } = fakeContext();
  ctx.decodeAudioData = () => Promise.reject(new Error('corrupt file'));
  function FakeAudioContext() {
    return ctx;
  }

  const audio = createAudio(FakeAudioContext, SCREAM_SRC);
  audio.unlock();
  await settle();

  assert.doesNotThrow(() => audio.playScream(), 'the visual scare still runs when the sound cannot');
});

test('missing AudioContext degrades gracefully', () => {
  const audio = createAudio(undefined, SCREAM_SRC);

  assert.equal(audio.available, false);
  assert.doesNotThrow(() => audio.unlock(), 'unlock must not throw without Web Audio');
  assert.doesNotThrow(() => audio.playScream(), 'the visual scare still runs when audio cannot');
});

// --- Ambient music -------------------------------------------------------------------------------

test('MUSIC_GAIN is very low', () => {
  assert.ok(MUSIC_GAIN <= 0.06, 'the music sits at the edge of hearing, it is not listened to');
  assert.ok(
    MUSIC_GAIN * 4 < PEAK_GAIN,
    'it must never approach the scream, or the scream is merely the next loud thing',
  );
});

test('music schedules no gain above its cap', () => {
  const { ctx, log } = fakeContext();
  buildMusic(ctx);

  const gains = pathGains(log);
  assert.ok(gains.length > 0, 'fixture check: the music should reach the destination through a gain');

  for (const ramp of log.ramps.filter((r) => gains.includes(r.label))) {
    assert.ok(ramp.value <= MUSIC_GAIN + 1e-9, `the music scheduled ${ramp.value}, above MUSIC_GAIN`);
  }
});

test('music runs without an end', () => {
  const { ctx, log } = fakeContext();
  buildMusic(ctx);

  assert.ok(log.starts.length > 0, 'fixture check: the drone should actually start');
  assert.equal(log.stops.length, 0, 'it is a drone held until stopped, not a clip to be relaunched');
});

test('starting twice does not stack', () => {
  const { audio, log } = fakeAudio();
  const oscillators = () => log.created.filter((n) => n.kind === 'oscillator').length;

  audio.startMusic();
  const once = oscillators();
  audio.startMusic();

  assert.ok(once > 0, 'fixture check: the first call should build the drone');
  assert.equal(oscillators(), once, 'doubling the voices would double the volume');
});

test('stopMusic stops everything it started', () => {
  const { audio, log } = fakeAudio();
  audio.startMusic();

  const started = log.created.filter((n) => n.kind === 'oscillator').map((n) => n.label);
  const gains = pathGains(log);
  audio.stopMusic();

  for (const label of started) {
    assert.ok(log.stops.some((s) => s.label === label), `${label} was left running after stopMusic`);
  }

  const last = log.ramps.filter((r) => gains.includes(r.label)).pop();
  assert.match(last.method, /Ramp|setTarget/, 'the gain is ramped down; cutting it would click');
  assert.ok(last.value <= 0.001, `the gain ended at ${last.value}, not near silence`);
});

test('stopMusic before the scream', async () => {
  const { audio, log } = fakeAudio();
  audio.startMusic();
  await settle();

  const musicNodes = new Set(log.created.map((n) => n.label));
  audio.stopMusic();
  audio.playScream();

  const musicStop = Math.min(...log.stops.filter((s) => musicNodes.has(s.label)).map((s) => s.seq));
  const screamFirst = Math.min(
    ...[...log.starts, ...log.ramps].filter((e) => !musicNodes.has(e.label)).map((e) => e.seq),
  );

  assert.ok(Number.isFinite(screamFirst), 'fixture check: the scare sound should have been built');
  assert.ok(musicStop < screamFirst, 'the music must be stopped before a single scream node is built');

  // The ordering above only holds if the app calls them in that order, and that call site is a DOM
  // edge no test can drive. Pin it in the source instead: this is the rule the whole scare depends on.
  const showPhase = mainSource.slice(mainSource.indexOf('function showPhase'));
  assert.ok(
    showPhase.indexOf('audio.stopMusic()') < showPhase.indexOf('jumpscare.show()'),
    'showPhase must stop the music before it shows the jumpscare, which is what schedules the scream',
  );
});

test('music degrades without Web Audio', () => {
  const audio = createAudio(undefined);

  assert.doesNotThrow(() => audio.startMusic(), 'music that cannot start must never throw');
  assert.doesNotThrow(() => audio.stopMusic(), 'nor must stopping music that never started');
});

test('nothing plays before it is asked to', () => {
  const { log } = fakeAudio();

  assert.equal(log.created.length, 0, 'constructing the audio object schedules nothing at all');
});

test('unlock is safe to call repeatedly', () => {
  let constructed = 0;
  const { ctx } = fakeContext();
  function FakeAudioContext() {
    constructed += 1;
    return ctx;
  }

  const audio = createAudio(FakeAudioContext);
  audio.unlock();
  audio.unlock();
  audio.unlock();

  assert.equal(constructed, 1, 'the context is created once and reused');
});
