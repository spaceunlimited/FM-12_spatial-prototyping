# XR sandbox

A WebXR sandbox for quick, believable mixed-reality demos with AI components, testable on a real
headset or phone over the local network. Primary target: Meta Quest 3 with hand tracking
(passthrough, pinch, grab, surfaces). iPhone and Android run the same scene as a camera view with
tap and drag. Plain three.js, spatial UI on uikit, fake AI by default, a local proxy for real
model calls.

## Where things are
- `src/experience/` is the only code folder you edit. `main.ts` is the scene; `content/*.json` holds
  scripted AI replies and spoken lines. Keep it to a few files.
- `public/` holds asset files: models, images, video, voice clips. Any file there is served by its
  path, so `public/models/robot.glb` is `/models/robot.glb` in the scene.
- `tools/` holds build-time scripts you may run and edit, such as rendering voice clips. They read
  keys from `.env` and write into `public/`. `tools/README.md` lists them.
- `CAPABILITIES.md` lists every building block with its options and a copyable snippet. It is
  complete: import from `@blocks`, copy the snippet, and do not open `src/blocks/` to learn an API.
- Everything else (`src/blocks/`, `src/runtime/`, `server/`, `scripts/`, config files) is the
  engine. Treat it as a library: an experience-level change never needs it read or changed. If a
  block is missing, write plain three.js inside `src/experience/`.

## Conventions
- Write once against the blocks; the active device profile decides how a select, a point, a grab
  or a placement is realised. Branch on `profile.capabilities`, never on device names.
- Text in the scene uses `Panel`, `Label`, `Button`, `Prompt`. No DOM for content: headsets have
  no overlay. Sizes and distances are already the guideline defaults.
- Files come in through `model`, `image`, `video` and `voice.playClip`, which size and colour them
  correctly. Spoken lines in fake mode are pre-rendered clips (`tools/voice.mjs`), not live TTS.
- The AI starts in fake mode (`ai.fake(responses)`). `ai.mode = 'live'` needs a key in `.env` and
  is a deliberate step. Never read, print or commit `.env`; the person pastes keys there themselves.
- New content goes on `stage` or through `place()`: 1.5 m ahead, slightly below eye height.

## Commands
- `npm run dev` — HTTPS on the LAN, address and QR code in the terminal, laptop preview at
  `?sim=headset` (an emulated Quest 3 in a synthetic room); `?sim=phone` is the phone view.
- `npm run check` — type-check: the engine strictly, then `src/experience/` with the relaxed root
  config. Names the broken file. A pass means the whole repo compiles, nothing more.
- `npm run screenshot` — renders the scene headless as the laptop preview (`?sim=phone`, desktop
  window) and as the phone view into `test-results/scene-desktop.png` and `scene-phone.png`. Look
  at them before a device test; they show layout and reach, not passthrough or feel. A pre-check,
  not a test. The headset emulator is not pictured: its panels and gizmos obscure the scene.
- `npm run smoke` — the scene boots in a headless browser. `test/` belongs to the engine;
  `test/smoke/starter.spec.ts` describes the untouched starter scene and goes stale once the scene
  changes, which is expected. Leave it.

## Do not change without a reason you can state
The dev server and certificate (`scripts/`, `vite.config.ts`), the proxy (`server/`), the device
profiles (`src/runtime/profiles/`) and the dependency list. They are tested on devices; a change
there can break every phone in the room. Device setup steps for people are in `README.md`.
