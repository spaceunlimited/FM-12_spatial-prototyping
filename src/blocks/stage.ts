/**
 * @block stage
 * Where content starts. `stage` is a group placed 1.5 m ahead of the viewer, 0.15 m below eye
 * height, facing them, as soon as the device knows where the viewer is. Add things to it and
 * they arrive at a comfortable spot on every device. `recenter()` moves it back in front of
 * wherever the viewer is looking now.
 * @option distance number = 1.5 — metres ahead (recenter option)
 * @option heightOffset number = -0.15 — metres relative to eye height (recenter option)
 */
import * as THREE from 'three';
import { theme } from './ui/theme';
import { onFrame } from '../runtime/loop';
import { getRuntime, whenReady } from '../runtime/state';

export const stage = new THREE.Group();
stage.name = 'stage';

export interface StagePose {
  distance?: number;
  heightOffset?: number;
}

const _eye = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

/** Position and orientation for something `distance` ahead of the camera, facing it, upright. */
export function poseInFront(camera: THREE.Camera, opts: StagePose = {}): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const distance = opts.distance ?? theme.distance;
  const heightOffset = opts.heightOffset ?? theme.heightOffset;
  camera.getWorldPosition(_eye);
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  _pos.copy(_eye).addScaledVector(_fwd, distance);
  _pos.y = _eye.y + heightOffset;
  // +Z of the stage points at the viewer, so panels on it face them.
  _look.copy(_eye).setY(_pos.y);
  const m = new THREE.Matrix4().lookAt(_look, _pos, new THREE.Vector3(0, 1, 0));
  return { position: _pos.clone(), quaternion: new THREE.Quaternion().setFromRotationMatrix(m) };
}

let anim: { from: THREE.Vector3; to: THREE.Vector3; qFrom: THREE.Quaternion; qTo: THREE.Quaternion; t: number } | null = null;
let stopAnim: (() => void) | null = null;

/** Put the stage back in front of the viewer, eased over 260 ms. Immediate at first placement. */
export function recenter(opts: StagePose & { immediate?: boolean } = {}) {
  const { ctx } = getRuntime();
  const pose = poseInFront(ctx.camera, opts);
  if (opts.immediate || !stage.parent) {
    stage.position.copy(pose.position);
    stage.quaternion.copy(pose.quaternion);
    return;
  }
  anim = { from: stage.position.clone(), to: pose.position, qFrom: stage.quaternion.clone(), qTo: pose.quaternion, t: 0 };
  stopAnim?.();
  stopAnim = onFrame((dt) => {
    if (!anim) return;
    anim.t = Math.min(1, anim.t + (dt * 1000) / theme.appearMs);
    const e = 1 - Math.pow(1 - anim.t, 3);
    stage.position.lerpVectors(anim.from, anim.to, e);
    stage.quaternion.slerpQuaternions(anim.qFrom, anim.qTo, e);
    if (anim.t >= 1) {
      anim = null;
      stopAnim?.();
      stopAnim = null;
    }
  });
}

/** Called by core: adds the stage to the scene and places it on the first tracked frame. */
export function initStage(scene: THREE.Scene) {
  scene.add(stage);
  whenReady(() => recenter({ immediate: true }));
}
