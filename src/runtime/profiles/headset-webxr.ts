// headset-webxr: WebXR immersive-ar with passthrough, hands and controllers (Quest 3, Android XR).
// On Vision Pro, which offers immersive-vr only, the same profile runs in VR with a neutral room.
import type { DeviceProfile, ProfileContext } from './Profile';
import { WebXRProfile } from './webxr-base';

class HeadsetWebXRProfile extends WebXRProfile {
  constructor(opts: { simulated?: boolean }) {
    super({
      id: 'headset-webxr',
      label: opts.simulated ? 'Headset (emulator)' : 'Headset passthrough',
      startHint: 'Put the headset on. Point with a hand and pinch to select; pinch and move to drag; touch things with a fingertip.',
      startButtonLabel: 'Enter the room',
      capabilities: {
        positionalTracking: true,
        surfaceHitTest: true,
        hands: false,
        controllers: false,
        passthrough: true,
        touch: false,
        orientation: true,
        simulated: !!opts.simulated,
      },
      placementStrategies: ['surface', 'front', 'hand'],
      simulated: opts.simulated,
    });
  }

  protected async chooseMode(xr: XRSystem) {
    const ar = await xr.isSessionSupported('immersive-ar').catch(() => false);
    if (ar) return 'immersive-ar' as XRSessionMode;
    // Vision Pro and PC VR: no passthrough. Run in VR and give the viewer a room to stand in.
    this.capabilities.passthrough = false;
    this.label = 'Headset (VR)';
    return 'immersive-vr' as XRSessionMode;
  }

  async start(ctx: ProfileContext) {
    await super.start(ctx);
    if (this.mode === 'immersive-vr') {
      try {
        const { loadSimRoom } = await import('./sim-room');
        const room = await loadSimRoom(ctx.renderer, '/sim/brown_photostudio_02_1k.hdr', { passes: 1 });
        ctx.scene.background = room.background;
        ctx.scene.environment = room.environment;
      } catch (e) {
        console.warn('[headset-webxr] no room panorama for VR mode', e);
      }
    }
  }
}

export async function createHeadsetWebXRProfile(opts: { simulated?: boolean } = {}): Promise<DeviceProfile> {
  return new HeadsetWebXRProfile(opts);
}
