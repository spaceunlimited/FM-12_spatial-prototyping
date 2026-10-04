// Dev server configuration. Nobody needs to edit this file for an experience-level change.
// HTTPS with a locally trusted certificate, LAN access, the AI proxy mounted inside the dev
// server, a QR code + URL printout, and the `@blocks` alias.
import { defineConfig, loadEnv } from 'vite';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { apiPlugin } from './src/runtime/vite/api-plugin.ts';
import { devInfoPlugin } from './src/runtime/vite/dev-info-plugin.ts';

const PROFILES = ['auto', 'phone-camera', 'phone-webxr', 'headset-webxr'];

export default defineConfig(({ mode }) => {
  // .env is loaded for the server side only. Only VITE_* keys ever reach the browser.
  const env = loadEnv(mode, process.cwd(), '');
  const root = process.cwd();
  const noHttps = process.env.XR_NO_HTTPS === '1';
  const certFile = process.env.XR_CERT || '.cert/dev-cert.pem';
  const keyFile = process.env.XR_KEY || '.cert/dev-key.pem';
  const https =
    !noHttps && existsSync(certFile) && existsSync(keyFile)
      ? { cert: readFileSync(certFile), key: readFileSync(keyFile) }
      : undefined;

  // `npm run dev -- --profile <id>` pins a device profile for one run. Default: detect.
  const requested = process.env.VITE_DEVICE_PROFILE || 'auto';
  const profile = PROFILES.includes(requested) ? requested : 'auto';

  // check-standalone runs Vite from a temp copy with a symlinked node_modules; Vite resolves
  // real paths, so the real node_modules must be allowed too.
  const nodeModules = resolve(root, 'node_modules');
  const realNodeModules = existsSync(nodeModules) ? realpathSync(nodeModules) : nodeModules;

  return {
    define: { 'import.meta.env.VITE_DEVICE_PROFILE': JSON.stringify(profile) },
    plugins: [apiPlugin({ ...env, VITE_DEVICE_PROFILE: profile }), devInfoPlugin()],
    cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
    server: {
      host: true,
      port: Number(env.DEV_PORT || 5173),
      strictPort: false,
      https,
      fs: { allow: [root, realNodeModules] },
    },
    resolve: {
      // The emulator packages bring their own three; one copy only.
      dedupe: ['three'],
      alias: [
        { find: /^@blocks$/, replacement: resolve(root, 'src/blocks/index.ts') },
        { find: /^@blocks\//, replacement: resolve(root, 'src/blocks') + '/' },
      ],
    },
    build: { target: 'es2022' },
  };
});
