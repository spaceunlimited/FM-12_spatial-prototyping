/**
 * @block ai
 * The "AI" of the experience. Fake by default: `ai.fake(responses)` loads scripted replies that
 * match keywords in the prompt, and `ai.ask()` waits a believable moment and answers. Switch
 * `ai.mode = 'live'` to call a real model through the proxy; the same events fire, so experience
 * code never changes when a behaviour goes from fake to real. Without a key, live falls back to fake.
 * @option ai.fake(responses) — { "hello": "Hi!", "/planet|sun/": ["a", "b"], "*": "Say that again?" }
 * @option ai.ask(prompt, { system? }) → Promise<string> — a reply, fake or live
 * @option ai.say(idOrText, { speak? }) → Promise<string> — a scripted reply by id or literal line; no matching, no model
 * @option ai.see(prompt) → Promise<string> — what the camera sees (live) · a fake match on headsets and in fake mode
 * @option ai.hear(blob) → Promise<string> — transcribe recorded audio (live only; '' in fake mode)
 * @option ai.on('thinking' | 'reply' | 'error', cb) — reply: { text, source: 'fake' | 'live' }
 * @option ai.mode 'fake' | 'live' = 'fake'
 */
import { theme } from '../ui/theme';
import { toast } from '../ui/toast';
import { voice } from '../voice';
import { hasRuntime, getRuntime } from '../../runtime/state';
import { matchFake, normalize, type FakeResponses, type ResolvedResponse } from './fake';
import { ProxyClient } from './client';

export type AIMode = 'fake' | 'live';
export type ReplySource = 'fake' | 'live';

type Events = {
  thinking: { prompt?: string };
  reply: { text: string; source: ReplySource; key?: string };
  error: { message: string };
};
type Handler<K extends keyof Events> = (e: Events[K]) => void;

class AI {
  mode: AIMode = 'fake';
  readonly proxy = new ProxyClient();
  private responses: FakeResponses = { '*': 'I am not sure what to say to that.' };
  private handlers: { [K in keyof Events]?: Handler<K>[] } = {};
  private busy = false;
  private warnedNoKey = false;

  /** Load scripted replies (usually from src/experience/content/responses.json). */
  fake(responses: FakeResponses) {
    this.responses = { ...this.responses, ...responses };
    return this;
  }

  on<K extends keyof Events>(event: K, cb: Handler<K>) {
    const list = (this.handlers[event] ||= []) as Handler<K>[];
    list.push(cb);
    return () => this.off(event, cb);
  }
  off<K extends keyof Events>(event: K, cb: Handler<K>) {
    this.handlers[event] = (this.handlers[event] || []).filter((h) => h !== cb) as any;
  }
  private emit<K extends keyof Events>(event: K, payload: Events[K]) {
    for (const h of this.handlers[event] || []) (h as Handler<K>)(payload);
  }

  get isThinking() {
    return this.busy;
  }

  /** Ask the AI. Fake mode matches the prompt against the scripted replies; live mode calls the proxy. */
  async ask(prompt: string, opts: { system?: string } = {}): Promise<string> {
    if (this.mode === 'live') {
      this.busy = true;
      this.emit('thinking', { prompt });
      try {
        const res = await this.proxy.text(prompt, { system: opts.system });
        if (!res.fallback) {
          this.busy = false;
          this.emit('reply', { text: res.text, source: 'live' });
          return res.text;
        }
        this.noteFallback(res.reason);
      } catch (e: any) {
        this.emit('error', { message: String(e?.message || e) });
        this.noteFallback('network');
      }
      this.busy = false;
      return this.replyFake(prompt, true);
    }
    return this.replyFake(prompt);
  }

  /** A scripted line right now: `idOrText` is a key in the responses or a literal sentence. */
  async say(idOrText: string, opts: { speak?: boolean; thinkingMs?: number } = {}): Promise<string> {
    const base = idOrText in this.responses ? normalize(this.responses[idOrText]) : { text: idOrText };
    const r: ResolvedResponse = { ...base, key: idOrText, speak: opts.speak ?? base.speak, thinkingMs: opts.thinkingMs ?? base.thinkingMs };
    return this.deliver(r, idOrText);
  }

  /** What does the camera see? Live mode sends a snapshot; everything else answers from the script. */
  async see(prompt = 'What do you see?'): Promise<string> {
    if (this.mode === 'live' && hasRuntime()) {
      const { ctx, profile } = getRuntime();
      const video = ctx.video;
      if (!profile.immersive && video.readyState >= 2) {
        this.busy = true;
        this.emit('thinking', { prompt });
        try {
          const res = await this.proxy.vision(video, prompt);
          this.busy = false;
          if (!res.fallback) {
            this.emit('reply', { text: res.text, source: 'live' });
            return res.text;
          }
          this.noteFallback(res.reason);
        } catch (e: any) {
          this.busy = false;
          this.emit('error', { message: String(e?.message || e) });
        }
      }
    }
    return this.replyFake(prompt);
  }

  /** Transcribe recorded audio through the proxy. Fake mode has no ears and returns ''. */
  async hear(blob: Blob): Promise<string> {
    if (this.mode !== 'live') return '';
    try {
      const res = await this.proxy.transcribe(blob);
      if (res.fallback) {
        this.noteFallback(res.reason);
        return '';
      }
      return res.text;
    } catch (e: any) {
      this.emit('error', { message: String(e?.message || e) });
      return '';
    }
  }

  private async replyFake(prompt: string, skipThinking = false): Promise<string> {
    const r = matchFake(this.responses, prompt) ?? { text: 'I am not sure what to say to that.', key: '*' };
    return this.deliver(r, prompt, skipThinking);
  }

  private async deliver(r: ResolvedResponse, prompt: string, skipThinking = false): Promise<string> {
    voice.stopAll(); // one voice at a time: a new reply cuts off the previous one
    if (!skipThinking) {
      this.busy = true;
      this.emit('thinking', { prompt });
      await wait(r.thinkingMs ?? rand(theme.thinkingMinMs, theme.thinkingMaxMs));
    }
    this.busy = false;
    this.emit('reply', { text: r.text, source: 'fake', key: r.key });
    if (r.audio) voice.playClip(r.audio).catch(() => {});
    else if (r.speak) voice.speak(r.text);
    return r.text;
  }

  private noteFallback(reason?: string) {
    if (this.warnedNoKey) return;
    this.warnedNoKey = true;
    const why = reason === 'no-key' ? 'No AI key in .env' : reason === 'rate-limited' ? 'The AI is rate-limited' : 'The AI is unreachable';
    toast(`${why}: using the scripted replies instead.`, 4000);
  }
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const ai = new AI();
export type { FakeResponses, FakeResponse } from './fake';
