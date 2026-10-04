# Visual guidelines for mixed-reality demos

Ten minutes of rules for putting text, panels and objects into a real room, seen through an iPhone camera, an Android WebXR session or a Quest 3 passthrough. Every rule carries a source tag in brackets (see *Sources*); numbers without a source are marked **[unverified]**. The numbers live in `src/scaffold/ui/defaults.ts`, so the kit follows them for you.

Sizes are given in metres *at 1 m distance*; the kit scales them with distance, so a 2.6 cm letter at 1 m becomes 5.2 cm at 2 m and looks the same to the viewer.

## 1. Where things live: distance and size

- Nothing the viewer has to look at for more than a moment sits closer than 0.5 m; closer strains the eyes. [Meta]
- Panels you read sit at 1 m or more; the kit starts everything at 1.5 m, inside Android XR's 0.75–1.75 m constant-size band and XR Blocks' object distance. [visionOS, Meta, AXR, XRB]
- The same 1.5 m applies on a phone: the camera view is a window onto the same room, not a card held in the hand.
- Put the main content in the central 41° of view and set its centre about 5° below eye level, because people look slightly down when relaxed. [AXR, Meta]
- Body text is 2.6 cm at 1 m (about 1.5° of visual angle), caption text 1.9 cm (1.1°), titles 3.4 cm (1.9°); the platform minimum is roughly 1.2 cm at 1 m, so we sit well above it. [AXR, Meta]
- Anything tappable, pinchable or gaze-selectable is at least 6 cm across at 1 m (about 3.4°); Meta asks for 3° and Android XR for 56 dp, which is about 4.9 cm at 1 m. [Meta, AXR]
- On the phone screen itself, touch targets stay at 44 × 44 pt. [Apple HIG]
- Never anchor content to the viewer's head; anchor it in the room. [visionOS]

## 2. Legibility over passthrough and camera feed

