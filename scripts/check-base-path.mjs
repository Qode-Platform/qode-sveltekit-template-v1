#!/usr/bin/env node
/**
 * check-base-path.mjs - guard against host-root ("/...") URL literals.
 *
 * WHY THIS EXISTS
 * ---------------
 * In the fleet this app is NOT served at the host root. The ingress serves it
 * under a proxy prefix and forwards that prefix to the app UNCHANGED:
 *
 *     BASE_PATH=/direct/<agent>:<port>
 *
 * A URL written as a bare "/..." literal is resolved by the browser against the
 * HOST root, not against the app. So it works on localhost and 404s in the
 * fleet. Every API call and every asset reference has to carry the base path.
 *
 * HOW TO FIX AN OFFENDER (SvelteKit)
 * --------------------------------------
 * SvelteKit resolves ROUTES under `paths.base` (set from BASE_PATH in
 * vite.config.ts) and Vite rewrites imported assets (`import x from '$lib/...'`)
 * and the bundle URLs in app.html. Raw string URLs are NOT touched.
 *
 * Use `base` from $app/paths:
 *
 *     import { base } from '$app/paths';
 *     const res = await fetch(`${base}/api/items`);
 *     <a href="{base}/about">About</a>
 *     <img src="{base}/logo.svg" alt="" />
 *
 * EXEMPTING A LINE
 * ----------------
 * Some literals ARE rewritten for you by the framework. A line that is
 * genuinely handled can be exempted with a trailing `base-path-ok` comment,
 * which makes this check skip it - always say why:
 *
 *     href="/docs" <!-- rewritten by X - base-path-ok -->
 *
 * `href="/#..."` (in-page anchors) is skipped automatically.
 *
 * This is a standalone check on purpose: it is NOT wired into the build or CI.
 * Run it yourself with:  npm run check:base-path
 * Exit code 1 if any offender is found, 0 otherwise.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Application source lives here. Both are checked when both exist.
const SCAN_DIRS = ["src", "app"];

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".nuxt", ".output",
  ".svelte-kit", ".fleet-www", ".angular", "coverage",
]);

const EXTS = new Set([
  ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs",
  ".vue", ".svelte", ".astro", ".html", ".htm",
  ".css", ".scss", ".sass", ".less",
]);

// Patterns the framework does NOT rewrite for you.
const PATTERNS = [
  [/fetch\(\s*["'`]\//, 'fetch("/...")'],
  [/\bsrc=["']\//, 'src="/..."'],
  [/\bhref=["']\/(?!#)/, 'href="/..."'],
  [/\burl:\s*["'`]\//, 'url: "/..."'],
];

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile() && EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

const files = [];
for (const d of SCAN_DIRS) {
  const full = join(ROOT, d);
  if (existsSync(full) && statSync(full).isDirectory()) walk(full, files);
}

const offenders = [];
for (const file of files.sort()) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes("base-path-ok")) return; // explicitly exempted
    for (const [re, label] of PATTERNS) {
      if (re.test(line)) {
        offenders.push({
          where: `${relative(ROOT, file)}:${i + 1}`,
          label,
          text: line.trim(),
        });
        break;
      }
    }
  });
}

if (offenders.length === 0) {
  console.log("check:base-path OK - no host-root URL literals found.");
  process.exit(0);
}

console.error(
  `check:base-path FAILED - ${offenders.length} host-root URL literal(s) found.\n` +
    "These resolve against the host root, not against BASE_PATH, and will 404\n" +
    "behind the fleet proxy. See the header of scripts/check-base-path.mjs.\n"
);
for (const o of offenders) {
  console.error(`  ${o.where}  [${o.label}]\n      ${o.text}`);
}
process.exit(1);
