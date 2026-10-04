# Capabilities

Every building block of this sandbox, with its options and one snippet to copy. Generated from the
code by `npm run capabilities`; do not edit by hand. Experience code lives in `src/experience/` and
imports everything from `@blocks`:

```ts
import { startExperience, stage, recenter, onSelect, onPoint, onLongPress, onPoke, draggable, place,
  Panel, Label, Button, Prompt, toast, voice, model, image, video, ai, onFrame, theme, THREE } from '@blocks';
```

Defaults that already apply: content starts 1.5 m ahead and 0.15 m below eye height; panels are
0.42 m wide at 1 m and keep their visual size at any distance; targets are at least 6 cm at 1 m;
the AI is fake until `ai.mode = 'live'`. The device profile (phone camera, phone AR, headset)
decides how a select, a point or a grab is realised; branch on `profile.capabilities`, never on
device names (details: `docs/DEVICE-PROFILES.md`).

## startExperience

Boots everything and runs your setup once the device is ready: renderer, device profile, start screen (the one tap that unlocks camera, motion, audio or the XR session), pointer layer, stage.

| Option | Meaning |
|---|---|
| `setup (ctx) => void` | your scene; ctx has scene, camera, profile.capabilities, onFrame() |
| `title string` | on the start screen |
| `hint string | { 'phone-camera'?, 'phone-webxr'?, 'headset-webxr'? }` | one line under the title |
| `buttonLabel string` | the start button |

```ts
import { startExperience, stage, THREE } from '@blocks';

startExperience(
  ({ profile }) => {
    // Everything you add to `stage` appears 1.5 m in front of the viewer.
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
    stage.add(ball);
    if (profile.capabilities.hands) console.log('hands are tracked on this device');
  },
  { title: 'My demo' },
);
```

## stage

Where content starts. `stage` is a group placed 1.5 m ahead of the viewer, 0.15 m below eye height, facing them, as soon as the device knows where the viewer is. Add things to it and they arrive at a comfortable spot on every device. `recenter()` moves it back in front of wherever the viewer is looking now.

| Option | Meaning |
|---|---|
| `distance number = 1.5` | metres ahead (recenter option) |
| `heightOffset number = -0.15` | metres relative to eye height (recenter option) |

```ts
import { stage, recenter, onLongPress, THREE } from '@blocks';

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
cube.position.set(0.2, 0, 0); // 20 cm to the right of the stage centre
stage.add(cube);

// Hold anywhere for 0.75 s to bring the stage back in front of the viewer.
onLongPress('anywhere', () => recenter());
```

## interact

One vocabulary for every device. A tap on a phone, a pinch or trigger in a headset, a click on the laptop all arrive as `onSelect`. Each function returns a function that removes the handler.

| Option | Meaning |
|---|---|
| `onSelect(object | 'anywhere', cb)` | cb gets { object, point, pointerId, kind } |
| `onPoint(object, { enter, leave, dwellMs?, dwell?, progress? })` | the device (or a hand) is aimed at the object; dwell fires after `dwellMs` (default 1500) of steady aim |
| `onLongPress(object | 'anywhere', cb, { ms? = 750, progress? })` | hold the select; suppresses the plain select |
| `onPoke(object, { touch, release })` | a fingertip touches the object (headset); a select stands in elsewhere |

```ts
import { onSelect, onPoint, onLongPress, onPoke, stage, THREE } from '@blocks';

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
stage.add(cube);

onSelect(cube, (e) => console.log('selected by', e.kind, 'at', e.point));
onPoint(cube, {
  enter: () => cube.scale.setScalar(1.1),
  leave: () => cube.scale.setScalar(1),
  dwellMs: 1500,
  dwell: () => console.log('looked at it for 1.5 s'),
});
onLongPress(cube, () => console.log('held'), { ms: 750 });
onPoke(cube, { release: () => console.log('poked') });
onSelect('anywhere', () => console.log('tapped on nothing'));
```

## draggable

Pick up, move and drop any object: one finger on a phone, pinch-and-move or a trigger in a headset. The object keeps the point where it was grabbed, so it never jumps into the hand. Two tracked pointers on the same object scale it.

| Option | Meaning |
|---|---|
| `scale boolean = true` | two-hand pinch scaling, 0.25–4× of the original size |
| `rotate boolean = false` | two-hand yaw rotation |
| `onMove (object) => void` | every frame while held |
| `onDrop (object) => void` | released |

Returns `() => void — stop being draggable`.

```ts
import { draggable, stage, THREE } from '@blocks';

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
stage.add(cube);

const stop = draggable(cube, { scale: true, onDrop: (o) => console.log('dropped at', o.position) });
// later: stop();
void stop;
```

## place

Put an object into the room. On a surface where the device can find one (hit-test), otherwise floating in front of the viewer. Says what it did in plain words, and makes the object draggable so the viewer can nudge it.

