#!/usr/bin/env node
// Proves the sandbox stands alone: a copy of the repo with every non-sandbox file removed must
// still type-check, build, pass its tests and boot in a browser. Also lints the source for any
// reference to the files a process harness would add.
//
//   npm run check-standalone            full run (copy, lint, check, build, test, smoke)
//   node scripts/check-standalone.mjs --lint-only   just the reference lint (pre-push hook)
import { cpSync, rmSync, mkdtempSync, symlinkSync, readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const lintOnly = process.argv.includes('--lint-only');

// Files a harness adds, and vocabulary that only makes sense with one. Built at runtime so this
// script does not trip its own lint.
const DOT = '.';
const FORBIDDEN = [
  DOT + 'claude',
  'BRIEF' + DOT + 'md',
  'JOURNAL' + DOT + 'md',
  'PLAN' + DOT + 'md',
  'toolbox' + DOT + 'json',
  DOT + 'harness',
  'BRIEF §',
  'session-start hook',
];
const CLAUDE_MD = 'CLAUDE' + DOT + 'md';
const LINT_PATHS = ['src', 'server', 'scripts', 'tools', 'test', 'docs', 'vite.config.ts', 'index.html', 'package.json', 'README.md', 'CAPABILITIES.md'];
const LINT_SKIP = new Set(['scripts/check-standalone.mjs', 'scripts/benchmark.mjs']);
const CLAUDE_MD_ALLOWED = new Set(['README.md', 'scripts/benchmark.mjs', 'docs/BENCHMARK.md']);

function lint(root) {
  const problems = [];
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const f of readdirSync(p)) walk(join(p, f));
      return;
    }
    const rel = relative(root, p);
    if (LINT_SKIP.has(rel) || /\.(hdr|png|jpg|wav|mp3|glb)$/.test(rel)) return;
    const text = readFileSync(p, 'utf8');
    for (const word of FORBIDDEN) if (text.includes(word)) problems.push(`${rel}: references "${word}"`);
    if (text.includes(CLAUDE_MD) && !CLAUDE_MD_ALLOWED.has(rel)) problems.push(`${rel}: references ${CLAUDE_MD} (only README may)`);
  };
  for (const p of LINT_PATHS) if (existsSync(join(root, p))) walk(join(root, p));
  return problems;
}

const problems = lint(ROOT);
if (problems.length) {
  console.error('✗ The sandbox references harness files:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('✓ no references to harness files');
if (lintOnly) process.exit(0);

// A clean copy: no node_modules (symlinked), no .git, no build output, no harness files.
const tmp = mkdtempSync(join(tmpdir(), 'xr-sandbox-standalone-'));
cpSync(ROOT, tmp, {
  recursive: true,
  filter: (src) => {
    const rel = relative(ROOT, src);
    return !/^(node_modules|\.git|dist|test-results|playwright-report)(\/|$)/.test(rel);
  },
});
symlinkSync(join(ROOT, 'node_modules'), join(tmp, 'node_modules'), 'dir');
for (const f of [DOT + 'claude', 'BRIEF' + DOT + 'md']) rmSync(join(tmp, f), { recursive: true, force: true });
console.log(`✓ clean copy in ${tmp}`);

const env = { ...process.env, VITE_CACHE_DIR: join(tmp, '.vite-cache') };
const steps = [
  ['type-check', ['npm', ['run', 'check']]],
  ['build (incl. CAPABILITIES check)', ['npm', ['run', 'build']]],
  ['unit tests', ['npm', ['run', 'test']]],
  ['smoke test', ['npm', ['run', 'smoke', '--', '--all']]],
];
for (const [label, [cmd, args]] of steps) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(process.platform === 'win32' ? cmd + '.cmd' : cmd, args, { cwd: tmp, stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n✗ standalone check failed at: ${label}  (copy kept at ${tmp})`);
    process.exit(1);
  }
}
rmSync(tmp, { recursive: true, force: true });
console.log('\n✓ the sandbox builds, tests and boots on its own');