- Never rely on the background: every piece of text sits on a translucent dark backing, ours at 72 % opacity, never on the raw room; the sources say "translucent, not opaque" and the exact value is ours. [visionOS, Meta] **[unverified]**
- Text contrast against its backing is at least 4.5:1, and we aim for 7:1 because real rooms add visual noise behind the panel. [W3C]
- Light text on dark glass is the default; on a bright phone camera feed, test both light-on-dark and dark-on-light in the actual room. [Meta, Google AR]
- Use a sans-serif at Regular weight or heavier, no italics; Ultralight, Thin and Light disappear over a real room. [visionOS, Meta, AXR]
- Prefer flat 2D text; letters with depth are hard to read. [visionOS]
- Our text colour is off-white (#f4f4f6), not pure white, to soften glare on headset displays. **[unverified]**
- Round the corners of anything interactive; eyes get pulled into sharp corners. [visionOS]

## 3. Panel and label patterns

- **World-locked** is the default: the panel stays where you put it in the room. [visionOS, Meta]
- **Object-attached label**: a small billboard that always faces the viewer, with a leader line if it floats more than 10 cm from its object. [visionOS]
- **Lazy-follow** is for prompts only: the panel drifts after the viewer with a 450 ms ease and only moves once they have turned more than 16°; the numbers are a house choice. [visionOS] **[unverified]**
- One primary panel at a time; everything else is a small label or an "orbiter" hugging the panel edge. [Google AR, AXR]
- Keep 16 pt-equivalent of space between neighbouring targets so a glance does not pick the wrong one. [visionOS]
- On a phone, show an edge arrow or soft glow when the object is off-screen, and place the first object near the screen edge to invite movement. [Google AR]
- Panel corners are rounded at 2.8 cm at 1 m, matching Android XR's 32 dp. [AXR]

## 4. Colour and depth cues

- A limited palette: neutrals, one accent (#ffd166) and one "the AI is active" colour (#8ecae6). [W3C]
- Never use colour alone to signal a state; pair it with an icon, a word or a shape. [W3C, Meta]
- Every floating object gets a ground shadow or contact ring, or it reads as a sticker. [Google AR]

## 5. Motion and feedback

- Every action gets visible feedback within 100 ms: a highlight, a tick, a haptic on the phone. [Nielsen]
- Fake "AI thinking" lasts 0.6 to 1.2 s with a visible indicator; over about 1 s the viewer's flow breaks, so the indicator is not optional. [Nielsen]
- Things appear in 260 ms with an ease-out and leave in 200 ms with an ease-in, matching Material's short and medium duration tokens. [Material 3]
- When something must move to a new place, fade it out, move it, fade it back in; never slide it across the room. [visionOS]
- No sustained wobbling or bobbing (especially around one cycle every five seconds) and no continuous motion at the edges of view. [visionOS]
- Fade objects in when placing them; never pop anything into view near the face. [visionOS, Meta]

## 6. Avoiding discomfort

- Never move, rotate or scale the camera or the world for the viewer; if you must jump, fade out, cut, fade in. [visionOS, AXR, Meta]
- Large objects that fill the view feel like the room is moving; keep them small, translucent or low-contrast. [visionOS, AXR]
- Nothing flashes more than three times per second. [W3C]
- On a phone, remind the viewer to look up before walking, and never make them walk backwards. [Google AR]
- Keep a demo under about three minutes; holding a phone up is tiring and the sources say to avoid long sessions. [Google AR] **[unverified number]**
- Design for one-handed hold with the thumb on the primary control. [Google AR]

## 7. Voice and timing

- One speaker, one voice, for the whole demo. **[unverified, house rule]**
- Each spoken utterance is at most 12 words; the viewer is also looking at a room. **[unverified, house rule]**
- Leave a pause between beats, never play two sounds at once, and let sound get quieter with distance. [Google AR]

## 8. Defaults table

These live in `theme` in `src/blocks/ui/theme.ts`. Lengths are uikit pixels: one pixel is one
millimetre at one metre, and every UI block scales with its distance so the angles hold anywhere.

| Constant (`theme`) | Value | Meaning | Source |
|---|---|---|---|
| `distance` / `heightOffset` | 1.5 m / −0.15 m | Where the stage and new panels start: ahead, a little below eye height | [AXR 0.75–1.75 m, XRB 1.5 m, AXR 5° below] |
| `minDistance` / `maxDistance` | 0.5 m / 5 m | Closest and farthest anything sits | [Meta] / [AXR, MRTK] |
| `constantSizeUntil` / `growthBeyond` | 1.75 m / 0.5 m per m | Visual size constant to 1.75 m, then grows slower than distance | [AXR] |
| `panelWidth` / `panelMaxWidth` | 420 / 700 px | Panel width (0.42 m at 1 m) | [house] |
| `fontTitle` / `fontBody` / `fontCaption` | 34 / 26 / 19 px | Text height at 1 m; body ≈ 1.5°, all above the platform minima | [AXR 14 dp, Apple 17 pt, MRTK 0.4° min] |
| `lineHeight` | 1.32 | Line height as a multiple of the font size | [house] |
| `minTarget` / `gap` | 60 / 14 px | Smallest target (≈ 3.4° at 1 m) and the gap between targets | [AXR 56 dp + 8 dp, Apple 60 pt + 16 pt, Meta 48 dp] |
| `backing` / `backingOpacity` | #14141a / 0.72 | Translucent dark backing | [visionOS: translucency] / value [house] |
| `text` | #f4f4f6 | Off-white text, ≥ 4.5:1, aim 7:1 | [W3C] |
| `accent` / `aiActive` | #ffd166 / #8ecae6 | One accent, one "AI active" colour | [W3C] |
| `cornerRadius` / `padding` | 28 px | Rounded corners and inner padding | [AXR 32 dp] |
| `elevation.orbiter/popup/dialog` | 14 / 28 / 49 mm at 1 m | Depth as hierarchy: how far a control, a popup, a dialog float in front of their panel | [AXR 16 / 32 / 56 dp] |
| `feedbackMs` | 100 ms | Feedback after any action | [Nielsen] |
| `appearMs` / `disappearMs` | 260 / 200 ms | Enter and exit durations | [Material 3] |
| `followLagMs` / `followDeadZoneRad` | 450 ms / 0.28 rad (16°) | Lazy follow: turn this far before the panel moves, then ease over | [house; MRTK: body-lock, never head-lock] |
| `thinkingMinMs` / `thinkingMaxMs` | 600 / 1200 ms | Fake AI thinking delay | [Nielsen] |

## 9. Interaction: the numbers behind the kit

These live in `theme.interact` in `src/blocks/ui/theme.ts`. Most are tuned values from [XRB], which had already tried them on hardware; the rest are house choices marked as such.

| Constant (`INTERACT`) | Value | Meaning | Source |
|---|---|---|---|
| `pokeExitPadding` | 0.01 m | Get this far clear before a touch counts as finished, so the edge does not flicker | [XRB] |
| `pokeBoundsPadding` | 0.012 m | Grow a small object by this so a fingertip can find it | house |
| `dwellMs` | 1500 ms | Default hold before a dwell fires | [XRB] |
| `dwellResetSpeed` | 0.2 m/s | Travel faster than this cancels the dwell; tremor stays well under it | [XRB] |
| `longPressMs` | 750 ms | Holding a select | [XRB] |
| `cursorRadius` | 0.009 m at 1 m | ≈0.5°: aimable, but not itself a target | house |
| `cursorRingThickness` | 0.15 | Ring thickness as a fraction of the radius | [XRB] |
| `cursorSurfaceOffset` | 0.001 m | Lift off a real surface so it does not z-fight | [XRB] |
| `cursorPressScale` | 0.7 | How far the cursor shrinks when fully pressed | [XRB] |
| `cursorSmoothing` | 0.8 | Eases the cursor's turn between surfaces instead of snapping | [XRB] |
| `scaleMin` / `scaleMax` | 0.25× / 4× | Limits when two hands resize an object | house |
| `nodDegrees` / `shakeDegrees` | 12° / 16° | The excursion that counts as a nod or a shake | house, method [XRB] |
| `gestureWindowMs` | 900 ms | The out-and-back has to happen inside this window | house |
| `gestureQuietDegrees` | 10° | The other axes must stay quieter than this, or it is not a nod | [XRB] |

Three rules about interaction that are not numbers:

- **Act when they finish, not when they start.** A poke commits on withdrawal, a long press on completion. When tracking is lost mid-gesture, undo the feedback and do nothing else — a demo that acts on a dropped hand feels possessed.
- **Any hold needs visible progress.** A 750 ms or 1.5 s wait with nothing filling up reads as a broken button, not as a deliberate pause.
- **One gesture, one meaning.** A still pinch is a tap and a travelling pinch is a drag; a completed long press is not also a tap. The viewer should never have to be told which they just did.

Two spatial defaults worth keeping apart, because they get confused: a panel you **read** sits about 5° below eye level [AXR, Meta], while an object **placed in front of you** sits about 18° below [XRB]. Different purposes, different numbers.

## 10. How to break the rules

These are defaults, not laws: a horror piece may want a label to creep closer than 0.5 m, a
poster-scale idea a 2 m panel, a playful tone a bouncing marker. Deviate per object (`Panel({ width,
backgroundColor })`, `recenter({ distance })`) rather than by editing `theme.ts`, so the rest of the
scene keeps the defaults; and if a deviation touches comfort (§6), try it on the device first.

## Sources

- **[visionOS]** Apple Human Interface Guidelines: [Designing for visionOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos), [Spatial layout](https://developer.apple.com/design/human-interface-guidelines/spatial-layout), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Eyes](https://developer.apple.com/design/human-interface-guidelines/eyes), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials).
- **[Apple HIG]** Apple HIG [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) (44 × 44 pt on iOS, 60 × 60 pt on visionOS).
- **[Meta]** Meta Horizon OS design guidelines: [Display](https://developers.meta.com/horizon/design/display/) (0.5 m, 1 m), [Key considerations for MR](https://developers.meta.com/horizon/design/mr-design-guideline/), [Comfort](https://developers.meta.com/horizon/design/comfort/), [Typography](https://developers.meta.com/horizon/design/styles_typography/), [Accessibility](https://developers.meta.com/horizon/design/accessibility/) (3° targets, contrast), [Head](https://developers.meta.com/horizon/design/head/), [Health and safety](https://developers.meta.com/horizon/design/mr-health-general/).
- **[AXR]** Android XR design guidance: [Visual design](https://developer.android.com/design/ui/xr/guides/visual-design) (0.868 dp-to-dmm, 14 dp, 56 dp, 41°), [Spatial UI](https://developer.android.com/design/ui/xr/guides/spatial-ui) (1.75 m, 0.75–5 m, 5° below eye level, orbiters), [Motion](https://developer.android.com/design/ui/xr/guides/motion).
- **[Google AR]** Google AR design guidelines for handheld AR: [Safety and comfort](https://developers.google.com/ar/design/user/safety-comfort), [Movement](https://developers.google.com/ar/design/user/movement), [Content placement](https://developers.google.com/ar/design/content/content-placement), [Realism](https://developers.google.com/ar/design/content/realism), [UI](https://developers.google.com/ar/design/interaction/ui), [UX](https://developers.google.com/ar/design/interaction/ux).
- **[W3C]** [WCAG 2.2](https://www.w3.org/TR/WCAG22/): 1.4.3 Contrast (Minimum) 4.5:1, 1.4.6 Contrast (Enhanced) 7:1, 1.4.1 Use of Color, 2.3.1 Three Flashes, 2.5.5 Target Size 44 px.
- **[Nielsen]** Nielsen Norman Group, [Response times: the 3 important limits](https://www.nngroup.com/articles/response-times-3-important-limits/) (0.1 s, 1 s, 10 s).
- **[Material 3]** Material Design 3, [Easing and duration tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs) (short 50–200 ms, medium 250–400 ms).
- **[XRB]** Google [XR Blocks](https://github.com/google/xrblocks) (Apache-2.0), read at version 0.x in October 2026: `src/core/User.ts` (panel distance 1.75 m, object distance 1.5 m at −18°, 0.2 m safe space), `src/interaction/DirectTouch.ts` (1 cm exit padding, contact phases), `src/interaction/GazeDwell.ts` (1.5 s dwell, 0.2 m/s reset), `src/core/Options.ts` (0.75 s long select), `src/interaction/reticle/Reticle.ts` (ring proportions, 0.8 smoothing, 0.7 pressed scale), `src/interaction/manipulation/` (translate + scale by default, rotation opt-in and Y-only). We use the numbers and the methods, and copy a few self-contained files (gaze dwell, billboarding, head gestures) into `src/runtime/vendor/xrblocks/` with attribution.
- **[MRTK]** Microsoft Mixed Reality design docs: [Comfort](https://learn.microsoft.com/windows/mixed-reality/design/comfort) (1.25–5 m zone, 2 m focal plane, fade at 40 cm), [Typography](https://learn.microsoft.com/windows/mixed-reality/design/typography) (0.35–0.4° minimum, 0.6–0.75° comfortable), [Interactable object](https://learn.microsoft.com/windows/mixed-reality/design/interactable-object) (2° / 1.6 cm direct, 1° / 3.5 cm at 2 m by ray).

## D. Cross-platform numbers, checked 2026-10-03

| Metric | visionOS | Android XR | Meta Horizon | MRTK | Our default |
|---|---|---|---|---|---|
| Default UI distance | ~2 m (windows) | 1.75 m | ~1 m menus; 0.45 m direct-hand UI | 2 m | 1.5 m |
| Comfortable range | ≥ 1 m to read; 1.5 m immersive boundary | 0.75–5 m | ≥ 0.5 m | 1.25–5 m; fade 0.4 m | 0.5–5 m |
| Default panel | 1280 × 720 pt | 1024 × 720 dp | 1024 × 640 dp | – | 420 px wide, height by content |
| Min target | 60 pt centres, 16 pt gap | 56 dp, 8 dp gap | 48 dp | 1.6 cm direct, 3.5 cm at 2 m | 60 px + 14 px gap |
| Min text | 12 pt (default 17) | 14 dp | Body 14 dp | 0.35–0.4° | 19 px caption, 26 px body |
| Vertical placement | head-relative, in FOV | centre 5° below eye | slightly below line of sight | gaze rests 10–20° below | 0.15 m below eye at 1.5 m (≈ 6°) |
| Angular unit | point = angle | 0.868 dp per dmm; constant 0.75–1.75 m | angular scaling | degrees | 1 px = 1 mm at 1 m, scaled with distance |
| Head-lock | avoid | – | – | body-lock, never head-lock | lazy follow with 16° dead zone |