| Option | Meaning |
|---|---|
| `strategy 'auto' | 'surface' | 'front' | 'hand' = 'auto'` | auto = surface if the device can, else front |
| `distance number = 1.5` | metres ahead, for 'front' |
| `heightOffset number = -0.15` | metres relative to eye height, for 'front' |
| `adjustable boolean = true` | viewer can drag it afterwards |
| `onPlaced (result) => void` | called once the object is in place (async on headsets) |

Returns `{ used, fellBack, explanation }`.

```ts
import { place, THREE } from '@blocks';

const plant = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x4caf50 }));
const result = place(plant, {
  strategy: 'auto', // surface where the device finds one, otherwise in front
  onPlaced: (r) => console.log(r.used, '—', r.explanation),
});
void result;
```

## Panel

A floating text panel: optional title, body text, optional row of buttons. Reads over a camera feed or passthrough, faces the viewer, keeps its visual size at any distance.

| Option | Meaning |
|---|---|
| `title string` | bold first line |
| `text string` | body text; word-wrapped |
| `width number = 0.42` | metres at 1 m (max 0.7) |
| `buttons ButtonSpec[]` | { label, onSelect, variant?: 'accent' } rendered in a row below the text |
| `follow 'world' | 'lazy' | 'object' = 'world'` | 'lazy' trails the viewer at `distance` |
| `distance number = 1.5` | metres, for follow: 'lazy' |
| `anchor 'center' | 'bottom' = 'center'` | 'bottom' grows upward from its position |

- `setText(text, { typewriter?, cps? = 40 }) — replace the body; typewriter reveals it like model output`
- `setTitle(title)`
- `attachTo(object, { offset? = [0, 0.2, 0] }) — ride on an object`
- `dispose()`

```ts
import { Panel, stage } from '@blocks';

const panel = new Panel({
  title: 'Welcome',
  text: 'Select the cube to begin.',
  buttons: [{ label: 'Skip', onSelect: () => panel.setText('Skipped.') }],
});
panel.position.set(0, 0.4, 0); // 40 cm above the stage centre
stage.add(panel);

panel.setText('Thinking…');
panel.setText('Here is a longer reply, typed out like a model would.', { typewriter: true });
```

## Label

A short caption that rides on an object: a pill of text that faces the viewer and grows upward from its anchor, so it never sinks into what it names.

| Option | Meaning |
|---|---|
| `text string` | the caption (first constructor argument) |

- `attachTo(object, { offset? = [0, 0.16, 0] }) — ride on an object`
- `setText(text)`
- `dispose()`

```ts
import { Label, stage, THREE } from '@blocks';

const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
stage.add(cube);

const label = new Label('Cube').attachTo(cube, { offset: [0, 0.1, 0] });
label.setText('Still a cube');
```

## Button

A single tappable / pinchable button in the room, at least 6 cm wide at 1 m, with hover, pressed, selected and disabled states.

| Option | Meaning |
|---|---|
| `label string` |   |
| `onSelect () => void` |   |
| `variant 'default' | 'accent' = 'default'` | accent for the one primary action |
| `disabled boolean = false` |   |
| `selected boolean = false` |   |

- `setLabel(label) · setDisabled(bool) · setSelected(bool) · attachTo(object, { offset }) · dispose()`

```ts
import { Button, stage } from '@blocks';

const again = new Button({ label: 'Again', variant: 'accent', onSelect: () => console.log('again!') });
again.position.set(0, -0.2, 0);
stage.add(again);
again.setDisabled(false);
```

## Prompt

A question with a row of choices. The viewer taps or pinches one; the chosen button stays highlighted. Use it wherever a demo needs an answer and voice is not available.

| Option | Meaning |
|---|---|
| `text string` | the question |
| `options string[]` | the choices, one button each |
| `onChoose (index, label) => void` |   |
| `follow 'world' | 'lazy' | 'object' = 'lazy'` | a prompt trails the viewer by default |

- `choose(index) — select programmatically · setDisabled(bool) · dispose()`

```ts
import { Prompt, stage } from '@blocks';

// Trails the viewer by default and disappears after a choice.
const prompt = new Prompt({
  text: 'Which planet?',
  options: ['Earth', 'Mars'],
  onChoose: (i, label) => console.log('chose', i, label),
});
stage.add(prompt);
```

## toast

A short notice that fades after a moment: an HTML strip at the bottom on phones and the laptop, a lazy-following panel inside a headset session (no HTML there).

| Option | Meaning |
|---|---|
| `text string` |   |
| `ms number = 3500` | how long it stays |

```ts
import { toast } from '@blocks';

toast('Saved', 2000);
```

## voice

Voice in and voice out, with graceful absence. Recognition uses the browser (prefixed on iPhone, server-based on Android); speech uses the browser voice or the proxy's TTS. When recognition is missing, `fallbackPhrases` shows a tap-a-phrase prompt instead, so the demo still works.

