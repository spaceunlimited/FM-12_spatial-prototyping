// Mounts the key-hiding proxy (server/app.ts) inside Vite's own dev server, so there is one
// process, one port and one certificate. Also starts a tiny plain-HTTP server that only serves
// the root certificate, because a phone cannot download the CA over an HTTPS origin it does not
// trust yet.
import type { Plugin } from 'vite';
import http from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createApp } from '../../../server/app.ts';
import { readRootCA } from '../../../server/cert.ts';

const API_PREFIXES = ['/api/', '/setup', '/cert/', '/check'];

export function apiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'xr-sandbox-api',
    apply: 'serve',
    configureServer(server) {
      const app = createApp(env);
      const listener = getRequestListener(app.fetch);
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (API_PREFIXES.some((p) => url.startsWith(p))) return listener(req, res);
        next();
      });
      if (server.httpServer && process.env.XR_NO_CERT_HTTP !== '1') startCertHttpServer(Number(env.CERT_HTTP_PORT || 5174));
    },
  };
}

let certServerStarted = false;
function startCertHttpServer(port: number) {
  if (certServerStarted) return;
  certServerStarted = true;
  const srv = http.createServer((req, res) => {
    const ca = readRootCA();
    if (!ca) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('No local certificate authority found yet. Start `npm run dev` once and try again.');
    }
    if ((req.url || '').startsWith('/cert/rootCA.pem') || (req.url || '').startsWith('/cert/rootCA.crt')) {
      res.writeHead(200, {
        'content-type': 'application/x-x509-ca-cert',
        'content-disposition': 'attachment; filename="xr-sandbox-rootCA.crt"',
      });
      return res.end(ca);
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font:17px -apple-system,system-ui,sans-serif;padding:24px;max-width:520px;margin:auto;line-height:1.5">
<h2>Trust this laptop's certificate</h2>
<p>Step 1 of the device setup. Download the certificate, then follow the steps for your device.</p>
<p><a href="/cert/rootCA.crt" style="display:inline-block;padding:14px 20px;background:#111;color:#fff;border-radius:10px;text-decoration:none">Download certificate</a></p>
<p><b>iPhone:</b> Allow the download → Settings → Profile Downloaded → Install. Then Settings → General → About → Certificate Trust Settings → switch on “mkcert …”.</p>
<p><b>Android:</b> Settings → Security → Encryption &amp; credentials → Install a certificate → CA certificate → pick the downloaded file.</p>
<p>Then scan the QR code again.</p></body>`);
  });
  srv.on('error', () => {
    /* port busy: another dev server is already serving the CA */
  });
  srv.listen(port, '0.0.0.0');
}
