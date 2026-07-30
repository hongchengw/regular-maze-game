import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SCARE_DURATION } from '../src/game.js';
import { SCREAM_DURATION, PEAK_GAIN, MUSIC_GAIN, buildScream, buildMusic, createAudio } from '../src/audio.js';

// Comments are stripped, so prose about the ordering below does not read as the ordering itself.
const mainSource = fs
  .readFileSync(fileURLToPath(new URL('../src/main.js', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

// A hand-written fake Web Audio context. It records what was created, scheduled, and connected, so
// the scheduling can be asserted in plain Node. No mock package: the repo has zero dependencies.
function fakeContext() {
  const log = { created: [], starts: [], stops: [], ramps: [], connections: [] };
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
    createBuffer(channels, length, sampleRate) {
      return { length, sampleRate, getChannelData: () => new Float32Array(length) };
    },
  };

  return { ctx, log };
}

/** The master gain is the gain node feeding the limiter, found without labelling the production code. */
function masterGainValues(log) {
  const compressor = log.created.find((n) => n.kind === 'compressor');
  const feeding = log.connections.filter((c) => c.to === compressor.label).map((c) => c.from);
  return log.ramps.filter((r) => feeding.includes(r.label)).map((r) => r.value);
}

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
  return { audio: createAudio(FakeAudioContext), log };
}

test('SCREAM_DURATION is exactly 4', () => {
  assert.equal(SCREAM_DURATION, 4.0);
});

test('scream duration is shorter than the scare', () => {
  assert.ok(
    SCREAM_DURATION < SCARE_DURATION,
    'the image must outlast the sound, leaving silence rather than a loop',
  );
});

test('buildScream schedules every layer', () => {
  const { ctx, log } = fakeContext();
  buildScream(ctx, 0);

  const kinds = log.created.map((n) => n.kind);
  const sawtooths = log.created.filter((n) => n.kind === 'oscillator' && n.type === 'sawtooth');
  const sines = log.created.filter((n) => n.kind === 'oscillator' && n.type === 'sine');

  assert.ok(kinds.includes('buffer-source'), 'the impact and grit layers need noise buffer sources');
  assert.equal(sawtooths.length, 2, 'the scream body is two detuned sawtooths');
  assert.ok(sines.length >= 1, 'the sub layer is a sine');
  assert.ok(kinds.filter((k) => k === 'filter').length >= 2, 'a lowpass and a bandpass at least');
});

test('every scheduled node stops by the duration', () => {
  const { ctx, log } = fakeContext();
  const startTime = 3;
  buildScream(ctx, startTime);

  assert.ok(log.stops.length > 0, 'fixture check: something should be scheduled to stop');
  for (const stop of log.stops) {
    assert.ok(
      stop.time <= startTime + SCREAM_DURATION + 1e-9,
      `${stop.label} outlives the 4s window at ${stop.time}`,
    );
  }
});

test('nothing is scheduled before the start time', () => {
  const { ctx, log } = fakeContext();
  const startTime = 3;
  buildScream(ctx, startTime);

  for (const event of [...log.starts, ...log.ramps]) {
    assert.ok(event.time >= startTime - 1e-9, `${event.label} fires at ${event.time}, before the start`);
  }
});

test('master gain is capped', () => {
  const { ctx, log } = fakeContext();
  buildScream(ctx, 0);

  assert.ok(PEAK_GAIN <= 0.5, 'the cap itself must stay startling rather than damaging');

  const values = masterGainValues(log);
  assert.ok(values.length > 0, 'fixture check: the master gain should be scheduled');
  for (const value of values) {
    assert.ok(value <= PEAK_GAIN + 1e-9, `master gain reached ${value}, above PEAK_GAIN`);
  }
});

test('a limiter sits before the destination', () => {
  const { ctx, log } = fakeContext();
  buildScream(ctx, 0);

  const compressor = log.created.find((n) => n.kind === 'compressor');
  assert.ok(compressor, 'a DynamicsCompressor should be created as a safety limiter');
  assert.ok(
    log.connections.some((c) => c.from === compressor.label && c.to === 'destination'),
    'the limiter should be the last node before the destination',
  );
});

test('missing AudioContext degrades gracefully', () => {
  const audio = createAudio(undefined);

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

test('stopMusic before the scream', () => {
  const { audio, log } = fakeAudio();
  audio.startMusic();

  const musicNodes = new Set(log.created.map((n) => n.label));
  audio.stopMusic();
  audio.playScream();

  const musicStop = Math.min(...log.stops.filter((s) => musicNodes.has(s.label)).map((s) => s.seq));
  const screamFirst = Math.min(
    ...[...log.starts, ...log.ramps].filter((e) => !musicNodes.has(e.label)).map((e) => e.seq),
  );

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
