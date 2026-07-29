// The scare sound, synthesized with the Web Audio API. No audio file and no base64 audio blob, so
// the bundle stays small and the sound is exactly 4 seconds by construction rather than by however
// long a sourced clip happens to run.
//
// Nothing here reads game state or touches the DOM. No audio plays at any other time: the title,
// select, and gameplay screens are silent, and silence during play is what makes the scare land.

/** Seconds. The image holds for 10s, so the last 6 are deliberately silent. */
export const SCREAM_DURATION = 4.0;

/** Master gain ceiling. Startling, not damaging. */
export const PEAK_GAIN = 0.45;

/** Seconds of white noise generated once per context and reused across plays. */
const NOISE_SECONDS = 4.0;

const noiseBuffers = new WeakMap();

/** White noise, generated once per context. */
function noiseBuffer(ctx) {
  const cached = noiseBuffers.get(ctx);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;

  noiseBuffers.set(ctx, buffer);
  return buffer;
}

/**
 * Schedule the four layers of the scream at `startTime`, all at once and with no timers. Returns
 * the scheduled source nodes. Nothing is scheduled before `startTime` and nothing outlives
 * `startTime + SCREAM_DURATION`.
 */
export function buildScream(ctx, startTime) {
  const end = startTime + SCREAM_DURATION;

  // A limiter is the last thing before the destination, as a safety net under the master cap.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-12, startTime);
  limiter.knee.setValueAtTime(6, startTime);
  limiter.ratio.setValueAtTime(12, startTime);
  limiter.attack.setValueAtTime(0.002, startTime);
  limiter.release.setValueAtTime(0.15, startTime);
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.setValueAtTime(PEAK_GAIN, startTime);
  master.connect(limiter);

  const sources = [];

  // Layer 1, impact: a white-noise burst through a lowpass sweeping 8 kHz down to 200 Hz.
  const impact = ctx.createBufferSource();
  impact.buffer = noiseBuffer(ctx);
  const impactFilter = ctx.createBiquadFilter();
  impactFilter.type = 'lowpass';
  impactFilter.frequency.setValueAtTime(8000, startTime);
  impactFilter.frequency.exponentialRampToValueAtTime(200, startTime + 0.25);
  const impactGain = ctx.createGain();
  impactGain.gain.setValueAtTime(0.0001, startTime);
  impactGain.gain.linearRampToValueAtTime(1, startTime + 0.01);
  impactGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);
  impact.connect(impactFilter);
  impactFilter.connect(impactGain);
  impactGain.connect(master);
  impact.start(startTime);
  impact.stop(startTime + 0.3);
  sources.push(impact);

  // Layer 2, scream body: two sawtooths detuned about 15 cents, gliding 1200 Hz down to 180 Hz.
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, startTime);
  bodyGain.gain.linearRampToValueAtTime(0.8, startTime + 0.02);
  bodyGain.gain.setValueAtTime(0.8, startTime + 2.8);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 3.4);
  bodyGain.connect(master);

  for (const detune of [-15, 15]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.setValueAtTime(detune, startTime);
    osc.frequency.setValueAtTime(1200, startTime);
    osc.frequency.exponentialRampToValueAtTime(180, startTime + 3.4);
    osc.connect(bodyGain);
    osc.start(startTime);
    osc.stop(end);
    sources.push(osc);
  }

  // Layer 3, grit: bandpass-filtered noise tracking the scream's pitch, at a lower gain.
  const grit = ctx.createBufferSource();
  grit.buffer = noiseBuffer(ctx);
  const gritFilter = ctx.createBiquadFilter();
  gritFilter.type = 'bandpass';
  gritFilter.Q.setValueAtTime(1.2, startTime);
  gritFilter.frequency.setValueAtTime(1200, startTime);
  gritFilter.frequency.exponentialRampToValueAtTime(180, startTime + 3.4);
  const gritGain = ctx.createGain();
  gritGain.gain.setValueAtTime(0.0001, startTime);
  gritGain.gain.linearRampToValueAtTime(0.35, startTime + 0.05);
  gritGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 3.4);
  grit.connect(gritFilter);
  gritFilter.connect(gritGain);
  gritGain.connect(master);
  grit.start(startTime);
  grit.stop(end);
  sources.push(grit);

  // Layer 4, sub: a 55 Hz sine for chest weight.
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, startTime);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, startTime);
  subGain.gain.linearRampToValueAtTime(0.7, startTime + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);
  sub.connect(subGain);
  subGain.connect(master);
  sub.start(startTime);
  sub.stop(startTime + 1.3);
  sources.push(sub);

  return sources;
}

/**
 * Wrap the scream in a context lifecycle. The constructor is injected so tests can pass a fake or
 * `undefined`; `main.js` passes `window.AudioContext || window.webkitAudioContext`.
 */
export function createAudio(AudioContextCtor) {
  let ctx = null;

  // Browsers block audio started outside a user gesture, so unlock() is called from the START
  // click handler. Calling it again is harmless.
  function unlock() {
    if (!AudioContextCtor) return;
    try {
      if (!ctx) ctx = new AudioContextCtor();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (err) {
      ctx = null;
    }
  }

  // Audio failure never blocks the jumpscare and never throws into the animation loop.
  function playScream() {
    if (!AudioContextCtor) return;
    try {
      unlock();
      if (ctx) buildScream(ctx, ctx.currentTime + 0.01);
    } catch (err) {
      // Swallowed on purpose: the visual scare still runs.
    }
  }

  return { unlock, playScream, available: Boolean(AudioContextCtor) };
}
