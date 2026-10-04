// Which model provider the proxy talks to. Gemini by default; anything OpenAI-compatible
// (OpenAI, Mistral, a local Ollama) with AI_PROVIDER=openai. Both answer the same four routes.
import { Hono } from 'hono';
import { geminiRoutes } from './gemini.ts';
import { openaiRoutes } from './openai.ts';

export interface Provider {
  name: 'gemini' | 'openai';
  keyPresent: boolean;
  key: string;
}

export function providerFor(env: Record<string, string>): Provider {
  const name = env.AI_PROVIDER === 'openai' ? 'openai' : 'gemini';
  const key = (name === 'gemini' ? env.GEMINI_API_KEY : env.OPENAI_API_KEY)?.trim() || '';
  return { name, key, keyPresent: key.length > 0 };
}

export const FALLBACK_LINES = [
  'I would answer here, but no AI key is set. This is a scripted stand-in.',
  'Placeholder reply: the real model is switched off in this demo.',
  'Scripted response. Add a key to .env to make this real.',
];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Requests per minute per client; 0 disables. Protects a shared key from a room full of phones. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private rpm: number) {}
  allow(id: string): boolean {
    if (!this.rpm) return true;
    const now = Date.now();
    const list = (this.hits.get(id) || []).filter((t) => now - t < 60_000);
    if (list.length >= this.rpm) return false;
    list.push(now);
    this.hits.set(id, list);
    return true;
  }
}

export function clientId(c: any): string {
  return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || c.req.header('user-agent') || 'anon';
}

/** The guard every route runs first: no key → fallback reply; too many requests → 429. */
export function makeGuard(provider: Provider, env: Record<string, string>) {
  const limiter = new RateLimiter(Number(env.RATE_LIMIT_RPM || 0));
  return (c: any) => {
    if (!provider.keyPresent) return c.json({ fallback: true, reason: 'no-key', text: pick(FALLBACK_LINES) });
    if (!limiter.allow(clientId(c)))
      return c.json({ fallback: true, reason: 'rate-limited', text: 'The AI is busy. Try again in a minute.' }, 429);
    return null;
  };
}

export function aiRoutes(provider: Provider, env: Record<string, string>) {
  const guard = makeGuard(provider, env);
  return provider.name === 'openai' ? openaiRoutes(provider.key, env, guard) : geminiRoutes(provider.key, env, guard);
}

export type Guard = ReturnType<typeof makeGuard>;
