# Task 18 - The image fills the whole screen

**Depends on:** nothing. **Unblocks:** nothing. Ships the last of the second round of QA changes.

## Goal

When this is done the whole jumpscare image is on screen, stretched to the viewport, with nothing
cropped away.

This reverses a decision from `tasks/README.md`. See the second "Decisions changed after QA" table
there. `object-fit: cover` does fill the screen, which is why it was chosen, but it fills it by
cropping whichever axis overflows. On a phone in portrait that cut most of the picture away.

## Spec first

Already written. `SPEC.md` section 13 carries `object-fit: fill` and records that the distortion is
deliberate. Verify the code matches; do not re-author it.

## Failing tests first

The overlay is a DOM edge, so the seam is the stylesheet itself, scanned the way
`tests/jumpscare.test.js` already scans it for animation properties.

Expected red run: the new case fails on `cover`.

| Test case | Assertion |
| --- | --- |
| `the image is stretched to the whole viewport` | The `.jumpscare img` rule declares `object-fit: fill`, and `width` and `height` are both `100%`. |
| `the image is not cropped` | The same rule declares neither `cover` nor `contain`. `cover` crops and `contain` letterboxes, and both leave part of the screen showing something other than the image. |
| `no animation properties in the stylesheet` | Already exists. Must still pass: stretching is a layout property, not an animation, so `SPEC.md` section 13's no-flash rule is untouched. |
| `overlay markup has no text content` | Already exists. Must still pass: this task changes no markup. |

## Implementation outline

**`src/styles.css`**, in the `.jumpscare img` rule: `object-fit: cover` becomes `object-fit: fill`.

Nothing else. In particular, do not add a `background-size`, an `aspect-ratio`, or a wrapper to
"preserve" the proportions. Losing them is the point of the change, and a later reader who thinks
this is a bug should find that sentence in `SPEC.md` section 13 before they act on it.

The black background behind the image stays. It no longer covers letterboxing, since there is none,
but it is what the overlay shows in the moment before the image paints.

## Files touched

**Modified:** `src/styles.css`, `tests/jumpscare.test.js`, `changelogs/CHANGELOGS.md`,
`dist/index.html` (rebuild).

**Never touched:** `README.md`, `src/index.html`, `src/jumpscare.js`.

## Done criteria

- `npm test` passes; the fill case was observed red first.
- `node build/build.js` succeeds and the rebuilt `dist/index.html` is committed.
- By hand, in both orientations and at more than one window size: the whole image is visible, it
  touches all four edges, and no black band appears anywhere. Portrait on a phone is the case that
  prompted the change, so check that one specifically.

## Commit

Run the `git-commit-formatter` skill with subject:

```
fix(jumpscare): stretch the image to fill the screen
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend `## Task 18 - Full-screen scare image - <date> <time> EDT` with Added / Changed / Deleted.
Note that this completes the second round of QA changes, tasks 16 to 18.
