// The scare sound and the ambient music, both synthesized with the Web Audio API. No audio file and
// no base64 audio blob, so the bundle stays small and the scream is exactly 4 seconds by
// construction rather than by however long a sourced clip happens to run.
//
// Nothing here reads game state or touches the DOM. The title screen is silent, wall contact makes
// no sound, and the music is cut before the scream is scheduled, so the scream still lands into
// silence, which is what makes it land at all.

/** Seconds. Shorter than the image, so the scare always ends in silence rather than in a cut-off. */
export const SCREAM_DURATION = 4.0;

/** Master gain ceiling. Startling, not damaging. */
export const PEAK_GAIN = 0.45;

/**
 * Master gain ceiling for the ambient music, against the scream's 0.45. It is meant to sit at the
 * edge of hearing and set unease, never to be listened to.
 */
export const MUSIC_GAIN = 0.05;

/** Seconds the music takes to ramp away when stopped. An abrupt stop would click. */
const MUSIC_FADE = 0.3;

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
 * The ambient drone: two low detuned oscillators through a lowpass, with two slow LFOs moving the
 * filter cutoff and the master music gain so it breathes. Returns `{ nodes, gain }`, where `nodes`
 * are the oscillators, the only things that need stopping.
 *
 * Nothing here schedules a stop and nothing loops, because there is no clip to loop: the oscillators
 * simply run until `stopMusic` ends them, so there is no loop point to hear.
 */
export function buildMusic(ctx) {
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(MUSIC_GAIN * 0.8, now);
  gain.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(240, now);
  filter.Q.setValueAtTime(0.8, now);
  filter.connect(gain);

  const nodes = [];

  // Two voices a fifth apart, low in the register and detuned a few cents so they beat slowly
  // against each other rather than sitting still.
  for (const [frequency, detune] of [[55, -6], [82.5, 7]]) {
    const voice = ctx.createOscillator();
    voice.type = 'sawtooth';
    voice.frequency.setValueAtTime(frequency, now);
    voice.detune.setValueAtTime(detune, now);
    voice.connect(filter);
    voice.start(now);
    nodes.push(voice);
  }

  // The filter LFO. Its depth is a cutoff swing in Hz, not a loudness, and it feeds an AudioParam
  // rather than the audio path, so it is not bound by MUSIC_GAIN.
  const filterLfo = ctx.createOscillator();
  filterLfo.type = 'sine';
  filterLfo.frequency.setValueAtTime(0.06, now);
  const filterDepth = ctx.createGain();
  filterDepth.gain.setValueAtTime(120, now);
  filterLfo.connect(filterDepth);
  filterDepth.connect(filter.frequency);
  filterLfo.start(now);
  nodes.push(filterLfo);

  // The gain LFO: the breathing. A fifth of the base level either side of it, so the peak is exactly
  // MUSIC_GAIN and the trough is still audible.
  const gainLfo = ctx.createOscillator();
  gainLfo.type = 'sine';
  gainLfo.frequency.setValueAtTime(0.09, now);
  const gainDepth = ctx.createGain();
  gainDepth.gain.setValueAtTime(MUSIC_GAIN * 0.2, now);
  gainLfo.connect(gainDepth);
  gainDepth.connect(gain.gain);
  gainLfo.start(now);
  nodes.push(gainLfo);

  return { nodes, gain };
}

/**
 * Wrap the scream and the music in a context lifecycle. The constructor is injected so tests can
 * pass a fake or `undefined`; `main.js` passes `window.AudioContext || window.webkitAudioContext`.
 */
export function createAudio(AudioContextCtor) {
  let ctx = null;
  let music = null;

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

  // Idempotent: the node set lives in this closure and a second call is a no-op, since a second set
  // of voices would simply double the volume.
  function startMusic() {
    if (!AudioContextCtor || music) return;
    try {
      unlock();
      if (ctx) music = buildMusic(ctx);
    } catch (err) {
      // Swallowed on purpose: music must never throw into the animation loop.
      music = null;
    }
  }

  function stopMusic() {
    if (!music) return;

    const stopping = music;
    music = null;

    try {
      const now = ctx.currentTime;
      // Ramped rather than cut, since an abrupt stop clicks. The oscillators end just after the
      // ramp lands, so nothing is still sounding when they do.
      stopping.gain.gain.cancelScheduledValues(now);
      stopping.gain.gain.setValueAtTime(MUSIC_GAIN, now);
      stopping.gain.gain.linearRampToValueAtTime(0.0001, now + MUSIC_FADE);
      for (const node of stopping.nodes) node.stop(now + MUSIC_FADE + 0.05);
    } catch (err) {
      // Swallowed on purpose, as above.
    }
  }

  return { unlock, playScream, startMusic, stopMusic, available: Boolean(AudioContextCtor) };
}
