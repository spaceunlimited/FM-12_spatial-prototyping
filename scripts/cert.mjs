// Local HTTPS for the dev server. Downloads mkcert once into ~/.xr-sandbox/cert,
// creates a local certificate authority there, asks the OS to trust it (this is the one
// password prompt students see), and issues a certificate for localhost + this laptop's LAN IPs.
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, createWriteStream } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir, networkInterfaces, platform, arch } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const CERT_HOME = join(homedir(), '.xr-sandbox', 'cert');
export const PROJECT_CERT_DIR = '.cert';
export const ROOT_CA_PATH = join(CERT_HOME, 'rootCA.pem');
export const CERT_PATH = join(PROJECT_CERT_DIR, 'dev-cert.pem');
export const KEY_PATH = join(PROJECT_CERT_DIR, 'dev-key.pem');

export function lanIPv4s() {
  const out = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (/^(utun|tun|tap|docker|br-|vboxnet|vmnet|zt)/i.test(name)) continue; // VPNs, containers
      out.push(a.address);
    }
  }
  const score = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return [...new Set(out)].sort((a, b) => score(a) - score(b));
}

function binaryPath() {
  return join(CERT_HOME, platform() === 'win32' ? 'mkcert.exe' : 'mkcert');
}

async function ensureBinary(log) {
  const bin = binaryPath();
  if (existsSync(bin)) return bin;
  mkdirSync(CERT_HOME, { recursive: true });
  const os = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[platform()];
  const cpu = { arm64: 'arm64', x64: 'amd64' }[arch()];
  if (!os || !cpu) throw new Error(`No mkcert build for ${platform()}/${arch()}`);
  const url = `https://dl.filippo.io/mkcert/latest?for=${os}/${cpu}`;
  log(`  Downloading mkcert (one time)…`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`mkcert download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(bin));
  if (platform() !== 'win32') chmodSync(bin, 0o755);
  return bin;
}

/**
 * Returns { cert, key, trusted, hosts } or null when HTTPS could not be set up.
 * opts.trust=false skips the OS trust prompt (certificate still works on phones that trust the CA).
 */
export async function ensureCert({ trust = true, log = console.log } = {}) {
  let bin;
  try {
    bin = await ensureBinary(log);
  } catch (e) {
    log(`  Could not get mkcert (${e.message}). Falling back to plain http; use --tunnel for devices.`);
    return null;
  }
  const env = { ...process.env, CAROOT: CERT_HOME };

  // 1. Local CA: create (no password needed) …
  if (!existsSync(ROOT_CA_PATH)) {
    spawnSync(bin, ['-CAROOT'], { env, stdio: 'ignore' });
  }
  // 2. … and ask the OS to trust it. Idempotent: prints "already installed" when done before.
  let trusted = false;
  if (trust) {
    if (platform() === 'darwin') log('  macOS may ask for your laptop password once, to trust the local certificate.');
    if (platform() === 'win32') log('  Windows will show a security dialog once. Choose Yes.');
    const r = spawnSync(bin, ['-install'], { env, stdio: 'inherit' });
    trusted = r.status === 0;
    if (!trusted) log('  Certificate not trusted on this laptop (skipped or failed). Phones can still trust it via /setup.');
  }

  // 3. Leaf certificate for localhost + LAN IPs; regenerate when the IPs changed.
  const hosts = ['localhost', '127.0.0.1', '::1', ...lanIPv4s()];
  mkdirSync(PROJECT_CERT_DIR, { recursive: true });
  const stamp = join(PROJECT_CERT_DIR, 'hosts.json');
  const prev = existsSync(stamp) ? readFileSync(stamp, 'utf8') : '';
  if (!existsSync(CERT_PATH) || !existsSync(KEY_PATH) || prev !== JSON.stringify(hosts)) {
    try {
      execFileSync(bin, ['-cert-file', CERT_PATH, '-key-file', KEY_PATH, ...hosts], { env, stdio: 'pipe' });
      writeFileSync(stamp, JSON.stringify(hosts));
    } catch (e) {
      log(`  Could not create the dev certificate: ${String(e.stderr || e.message).trim()}`);
      return null;
    }
  }
  return { cert: CERT_PATH, key: KEY_PATH, trusted, hosts };
}
