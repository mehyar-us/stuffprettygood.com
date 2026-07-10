#!/usr/bin/env node
// scripts/check-inline-iife.mjs
// Build-step gate: every inline <script>...</script> block in dist/*.html must
// parse without SyntaxError. Catches the pitfall-69 class of bugs where
// template-literal string interpolation strips backslashes from regex literals
// inside IIFEs (compare-mode + share-URL bug shipped tick 18).
//
// Uses Node's vm.Script for in-process parsing (no spawn). Walks dist/ once,
// collects all script bodies, then parses them in a tight loop.
//
// Usage: node scripts/check-inline-iife.mjs
// Exit codes: 0 = all clean, 1 = at least one script failed to parse.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep, relative } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const distDir = join(root, 'dist');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (full.includes(`${sep}go${sep}`)) continue;
      walk(full, out);
    } else if (name === 'index.html') {
      out.push(full);
    }
  }
  return out;
}

const SCRIPT_RE = /<script(?![^>]*type=)([^>]*)>([\s\S]*?)<\/script>/g;
const files = walk(distDir);
let checked = 0;
const failures = [];

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  SCRIPT_RE.lastIndex = 0;
  let m;
  let idx = 0;
  while ((m = SCRIPT_RE.exec(html)) !== null) {
    idx++;
    const body = m[2];
    if (!body.trim()) continue;
    checked++;
    try {
      new vm.Script(body, { filename: `${relative(root, file)}#script${idx}` });
    } catch (e) {
      failures.push({
        file: relative(root, file),
        scriptIdx: idx,
        line: e.lineNumber || 0,
        msg: e.message.split('\n')[0].slice(0, 240),
      });
    }
  }
}

console.log(`checked ${checked} inline script bodies across ${files.length} dist pages`);
if (failures.length) {
  console.error(`FAIL: ${failures.length} script(s) failed to parse`);
  for (const f of failures) {
    console.error(`  - ${f.file} script #${f.scriptIdx}: ${f.msg}`);
  }
  process.exit(1);
}
console.log('OK: all inline script bodies parse cleanly');