// The active profile and render context, for blocks that need the camera, the scene or the
// device's capabilities. Set once by core; read-only everywhere else.
import type { DeviceProfile, ProfileContext } from './profiles/Profile';

let profile: DeviceProfile | null = null;
let ctx: ProfileContext | null = null;
const readyCbs: (() => void)[] = [];
let isReady = false;

export function setRuntime(p: DeviceProfile, c: ProfileContext) {
  profile = p;
  ctx = c;
  p.ready.then(() => {
    isReady = true;
    for (const cb of readyCbs.splice(0)) cb();
  });
}

export function getRuntime(): { profile: DeviceProfile; ctx: ProfileContext } {
  if (!profile || !ctx) throw new Error('The runtime is not started yet. Call blocks from inside startExperience().');
  return { profile, ctx };
}

export function hasRuntime(): boolean {
  return !!profile && !!ctx;
}

/** Runs once the device knows where the viewer is (immediately if it already does). */
export function whenReady(cb: () => void) {
  if (isReady) cb();
  else readyCbs.push(cb);
}
