// Prints the LAN URL + QR code once the dev server listens, and writes `.dev-url` so
// `npm run show-url` can print them again later.
import type { Plugin } from 'vite';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface DevInfo {
  url: string;
  local?: string;
  network?: string;
  tunnel: string | null;
  setup: string;
  check: string;
  certHttp: string | null;
  startedAt: string;
}

export function devInfoPlugin(): Plugin {
  return {
    name: 'xr-sandbox-dev-info',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        // Give Vite a tick to resolve URLs.
        setTimeout(() => {
          const urls = server.resolvedUrls;
          const network = pickLanUrl(urls?.network || []);
          const local = urls?.local?.[0];
          const tunnel = process.env.XR_TUNNEL_URL;
          const base = tunnel || network || local;
          if (!base) return;
          const info: DevInfo = {
            url: base,
            local,
            network,
            tunnel: tunnel || null,
            setup: base + 'setup',
            check: base + 'check',
            certHttp:
              network && network.startsWith('https://')
                ? network.replace('https://', 'http://').replace(/:\d+\/$/, ':' + (process.env.CERT_HTTP_PORT || 5174) + '/cert/')
                : null,
            startedAt: new Date().toISOString(),
          };
          try {
            writeFileSync('.dev-url', JSON.stringify(info, null, 2));
          } catch {}
          if (process.env.XR_QUIET !== '1') printDevInfo(info);
        }, 50);
      });
    },
  };
}

function pickLanUrl(list: string[]): string | undefined {
  const score = (u: string) => (/\/\/192\.168\./.test(u) ? 0 : /\/\/10\./.test(u) ? 1 : /\/\/172\.(1[6-9]|2\d|3[01])\./.test(u) ? 2 : 3);
  return [...list].sort((a, b) => score(a) - score(b))[0];
}

export function printDevInfo(info: DevInfo) {
  const qr = require('qrcode-terminal');
  console.log('');
  console.log('  ┌─────────────────────────────────────────────────────┐');
  console.log('  │  Scan with your phone (same Wi-Fi as this laptop)   │');
  console.log('  └─────────────────────────────────────────────────────┘');
  qr.generate(info.url, { small: true }, (code: string) => {
    console.log(code.split('\n').map((l) => '  ' + l).join('\n'));
    console.log(`  Experience   ${info.url}`);
    console.log(`  Device setup ${info.setup}   (first time on a new phone)`);
    console.log(`  Device check ${info.check}   (what this device can do)`);
    if (info.certHttp) console.log(`  Certificate  ${info.certHttp}   (plain http, for downloading the CA)`);
    if (info.tunnel) console.log('  Running through a public tunnel. Assets load a bit slower; camera and 3D are local.');
    if (!info.url.startsWith('https://') && !info.tunnel) console.log('  Plain HTTP: phones need HTTPS for the camera. Only the laptop and a cabled Quest can use this URL.');
    console.log('');
  });
}
