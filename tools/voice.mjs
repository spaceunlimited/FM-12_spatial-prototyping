#!/usr/bin/env node
// Renders spoken lines to mp3 clips with ElevenLabs, so the demo can speak in fake mode without a
// model call: `voice.playClip('/voice/hello.mp3')` in the scene. No dependencies. The key comes from
// .env and is never printed.
//
//   node tools/voice.mjs                         every line in src/experience/content/voice.json without a clip yet
//   node tools/voice.mjs "Hello there." hello    one line → public/voice/hello.mp3
//   --quality low | standard | high              mp3 22 kHz 32 kbps · 44.1 kHz 128 kbps (default) · 44.1 kHz 192 kbps (paid tiers)
//   --voice sarah | george | jessica | daniel | <id>   a premade voice by name, or any voice id; overrides ELEVENLABS_VOICE_ID
//   --model <id>                                 default eleven_multilingual_v2; eleven_flash_v2_5 is faster and cheaper
//   --force                                      re-render clips that already exist
//
// voice.json is a flat object, id → line:  { "hello": "Hello there.", "bye": "See you soon." }
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const LINES = resolve(ROOT, 'src/experience/content/voice.json');
const OUT = resolve(ROOT, 'public/voice');
// ElevenLabs' premade voices, usable on every plan (checked 2026-10-04). Library voices need a paid plan.
const VOICES = { sarah: 'EXAVITQu4vr4xnSDxMaL', george: 'JBFqnCBsd6RMkjVDRZzb', jessica: 'cgSgspJ2msm6clMCkdW9', daniel: 'onwK4e9ZLuTAKqWW03F9' };
const DEFAULT_VOICE = VOICES.sarah;
const QUALITY = { low: 'mp3_22050_32', standard: 'mp3_44100_128', high: 'mp3_44100_192' };

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(name);
const positional = args.filter((a, i) => !a.startsWith('--') && !['--quality', '--voice', '--model'].includes(args[i - 1]));

const env = readEnv(resolve(ROOT, '.env'));
const key = env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('✗ No ELEVENLABS_API_KEY in .env. Paste your key on that line (the file is yours and never committed), then run this again.');
  process.exit(1);
}
const chosen = opt('--voice') || env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
const voice = VOICES[chosen.toLowerCase()] || chosen;
const model = opt('--model') || 'eleven_multilingual_v2';
const quality = opt('--quality') || 'standard';
if (!QUALITY[quality]) {
  console.error(`✗ --quality must be one of ${Object.keys(QUALITY).join(', ')}`);
  process.exit(1);
}

let lines;
if (positional.length === 2) lines = { [positional[1]]: positional[0] };
else if (positional.length === 0) {
  if (!existsSync(LINES)) {
    console.error(`✗ No lines given and no ${rel(LINES)}. Create it as { "id": "spoken line", … } or pass one line: node tools/voice.mjs "Hello." hello`);
    process.exit(1);
  }
  lines = JSON.parse(readFileSync(LINES, 'utf8'));
} else {
  console.error('✗ Usage: node tools/voice.mjs "Spoken line" clip-id   (or no arguments to render voice.json)');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
let rendered = 0;
for (const [id, text] of Object.entries(lines)) {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
    console.error(`✗ "${id}": clip ids are letters, digits, - and _ (they become file names)`);
    process.exit(1);
  }
  const file = resolve(OUT, `${id}.mp3`);
  if (existsSync(file) && !flag('--force')) {
    console.log(`  ${id}.mp3 exists, kept (use --force to re-render)`);
    continue;
  }
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${QUALITY[quality]}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: model }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    const detail = parseDetail(body);
    if (res.status === 401 && detail.status === 'missing_permissions') console.error(`✗ The key lacks a permission (${detail.message}). In ElevenLabs, create a key with Text to Speech enabled.`);
    else if (res.status === 401) console.error('✗ ElevenLabs rejected the key (401). Check the ELEVENLABS_API_KEY line in .env.');
    else if (res.status === 402 && detail.code === 'paid_plan_required') console.error(`✗ Voice ${voice} needs a paid plan. Use a premade voice: --voice ${Object.keys(VOICES).join(' | ')} (or unset ELEVENLABS_VOICE_ID).`);
    else if (res.status === 402 || res.status === 429) console.error(`✗ ElevenLabs quota or rate limit (${res.status}). ${detail.message || body}`);
    else console.error(`✗ ElevenLabs ${res.status} for "${id}": ${body}`);
    process.exit(1);
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  rendered++;
  console.log(`  ✓ ${id}.mp3  “${text.length > 60 ? text.slice(0, 57) + '…' : text}”`);
}
console.log(`\n  ${rendered} clip${rendered === 1 ? '' : 's'} rendered to public/voice/ (${quality}, voice ${voice}). In the scene: voice.playClip('/voice/<id>.mp3')\n`);

// Minimal .env reader: KEY=value lines, optional quotes, # comments. Nothing is logged.
function readEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    if (v) out[m[1]] = v;
  }
  return out;
}
function parseDetail(body) {
  try {
    const d = JSON.parse(body).detail;
    return typeof d === 'object' && d ? d : { message: String(d ?? '') };
  } catch {
    return {};
  }
}
function rel(p) {
  return p.slice(ROOT.length + 1);
}
