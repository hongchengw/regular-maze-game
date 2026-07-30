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

To change the scare image, replace `assets/jumpscare.jpg` and build again. The media type follows the
file extension, so `.png`, `.webp`, `.gif`, and `.avif` work too without touching any code.

## Deploy

Import the repository on Vercel, or run `vercel` from the project root. `vercel.json` already sets
everything: build with `npm run build`, publish `dist/`, no framework, nothing to install.

The deployment also sends the headers the document cannot set for itself, chiefly
`frame-ancestors 'none'` so the game cannot be embedded in someone else's page with the warning
cropped out of view.

## Test

```
npm test
```

Runs the built-in Node test runner against `tests/`. Both commands must succeed before any commit.
