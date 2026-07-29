# Regular Maze Game

A reguler maze game. A prize awaits for you at the end to claim...

## Build

Requires Node 18 or newer. There are no dependencies to install.

```
node build/build.js
```

This writes `dist/index.html`, a single self-contained file with the stylesheet and the jumpscare
image inlined. Open it directly from the filesystem or serve it from any static host.

To use your own image, replace `assets/jumpscare.png` and rebuild. The committed file is a
placeholder.

## Test

```
npm test
```

Runs the built-in Node test runner against `tests/`. Both commands must succeed before any commit.
