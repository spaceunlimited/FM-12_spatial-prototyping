# Compatibility matrix

What each browser supports, as researched from primary sources on 2026-10-03 (WebKit source and
bug tracker, caniuse, MDN browser-compat-data, Chrome status, Meta and Android XR developer docs,
Apple release notes). ✓ yes · ✗ no · ~ partial · ? unverified. "On hardware" rows record what this
sandbox has actually been run on; they are filled in as milestones land.

## Browser capabilities

| Capability | iPhone Safari (iOS 26/27) | Android Chrome + ARCore | Quest 3 Browser (150.x) | Android XR Chrome (136+) | Vision Pro Safari (visionOS 27) | Laptop Chrome + IWER |
|---|---|---|---|---|---|---|
| WebXR `immersive-ar` | ✗ (no WebXR at all, not even behind a flag) | ✓ | ✓ passthrough | ✓ | ✗ (`immersive-vr` only) | ✓ emulated |
| hit-test | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ emulated |
| hand-tracking | ✗ | n/a | ✓ 25 joints | ✓ default input | ~ opt-in Safari setting; default input is `transient-pointer` | ✓ emulated |
| DOM overlay in AR | ✗ | ✓ | ✓ | ? | ✗ | ✓ |
| depth sensing | ✗ | ✓ | ~ experimental | ✓ stereo | ✗ | listed |
| anchors | ✗ | ✓ | ✓ (+ persistent) | ✓ | ✗ | ✓ |
| camera via `getUserMedia` | ✓ HTTPS, inside a tap | ✓ | ✗ no evidence (mic only) | ? | ✓ | ✓ |
| DeviceOrientation | ✓ `requestPermission` inside a tap | ✓ | ~ | ? | n/a | ✗ |
| SpeechRecognition | ✓ `webkit` prefix, one phrase at a time | ✓ server-based | ? API present, backend unverified | ? | ✓ prefixed | ✓ |
| speechSynthesis | ✓ | ✓ | ✓ | ? | ✓ | ✓ |
| WebGL2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ software |

Notes
- iPhone: WebKit enables WebXR only for visionOS (`PlatformEnableCocoa.h`); a WebKit engineer confirmed on bug 309550 (2026-03-11) that WebXR is not supported on iOS. The only route is Variant Launch (App Clip, paid above 3 000 views/month). This sandbox treats the camera view as the iPhone's path.
- Android Chrome removed `supportsSession` in M135; detection uses `isSessionSupported`. Chrome on a phone also reports `immersive-vr` (Cardboard), so a headset is recognised by user agent, not by that flag.
- Quest Browser pages cannot access the cameras; AI vision does not work on a headset.
- IWER 2.5.0 is the only maintained desktop emulator (Meta archived its browser extension on 2026-10-01).

## This sandbox on hardware

| Profile / feature | iPhone | Android (ARCore) | Quest 3 | Laptop |
|---|---|---|---|---|
| phone-camera: camera feed, gyro, tap, drag | ✓ 2026-10-03 user test (iPhone: camera background, floating objects, tap, drag) | ? no ARCore phone available | ✓ 2026-10-03 as the fallback view (no camera on Quest Browser; select and drag work) | ✓ 2026-10-03 (preview, headless smoke) |
| Certificate trust via /setup | ✓ 2026-10-03 user test | ? no device available | ✓ 2026-10-03 click-through | ✓ 2026-10-03 (mkcert download, CA, LAN cert, HTTPS, QR, /setup, /cert) |
| Fake AI reply on tap | ✓ 2026-10-03 user test | ? no device available | ✓ 2026-10-03 (fallback view) | ✓ 2026-10-03 |
| phone-webxr: surfaces | n/a | ? built 2026-10-03; no ARCore phone available to test | n/a | ✓ 2026-10-03 emulator (`?sim=phone-ar`) |
| headset-webxr: hands, controllers, pinch, poke | n/a | n/a | ✓ 2026-10-03 user test: passthrough session, pinch select, pinch-drag, two-hand scale, surface placement (walls first, fixed to floor/table) | ✓ 2026-10-03 emulator (`?sim=headset`, headless smoke) |
| voice.listen | ? | ? | ? | ✓ |
| voice.speak (browser) | ? | ? | ? | ✓ |
| model / image / video (assets) | ? | ? | ? | ✓ 2026-10-04 emulator and phone preview: glb fit and animation, png colours, mp4 frame (headless screenshot) |

Fill a cell: open `/check` on the device, press "Send results", then on the laptop
`curl -sk https://localhost:5173/api/diag`.

## Not testable at the moment

No ARCore Android phone, Vision Pro or Android XR headset was available (2026-10-03). The
`phone-webxr` profile is exercised only by the emulator (`?sim=phone-ar`); the Vision Pro VR
sub-mode and Android XR have never run. Anyone with one of these devices: open the QR link, try the
starter scene, then `/check` and "Send results", and update this table.
