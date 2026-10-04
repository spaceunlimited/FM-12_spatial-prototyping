#!/usr/bin/env node
// Headless browser check: starts the dev server over plain HTTP on a free port, runs the Playwright
// specs in test/smoke against it, stops the server. Installs Chromium on first use.
//
//   npm run smoke                 boot.spec.ts: your scene boots, the proxy answers (safe after any edit)
//   npm run smoke -- --all        every spec, including the starter-scene checks (check-standalone uses this)
//   npm run smoke -- starter      one spec by name
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';

const ROOT = new URL('..', import.meta.url).pathname;
const argv = process.argv.slice(2);
const only = argv.find((a) => !a.startsWith('-')) || (argv.includes('--all') ? undefined : 'boot');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const shell = process.platform === 'win32';

const port = await freePort();
const env = { ...process.env, XR_NO_HTTPS: '1', XR_NO_CERT_HTTP: '1', XR_QUIET: '1', VITE_CACHE_DIR: process.env.VITE_CACHE_DIR || 'node_modules/.vite-smoke' };
const vite = spawn(npx, ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], shell });
let viteLog = '';
vite.stdout.on('data', (d) => (viteLog += d));
vite.stderr.on('data', (d) => (viteLog += d));

const url = `http://127.0.0.1:${port}`;
const up = await waitForHttp(url, 30_000);
if (!up) {
  console.error('✗ dev server did not start\n' + viteLog);
  vite.kill();
  process.exit(1);
}

ensureChromium();
const args = ['playwright', 'test', '--config', 'test/smoke/playwright.config.ts'];
if (only) args.push(only);
const run = spawnSync(npx, args, { cwd: ROOT, env: { ...env, SMOKE_URL: url }, stdio: 'inherit', shell });
vite.kill('SIGINT');
process.exit(run.status ?? 1);

function ensureChromium() {
  const probe = spawnSync(npx, ['playwright', 'install', '--dry-run', 'chromium'], { cwd: ROOT, encoding: 'utf8', shell });
  const out = (probe.stdout || '') + (probe.stderr || '');
  const m = out.match(/Install location:\s*(.+)/);
  if (m && existsSync(m[1].trim())) return;
  console.log('  Installing Chromium for the smoke test (once, ~150 MB)…');
  spawnSync(npx, ['playwright', 'install', 'chromium'], { cwd: ROOT, stdio: 'inherit', shell });
}

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

async function waitForHttp(u, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(u);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}
