import { describe, expect, it } from 'vitest';
import { matchFake } from '../../src/blocks/ai/fake';

const responses = {
  hello: 'Hi!',
  planet: ['Earth.', 'Mars.'],
  '/what (is|are)/': { text: 'A thing.', thinkingMs: 100 },
  '*': 'Default.',
};

describe('fake AI matching', () => {
  it('exact id wins', () => expect(matchFake(responses, 'hello')?.text).toBe('Hi!'));
  it('keyword inside the prompt, case-insensitive', () => {
    expect(['Earth.', 'Mars.']).toContain(matchFake(responses, 'Tell me about a PLANET please')?.text);
  });
  it('regex keys', () => {
    const r = matchFake(responses, 'What is this?');
    expect(r?.text).toBe('A thing.');
    expect(r?.thinkingMs).toBe(100);
    expect(r?.key).toBe('/what (is|are)/');
  });
  it('falls back to *', () => expect(matchFake(responses, 'zzz')?.key).toBe('*'));
  it('null without *', () => expect(matchFake({ a: 'b' }, 'zzz')).toBeNull());
});
