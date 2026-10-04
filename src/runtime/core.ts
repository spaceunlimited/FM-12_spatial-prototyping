// Boots the experience: renderer, scene, profile, the start button (one tap unlocks camera,
// motion and audio), then hands a ready context to the experience code.
import * as THREE from 'three';
import { reversePainterSortStable } from '@pmndrs/uikit';
import { selectProfile, simMode } from './profiles/select';
import type { ProfileAlternative } from './profiles/select';
import type { DeviceProfile, ProfileContext, ProfileId } from './profiles/Profile';
import { EYE_HEIGHT } from './profiles/Profile';
import { initInteraction, updateInteraction, getPointerEntries } from './interaction';
import { runFrame, onFrame } from './loop';
import { setRuntime } from './state';
import { updateUI } from '../blocks/ui/UIBlock';
import { toast } from '../blocks/ui/toast';
import { voice } from '../blocks/voice';
import { ai } from '../blocks/ai';
import { initStage, recenter, stage } from '../blocks/stage';

export interface ExperienceContext extends ProfileContext {
  profile: DeviceProfile;
  /** Register a per-frame callback. dt in seconds. Returns the function that removes it. */
  onFrame(cb: (dt: number, t: number) => void): () => void;
}

export interface StartOptions {
  /** Shown on the start screen. */
  title?: string;
  /**
   * One line under the title. Leave it out and each device explains itself ("hold the phone up
   * like a window", "put the headset on and pinch"). Pass a string to say something else, or one
   * string per device when holding a phone and wearing a headset need different words.
   */
  hint?: string | Partial<Record<ProfileId, string>>;
  buttonLabel?: string;
}

/**
 * @block startExperience
 * Boots everything and runs your setup once the device is ready: renderer, device profile, start
 * screen (the one tap that unlocks camera, motion, audio or the XR session), pointer layer, stage.
 * @option setup (ctx) => void — your scene; ctx has scene, camera, profile.capabilities, onFrame()
 * @option title string — on the start screen
 * @option hint string | { 'phone-camera'?, 'phone-webxr'?, 'headset-webxr'? } — one line under the title
 * @option buttonLabel string — the start button
 */
