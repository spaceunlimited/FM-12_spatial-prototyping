/**
 * @block place
 * Put an object into the room. On a surface where the device can find one (hit-test), otherwise
 * floating in front of the viewer. Says what it did in plain words, and makes the object
 * draggable so the viewer can nudge it.
 * @option strategy 'auto' | 'surface' | 'front' | 'hand' = 'auto' — auto = surface if the device can, else front
 * @option distance number = 1.5 — metres ahead, for 'front'
 * @option heightOffset number = -0.15 — metres relative to eye height, for 'front'
 * @option adjustable boolean = true — viewer can drag it afterwards
 * @option onPlaced (result) => void — called once the object is in place (async on headsets)
 * @returns { used, fellBack, explanation }
 */
import * as THREE from 'three';
import type { PlacementStrategy } from '../runtime/profiles/Profile';
import { getRuntime, whenReady } from '../runtime/state';
import { onFrame } from '../runtime/loop';
import { draggable } from './drag';
import { poseInFront } from './stage';
import { theme } from './ui/theme';

// A phone has to look around for a second before it knows where the table is; a headset knows
// at once. Either way we wait this long for a surface before floating the object instead.
const SURFACE_WAIT_MS = 6000;
// A surface only counts when it is where the viewer could reasonably want the object: facing up
// (a floor or a table, never a wall), not too far, and below eye height.
const SURFACE_MIN_M = 0.4;
const SURFACE_MAX_M = 3;
const SURFACE_MIN_UP = 0.7; // cos ≈ 45°: how upward-facing the surface normal must be

export interface PlaceOptions {
  strategy?: PlacementStrategy | 'auto';
  distance?: number;
  heightOffset?: number;
  adjustable?: boolean;
  onPlaced?: (result: PlaceResult) => void;
}
export interface PlaceResult {
  requested: PlacementStrategy | 'auto';
  used: PlacementStrategy;
  fellBack: boolean;
  /** Plain words about where the object ended up and why. */
  explanation: string;
}

export function place(object: THREE.Object3D, opts: PlaceOptions = {}): PlaceResult {
  const { profile, ctx } = getRuntime();
  const requested = opts.strategy ?? 'auto';
  const available = profile.placementStrategies;
  let used: PlacementStrategy;
  if (requested === 'auto') used = available.includes('surface') ? 'surface' : 'front';
  else used = available.includes(requested) ? requested : 'front';
  const distance = opts.distance ?? undefined;
  const result: PlaceResult = { requested, used, fellBack: requested !== 'auto' && used !== requested, explanation: '' };
  result.explanation = explain(used, requested, distance);

  const finish = (strategy: PlacementStrategy) => {
    result.used = strategy;
    result.fellBack = requested !== 'auto' && strategy !== requested;
    result.explanation = explain(strategy, requested, distance);
    if (strategy !== 'hand' && opts.adjustable !== false) draggable(object);
    opts.onPlaced?.(result);
  };

  const inFront = () => {
    const pose = poseInFront(ctx.camera, { distance: opts.distance, heightOffset: opts.heightOffset });
    if (!object.parent) ctx.scene.add(object);
    const local = object.parent ? object.parent.worldToLocal(pose.position.clone()) : pose.position;
    object.position.copy(local);
    object.quaternion.copy(pose.quaternion);
  };

  whenReady(() => {
    if (used === 'hand') {
      const anchor = profile.getGripAnchor?.();
      if (anchor) {
        anchor.add(object);
        object.position.set(0, 0, -0.06);
        finish('hand');
        return;
      }
      used = available.includes('surface') ? 'surface' : 'front';
    }
    if (used === 'surface' && profile.hitSurface) {
      // Float where the viewer looks while the device looks for a surface; show a ring on the
      // surface it has found; settle there, or give up after a while and stay in front.
      inFront();
      const ring = surfaceRing();
      ctx.scene.add(ring);
      const deadline = performance.now() + SURFACE_WAIT_MS;
      const eye = new THREE.Vector3();
      const stop = onFrame(() => {
        // Where the viewer looks, not where a hand happens to point: that is the surface they mean.
        const vs = profile.viewerSurface?.() ?? null;
        let hit: THREE.Vector3 | null = vs && vs.normal.y >= SURFACE_MIN_UP ? vs.point : null;
        if (!hit && !vs) {
          // No viewer hit-test on this device: fall back to the active ray, orientation unknown.
          const ray = profile.getPointerRay();
          hit = ray ? profile.hitSurface!(ray) : null;
        }
        ctx.camera.getWorldPosition(eye);
        if (hit) {
          const d = hit.distanceTo(eye);
          if (d < SURFACE_MIN_M || d > SURFACE_MAX_M || hit.y > eye.y - 0.1) hit = null;
        }
        ring.visible = !!hit;
        if (hit) ring.position.copy(hit);
        if (hit) {
          const local = object.parent ? object.parent.worldToLocal(hit.clone()) : hit;
          object.position.copy(local);
          object.lookAt(eye.x, hit.y, eye.z);
          cleanup();
          finish('surface');
        } else if (performance.now() > deadline) {
          cleanup();
          finish('front');
        }
      });
      const cleanup = () => {
        stop();
        ring.removeFromParent();
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      };
      return;
    }
    inFront();
    finish('front');
  });
  return result;
}

function surfaceRing(): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.035, 0.044, 32),
    new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.6, depthTest: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 20;
  ring.pointerEvents = 'none';
  ring.visible = false;
  return ring;
}

function explain(used: PlacementStrategy, requested: PlacementStrategy | 'auto', distance?: number): string {
  const d = distance ?? 1.5;
  if (used === 'hand') return 'Held in the viewer’s hand; it moves with them.';
  if (used === 'surface') return 'Placed on the real surface the viewer is pointing at. It stays there when they walk around it.';
  if (requested !== 'auto' && requested !== used)
    return `This device cannot find surfaces, so the object floats about ${d} m in front of the viewer, slightly below eye level. They can drag it.`;
  return `The object floats about ${d} m in front of the viewer, slightly below eye level. They can drag it.`;
}
