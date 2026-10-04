// Thin client for the proxy routes in server/. Plain fetch; no SDK in the browser; no key here.
export interface ProxyReply {
  text: string;
  fallback?: boolean;
  reason?: string;
  model?: string;
}

export class ProxyClient {
  async health(): Promise<{ ok: boolean; keyPresent: boolean; provider: string; models: Record<string, string> }> {
    const r = await fetch('/api/health');
    return r.json();
  }
  async text(
    prompt: string,
    opts: { system?: string; history?: { role: 'user' | 'model'; text: string }[]; json?: boolean } = {},
  ): Promise<ProxyReply> {
    const r = await fetch('/api/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system: opts.system, messages: [...(opts.history || []), { role: 'user', text: prompt }], json: opts.json }),
    });
    return r.json();
  }
  /** Describe what the camera sees. Pass a <video> or <canvas>; a JPEG snapshot is taken. */
  async vision(source: HTMLVideoElement | HTMLCanvasElement, prompt: string, opts: { json?: boolean; maxSize?: number } = {}): Promise<ProxyReply> {
    const imageBase64 = snapshotJpeg(source, opts.maxSize ?? 768);
    const r = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', prompt, json: opts.json }),
    });
    return r.json();
  }
  /** Text-to-speech through the proxy; returns a playable object URL (audio/wav) or null. */
  async tts(text: string, voice?: string): Promise<string | null> {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, voice }) });
    if (!r.ok || !r.headers.get('content-type')?.includes('audio')) return null;
    return URL.createObjectURL(await r.blob());
  }
  async transcribe(blob: Blob): Promise<ProxyReply> {
    const audioBase64 = await blobToBase64(blob);
    const r = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType: blob.type || 'audio/webm' }),
    });
    return r.json();
  }
}

function snapshotJpeg(source: HTMLVideoElement | HTMLCanvasElement, maxSize: number): string {
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.readAsDataURL(blob);
  });
}
