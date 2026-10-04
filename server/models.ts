// One place for every Gemini model id. Re-check https://ai.google.dev/gemini-api/docs/models
// before each course run; ids change a few times a year. The OpenAI-compatible provider takes
// its model from OPENAI_MODEL in .env instead.
export const MODELS = {
  text: 'gemini-3.8-flash',
  vision: 'gemini-3.8-flash',
  transcribe: 'gemini-3.8-flash',
  tts: 'gemini-3.1-flash-tts-preview',
} as const;

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
