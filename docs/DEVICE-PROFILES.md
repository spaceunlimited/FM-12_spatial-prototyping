# Device profiles

A profile is how the sandbox talks to a device. It decides what the viewer sees behind the 3D
objects, how they look around, how they select things, and where objects can be placed. Your demo
code is the same for all profiles; only the profile changes.

**One link works on every device.** Open the same URL on an iPhone, an AR Android phone or a
Quest and each one runs the best version it can: camera view, surfaces, or the room. You never type
a special address into a headset, and the start screen offers the other versions as one-tap links.

The device always has the last word. What it cannot do, it falls back from, with a short notice on
the start screen before the viewer begins; never a silent substitution. To pin a profile for one
run: `npm run dev -- --profile phone-camera`, or `?profile=…` in the URL.

Branch on `profile.capabilities` (`surfaceHitTest`, `hands`, `controllers`, `passthrough`, `touch`,
`positionalTracking`, `simulated`), never on device names.

## headset-webxr (Quest 3, the primary target; Android XR; Vision Pro in VR)

**What the viewer sees:** the room through passthrough (Vision Pro: a neutral virtual room).

**Selecting:** pinch, or press the controller trigger. Both arrive in your code as the same select.
A ray leaves each hand with a cursor where it lands; the cursor shrinks on a press; a controller
buzzes. Poke (`onPoke`) is a fingertip touching the object. Two hands on one draggable object scale it.

**Placement:** real surfaces, or in the hand (`holdInHand`). **Text and buttons:** all panels and
labels live in the room; there is no HTML over a headset view. Do not design around a left-hand
palm pinch: the system menu owns it.

## phone-camera (iPhone and every Android)

**What the viewer sees:** the phone's camera image, with the 3D objects drawn on top. Like looking
through a window.

**Looking around:** the gyroscope. Turn the phone and the view turns with it.

**Selecting:** tap on an object. Drag to move it. Aiming the phone's centre at an object counts as
pointing (`onPoint`); a small reticle lights up.

**Placement:** objects float at a fixed distance in front of the viewer (1.5 m, a little below eye
height). There are no surfaces to find.

**The honest limitation:** the phone knows which way it is turned, but not where it is. If the
viewer walks, the objects walk with them. Plan the demo for a viewer who stands on one spot and
turns. iPhone has no WebXR, so this is its only profile.

**Voice:** the phone can speak. Listening works one phrase at a time on iPhone; where it is
unreliable, `voice.listen({ fallbackPhrases })` shows tappable phrases instead.

## phone-webxr (Android with ARCore)

**What the viewer sees:** the camera image inside a WebXR AR session. The phone now knows where it
is in the room.

**Selecting:** tap. **Placement:** objects go on real surfaces (`place()` with hit-test). The object
first waits where the viewer is looking and a thin ring shows on the surface the phone found; after
six seconds without a surface it floats in front instead and says so.

## Side by side

| | phone-camera | phone-webxr | headset-webxr |
|---|---|---|---|
| Devices | iPhone, Android, laptop preview | Android with ARCore | Quest 3, Android XR, (Vision Pro: VR only) |
| Objects stay put when the viewer walks | no | yes | yes |
| Surfaces | no | yes | yes (not Vision Pro) |
| Select | tap | tap | pinch, trigger, poke |
| Laptop preview | yes | emulator (`?sim=phone-ar`) | emulator (`?sim=headset`) |

## What every profile gives you

- **One way to point.** Screen centre on a phone, a ray out of each hand on a headset, with a
  cursor at the end. The runtime draws it; do not rebuild it.
- **A visible hover state.** Anything with `onSelect`, `onPoint` or `draggable` lights up when aimed at.
- **Tap and drag from one gesture.** Press and release is a select; press and move is a drag.
- **Placement that admits what it did.** `place()` reports which strategy it used, in plain words.
- **A device-matched start screen.** It names the version running, says how to hold or wear the
  device, and links to the other versions.

## The laptop preview

`npm run dev` opens `?sim=phone`: the phone-camera profile with a blurred photo-studio panorama
(`public/sim/brown_photostudio_02_1k.hdr`, Poly Haven, CC0) standing in for the room and lighting
the objects. Drag to look around, click to tap, drag an object to move it. "Preview as headset" on
the start screen runs the headset profile in an emulator (IWER) with a synthetic meeting room:
hit-test finds its floor and table, the dev panel moves the head and the controllers, and `?sim=phone-ar`
does the same for the phone AR profile. A quick check, not a substitute for the device.
