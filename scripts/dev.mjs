#!/usr/bin/env node
// `npm run dev` — the one command students run.
// 1. makes sure .env exists     2. installs the git pre-commit guard
// 3. optional: adb reverse for Quest, or a public tunnel
// 4. starts Vite (HTTPS, LAN, proxy, QR)   5. opens the desktop preview
import { spawn, execSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, unlinkSync } from 'node:fs';
import { platform } from 'node:os';
import { ensureCert } from './cert.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const PORT = opt('--port') || process.env.DEV_PORT || '5173';
const env = { ...process.env };

// 1. .env
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('\n  Created .env from .env.example. Add an AI key there when you want real model calls; fake mode works without it.\n');
}
// 1a. A name like ELEVENLABS-API-KEY is not a variable: readers skip the line and the key is never found.
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*(?:export\s+)?([^=#\s]+)\s*=/);
  if (m && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(m[1])) {
    console.warn(`  .env: "${m[1]}" is not a valid variable name (letters, digits, underscore; no hyphens). That line is ignored.`);
  }
}
// 1b. Pin a device profile for this run (default: every device runs the best version it can).
if (opt('--profile')) env.VITE_DEVICE_PROFILE = opt('--profile');

// 2. git hooks
try {
  if (existsSync('.git')) execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {}

// 3a. Quest over cable: the headset reaches the laptop as localhost, which is a secure context
// even over plain HTTP, so this run skips HTTPS entirely (no certificate to trust on the headset).
if (flag('--quest')) {
  env.XR_NO_HTTPS = '1';
  try {
    execSync(`adb reverse tcp:${PORT} tcp:${PORT}`, { stdio: 'inherit' });
    console.log(`\n  Quest: open  http://localhost:${PORT}  in the Quest browser (cable connected, developer mode on).`);
    console.log('  This run is plain HTTP: phones on the Wi-Fi cannot use it. Restart without --quest for phones.\n');
  } catch {
    console.log('\n  adb not found or no headset connected. Install Android platform-tools and enable developer mode on the Quest.\n');
  }
}

// 3b. Tunnel (public https url with a real certificate; no device setup)
let tunnelProc = null;
if (flag('--tunnel')) {
  env.XR_NO_HTTPS = '1';
  const url = await startTunnel(PORT);
  if (url) env.XR_TUNNEL_URL = url.endsWith('/') ? url : url + '/';
  else console.log('  Tunnel did not start; falling back to LAN https.');
}

// 3c. HTTPS certificate (skipped behind a tunnel or a Quest cable)
if (!flag('--tunnel') && !flag('--quest')) {
  const cert = await ensureCert({ trust: !flag('--no-trust') });
  if (cert) {
    env.XR_CERT = cert.cert;
    env.XR_KEY = cert.key;
  }
}

// 4. Vite
try {
  unlinkSync('.dev-url');
} catch {}
const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '--port', PORT], { stdio: 'inherit', env, shell: process.platform === 'win32' });

// 5. Desktop preview
if (!flag('--no-open')) {
  waitFor('.dev-url', 20000).then((info) => {
    if (!info) return;
    const target = (info.local || info.url) + '?sim=headset';
    openBrowser(target);
  });
}

const shutdown = () => {
  vite.kill('SIGINT');
  tunnelProc?.kill('SIGINT');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
vite.on('exit', (code) => {
  tunnelProc?.kill('SIGINT');
  process.exit(code ?? 0);
});

// helpers -------------------------------------------------------------------
function waitFor(file, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const iv = setInterval(() => {
      if (existsSync(file)) {
        clearInterval(iv);
        try {
          resolve(JSON.parse(readFileSync(file, 'utf8')));
        } catch {
          resolve(null);
        }
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(iv);
        resolve(null);
      }
    }, 300);
  });
}

function openBrowser(url) {
  const p = platform();
  const cmd = p === 'darwin' ? ['open', [url]] : p === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
  } catch {}
}

function startTunnel(port) {
  return new Promise((resolve) => {
    console.log('\n  Starting a public tunnel (cloudflared). First run downloads it, this can take a minute…\n');
    tunnelProc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', 'cloudflared', 'tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    let done = false;
    const onData = (buf) => {
      const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !done) {
        done = true;
        resolve(m[0]);
      }
    };
    tunnelProc.stdout.on('data', onData);
    tunnelProc.stderr.on('data', onData);
    tunnelProc.on('exit', () => !done && resolve(null));
    setTimeout(() => !done && resolve(null), 90000);
  });
}
