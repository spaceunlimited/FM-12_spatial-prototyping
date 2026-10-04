# Proxy API

The dev server hosts a small proxy so the browser never sees an API key. `src/blocks/ai` and
`voice.speak({ engine: 'proxy' })` call it; you only need this page when you want to call it directly.

Provider: `AI_PROVIDER=gemini` (default) or `openai` (anything OpenAI-compatible: OpenAI, Mistral,
a local Ollama via `OPENAI_BASE_URL`). Keys and model names live in `.env`; see `.env.example`.

| Route | Body | Answer |
|---|---|---|
| `GET /api/health` | – | `{ ok, provider, keyPresent, models }` |
| `POST /api/text` | `{ system?, messages: [{ role: 'user' \| 'model', text }], json? }` | `{ text, model }` |
| `POST /api/vision` | `{ imageBase64, mimeType, prompt, json? }` | `{ text, model }` |
| `POST /api/transcribe` | `{ audioBase64, mimeType }` | `{ text }` (Gemini only) |
| `POST /api/tts?save=name` | `{ text, voice? }` | `audio/wav`; with `save`, writes `public/clips/<name>.wav` and returns `{ saved }` (Gemini only) |
| `GET /setup` · `GET /check` | – | device setup page · device capability page |
| `GET /cert/rootCA.crt` | – | the local CA (also on plain HTTP, port `CERT_HTTP_PORT`) |

Every AI route answers `{ fallback: true, reason, text }` instead of failing when there is no key
(`no-key`), the limit is hit (`rate-limited`, HTTP 429), the provider errors (`api-error`) or the
network is down (`network`). The `ai` block turns a fallback into a scripted reply, so a demo keeps
running.

Limits worth knowing
- `RATE_LIMIT_RPM` in `.env` caps requests per minute per device (0 = off). Set it when a room full
  of phones shares one key.
- Gemini's free tier allows about three TTS generations per minute. Generate clips a few at a time
  with `?save=`, and play the saved files with `voice.playClip('/clips/<name>.wav')`.
- The proxy exists only under `npm run dev`. A static `npm run build` has no `/api`.
