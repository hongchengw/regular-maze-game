# Task 01 - Scaffold: spec, package manifest, and dependency-free bundler

**Depends on:** nothing. **Unblocks:** everything.

## Goal

When this is done the repo has a runnable test command and a working build. `SPEC.md` exists with
the full behavioral spec skeleton. `npm test` runs the built-in Node test runner against `tests/`.
`node build/build.js` walks the module graph from `src/main.js`, inlines everything, and writes a
self-contained `dist/index.html` with zero external requests. A placeholder
`assets/jumpscare.png` exists so the build works before the user's real image lands.

## Spec first

Create `SPEC.md` with these sections. Later tasks fill in the ones marked TBD; this task writes the
prose for the first four and stubs the rest so the document's shape is fixed up front.

1. **Overview** - what the app is, that it is a prank, and that the jumpscare is the payload.
2. **Screens** - title (black screen, warning text, START button), difficulty select
   (EASY / MEDIUM / HARD), gameplay, jumpscare overlay. No other screens exist.
3. **Build and distribution** - `dist/index.html` is a single self-contained file. No external
   scripts, stylesheets, fonts, images, or network requests of any kind. Assets are inlined as
   base64 data URIs. The repo has zero npm dependencies.
4. **Assets** - `assets/jumpscare.png` is user-supplied. The committed file is a placeholder;
   replacing it and rerunning `node build/build.js` is the entire swap procedure.
5. Coordinate model (TBD, task 02) - Maze generation (TBD, task 02) - Collision (TBD, task 03) -
   Difficulty (TBD, task 04) - Game phases (TBD, task 05) - Rendering and fog (TBD, task 06) -
   Input (TBD, task 07) - Audio (TBD, task 08) - Jumpscare (TBD, task 09).

## Failing tests first

Write `tests/build.test.js` before `build/build.js` exists. Expected red run: the import of
`build/build.js` throws `ERR_MODULE_NOT_FOUND`. That is the correct first failure.

| Test case | Assertion |
| --- | --- |
| `build writes dist/index.html` | After calling the build, `dist/index.html` exists and is non-empty. |
| `output has no external references` | The output contains no `src="http`, no `href="http`, no `<link rel="stylesheet"`, and no `<script src=`. |
| `output has no leftover module syntax` | The output contains no bare `import ` or `export ` statements. Every `src/` module was stripped and concatenated. |
| `output inlines the stylesheet` | A known selector from `src/styles.css` appears inside a `<style>` block in the output. |
| `output inlines the jumpscare asset` | The output contains `data:image/png;base64,` and the decoded byte length matches `assets/jumpscare.png` on disk. |
| `module order respects dependencies` | For a fixture graph where `a.js` imports `b.js`, `b`'s body appears before `a`'s in the output. |
| `unresolvable import fails loudly` | Building a fixture that imports a missing file throws with the offending path in the message, rather than emitting a broken bundle. |

Run these against small fixtures under `tests/fixtures/` for the graph-ordering cases so they do not
depend on the real app's module list, which changes every task.

## Implementation outline

**`package.json`**

```json
{
  "name": "regular-maze-game",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "build": "node build/build.js"
  }
}
```

No `dependencies` and no `devDependencies`. Ever.

**`build/build.js`** - exported as a function plus a CLI entry so tests can call it directly:

- `resolveGraph(entryPath)` - read the entry, match relative imports with
  `/^import\s+.*?from\s+['"](\.[^'"]+)['"];?$/gm`, recurse depth-first, and return modules in
  dependency order (dependencies before dependents). Track visited paths to tolerate diamonds and
  throw on a cycle with the path chain in the message.
- `stripModuleSyntax(source)` - remove relative `import` lines and leading `export ` keywords.
  Because everything lands in one scope, top-level names across `src/` must be unique. Note that
  constraint in `SPEC.md`.
- `build({ srcDir, outFile })` - concatenate stripped bodies, read `src/styles.css`, read
  `assets/jumpscare.png` as base64, substitute into the `src/index.html` template placeholders
  `__STYLES__`, `__SCRIPT__`, and `__ASSET_JUMPSCARE__`, then write `dist/index.html`.

**`src/index.html`** - minimal template: `<!doctype html>`, viewport meta with
`user-scalable=no` so D-pad taps do not zoom on mobile, `<style>__STYLES__</style>`, an empty
`<body>` the app populates, and `<script type="module">__SCRIPT__</script>`. Expose the asset to JS
as a single `const JUMPSCARE_SRC = "__ASSET_JUMPSCARE__";` line at the top of the script block.

**`src/styles.css`** - just enough for this task: `html, body { margin: 0; background: #000; }` and
one identifiable selector the build test can assert on.

**`src/main.js`** - a one-line placeholder for now (later tasks replace it), so the graph walk has an
entry point.

**`assets/jumpscare.png`** - generate a small solid `#0a0a0a` PNG (a few hundred bytes, written with
a tiny zlib-free or `node:zlib`-based writer, or hand-assembled IHDR/IDAT/IEND chunks). It only has
to be a valid PNG. Do not commit anything large.

## Files touched

**Created:** `SPEC.md`, `package.json`, `build/build.js`, `src/index.html`, `src/styles.css`,
`src/main.js`, `assets/jumpscare.png`, `tests/build.test.js`, `tests/fixtures/*`,
`dist/index.html` (generated).

**Modified:** `changelogs/CHANGELOGS.md`, `.gitignore` (ensure `node_modules/` is ignored but
`dist/` is **not**, since `dist/index.html` is a committed artifact).

**Never touched:** `README.md`.

## Done criteria

- `npm test` passes, and each build test was observed red before `build/build.js` existed.
- `node build/build.js` succeeds and `dist/index.html` opens from the filesystem with no console
  errors and no network requests (check the browser Network tab shows only the document).
- `SPEC.md` sections 1 to 4 are written prose, 5 onward are explicit TBD stubs naming their task.
- `package.json` has no dependency fields.

## Commit

Run the `git-commit-formatter` skill with subject:

```
chore(build): add spec, manifest, and dependency-free bundler
```

No `Co-Authored-By` trailer.

## Changelog entry

Prepend to `changelogs/CHANGELOGS.md` as `## Task 01 - Scaffold - <date> <time> EDT` with
Added / Changed / Deleted subsections, per the format in `tasks/README.md`.
