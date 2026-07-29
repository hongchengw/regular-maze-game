// Dependency-free bundler. Walks the module graph from src/main.js, strips module syntax, and
// writes one self-contained dist/index.html with every asset inlined.
//
// Because every module body lands in a single scope, top-level names across src/ must be unique.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

/** Matches `import ... from './rel.js'` and bare `import './rel.js'`, relative paths only. */
const IMPORT_RE = /^[ \t]*import\s+(?:.*?\s+from\s+)?['"](\.[^'"]+)['"];?[ \t]*$/gm;

/**
 * Read `entryPath` and every relative import it reaches, depth first.
 * Returns `{ path, source }` in dependency order: a module always follows everything it imports.
 * Throws on an unresolvable import or an import cycle, naming the offending path.
 */
export function resolveGraph(entryPath) {
  const modules = [];
  const done = new Set();

  const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

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

/** Build the single-file bundle. Returns the output HTML and writes it to `outFile`. */
export function build({
  srcDir = path.join(ROOT, 'src'),
  assetFile = path.join(ROOT, 'assets', 'jumpscare.png'),
  outFile = path.join(ROOT, 'dist', 'index.html'),
} = {}) {
  const script = resolveGraph(path.join(srcDir, 'main.js'))
    .map((mod) => stripModuleSyntax(mod.source).trim())
    .filter(Boolean)
    .join('\n\n');

  const styles = fs.readFileSync(path.join(srcDir, 'styles.css'), 'utf8').trim();
  const asset = `data:image/png;base64,${fs.readFileSync(assetFile).toString('base64')}`;

  const output = fs
    .readFileSync(path.join(srcDir, 'index.html'), 'utf8')
    .replace('__STYLES__', () => styles)
    .replace('__ASSET_JUMPSCARE__', () => asset)
    .replace('__SCRIPT__', () => script);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, output);
  return output;
}

// CLI entry. Importing this module never builds; only running it does.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = build();
  console.log(`built dist/index.html (${out.length} bytes)`);
}
