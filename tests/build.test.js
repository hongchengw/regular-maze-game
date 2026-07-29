import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, resolveGraph, stripModuleSyntax } from '../build/build.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fixtures = path.join(here, 'fixtures');

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
  assert.ok(output.includes('data:image/png;base64,'), 'asset should be a png data URI');

  const match = output.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match, 'the data URI should carry base64 payload');

  const decoded = Buffer.from(match[1], 'base64');
  const onDisk = fs.readFileSync(path.join(root, 'assets', 'jumpscare.png'));
  assert.equal(decoded.length, onDisk.length, 'decoded bytes should match the file on disk');
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
