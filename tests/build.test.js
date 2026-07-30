import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, mimeFor, resolveGraph, stripModuleSyntax } from '../build/build.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fixtures = path.join(here, 'fixtures');

const ASSET = path.join(root, 'assets', 'jumpscare.jpg');

/** Build a fixture source tree to a throwaway file, so dist/ is never touched by these cases. */
function buildFixture(name, assetFile = ASSET) {
  return build({
    srcDir: path.join(fixtures, name),
    assetFile,
    outFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'maze-build-')), 'index.html'),
  });
}

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('base64');

/** Concatenate a fixture graph the way build() does, so order is observable. */
function bundleFixture(entry) {
  return resolveGraph(entry)
    .map((mod) => stripModuleSyntax(mod.source))
    .join('\n');
}

const output = build();

test('build writes dist/index.html', () => {
  const outFile = path.join(root, 'dist', 'index.html');
  assert.ok(fs.existsSync(outFile), 'dist/index.html should exist after a build');
  assert.ok(fs.statSync(outFile).size > 0, 'dist/index.html should not be empty');
});

test('output has no external references', () => {
  assert.ok(!output.includes('src="http'), 'no external script or image src');
  assert.ok(!output.includes('href="http'), 'no external href');
  assert.ok(!/<link\s+rel="stylesheet"/.test(output), 'no external stylesheet link');
  assert.ok(!/<script\s+src=/.test(output), 'no external script src');
});

test('output has no leftover module syntax', () => {
  assert.ok(!/^\s*import\s/m.test(output), 'every import statement should be stripped');
  assert.ok(!/^\s*export\s/m.test(output), 'every export keyword should be stripped');
});

test('output inlines the stylesheet', () => {
  const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
  const selector = '.jumpscare';
  assert.ok(css.includes(selector), 'fixture check: the selector exists in the source stylesheet');

  const styleBlock = output.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(styleBlock, 'output should contain a <style> block');
  assert.ok(styleBlock[1].includes(selector), 'the stylesheet should be inlined into <style>');
});

test('output inlines the jumpscare asset', () => {
  assert.ok(output.includes('data:image/jpeg;base64,'), 'the shipped asset is a jpeg data URI');

  const match = output.match(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match, 'the data URI should carry base64 payload');

  const decoded = Buffer.from(match[1], 'base64');
  const onDisk = fs.readFileSync(ASSET);
  assert.equal(decoded.length, onDisk.length, 'decoded bytes should match the file on disk');
  assert.ok(decoded.equals(onDisk), 'and should be the same bytes, not merely the same length');
});

test('the media type follows the asset extension', () => {
  assert.equal(mimeFor('a/b/jumpscare.jpg'), 'image/jpeg');
  assert.equal(mimeFor('jumpscare.jpeg'), 'image/jpeg');
  assert.equal(mimeFor('jumpscare.png'), 'image/png');
  assert.equal(mimeFor('jumpscare.webp'), 'image/webp');
  assert.equal(mimeFor('jumpscare.gif'), 'image/gif');
  assert.equal(mimeFor('jumpscare.avif'), 'image/avif');
  assert.equal(mimeFor('JUMPSCARE.JPG'), 'image/jpeg', 'the extension is matched case-insensitively');
});

test('an unrecognised asset type fails the build', () => {
  // Guessing a media type here would ship a data URI the browser refuses to decode, and the scare
  // would be a blank screen with no error anywhere.
  assert.throws(
    () => mimeFor('assets/jumpscare.tiff'),
    (err) => err.message.includes('jumpscare.tiff'),
    'the error should name the offending file',
  );
});

test('swapping the asset format needs no code change', () => {
  // The whole swap procedure is "replace the file and rebuild", so a png must still work.
  const png = path.join(fixtures, 'asset', 'swap.png');
  const swapped = buildFixture('hostile-js', png);

  assert.ok(swapped.includes('data:image/png;base64,'), 'a png asset yields a png data URI');
  assert.ok(!swapped.includes('data:image/jpeg'), 'and nothing is left over from the jpeg default');
});

test('an inlined module cannot close the script block', () => {
  const hostile = buildFixture('hostile-js');
  const scriptBlock = hostile.match(/<script type="module">([\s\S]*?)<\/script>/);

  assert.ok(scriptBlock, 'the output should still have exactly one script block');
  assert.ok(
    !scriptBlock[1].includes('</script'),
    'a source string containing </script> must not terminate the block that carries it',
  );
  assert.ok(!scriptBlock[1].includes('<!--'), 'nor may it open an HTML comment');
  assert.ok(
    !/<img src=x onerror=/.test(hostile.replace(scriptBlock[0], '')),
    'nothing from the module body may escape into the document as markup',
  );
});

