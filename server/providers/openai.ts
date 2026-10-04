// OpenAI-compatible routes: OpenAI itself, Mistral, or a local Ollama (OPENAI_BASE_URL). Text and
// vision only; speech routes answer with a fallback so the blocks degrade to the browser voice.
import { Hono } from 'hono';
import type { Guard } from './index.ts';

export function openaiRoutes(key: string, env: Record<string, string>, guard: Guard) {
  const r = new Hono();
  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = env.OPENAI_MODEL || 'gpt-4.1-mini';

  // POST /api/text  { system?, messages: [{role:'user'|'model', text}], json?: boolean }
  r.post('/text', async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const body = await c.req.json();
    const messages = [
      ...(body.system ? [{ role: 'system', content: body.system }] : []),
      ...(body.messages || []).map((m: any) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
    ];
    return c.json(await chat(base, key, model, messages, body.json));
  });

  // POST /api/vision  { imageBase64, mimeType, prompt, json? }
  r.post('/vision', async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const body = await c.req.json();
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: body.prompt || 'Describe what you see in one sentence.' },
          { type: 'image_url', image_url: { url: `data:${body.mimeType || 'image/jpeg'};base64,${body.imageBase64}` } },
        ],
      },
    ];
    return c.json(await chat(base, key, model, messages, body.json));
  });

  r.post('/transcribe', (c) => c.json({ fallback: true, reason: 'unsupported', text: 'Transcription is only wired for the Gemini provider.' }));
  r.post('/tts', (c) => c.json({ fallback: true, reason: 'unsupported', text: 'Text-to-speech is only wired for the Gemini provider.' }));
  return r;
}

async function chat(base: string, key: string, model: string, messages: unknown[], json?: boolean) {
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    });
    if (!res.ok) return { fallback: true, reason: 'api-error', status: res.status, text: 'The model did not answer.', detail: (await res.text()).slice(0, 500) };
    const data: any = await res.json();
    return { text: data.choices?.[0]?.message?.content ?? '', model };
  } catch (e: any) {
    return { fallback: true, reason: 'network', text: 'The model is unreachable.', detail: String(e?.message || e) };
  }
}
