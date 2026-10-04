// Fake mode: scripted replies with zero network. Keys in the responses map are matched against
// the prompt in this order: exact id, keyword contained in the prompt, /regex/ key, then "*".
export type FakeResponse =
  | string
  | string[]
  | {
      text: string;
      variants?: string[]; // alternative lines; one is picked at random
      thinkingMs?: number; // fixed delay; default random 600–1200 ms
      audio?: string; // clip url to play with the reply
      speak?: boolean; // read it out with the browser voice
    };
export type FakeResponses = Record<string, FakeResponse>;

export interface ResolvedResponse {
  text: string;
  thinkingMs?: number;
  audio?: string;
  speak?: boolean;
  key: string;
}

export function normalize(r: FakeResponse): Omit<ResolvedResponse, 'key'> {
  if (typeof r === 'string') return { text: r };
  if (Array.isArray(r)) return { text: pick(r) };
  const text = r.variants?.length ? pick([r.text, ...r.variants]) : r.text;
  return { text, thinkingMs: r.thinkingMs, audio: r.audio, speak: r.speak };
}

/** Find the scripted reply for a prompt, or null when nothing matches and there is no "*". */
export function matchFake(responses: FakeResponses, prompt: string): ResolvedResponse | null {
  const p = prompt.trim();
  const lower = p.toLowerCase();
  if (p in responses) return { ...normalize(responses[p]), key: p };
  for (const key of Object.keys(responses)) {
    if (key === '*' || key.startsWith('/')) continue;
    if (lower.includes(key.toLowerCase())) return { ...normalize(responses[key]), key };
  }
  for (const key of Object.keys(responses)) {
    if (!key.startsWith('/')) continue;
    const m = key.match(/^\/(.*)\/([a-z]*)$/);
    if (!m) continue;
    try {
      if (new RegExp(m[1], m[2] || 'i').test(p)) return { ...normalize(responses[key]), key };
    } catch {
      /* a bad regex key is ignored */
    }
  }
  if ('*' in responses) return { ...normalize(responses['*']), key: '*' };
  return null;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
