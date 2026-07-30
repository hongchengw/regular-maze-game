# Regular Maze Game

A reguler maze game. A prize awaits for you at the end to claim...

## Build

```
npm run build
```

There is no `npm install` step. The project has no dependencies, runtime or dev, so a fresh clone is
ready to build. Node 18 or newer.

That writes `dist/index.html`: one self-contained file with the stylesheet, every module, and the
jumpscare image inlined as a data URI. Open it straight from the filesystem, or drop it on any static
host. It makes no network requests of any kind.

There is no `npm run dev` and no dev server, because there is nothing to serve. The dev loop is
`npm run build` and then reload the file in your browser. Under the hood the script just runs
`node build/build.js`, which you can call directly if you prefer.

To use your own image, replace `assets/jumpscare.png` and build again. The committed one is a
placeholder.

## Test

```
npm test
```

Runs the built-in Node test runner against `tests/`. Both commands must succeed before any commit.
