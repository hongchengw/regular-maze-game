import test from 'node:test';
import assert from 'node:assert/strict';

import { SCARE_DURATION } from '../src/game.js';
import { SCREAM_DURATION, PEAK_GAIN, buildScream, createAudio } from '../src/audio.js';

// A hand-written fake Web Audio context. It records what was created, scheduled, and connected, so
// the scheduling can be asserted in plain Node. No mock package: the repo has zero dependencies.
function fakeContext() {
  const log = { created: [], starts: [], stops: [], ramps: [], connections: [] };
  let counter = 0;

  const param = (label) => {
    const record = (value, time) => {
      log.ramps.push({ label, value, time });
    };
    return {
      value: 0,
      setValueAtTime: record,
      linearRampToValueAtTime: record,
      exponentialRampToValueAtTime: record,
      setTargetAtTime: record,
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
      self.start = (time) => log.starts.push({ label: self.label, time });
      self.stop = (time) => log.stops.push({ label: self.label, time });
      return self;
    },
    createBufferSource() {
      const self = node('buffer-source');
      self.buffer = null;
      self.start = (time) => log.starts.push({ label: self.label, time });
      self.stop = (time) => log.stops.push({ label: self.label, time });
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
