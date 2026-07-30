import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from '../build/build.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const config = readJson('vercel.json');
const manifest = readJson('package.json');

/** Every header the deployment sets, flattened to a name-to-value map. */
function headersFor(pathname) {
  const map = new Map();
  for (const rule of config.headers ?? []) {
    // Only the catch-all is exercised here; the config is not expected to grow path-specific rules.
    if (rule.source === '/(.*)' || rule.source === pathname) {
      for (const { key, value } of rule.headers) map.set(key.toLowerCase(), value);
    }
  }
  return map;
}

test('the build command is one the project actually has', () => {
  const command = config.buildCommand;
  assert.ok(command, 'a build command should be declared rather than guessed by the platform');

  const script = command.replace(/^npm run /, '');
  assert.ok(
    Object.prototype.hasOwnProperty.call(manifest.scripts, script),
    `vercel.json runs '${command}', but package.json has no '${script}' script`,
  );
});

test('the output directory is where the build actually writes', () => {
  assert.equal(config.outputDirectory, 'dist');

  // Not a guess: run the real build and confirm the file lands in the directory being published.
  build();
  const published = path.join(root, config.outputDirectory, 'index.html');
  assert.ok(fs.existsSync(published), `${config.outputDirectory}/index.html should exist after a build`);
  assert.ok(fs.statSync(published).size > 0, 'and should not be empty');
});

test('the deployment declares no framework', () => {
  assert.equal(config.framework, null, 'this is plain static output, not a framework build');
});

test('the response headers cover framing and sniffing', () => {
  const headers = headersFor('/');

  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.match(headers.get('referrer-policy') ?? '', /no-referrer/);
  assert.match(
    headers.get('content-security-policy') ?? '',
    /frame-ancestors 'none'/,
    'a real header can forbid framing, which a meta policy cannot',
  );
});

test('the header policy cannot break the inline bundle', () => {
  // The bundle's own meta policy carries the script and style hashes. Policies combine by
  // intersection, so any script-src or style-src sent here would have to allow those hashes too,
  // and would silently blank the app if it did not. The header stays framing-only on purpose.
  const policy = headersFor('/').get('content-security-policy') ?? '';
  const directives = policy
    .split(';')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);

  assert.deepEqual(directives, ['frame-ancestors'], `the header policy must be framing-only, got '${policy}'`);
});

test('the document is revalidated rather than cached forever', () => {
  const cacheControl = headersFor('/').get('cache-control') ?? '';
  assert.match(
    cacheControl,
    /max-age=0|no-cache/,
    'the whole app is one HTML file, so a stale cached copy is a stale app',
  );
});

test('the deployment ignores nothing the build needs', () => {
  const ignoreFile = path.join(root, '.vercelignore');
  if (!fs.existsSync(ignoreFile)) return;

  const ignored = fs
    .readFileSync(ignoreFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (const needed of ['src', 'assets', 'build']) {
    assert.ok(!ignored.includes(needed) && !ignored.includes(`${needed}/`), `${needed}/ is needed by the build`);
  }
});

test('gitignore keeps the committed artifact and drops local noise', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  const rules = gitignore
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  assert.ok(rules.includes('node_modules/'), 'dependencies are never committed');
  assert.ok(rules.includes('.vercel'), "the CLI's local link directory is not shared state");

  // dist/index.html is a committed artifact, so nothing may ignore it.
  assert.ok(
    !rules.some((rule) => /^\/?dist\/?$/.test(rule)),
    'dist/ must stay committed: it is the shipped artifact',
  );
});
