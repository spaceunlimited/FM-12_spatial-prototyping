// The key-hiding proxy. Runs inside the Vite dev server (see src/runtime/vite/api-plugin.ts).
// The browser only ever talks to /api/*; the provider key stays in .env on the laptop.
import { Hono } from 'hono';
import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { MODELS } from './models.ts';
import { readRootCA } from './cert.ts';
import { setupPage } from './setup-page.ts';
import { checkPage } from './check-page.ts';
import { aiRoutes, providerFor } from './providers/index.ts';

export function createApp(env: Record<string, string>) {
  const app = new Hono();
  const provider = providerFor(env);

  app.get('/api/health', (c) =>
    c.json({
      ok: true,
      provider: provider.name,
      keyPresent: provider.keyPresent,
      profile: env.VITE_DEVICE_PROFILE || 'auto',
      models: provider.name === 'gemini' ? MODELS : { text: env.OPENAI_MODEL || 'default' },
      time: new Date().toISOString(),
    }),
  );

  // Devices post diagnostics here from the /check page; `curl -sk https://localhost:5173/api/diag` reads them.
  app.post('/api/diag', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    mkdirSync('.diag', { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), ...body }) + '\n';
    appendFileSync('.diag/devices.jsonl', line);
    return c.json({ ok: true });
  });
  app.get('/api/diag', (c) => {
    if (!existsSync('.diag/devices.jsonl')) return c.json({ entries: [] });
    const entries = readFileSync('.diag/devices.jsonl', 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .slice(-20);
    return c.json({ entries });
  });

  // Root certificate download (also served on the plain-HTTP port).
  app.get('/cert/:file', (c) => {
    const ca = readRootCA();
    if (!ca) return c.text('No local certificate authority found yet.', 404);
    return c.body(new Uint8Array(ca), 200, {
      'content-type': 'application/x-x509-ca-cert',
      'content-disposition': 'attachment; filename="xr-sandbox-rootCA.crt"',
    });
  });

  // Device setup page and device check page.
  app.get('/setup', (c) => c.html(setupPage(c.req.header('user-agent') || '', env)));
  app.get('/check', (c) => c.html(checkPage()));

  // AI routes (text, vision, tts, transcribe). Fallback replies when no key.
  app.route('/api', aiRoutes(provider, env));

  app.notFound((c) => c.json({ error: 'not found', path: c.req.path }, 404));
  return app;
}
