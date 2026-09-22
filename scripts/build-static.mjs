/**
 * Assembles dist/ — the static copy of the site that GitHub Pages serves.
 *
 * The source in public/ is not modified. Everything Pages needs differently happens
 * here, on the copy:
 *
 *  1. Base path. A project site lives under /<repo>/, so every root-absolute URL
 *     ("/assets/...") would point at the domain root and 404. They are rewritten to
 *     BASE_PATH + url. BASE_PATH comes from actions/configure-pages in CI ("/diver"),
 *     and is "" for a custom domain served at the root.
 *  2. three.js. Express serves it from node_modules at /vendor/three/; here it is
 *     bundled into one minified ES module at the same path instead.
 *  3. Server-only pages. admin.html reads the lead API, which does not exist on Pages.
 *  4. .nojekyll, so Pages serves the files as they are.
 *
 * Fails the build if any root-absolute URL survives the rewrite — a half-rewritten
 * site deploys "successfully" and then shows up unstyled. /api/ calls are reported,
 * not failed: they are expected to be unreachable on Pages until the form is wired
 * to a hosted form service.
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

// "/diver" in CI, "" for a site served at the domain root. Never a trailing slash.
const BASE = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');

// Refuse anything that is not a URL path. Git Bash on Windows silently rewrites
// BASE_PATH=/diver into "C:/Program Files/Git/diver"; that value slips past the
// leftover check below (it no longer starts with "/") and would ship a broken site.
if (BASE && !/^\/[A-Za-z0-9._~\-/]*$/.test(BASE)) {
  console.error(
    `[build-static] FAILED: BASE_PATH must be "" or a URL path like "/diver", got "${BASE}".\n` +
      '  In Git Bash, prefix the command with MSYS_NO_PATHCONV=1.',
  );
  process.exit(1);
}

const EXCLUDE = new Set(['admin.html', path.join('assets', 'js', 'admin.js')]);
const API_PREFIX = '/api/';

const log = (...args) => console.log('[build-static]', ...args);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Prefix root-absolute URLs in HTML attributes. Protocol-relative "//" is left alone. */
function rewriteHtml(html) {
  return html.replace(/\b(href|src|content|data-frames)="\/(?!\/)/g, `$1="${BASE}/`);
}

/** Prefix root-absolute string literals in JS, except the API, which stays as-is. */
function rewriteJs(js) {
  return js.replace(/(['"`])\/(?!\/)(?!api\/)([a-z][^'"`\n]*)\1/gi, `$1${BASE}/$2$1`);
}

async function main() {
  const started = Date.now();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // 1. Copy public/, minus server-only pages.
  const files = await walk(SRC);
  let copied = 0;
  for (const file of files) {
    const rel = path.relative(SRC, file);
    if (EXCLUDE.has(rel)) continue;
    const dest = path.join(OUT, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(file, dest);
    copied++;
  }
  log(`copied ${copied} files (skipped: ${[...EXCLUDE].join(', ')})`);

  // 2. Rewrite URLs for the base path.
  const apiCalls = [];
  const leftovers = [];
  for (const file of await walk(OUT)) {
    const ext = path.extname(file);
    if (ext !== '.html' && ext !== '.js') continue;
    const before = await readFile(file, 'utf8');
    const after = ext === '.html' ? rewriteHtml(before) : rewriteJs(before);
    if (after !== before) await writeFile(file, after);

    const rel = path.relative(OUT, file);
    const attrLeft = ext === '.html' ? after.match(/\b(href|src|content|data-frames)="\/(?!\/)[^"]*"/g) : null;
    if (BASE && attrLeft) {
      for (const hit of attrLeft) {
        if (!hit.includes(`"${BASE}/`)) leftovers.push(`${rel}: ${hit}`);
      }
    }
    for (const hit of after.match(/(['"`])\/api\/[^'"`]*\1/g) ?? []) apiCalls.push(`${rel}: ${hit}`);
  }

  // 3. three.js as one minified module where dottedSurface.js expects it.
  const threeEntry = path.join(ROOT, 'node_modules', 'three', 'build', 'three.module.js');
  const threeOut = path.join(OUT, 'vendor', 'three', 'three.module.js');
  await build({
    entryPoints: [threeEntry],
    bundle: true,
    format: 'esm',
    minify: true,
    legalComments: 'none',
    outfile: threeOut,
    logLevel: 'warning',
  });
  const threeRaw =
    (await stat(threeEntry)).size +
    (await stat(path.join(ROOT, 'node_modules', 'three', 'build', 'three.core.js'))).size;
  const threeMin = (await stat(threeOut)).size;
  log(`three.js bundled: ${(threeRaw / 1024).toFixed(0)} KB -> ${(threeMin / 1024).toFixed(0)} KB`);

  // 4. Let Pages serve files as they are.
  await writeFile(path.join(OUT, '.nojekyll'), '');

  // 5. Guard rails.
  if (!(await stat(path.join(OUT, 'assets', 'css', 'site.css')).catch(() => null))) {
    throw new Error('dist/assets/css/site.css is missing — run `npm run build` first.');
  }
  if (leftovers.length) {
    throw new Error(`root-absolute URLs survived the rewrite:\n  ${leftovers.join('\n  ')}`);
  }
  for (const call of apiCalls) {
    log(`note: ${call} has no server on Pages — the lead form needs a hosted form service.`);
  }

  log(`done in ${Date.now() - started}ms · base path "${BASE || '/'}" · output ${path.relative(ROOT, OUT)}/`);
}

main().catch((error) => {
  console.error('[build-static] FAILED:', error.message);
  process.exit(1);
});
