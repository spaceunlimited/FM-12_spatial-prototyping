#!/usr/bin/env node
// The five-request benchmark: how much does a typical student request cost from a fresh clone?
// For each request: clone this repo to a temp dir, npm ci, run Claude Code non-interactively,
// record tokens, cost, time, turns and which files it read, then type-check and boot-test the
// result. Writes docs/BENCHMARK.md.
//
//   npm run benchmark                 all five requests
//   npm run benchmark -- 1 2 4        a subset
// Requires the `claude` CLI on PATH and a signed-in account. Each run costs real tokens.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const REQUESTS = [
  'Put a small blue cube on the table in front of me.',
  'Make the cube draggable.',
  "Add a label above the cube that says 'Cube'.",
  "When I tap the cube, the AI should say 'Nice choice' (fake is fine).",
  "When I say 'hello', show a panel that says 'Hello back'.",
];
const ALLOWED_READS = [/^src\/experience\//, /^CAPABILITIES\.md$/, /^CLAUDE\.md$/];
const picked = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= REQUESTS.length);
const indices = picked.length ? picked.map((n) => n - 1) : REQUESTS.map((_, i) => i);

const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
const rows = [];
for (const i of indices) {
  const request = REQUESTS[i];
  console.log(`\n▶ ${i + 1}. ${request}`);
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'xr-bench-')));
  run('git', ['clone', '-q', ROOT, dir]);
  run('npm', ['ci', '--no-audit', '--no-fund', '--silent'], dir);

  const t0 = Date.now();
  const claude = spawnSync(
    'claude',
    ['-p', request, '--output-format', 'stream-json', '--verbose', '--max-turns', '12', '--allowedTools', 'Edit,Write,Read,Glob,Grep,Bash(npm run check*)'],
    { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const wall = Date.now() - t0;
  const events = (claude.stdout || '').split('\n').filter(Boolean).map((l) => safeJson(l)).filter(Boolean);
  const result = events.find((e) => e.type === 'result') || {};
  const reads = [];
  for (const e of events) {
    if (e.type !== 'assistant') continue;
    for (const block of e.message?.content || []) {
      if (block.type === 'tool_use' && ['Read', 'Glob', 'Grep'].includes(block.name)) {
        const p = String(block.input?.file_path || block.input?.path || block.input?.pattern || '');
        reads.push(p.startsWith(dir) ? p.slice(dir.length).replace(/^\//, '') : p);
      }
    }
  }
  const outside = reads.filter((p) => p && !ALLOWED_READS.some((re) => re.test(p)));
  const changed = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
  const finalText = String(result.result || '').trim();
  const askedQuestion = !changed && /\?\s*$/.test(finalText);
  const check = spawnSync('npm', ['run', 'check', '--silent'], { cwd: dir, encoding: 'utf8' }).status === 0;
  const smoke = spawnSync('npm', ['run', 'smoke', '--silent'], { cwd: dir, encoding: 'utf8' }).status === 0;
  const u = result.usage || {};
  rows.push({
    n: i + 1,
    request,
    input: u.input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    output: u.output_tokens || 0,
    cost: result.total_cost_usd ?? null,
    seconds: Math.round((result.duration_ms || wall) / 1000),
    turns: result.num_turns ?? null,
    outside: outside.length,
    outsideList: [...new Set(outside)].slice(0, 5).join(', '),
    askedQuestion,
    check,
    smoke,
  });
  const row = rows.at(-1);
  console.log(`  ${row.seconds}s · ${row.input} new in + ${row.cacheWrite} cache write + ${row.cacheRead} cache read / ${row.output} out · check ${check ? '✓' : '✗'} · smoke ${smoke ? '✓' : '✗'} · reads outside: ${outside.length}`);
  rmSync(dir, { recursive: true, force: true });
}

const date = new Date().toISOString().slice(0, 10);
const table = [
  '| # | Request | New input | Cache write | Cache read | Output | Cost | Time | Turns | Reads outside | Asked a question | check | boot |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.n} | ${r.request} | ${r.input} | ${r.cacheWrite} | ${r.cacheRead} | ${r.output} | ${r.cost == null ? '–' : '$' + r.cost.toFixed(3)} | ${r.seconds}s | ${r.turns ?? '–'} | ${r.outside}${r.outsideList ? ` (${r.outsideList})` : ''} | ${r.askedQuestion ? 'yes' : 'no'} | ${r.check ? '✓' : '✗'} | ${r.smoke ? '✓' : '✗'} |`,
  ),
].join('\n');
const path = join(ROOT, 'docs/BENCHMARK.md');
const prev = existsSync(path) ? readFileSync(path, 'utf8') : '';
const header = prev.includes('\n## Runs') ? prev.slice(0, prev.indexOf('\n## Runs')) : prev;
writeFileSync(path, `${header.trimEnd()}\n\n## Runs\n\n### ${date} · ${sha}\n\n${table}\n${prev.includes('\n## Runs') ? prev.slice(prev.indexOf('\n## Runs') + '\n## Runs\n'.length) : ''}`);
console.log(`\nwrote docs/BENCHMARK.md`);

function run(cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}
function safeJson(l) {
  try {
    return JSON.parse(l);
  } catch {
    return null;
  }
}
