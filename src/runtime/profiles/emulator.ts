// Desktop emulation of a headset or an AR phone with IWER, so the WebXR profiles can be tried
// and tested without a device. Imported only in dev builds, before the profile is detected.
//   ?sim=headset   Meta Quest 3: passthrough (synthetic room), hands or controllers, hit-test
//   ?sim=phone-ar  the same runtime presenting as an AR phone, to exercise phone-webxr
import { XRDevice, metaQuest3 } from 'iwer';

export type EmulatorMode = 'headset' | 'phone-ar';

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';

export async function installEmulator(mode: EmulatorMode): Promise<XRDevice> {
  const config =
    mode === 'headset'
      ? metaQuest3
      : { ...metaQuest3, name: 'Emulated AR phone', supportedSessionModes: ['inline', 'immersive-ar'] as any, userAgent: ANDROID_UA };
  const device = new XRDevice(config as any, { stereoEnabled: false });
  // Desktop Chrome exposes a native navigator.xr with no device behind it; the emulator must win.
  device.installRuntime({ forceInstall: true });
  // A room to stand in: planes and meshes for hit-test, a passthrough-like backdrop.
  try {
    const { SyntheticEnvironmentModule } = await import('@iwer/sem');
    device.installSEM(SyntheticEnvironmentModule as any);
    await device.sem?.loadDefaultEnvironment('meeting_room');
  } catch (e) {
    console.warn('[emulator] synthetic environment unavailable; hit-test will find nothing', e);
  }
  if (mode === 'headset') {
    try {
      const { DevUI } = await import('@iwer/devui');
      device.installDevUI(DevUI as any);
    } catch (e) {
      console.warn('[emulator] dev UI unavailable', e);
    }
  }
  (window as any).__xrDevice = device;
  return device;
}
