// Picks the profile. One link works on every device: the page asks the device what it can do and
// runs that. Nobody should ever have to type a query parameter into a headset.
//
//   auto (the default)  – run the best thing this device can do
//   a named profile     – from `npm run dev -- --profile <id>`; honoured when the device can run it
//   ?profile=<id>       – an explicit override for one test; always wins when possible
//   ?sim=phone|headset  – laptop preview: the phone view, or the headset profile in an emulator
import type { DeviceProfile, ProfileId } from './Profile';
import { PhoneCameraProfile } from './phone-camera';

export type ProfileRequest = ProfileId | 'auto';
export type SimMode = 'phone' | 'headset' | 'phone-ar' | null;

export interface ProfileAlternative {
  id: ProfileId;
  /** What the viewer would gain or lose by switching, in plain words. */
  label: string;
}

export interface ProfileSelection {
  profile: DeviceProfile;
  requested: ProfileRequest;
  /** The richest profile this device turned out to support. */
  detected: ProfileId;
  /** Plain words about something the viewer is *missing* on this device. */
  notice?: string;
  /** Small print beside the device label when the run was pinned to a different profile. */
  targetNote?: string;
  /** Offered on the start screen as one-tap links, so nobody edits a URL on a headset. */
  alternatives: ProfileAlternative[];
  sim: SimMode;
}

/** Poorest to richest. "Richer" means it can do everything the one before it can, and more. */
const RANK: ProfileId[] = ['phone-camera', 'phone-webxr', 'headset-webxr'];
const rank = (id: ProfileId) => RANK.indexOf(id);

export function simMode(search = location.search): SimMode {
  const v = new URLSearchParams(search).get('sim');
  if (v === '1' || v === 'phone') return 'phone';
  if (v === 'headset') return 'headset';
  if (v === 'phone-ar') return 'phone-ar';
  return null;
}

export async function selectProfile(): Promise<ProfileSelection> {
  const params = new URLSearchParams(location.search);
  const override = params.get('profile') as ProfileId | null;
  const pinned = (import.meta.env.VITE_DEVICE_PROFILE || 'auto') as ProfileRequest;
  const requested: ProfileRequest = override || pinned;
  const sim = simMode();

  // The laptop preview of the phone view: no device, no detection.
  if (sim === 'phone') {
    return {
      profile: new PhoneCameraProfile({ simulate: true }),
      requested,
      detected: 'phone-camera',
      alternatives: [],
      sim,
      notice:
        requested !== 'auto' && requested !== 'phone-camera'
          ? 'This is the laptop preview of the phone view. Open the same link on the device, or use "Preview as headset".'
          : undefined,
    };
  }

  // With an emulator installed (?sim=headset / ?sim=phone-ar) detection below finds the emulated device.
  const detected = await detect(navigator, sim);

  let target: ProfileId;
  let notice: string | undefined;
  if (override) {
    target = rank(detected) >= rank(override) ? override : detected;
    if (target !== override) notice = downgradeNotice(override, detected);
  } else if (requested === 'auto' || requested === detected || rank(detected) > rank(requested)) {
    // The device does what it can. Running on a better device than the run was pinned to is not a
    // loss and gets no notice: the phone and the headset are equal citizens here.
    target = detected;
  } else {
    target = detected;
    notice = downgradeNotice(requested, detected);
  }

  const profile = await build(target, sim);
  const targetNote = requested !== 'auto' && requested !== target ? `designed for ${requested}` : undefined;
  return { profile, requested, detected, notice, targetNote, alternatives: alternativesFor(target, detected), sim };
}

export interface DetectEnv {
  xr?: { isSessionSupported(mode: string): Promise<boolean> };
  userAgent: string;
  maxTouchPoints?: number;
}

const HEADSET_UA = /OculusBrowser|Quest|Pico|Android XR|VisionOS|Vision Pro|XREAL/i;
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i;

/**
 * What this device can really do. The only honest signal we have before a session exists.
 * `immersive-ar` alone is not enough: Chrome on an ARCore phone also reports `immersive-vr`
 * (Cardboard), and a headset browser also reports a touch screen. The user agent breaks the tie.
 */
export async function detect(env: DetectEnv, sim: SimMode = null): Promise<ProfileId> {
  if (sim === 'headset') return 'headset-webxr';
  if (sim === 'phone-ar') return 'phone-webxr';
  const xr = env.xr;
  if (!xr?.isSessionSupported) return 'phone-camera';
  const ar = await xr.isSessionSupported('immersive-ar').catch(() => false);
  const headsetUA = HEADSET_UA.test(env.userAgent);
  if (!ar) {
    // Vision Pro: immersive-vr only, no passthrough. Still a headset.
    const vr = await xr.isSessionSupported('immersive-vr').catch(() => false);
    return vr && headsetUA ? 'headset-webxr' : 'phone-camera';
  }
  if (headsetUA) return 'headset-webxr';
  if (MOBILE_UA.test(env.userAgent)) return 'phone-webxr';
  // Desktop browser with an XR runtime (emulator, PC VR): treat it as a headset.
  return 'headset-webxr';
}

async function build(id: ProfileId, sim: SimMode): Promise<DeviceProfile> {
  try {
    if (id === 'headset-webxr') {
      const { createHeadsetWebXRProfile } = await import('./headset-webxr');
      return await createHeadsetWebXRProfile({ simulated: sim === 'headset' });
    }
    if (id === 'phone-webxr') {
      const { createPhoneWebXRProfile } = await import('./phone-webxr');
      return await createPhoneWebXRProfile({ simulated: sim === 'phone-ar' });
    }
  } catch (e) {
    console.warn(`[profiles] ${id} could not be prepared, using the phone camera view`, e);
  }
  return new PhoneCameraProfile();
}

function downgradeNotice(requested: ProfileId, detected: ProfileId): string {
  if (requested === 'headset-webxr' && detected === 'phone-webxr')
    return 'This is a phone, not a headset. Running the phone AR version: objects still stick to real surfaces, but you tap instead of pinch.';
  if (requested === 'headset-webxr')
    return 'This device has no headset AR, so you get the phone camera view: objects float in front of you instead of sitting in the room.';
  return 'This phone cannot find surfaces (iPhone, or no AR support). Objects float at a fixed distance instead.';
}

/** Other ways to see the same demo on this device, offered as links on the start screen. */
function alternativesFor(running: ProfileId, detected: ProfileId): ProfileAlternative[] {
  const out: ProfileAlternative[] = [];
  if (running !== 'phone-camera') out.push({ id: 'phone-camera', label: 'See the flat phone version instead' });
  if (running === 'headset-webxr' && rank(detected) >= rank('phone-webxr'))
    out.push({ id: 'phone-webxr', label: 'Use the phone AR version' });
  if (running === 'phone-camera' && detected !== 'phone-camera')
    out.push({
      id: detected,
      label: detected === 'headset-webxr' ? 'Open it in the room instead' : 'Put objects on real surfaces instead',
    });
  return out;
}
