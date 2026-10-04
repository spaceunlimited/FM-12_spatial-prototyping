// phone-webxr: WebXR immersive-ar on Android Chrome with ARCore. The phone knows where it is in
// the room; objects go on real surfaces; the DOM overlay keeps notices visible.
import type { DeviceProfile, ProfileContext } from './Profile';
import { WebXRProfile } from './webxr-base';

class PhoneWebXRProfile extends WebXRProfile {
  constructor(opts: { simulated?: boolean }) {
    super({
      id: 'phone-webxr',
      label: opts.simulated ? 'Phone AR (emulator)' : 'Phone AR (surfaces)',
      startHint: 'Hold the phone up and move it slowly so it can find the floor and tables. Tap to select, drag to move.',
      startButtonLabel: 'Start in AR',
      capabilities: {
        positionalTracking: true,
        surfaceHitTest: true,
        hands: false,
        controllers: false,
        passthrough: false,
        touch: true,
        orientation: true,
        simulated: !!opts.simulated,
      },
      placementStrategies: ['surface', 'front'],
      optionalFeatures: ['dom-overlay'],
      simulated: opts.simulated,
    });
  }
  protected extraSessionInit(ctx: ProfileContext) {
    return { domOverlay: { root: ctx.overlay } } as Partial<XRSessionInit>;
  }
}

export async function createPhoneWebXRProfile(opts: { simulated?: boolean } = {}): Promise<DeviceProfile> {
  return new PhoneWebXRProfile(opts);
}
