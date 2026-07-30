// The scare sound and the ambient music. The sound is the user's file, inlined by the build and
// decoded here; the music is synthesized, since a drone is cheaper to generate than to ship.
//
// The file is played through this module's `AudioContext` rather than through an `<audio>` element.
// That is deliberate three times over: the bundle's Content-Security-Policy needs no `media-src`,
// no network API is used to obtain the bytes so the never-networks rule holds without an exception,
// and the sound is gated behind the same user-gesture unlock the music already needs.
//
// Nothing here reads game state or touches the DOM. The title screen is silent, wall contact makes
// no sound, and the music is cut before the sound is scheduled, so the scare still lands into
// silence, which is what makes it land at all.

/**
 * Seconds. A **ceiling**, not the file's length: the source is stopped here whatever the supplied
 * sound happens to run to, so a longer file swapped in later cannot outlive the image.
 */
export const SCREAM_DURATION = 5.0;

/** Master gain ceiling. Startling, not damaging. */
export const PEAK_GAIN = 0.45;

/**
 * Master gain ceiling for the ambient music, against the scream's 0.45. It is meant to sit at the
 * edge of hearing and set unease, never to be listened to.
 */
export const MUSIC_GAIN = 0.05;

/** Seconds the music takes to ramp away when stopped. An abrupt stop would click. */
const MUSIC_FADE = 0.3;

/**
 * Decode the inlined sound into an `AudioBuffer`. The payload is read out of the data URI with
 * `atob`, so the bytes are already in the document and no network API is needed to reach them.
 */
export function decodeScream(ctx, dataUri) {
  const payload = dataUri.slice(dataUri.indexOf(',') + 1);
  const binary = atob(payload);

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  return ctx.decodeAudioData(bytes.buffer);
}

/**
 * Schedule the decoded sound at `startTime`, capped under the image. Nothing is scheduled before
 * `startTime` and nothing outlives `startTime + SCREAM_DURATION`. Returns the source node.
 *
 * The graph is `source -> master gain -> limiter -> destination`, which is the same ceiling the
 * synthesized scream this replaced ran through, so a hot-mastered file cannot come out louder than
 * the sound it replaced.
 */
export function buildScream(ctx, buffer, startTime) {
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

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(master);
  source.start(startTime);
  source.stop(startTime + SCREAM_DURATION);

  return source;
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
export function createAudio(AudioContextCtor, screamSrc) {
  let ctx = null;
  let scream = null;
  let decoded = false;
  let music = null;

  /**
   * Decode the sound once and keep it. Decoding takes milliseconds and the player is minutes from
   * the scare, so it is always ready by the time it is needed. Doing it per scare would stall the
   * one frame in the whole app that must not stall.
   */
  function decodeOnce() {
    if (!ctx || decoded || !screamSrc) return;
    decoded = true;
    try {
      Promise.resolve(decodeScream(ctx, screamSrc)).then(
        (buffer) => {
          scream = buffer;
        },
        () => {
          // A file that will not decode leaves the scare silent, never broken.
        },
      );
    } catch (err) {
      // As above.
    }
  }

  // Browsers block audio started outside a user gesture, so unlock() is called from the START
  // click handler. Calling it again is harmless.
  function unlock() {
    if (!AudioContextCtor) return;
    try {
      if (!ctx) ctx = new AudioContextCtor();
      if (ctx.state === 'suspended') ctx.resume();
      decodeOnce();
    } catch (err) {
      ctx = null;
    }
  }

  // Audio failure never blocks the jumpscare and never throws into the animation loop.
  function playScream() {
    if (!AudioContextCtor) return;
    try {
      unlock();
      if (ctx && scream) buildScream(ctx, scream, ctx.currentTime + 0.01);
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
