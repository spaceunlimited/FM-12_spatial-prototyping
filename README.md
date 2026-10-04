# XR sandbox

A ready-to-build sandbox for mixed-reality demos with AI components. Clone it, run one command,
see a scene on your phone or headset, and start plugging blocks together. Plain three.js and WebXR;
spatial UI that reads over a camera feed or passthrough; a fake AI that answers from a script until
you decide to make it real; a local proxy that keeps your key on the laptop.

It is a toolbox, not a framework: use the blocks where they help, write your own three.js where
they do not. Working with Claude Code? It reads `CLAUDE.md` and `CAPABILITIES.md` and knows the
rest.

## What you need

- A laptop (macOS or Windows) with **Node.js 20.19 or newer** and **git**
- A phone (iPhone or Android) or a Meta Quest 3, on the **same Wi-Fi** as the laptop

## Getting started

```
npm install
npm run dev
```

The first run downloads a small certificate tool and asks for your laptop password once (macOS)
or shows a security dialog (Windows). Say yes. Then the terminal prints a web address and a QR
code, and the laptop preview opens in your browser: an emulated Quest 3 in a synthetic room, with a
panel to move the head and the hands. "Preview as phone" on the start screen shows the phone view.

**On your phone:** scan the QR code. The first page is the device setup page; follow its steps
once to trust the laptop's certificate, then open the experience and allow camera and motion
access. Details and the Quest route: [docs/DEVICE-SETUP.md](docs/DEVICE-SETUP.md).

**Real AI, optional:** the first `npm run dev` creates `.env`. Paste a Gemini key next to
`GEMINI_API_KEY=` when you want real model calls. Everything works without it in fake mode.

## What runs where

| Device | What you get |
|---|---|
| iPhone, any Android | Camera feed behind the scene, gyroscope look-around, tap and drag. iPhone has no WebXR; this is its path. |
| Android with ARCore | WebXR AR: objects stick to real surfaces. Built; awaiting a hardware test. |
| Quest 3, Android XR | Passthrough, hands and controllers: pinch, point, grab, poke. Built; runs in the emulator, awaiting a hardware test. |
| Laptop | Preview of the phone view (`?sim=phone`); headset or AR-phone preview in an emulator (`?sim=headset`, `?sim=phone-ar`). |

One link opens on all of them. [docs/DEVICE-PROFILES.md](docs/DEVICE-PROFILES.md) explains the
differences; [docs/COMPAT-MATRIX.md](docs/COMPAT-MATRIX.md) lists what each browser supports.

## The building blocks

[CAPABILITIES.md](CAPABILITIES.md): stage and re-centering, select / point / grab on every device,
draggable objects, surface placement, Panel / Label / Button / Prompt, voice in and out, fake-first
AI. Each with a snippet to copy. The starter scene in `src/experience/main.ts` uses one of each.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server over HTTPS on the LAN, QR code, laptop preview (headset emulator) |
| `npm run dev -- --profile phone-camera` | Pin a device profile for this run |
| `npm run dev -- --quest` | Quest over USB cable (`adb reverse`); plain HTTP on localhost |
| `npm run dev -- --tunnel` | Public address with a real certificate, for Wi-Fi that isolates devices |
| `npm run dev -- --no-open` / `--no-trust` | Skip the laptop preview / the password prompt |
| `npm run show-url` | Print the address and QR code again |
| `npm run check` | Type-check: the engine strictly, your `src/experience/` with the relaxed root config |
| `npm run screenshot` | Headless pictures of your scene as the laptop preview and the phone view see it, in `test-results/` |
| `npm run test` / `npm run smoke` | Unit tests / headless boot check of your scene (downloads Chromium once, ~150 MB); `npm run smoke -- --all` adds the starter-scene checks |
| `npm run capabilities` | Regenerate `CAPABILITIES.md` from the code |
| `npm run check-standalone` | Build and test a copy of the repo with every non-sandbox file removed |

## Something broke?

1. **Stop and restart the dev server** (`Ctrl+C`, `npm run dev`). This fixes most things, including a
   laptop that changed Wi-Fi (the address and QR code are per session).
2. **Check the device:** open the `/check` page the terminal prints. It lists what the device can do.
3. **Find out what broke:** `npm run check` names the file.
4. **Recover the engine:** `git checkout -- src/blocks src/runtime server scripts` puts the toolbox
   back without touching `src/experience/`.

## What is in the folder

| Yours | |
|---|---|
| `src/experience/` | Your demo: `main.ts` and `content/responses.json`. |
| `public/` | Your asset files: models, images, video, voice clips. `public/x.glb` is `/x.glb` in the scene. |
| `tools/` | Build-time scripts you run and edit, e.g. voice clips with ElevenLabs. See `tools/README.md`. |
| `.env` | Your local settings and key. Never committed. |

| The engine | |
|---|---|
| `src/blocks/` | The building blocks. `CAPABILITIES.md` is generated from them. |
| `src/runtime/` | Device profiles, the pointer layer, the frame loop, copied third-party helpers (`vendor/`). |
| `server/` | The proxy that hides your key, plus the device setup and check pages. |
| `scripts/` | What `npm run dev` runs; the capabilities generator; the checks. |
| `docs/` | Visual guidelines, device setup and profiles, compatibility, proxy API, benchmark. |
| `THIRD_PARTY_LICENSES/` | Licenses of the copied code (XR Blocks, IWSDK, pmndrs). |

Footprint: `node_modules` is about 250 MB; the Playwright browser for `npm run smoke` adds about
150 MB on first use. The built site is about 1.3 MB, of which 0.4 MB is the embedded font, so the
whole thing also works on a hotspot without internet.
