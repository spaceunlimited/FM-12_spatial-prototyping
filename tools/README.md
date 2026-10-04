# Tools

Build-time scripts for making assets. You run and edit these; they are not part of the engine and
nothing in the browser depends on them. They read keys from `.env` and never print them. Output
goes to `public/`, where the scene loads it (see the assets and voice sections of `CAPABILITIES.md`).

| Script | Does |
|---|---|
| `node tools/voice.mjs` | Spoken lines → `public/voice/*.mp3` with ElevenLabs. Play with `voice.playClip('/voice/<id>.mp3')`. |

## voice.mjs

```
node tools/voice.mjs "Hello there." hello       one line → public/voice/hello.mp3
node tools/voice.mjs                            every line in src/experience/content/voice.json without a clip yet
  --quality low | standard | high               low = 22 kHz mp3 for a rough cut; standard (default) is fine on every device; high needs a paid tier
  --voice sarah | george | jessica | daniel | <id>   --model <id>   --force
```

`voice.json` is a flat object, id → spoken line. Ids become file names.

```json
{ "hello": "Hello there. Select the cube to begin.", "bye": "See you soon." }
```

**Key, once:** paste it after `ELEVENLABS_API_KEY=` in `.env` yourself. Nobody else needs to see or
handle the key; the pre-commit guard refuses to commit it. A voice is optional: without one the
script uses the premade voice "sarah"; the other names above work on every plan. Voices from the
ElevenLabs library need a paid plan; paste such an id after `ELEVENLABS_VOICE_ID=` if you have one.

**Fidelity before quantity:** decide the quality level before rendering a batch. Re-rendering costs
characters again. `standard` is right for a demo in a room; `high` only matters on good headphones.

Note, 2026-10-04: ElevenLabs offers a free tier with a monthly character allowance and paid tiers
with more characters and the 192 kbps output. Limits change; the response the script prints when a
quota is hit is the current truth.