| Option | Meaning |
|---|---|
| `voice.available` | { recognition: boolean, synthesis: boolean } |
| `voice.listen({ onResult(text, final), lang? = 'en-US', continuous? = true, fallbackPhrases?: string[] }) → stop()` |   |
| `voice.pushToTalk({ onText }) → { start(), stop() }` | hold to record, release to transcribe through the proxy (needs a key) |
| `voice.speak(text, { engine? = 'browser' | 'proxy', voice?, rate?, lang? }) → Promise<void>` |   |
| `voice.playClip(url, { volume? }) → Promise<void>` | a recorded wav/mp3 from public/ |
| `voice.stopAll()` | silence speech and clips |
| `voice.beep(freq? = 660, ms? = 90)` | tiny confirmation sound |

```ts
import { voice, Panel, stage } from '@blocks';

const panel = new Panel({ text: 'Say hello' });
stage.add(panel);

// Listens where the browser can; shows tappable phrases where it cannot (headsets, some phones).
voice.listen({
  fallbackPhrases: ['hello', 'next'],
  onResult: (text, final) => {
    if (final && /hello/i.test(text)) {
      panel.setText('Hello back!');
      voice.speak('Hello back!');
    }
  },
});
```

## assets

Files from `public/` into the room, at a size that makes sense. Put the file anywhere under `public/` and refer to it by its path from there: `public/models/robot.glb` is `/models/robot.glb`. Every loader returns a plain three.js object that works with `stage`, `place`, `draggable` and `onSelect`. Sound is `voice.playClip`. Formats: glb (uncompressed), png/jpg/webp, mp4 (H.264)/webm. A file that fails to load says so in a toast and the promise rejects.

| Option | Meaning |
|---|---|
| `model(url, { size? = 0.3, anchor? = 'center' | 'bottom', animate? = true }) → Promise<Group>` | a glb scaled so its largest side is `size` m, centred (or standing on) its origin; plays its first animation clip when it has one |
| `image(url, { width? = 0.3 }) → Promise<Mesh>` | a picture on a plane; height follows the image's aspect ratio |
| `video(url, { width? = 0.4, loop? = true, muted? = false, autoplay? = true }) → Promise<VideoMesh>` | a video on a plane with `play()`, `pause()` and the `video` element; sound needs the viewer's first tap, which the start screen gives |

```ts
import { model, image, video, place, stage, onSelect, voice } from '@blocks';

// Files live in public/: public/models/robot.glb is '/models/robot.glb'.
const robot = await model('/models/robot.glb', { size: 0.3, anchor: 'bottom' });
place(robot); // on a real surface where the device finds one, else floating in front

const poster = await image('/images/poster.jpg', { width: 0.3 });
poster.position.set(-0.35, 0.2, 0);
stage.add(poster);

const clip = await video('/video/intro.mp4', { width: 0.4 });
clip.position.set(0.35, 0.2, 0);
stage.add(clip);
onSelect(clip, () => (clip.video.paused ? clip.play() : clip.pause()));

void voice.playClip('/voice/hello.mp3'); // sound: a clip from public/, see voice
```

## ai

The "AI" of the experience. Fake by default: `ai.fake(responses)` loads scripted replies that match keywords in the prompt, and `ai.ask()` waits a believable moment and answers. Switch `ai.mode = 'live'` to call a real model through the proxy; the same events fire, so experience code never changes when a behaviour goes from fake to real. Without a key, live falls back to fake.

| Option | Meaning |
|---|---|
| `ai.fake(responses)` | { "hello": "Hi!", "/planet|sun/": ["a", "b"], "*": "Say that again?" } |
| `ai.ask(prompt, { system? }) → Promise<string>` | a reply, fake or live |
| `ai.say(idOrText, { speak? }) → Promise<string>` | a scripted reply by id or literal line; no matching, no model |
| `ai.see(prompt) → Promise<string>` | what the camera sees (live) · a fake match on headsets and in fake mode |
| `ai.hear(blob) → Promise<string>` | transcribe recorded audio (live only; '' in fake mode) |
| `ai.on('thinking' | 'reply' | 'error', cb)` | reply: { text, source: 'fake' | 'live' } |
| `ai.mode 'fake' | 'live' = 'fake'` |   |

```ts
import { ai, onSelect, Panel, stage, THREE } from '@blocks';

ai.fake({
  hello: ['Hi there!', 'Hello again.'],
  '/planet|mars/': 'Mars is the red one.',
  '*': 'I did not catch that.',
});

const panel = new Panel({ text: 'Select the cube.' });
stage.add(panel);
const cube = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x8ecae6 }));
cube.position.y = -0.3;
stage.add(cube);

ai.on('thinking', () => panel.setText('…'));
ai.on('reply', ({ text }) => panel.setText(text, { typewriter: true }));
onSelect(cube, () => ai.ask('tell me about mars'));
// ai.mode = 'live';  // real model through the proxy once a key is in .env; falls back to fake without one
```
