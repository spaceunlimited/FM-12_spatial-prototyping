import { describe, expect, it } from 'vitest';
import { detect, simMode } from '../../src/runtime/profiles/select';

const xr = (ar: boolean, vr: boolean) => ({ isSessionSupported: async (m: string) => (m === 'immersive-ar' ? ar : vr) });

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
  quest: 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.0 Chrome/150.0.0.0 VR Safari/537.36',
  androidXR: 'Mozilla/5.0 (Linux; Android 16; Android XR Build) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  visionPro: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15 VisionOS',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
};

describe('profile detection', () => {
  it('iPhone: no navigator.xr → phone-camera', async () => {
    expect(await detect({ userAgent: UA.iphone })).toBe('phone-camera');
  });
  it('Android with ARCore: immersive-ar and immersive-vr (Cardboard) → phone-webxr, not headset', async () => {
    expect(await detect({ xr: xr(true, true), userAgent: UA.android })).toBe('phone-webxr');
  });
  it('Android without AR → phone-camera', async () => {
    expect(await detect({ xr: xr(false, true), userAgent: UA.android })).toBe('phone-camera');
  });
  it('Quest 3 → headset-webxr', async () => {
    expect(await detect({ xr: xr(true, true), userAgent: UA.quest })).toBe('headset-webxr');
  });
  it('Android XR → headset-webxr', async () => {
    expect(await detect({ xr: xr(true, true), userAgent: UA.androidXR })).toBe('headset-webxr');
  });
  it('Vision Pro: immersive-vr only → headset-webxr (VR sub-mode)', async () => {
    expect(await detect({ xr: xr(false, true), userAgent: UA.visionPro })).toBe('headset-webxr');
  });
  it('desktop without XR → phone-camera (the preview)', async () => {
    expect(await detect({ userAgent: UA.desktop })).toBe('phone-camera');
  });
  it('desktop with an XR runtime (emulator) → headset-webxr', async () => {
    expect(await detect({ xr: xr(true, true), userAgent: UA.desktop })).toBe('headset-webxr');
  });
  it('?sim overrides detection', async () => {
    expect(await detect({ userAgent: UA.desktop }, 'headset')).toBe('headset-webxr');
    expect(await detect({ userAgent: UA.desktop }, 'phone-ar')).toBe('phone-webxr');
  });
  it('simMode parses the URL', () => {
    expect(simMode('?sim=1')).toBe('phone');
    expect(simMode('?sim=phone')).toBe('phone');
    expect(simMode('?sim=headset&autostart=1')).toBe('headset');
    expect(simMode('?profile=phone-camera')).toBe(null);
  });
});
