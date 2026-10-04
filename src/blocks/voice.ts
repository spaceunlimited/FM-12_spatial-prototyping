/**
 * @block voice
 * Voice in and voice out, with graceful absence. Recognition uses the browser (prefixed on
 * iPhone, server-based on Android); speech uses the browser voice or the proxy's TTS. When
 * recognition is missing, `fallbackPhrases` shows a tap-a-phrase prompt instead, so the demo
 * still works.
 * @option voice.available — { recognition: boolean, synthesis: boolean }
 * @option voice.listen({ onResult(text, final), lang? = 'en-US', continuous? = true, fallbackPhrases?: string[] }) → stop()
 * @option voice.pushToTalk({ onText }) → { start(), stop() } — hold to record, release to transcribe through the proxy (needs a key)
 * @option voice.speak(text, { engine? = 'browser' | 'proxy', voice?, rate?, lang? }) → Promise<void>
 * @option voice.playClip(url, { volume? }) → Promise<void> — a recorded wav/mp3 from public/
 * @option voice.stopAll() — silence speech and clips
 * @option voice.beep(freq? = 660, ms? = 90) — tiny confirmation sound
 */
import { Prompt } from './ui/Prompt';
import { hasRuntime, getRuntime } from '../runtime/state';

let ctx: AudioContext | null = null;
let unlocked = false;
const clipCache = new Map<string, AudioBuffer>();
const playing = new Set<AudioBufferSourceNode>();

const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

export const available = {
  get recognition(): boolean {
    return !!SR;
  },
  get synthesis(): boolean {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
  },
};

/** Must run inside the first user gesture (the start button does this). */
export async function unlock() {
  if (unlocked) return;
  try {
    ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    await ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    unlocked = true;
  } catch (e) {
    console.warn('[voice] unlock failed', e);
  }
  try {
    window.speechSynthesis?.getVoices(); // iOS loads the voice list lazily
  } catch {}
}

/** Play a recorded clip (wav/mp3) from public/, e.g. '/clips/hello.wav'. */
export async function playClip(url: string, opts: { volume?: number } = {}): Promise<void> {
  if (!ctx) await unlock();
  if (!ctx) return;
  let buf = clipCache.get(url);
  if (!buf) {
    const res = await fetch(url);
    buf = await ctx.decodeAudioData(await res.arrayBuffer());
    clipCache.set(url, buf);
  }
  return new Promise((resolve) => {
    const src = ctx!.createBufferSource();
    src.buffer = buf!;
    const gain = ctx!.createGain();
    gain.gain.value = opts.volume ?? 1;
    src.connect(gain).connect(ctx!.destination);
    playing.add(src);
    src.onended = () => {
      playing.delete(src);
      resolve();
    };
    src.start();
  });
}

export interface SpeakOptions {
  /** 'browser' (default, instant, robotic) or 'proxy' (Gemini TTS, needs a key; falls back to browser). */
  engine?: 'browser' | 'proxy';
  rate?: number;
  pitch?: number;
  lang?: string;
  /** Browser: a voice name or lang; proxy: a Gemini voice name such as 'Kore'. */
  voice?: string;
}

/** Say something. One voice at a time: this cuts off whatever was speaking. */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  stopAll();
  if (opts.engine === 'proxy') {
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, voice: opts.voice }) });
      if (r.ok && r.headers.get('content-type')?.includes('audio')) {
        const url = URL.createObjectURL(await r.blob());
        await playClip(url);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      /* fall through to the browser voice */
    }
  }
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.lang = opts.lang ?? 'en-US';
    if (opts.voice && opts.engine !== 'proxy') {
      const v = synth.getVoices().find((v) => v.name === opts.voice || v.lang === opts.voice);
      if (v) u.voice = v;
    }
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.cancel();
    synth.speak(u);
  });
}

/** Tiny confirmation sound. */
export function beep(freq = 660, ms = 90, volume = 0.15) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.value = volume;
  o.connect(g).connect(ctx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
  o.stop(ctx.currentTime + ms / 1000);
}

/** Silence everything the experience started: browser speech and every playing clip. */
export function stopAll() {
  window.speechSynthesis?.cancel();
  for (const src of playing) {
    try {
      src.stop();
    } catch {}
  }
  playing.clear();
}

export interface ListenOptions {
  onResult: (text: string, final: boolean) => void;
  lang?: string;
  /** Keep listening after each phrase (default true). iPhone stops after one; we restart it. */
  continuous?: boolean;
  /** Show these as tappable choices when the device has no speech recognition. */
  fallbackPhrases?: string[];
  /** Report partial results too (default false). */
  interim?: boolean;
}

/**
 * Listen for speech. Returns a function that stops. Where recognition is unavailable and
 * `fallbackPhrases` are given, a Prompt with those phrases appears and a tap calls onResult.
 */
export function listen(opts: ListenOptions): () => void {
  if (!SR) {
    if (opts.fallbackPhrases?.length && hasRuntime()) {
      const prompt = new Prompt({
        text: 'Say…',
        options: opts.fallbackPhrases,
        keep: true,
        onChoose: (_i, label) => opts.onResult(label, true),
      });
      getRuntime().ctx.scene.add(prompt);
      return () => prompt.dispose();
    }
    console.warn('[voice] speech recognition is not available on this device');
    return () => {};
  }
  const rec = new SR();
  rec.lang = opts.lang ?? 'en-US';
  rec.continuous = false; // iPhone ignores true; we restart on end instead
  rec.interimResults = !!opts.interim;
  let active = true;
  rec.onresult = (e: any) => {
    const res = e.results[e.results.length - 1];
    const text = String(res[0]?.transcript || '').trim();
    if (text) opts.onResult(text, !!res.isFinal);
  };
  rec.onend = () => {
    if (active && opts.continuous !== false) setTimeout(() => active && safeStart(rec), 250);
  };
  rec.onerror = (e: any) => {
    if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') active = false;
  };
  safeStart(rec);
  return () => {
    active = false;
    try {
      rec.stop();
    } catch {}
  };
}

function safeStart(rec: any) {
  try {
    rec.start();
  } catch {}
}

export interface PushToTalkOptions {
  onText: (text: string) => void;
}

/**
 * Hold to record, release to transcribe through the proxy. Wire `start` to a Button's
 * pointerdown and `stop` to its pointerup. Needs an AI key; without one the text stays empty.
 */
export function pushToTalk(opts: PushToTalkOptions) {
  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  return {
    async start() {
      if (rec) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec = new MediaRecorder(stream);
      chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
    },
    async stop() {
      if (!rec) return;
      const r = rec;
      rec = null;
      await new Promise<void>((res) => {
        r.onstop = () => res();
        r.stop();
      });
      r.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audioBase64: await blobToBase64(blob), mimeType: blob.type }),
      }).then((x) => x.json()).catch(() => ({ text: '' }));
      if (res?.text && !res.fallback) opts.onText(res.text);
    },
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.readAsDataURL(blob);
  });
}

export const voice = { available, unlock, playClip, speak, beep, stopAll, listen, pushToTalk };
