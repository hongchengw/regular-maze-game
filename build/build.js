// Dependency-free bundler. Walks the module graph from src/main.js, strips module syntax, and
// writes one self-contained dist/index.html with every asset inlined.
//
// Because every module body lands in a single scope, top-level names across src/ must be unique.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

/** Matches `import ... from './rel.js'` and bare `import './rel.js'`, relative paths only. */
const IMPORT_RE = /^[ \t]*import\s+(?:.*?\s+from\s+)?['"](\.[^'"]+)['"];?[ \t]*$/gm;

/** Repo-relative POSIX path, for error messages that read the same on every platform. */
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/**
 * Read `entryPath` and every relative import it reaches, depth first.
 * Returns `{ path, source }` in dependency order: a module always follows everything it imports.
 * Throws on an unresolvable import or an import cycle, naming the offending path.
 */
export function resolveGraph(entryPath) {
  const modules = [];
  const done = new Set();

  const visit = (filePath, stack) => {
    if (done.has(filePath)) return;

    if (stack.includes(filePath)) {
      const chain = [...stack, filePath].map(rel).join(' -> ');
      throw new Error(`Import cycle detected: ${chain}`);
    }

    if (!fs.existsSync(filePath)) {
      const importer = stack.length ? rel(stack[stack.length - 1]) : '(entry)';
      throw new Error(`Cannot resolve import '${rel(filePath)}' from ${importer}`);
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);

    for (const match of source.matchAll(IMPORT_RE)) {
      visit(path.resolve(dir, match[1]), [...stack, filePath]);
    }

    done.add(filePath);
    modules.push({ path: filePath, source });
  };

  visit(path.resolve(entryPath), []);
  return modules;
}

/** Drop relative import statements and the leading `export ` keyword, leaving a bare body. */
export function stripModuleSyntax(source) {
  return source.replace(IMPORT_RE, '').replace(/^[ \t]*export\s+/gm, '');
}

/**
 * Make JavaScript safe to inline in a `<script>` block. A source containing `</script>` would
 * otherwise close the block that carries it and inject the rest as markup.
 *
 * Both escapes are valid inside string literals, comments, and regular expressions, which is
 * everywhere these sequences can legally appear, so the meaning of the code never changes.
 */
export function escapeInlineScript(js) {
  return js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

/**
 * CSS has no escape that survives `</style`, so a stylesheet that can close its own block fails the
 * build rather than shipping an artifact someone can break out of.
 */
export function assertInlineStyleSafe(css, file) {
  if (/<\/style/i.test(css)) {
    throw new Error(`Refusing to inline ${file}: it contains '</style', which would close the <style> block`);
  }
  return css;
}

/** CSP source expression for an inline block, hashed over exactly the text that ships. */
function sha256Source(text) {
  return `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

/** Build the single-file bundle. Returns the output HTML and writes it to `outFile`. */
export function build({
  srcDir = path.join(ROOT, 'src'),
  assetFile = path.join(ROOT, 'assets', 'jumpscare.png'),
  outFile = path.join(ROOT, 'dist', 'index.html'),
} = {}) {
  const script = escapeInlineScript(
    resolveGraph(path.join(srcDir, 'main.js'))
      .map((mod) => stripModuleSyntax(mod.source).trim())
      .filter(Boolean)
      .join('\n\n'),
  );

  const styleFile = path.join(srcDir, 'styles.css');
  const styles = assertInlineStyleSafe(fs.readFileSync(styleFile, 'utf8').trim(), rel(styleFile));
  const asset = `data:image/png;base64,${fs.readFileSync(assetFile).toString('base64')}`;

  // Newlines are normalized to LF before anything is hashed or written. An HTML parser normalizes
  // CRLF to LF before hashing an inline block, so a CRLF checkout would otherwise ship a policy
  // whose hashes never match and silently block the whole script.
  const filled = fs
    .readFileSync(path.join(srcDir, 'index.html'), 'utf8')
    .replace('__STYLES__', () => styles)
    .replace('__ASSET_JUMPSCARE__', () => asset)
    .replace('__SCRIPT__', () => script)
    .replace(/\r\n/g, '\n');

  // Hash exactly the text that ships between the tags, so a tampered bundle refuses to run.
  const policy = [
    "default-src 'none'",
    'img-src data:',
    `script-src ${sha256Source(filled.match(/<script type="module">([\s\S]*?)<\/script>/)[1])}`,
    `style-src ${sha256Source(filled.match(/<style>([\s\S]*?)<\/style>/)[1])}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  const output = filled.replace('__CSP__', () => policy);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, output);
  return output;
}

// CLI entry. Importing this module never builds; only running it does.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = build();
  console.log(`built dist/index.html (${out.length} bytes)`);
}
