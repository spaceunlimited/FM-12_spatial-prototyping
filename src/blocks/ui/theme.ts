// The numbers behind the spatial UI. Sources and reasoning: docs/VISUAL-GUIDELINES.md.
// Lengths are uikit pixels unless noted; one pixel is one millimetre at one metre (pixelSize
// 0.001), and every UI block scales with its distance so these angles hold wherever it sits.
export const theme = {
  // Where things live (metres)
  distance: 1.5, // default distance for the stage and for panels [Android XR 0.75–1.75 m band, XR Blocks 1.5 m]
  heightOffset: -0.15, // below eye height [Android XR: centre 5° below eye level]
  minDistance: 0.5, // never closer [Meta]
  maxDistance: 5, // never further [Android XR, MRTK]
  constantSizeUntil: 1.75, // angular size stays constant up to here, then grows 0.5 m per metre [Android XR]
  growthBeyond: 0.5,
  pixelSize: 0.001,

  // Panels (px at 1 m)
  panelWidth: 420,
  panelMaxWidth: 700,
  padding: 28,
  gap: 14, // ≥ 8 dp Android XR; 16 pt Apple
  cornerRadius: 28, // 32 dp Android XR, rounded shapes are easier to target [Apple]

  // Text (px at 1 m). Body ≈ 1.5° at 1 m, above every platform minimum.
  fontTitle: 34,
  fontBody: 26,
  fontCaption: 19,
  lineHeight: 1.32,
  fontWeightTitle: 600,
  fontWeightBody: 500,

  // Targets
  minTarget: 60, // ≈ 3.4° at 1 m; between Android XR 56 dp and Apple 60 pt

  // Legibility over real backgrounds
  backing: '#14141a',
  backingOpacity: 0.72,
  text: '#f4f4f6',
  textMuted: '#b8b8c2',
  accent: '#ffd166',
  aiActive: '#8ecae6',
  button: '#2c2c36',
  buttonHover: '#3d3d4a',
  buttonPressed: '#ffd166',
  buttonPressedText: '#14141a',
  buttonSelected: '#ffd166',
  buttonDisabledOpacity: 0.4,

  // Motion and feedback (ms)
  feedbackMs: 100,
  appearMs: 260,
  disappearMs: 200,
  followLagMs: 450, // lazy-follow easing
  followDeadZoneRad: 0.28, // ≈16°: a lazy panel only moves when the viewer turns more than this
  thinkingMinMs: 600,
  thinkingMaxMs: 1200, // over ~1 s the viewer's flow breaks, even with an indicator [Nielsen]

  // Depth as hierarchy (metres at 1 m) [Android XR 16 / 32 / 56 dp]
  elevation: { orbiter: 0.014, popup: 0.028, dialog: 0.049 },

  // Interaction
  interact: {
    longPressMs: 750, // [XR Blocks]
    dwellMs: 1500, // [XR Blocks]
    scaleMin: 0.25, // smallest / largest multiple of an object's size from two-hand scaling
    scaleMax: 4,
  },
} as const;

/** Visual-angle-constant scale for something at `distance` metres: constant to 1.75 m, slower beyond. */
export function scaleForDistance(distance: number): number {
  const d = Math.max(theme.minDistance, distance);
  return d <= theme.constantSizeUntil ? d : theme.constantSizeUntil + theme.growthBeyond * (d - theme.constantSizeUntil);
}