test('the escape keeps the script valid and its meaning intact', () => {
  const hostile = buildFixture('hostile-js');
  const body = hostile.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

  // The escaped source must still parse, and the string must still hold what it held.
  const read = new Function(`${body}\nreturn { TAUNT, OPENER };`)();
  assert.equal(read.TAUNT, '</script><img src=x onerror=alert(1)>', 'the value is unchanged');
  assert.equal(read.OPENER, '<!-- html comment opener');
});

test('a stylesheet that closes its block fails the build', () => {
  assert.throws(
    () => buildFixture('hostile-css'),
    (err) => /style/i.test(err.message) && err.message.includes('styles.css'),
    'CSS has no safe escape, so this must fail loudly rather than ship a breakable bundle',
  );
});

test('bundle carries a content security policy matching what it ships', () => {
  const meta = output.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(meta, 'the bundle should declare a CSP in <head>');

  const policy = meta[1];
  assert.match(policy, /default-src 'none'/, 'nothing loads unless explicitly allowed');
  assert.match(policy, /img-src data:/, 'the jumpscare is a data URI');
  assert.match(policy, /base-uri 'none'/);
  assert.match(policy, /form-action 'none'/);

  const script = output.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const style = output.match(/<style>([\s\S]*?)<\/style>/)[1];

  assert.ok(
    policy.includes(`'sha256-${sha256(script)}'`),
    'the script-src hash must match the script that actually ships, or nothing runs',
  );
  assert.ok(
    policy.includes(`'sha256-${sha256(style)}'`),
    'and the style-src hash must match the stylesheet that actually ships',
  );
});

test('the policy sits before the script it governs', () => {
  assert.ok(
    output.indexOf('Content-Security-Policy') < output.indexOf('<script type="module">'),
    'a policy declared after the script would not apply to it',
  );
});

test('bundle includes every src module', () => {
  // One known symbol per module. A module dropping out of the import graph fails the build here
  // rather than silently shipping a broken app.
  const symbols = {
    'rng.js': 'mulberry32',
    'maze.js': 'toSegments',
    'collision.js': 'distancePointSegment',
    'difficulty.js': 'DIFFICULTY',
    'game.js': 'SCARE_DURATION',
    'render.js': 'fitTransform',
    'input.js': 'vectorFrom',
    'audio.js': 'buildScream',
    'jumpscare.js': 'createJumpscare',
    'main.js': 'JUMPSCARE_SRC',
  };

  const modules = fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js'));
  assert.deepEqual(modules.sort(), Object.keys(symbols).sort(), 'every src module needs a symbol here');

  for (const [module, symbol] of Object.entries(symbols)) {
    assert.ok(output.includes(symbol), `${module} is missing from the bundle: no ${symbol}`);
  }
});

test('bundle has the warning text verbatim', () => {
  assert.ok(
    output.includes('WARNING: Not suitable for those sensitive to sudden sounds or visuals.'),
    'the only forewarning the user gets must never be lost to a refactor',
  );
});

test('bundle makes no network requests', () => {
  assert.ok(!output.includes('fetch('), 'no fetch');
  assert.ok(!output.includes('XMLHttpRequest'), 'no XMLHttpRequest');
  assert.ok(!output.includes('http://'), 'no http URLs');
  assert.ok(!output.includes('https://'), 'no https URLs');
});

test('module order respects dependencies', () => {
  const bundled = bundleFixture(path.join(fixtures, 'graph', 'a.js'));
  const bIndex = bundled.indexOf('b body marker');
  const aIndex = bundled.indexOf('a sees');

  assert.ok(bIndex !== -1 && aIndex !== -1, 'both module bodies should be present');
  assert.ok(bIndex < aIndex, "b's body must appear before a's, since a imports b");
});

test('a diamond graph emits each module once, dependencies first', () => {
  const modules = resolveGraph(path.join(fixtures, 'diamond', 'top.js'));
  const names = modules.map((mod) => path.basename(mod.path));

  assert.equal(names.filter((n) => n === 'base.js').length, 1, 'base.js should appear once');
  assert.ok(names.indexOf('base.js') < names.indexOf('left.js'), 'base before left');
  assert.ok(names.indexOf('base.js') < names.indexOf('right.js'), 'base before right');
  assert.ok(names.indexOf('left.js') < names.indexOf('top.js'), 'left before top');
});

test('unresolvable import fails loudly', () => {
  assert.throws(
    () => resolveGraph(path.join(fixtures, 'missing', 'entry.js')),
    (err) => err.message.includes('does-not-exist.js'),
    'the error should name the offending path rather than emitting a broken bundle',
  );
});

test('an import cycle throws with the path chain', () => {
  assert.throws(
    () => resolveGraph(path.join(fixtures, 'cycle', 'one.js')),
    (err) => /cycle/i.test(err.message) && err.message.includes('one.js'),
    'a cycle should be reported with the chain, not loop forever',
  );
});