export async function startExperience(setup: (ctx: ExperienceContext) => void | Promise<void>, opts: StartOptions = {}) {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const video = document.getElementById('camera-feed') as HTMLVideoElement;
  const overlay = document.getElementById('overlay') as HTMLElement;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    toast('This browser cannot show 3D graphics. Try Safari on iPhone or Chrome on Android.', 10000);
    throw e;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.xr.enabled = true;
  // uikit needs these two: clipped scroll areas, and its own transparent sort order.
  renderer.localClippingEnabled = true;
  renderer.setTransparentSort(reversePainterSortStable);

  const scene = new THREE.Scene();
  const viewer = new THREE.Group();
  viewer.name = 'viewer';
  viewer.position.set(0, EYE_HEIGHT, 0);
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 60);
  viewer.add(camera);
  scene.add(viewer);

  // Neutral lighting that reads well over real backgrounds.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(1, 3, 2);
  scene.add(sun);

  // The headset / phone-AR emulator must exist before the profile is detected.
  const sim = simMode();
  let xrDevice: unknown;
  if (import.meta.env.DEV && (sim === 'headset' || sim === 'phone-ar')) {
    try {
      const { installEmulator } = await import('./profiles/emulator');
      xrDevice = await installEmulator(sim);
    } catch (e) {
      console.warn('[core] emulator unavailable', e);
    }
  }

  const selection = await selectProfile();
  const profile = selection.profile;
  const ctx: ProfileContext = { renderer, scene, camera, viewer, canvas, video, overlay };
  setRuntime(profile, ctx);

  // Everything that needs the viewer's permission — audio, camera, motion, the AR session —
  // has to happen inside the tap itself, so it all lives in here.
  const begin = async () => {
    await voice.unlock();
    await profile.start(ctx);
  };

  // ?autostart=1 skips the start button for the laptop preview and automated checks. Real
  // devices need the tap, and an AR session is never granted without one.
  const params = new URLSearchParams(location.search);
  const simulated = !!sim || profile.capabilities.simulated;
  const autostart = params.get('autostart') === '1' && (simulated || (!('ontouchstart' in window) && !profile.immersive));
  if (autostart) await begin();
  else await showStartScreen(overlay, opts, profile, selection.notice, selection.targetNote, selection.alternatives, begin, !!sim);

  if (selection.notice) toast(selection.notice, 5000);

  initInteraction(profile, ctx);
  initStage(scene);

  const exp: ExperienceContext = { ...ctx, profile, onFrame };
  await setup(exp);

  window.addEventListener('resize', () => {
    if (renderer.xr.isPresenting) return; // in a session the device owns the viewport
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let last = performance.now();
  renderer.setAnimationLoop((t: number, frame?: XRFrame) => {
    // The first frame, and the first frame of an XR session, can report a time from a different
    // clock than ours. An unclamped negative dt would push every appear animation into the past.
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
    last = t;
    profile.update(dt, frame);
    updateInteraction();
    runFrame(dt, t / 1000);
    updateUI(dt, camera);
    renderer.render(scene, camera);
  });

  // Headset off, or "exit AR" on the phone: stop drawing and offer the way back in. Starting
  // again reloads, so the demo always begins from a clean state in front of an audience.
  profile.onExit?.(() => {
    renderer.setAnimationLoop(null);
    showEndScreen(overlay, profile.startButtonLabel || 'Start');
  });

  (window as any).__sandbox = { scene, camera, renderer, profile, ai, stage, recenter, xrDevice, pointers: getPointerEntries, ready: true };
  return exp;
}

/**
 * One screen, every device. The words come from the profile (hold the phone up / put the headset
 * on), the fallback notice is shown *before* the viewer starts rather than after, and the tap
 * itself runs `activate`: a headset only grants an AR session inside a real gesture.
 */
function showStartScreen(
  overlay: HTMLElement,
  opts: StartOptions,
  profile: DeviceProfile,
  notice: string | undefined,
  targetNote: string | undefined,
  alternatives: ProfileAlternative[],
  activate: () => Promise<void>,
  isSim: boolean,
): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'mr-start';
    const simLinks =
      import.meta.env.DEV && !('ontouchstart' in window)
        ? `<a class="mr-alt" href="${simHref(isSim && profile.id !== 'phone-camera' ? 'phone' : 'headset')}">${
            isSim && profile.id !== 'phone-camera' ? 'Preview as phone' : 'Preview as headset (emulator)'
          }</a>`
        : '';
    el.innerHTML = `
      <h1>${escapeHtml(opts.title || 'XR sandbox')}</h1>
      <p>${escapeHtml(hintFor(opts.hint, profile) || profile.startHint || 'Hold the phone up like a window.')}</p>
      ${notice ? `<p class="mr-note">${escapeHtml(notice)}</p>` : ''}
      <button type="button">${escapeHtml(opts.buttonLabel || profile.startButtonLabel || 'Start')}</button>
      <p class="mr-error" hidden></p>
      <div class="mr-profile">${escapeHtml(profile.label)}${targetNote ? ` · ${escapeHtml(targetNote)}` : ''}</div>
      ${alternatives.map((a) => `<a class="mr-alt" href="${profileHref(a.id)}">${escapeHtml(a.label)}</a>`).join('')}
      ${simLinks}`;
    overlay.appendChild(el);
    const btn = el.querySelector('button')!;
    const err = el.querySelector('.mr-error') as HTMLElement;

    // iOS counts the gesture on pointerup/click, not on touchstart.
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      err.hidden = true;
      btn.textContent = 'Starting…';
      try {
        await activate();
        el.remove();
        resolve();
      } catch (e: any) {
        console.warn('[start]', e);
        btn.disabled = false;
        btn.textContent = 'Try again';
        err.textContent = startError(e, profile);
        err.hidden = false;
      }
    });
  });
}

/** Same page, different device version. A link, so a headset never needs a keyboard. */
function profileHref(id: ProfileId): string {
  const params = new URLSearchParams(location.search);
  params.set('profile', id);
  params.delete('sim');
  return `${location.pathname}?${params.toString()}`;
}

function simHref(mode: 'phone' | 'headset'): string {
  const params = new URLSearchParams(location.search);
  params.set('sim', mode);
  params.delete('profile');
  return `${location.pathname}?${params.toString()}`;
}

/** One hint for every device, or one per device; nothing means the device speaks for itself. */
function hintFor(hint: StartOptions['hint'], profile: DeviceProfile): string | undefined {
  if (!hint) return undefined;
  if (typeof hint === 'string') return hint;
  return hint[profile.id];
}

/** Why the start failed, in words the person holding the device can act on. */
function startError(e: any, profile: DeviceProfile): string {
  const name = e?.name || '';
  if (name === 'NotAllowedError')
    return profile.immersive
      ? 'The device did not allow the AR session. Tap again and accept the permission.'
      : 'Camera or motion access was refused. Tap again and accept, or check the browser settings.';
  if (name === 'NotSupportedError' || name === 'InvalidStateError')
    return 'This device cannot run the AR version. Use the link below to see the phone view instead.';
  if (name === 'SecurityError')
    return 'The connection is not trusted on this device. Open /setup and follow the certificate step.';
  return `Could not start: ${e?.message || name || 'unknown reason'}. Tap to try again.`;
}

/** After the viewer leaves the session: a way back in that starts from a clean state. */
function showEndScreen(overlay: HTMLElement, label: string) {
  const el = document.createElement('div');
  el.className = 'mr-start';
  el.innerHTML = `
    <h1>That was the demo</h1>
    <p>You left the immersive view. Start again when you are ready.</p>
    <button type="button">${escapeHtml(label)}</button>`;
  overlay.appendChild(el);
  el.querySelector('button')!.addEventListener('click', () => location.reload(), { once: true });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
