// The fullscreen overlay: the user-supplied image, held perfectly still, with the scream.
//
// The 10-second clock belongs to `game.step`, not to a timer here. The overlay is purely a function
// of `state.phase`, so there is one clock, no drift, and no orphaned timer if something else changes
// phase.

/**
 * Bind the overlay to its elements. `imageSrc` is the build-inlined data URI, assigned immediately
 * rather than on `show()`: a data URI decodes fast but not instantly, and a blank first frame would
 * deflate the scare.
 */
export function createJumpscare(overlayEl, imgEl, audio, imageSrc) {
  imgEl.src = imageSrc;

  function show() {
    overlayEl.classList.add('visible');

    // Audio failure never blocks the jumpscare. The image is the payload; the sound is a bonus.
    try {
      audio.playScream();
    } catch (err) {
      // Swallowed on purpose.
    }
  }

  function hide() {
    overlayEl.classList.remove('visible');
  }

  return { show, hide };
}
