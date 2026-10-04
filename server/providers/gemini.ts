// Gemini routes. All calls go to Google from the laptop; the browser never sees the key.
// Without a key every route answers { fallback: true, text } so fake-mode demos keep working.
import { Hono } from 'hono';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODELS, GEMINI_BASE } from '../models.ts';
import { FALLBACK_LINES, pick, type Guard } from './index.ts';

export function geminiRoutes(key: string, env: Record<string, string>, guard: Guard) {
  const r = new Hono();

  // POST /api/text  { system?, messages: [{role:'user'|'model', text}], json?: boolean }
  r.post('/text', async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const body = await c.req.json();
    const out = await generate(key, MODELS.text, {
      systemInstruction: body.system ? { parts: [{ text: body.system }] } : undefined,
      contents: (body.messages || []).map((m: any) => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] })),
      generationConfig: body.json ? { responseMimeType: 'application/json' } : undefined,
    });
    return c.json(out);
  });

  // POST /api/vision { imageBase64, mimeType?, prompt, json?: boolean }
  r.post('/vision', async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const body = await c.req.json();
    const out = await generate(key, MODELS.vision, {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: body.mimeType || 'image/jpeg', data: body.imageBase64 } },
            { text: body.prompt || 'What is in this image? Answer in one short sentence.' },
          ],
        },
      ],
      generationConfig: body.json ? { responseMimeType: 'application/json' } : undefined,
    });
    return c.json(out);
  });

  // POST /api/transcribe { audioBase64, mimeType }
  r.post('/transcribe', async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const body = await c.req.json();
    const out = await generate(key, MODELS.transcribe, {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: body.mimeType || 'audio/webm', data: body.audioBase64 } },
            { text: 'Transcribe this audio exactly. Output only the words spoken.' },
          ],
        },
      ],
    });
    return c.json(out);
  });

  // POST /api/tts { text, voice? }  → audio/wav.  ?save=name stores it in public/clips/
  r.post('/tts', async (c) => {
    const blocked = guard(c);
    if (blocked) return blocked;
    const body = await c.req.json();
    const save = c.req.query('save');
    const res = await fetch(`${GEMINI_BASE}/models/${MODELS.tts}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: body.text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: body.voice || 'Kore' } } },
        },
      }),
    });
    if (!res.ok) return c.json({ fallback: true, reason: 'api-error', status: res.status, text: await res.text() }, 502);
    const data: any = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!part) return c.json({ fallback: true, reason: 'no-audio' }, 502);
    const pcm = Buffer.from(part.inlineData.data, 'base64');
    const wav = pcmToWav(pcm, 24000, 1);
    if (save) {
      const name = save.replace(/[^a-z0-9-_]/gi, '_') + '.wav';
      const dir = join(process.cwd(), 'public/clips');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, name), wav);
      return c.json({ saved: `/public/clips/${name}`, bytes: wav.length });
    }
    return c.body(new Uint8Array(wav), 200, { 'content-type': 'audio/wav' });
  });

  return r;
}

async function generate(key: string, model: string, payload: unknown) {
  try {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { fallback: true, reason: 'api-error', status: res.status, text: pick(FALLBACK_LINES), detail: (await res.text()).slice(0, 500) };
    }
    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') ?? '';
    return { text, model, raw: undefined };
  } catch (e: any) {
    return { fallback: true, reason: 'network', text: pick(FALLBACK_LINES), detail: String(e?.message || e) };
  }
}

function pcmToWav(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
