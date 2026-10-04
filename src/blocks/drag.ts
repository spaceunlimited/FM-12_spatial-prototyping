/**
 * @block draggable
 * Pick up, move and drop any object: one finger on a phone, pinch-and-move or a trigger in a
 * headset. The object keeps the point where it was grabbed, so it never jumps into the hand.
 * Two tracked pointers on the same object scale it.
 * @option scale boolean = true — two-hand pinch scaling, 0.25–4× of the original size
 * @option rotate boolean = false — two-hand yaw rotation
 * @option onMove (object) => void — every frame while held
 * @option onDrop (object) => void — released
 * @returns () => void — stop being draggable
 */
import * as THREE from 'three';
import type { PointerEvent as XPointerEvent } from '@pmndrs/pointer-events';
import { setPointerBusy, on, off } from '../runtime/interaction';
import { theme } from './ui/theme';

export interface DragOptions {
  scale?: boolean;
  rotate?: boolean;
  onMove?: (object: THREE.Object3D) => void;
  onDrop?: (object: THREE.Object3D) => void;
}

interface Grip {
  /** World-space vector from the grabbed point to the object's origin, kept for the whole drag. */
  offset: THREE.Vector3;
  /** Where this pointer's grabbed point is now, in world space. */
  point: THREE.Vector3;
  pointerPosition: THREE.Vector3;
}

const _world = new THREE.Vector3();
const _pos = new THREE.Vector3();

export function draggable(object: THREE.Object3D, opts: DragOptions = {}): () => void {
  const grips = new Map<number, Grip>();
  let startScale = object.scale.clone();
  let spanAtGrab: number | null = null;
  let yawAtGrab = 0;
  let objectYawAtGrab = 0;
  /** Two hands: the object's origin relative to the midpoint between the hands, at the moment the second hand joined. */
  const midOffset = new THREE.Vector3();
  const _mid = new THREE.Vector3();

  const down = (e: XPointerEvent) => {
    if (e.pointerType === 'gaze') return;
    e.stopPropagation();
    object.setPointerCapture(e.pointerId);
    setPointerBusy(e.pointerId, true);
    object.getWorldPosition(_world);
    grips.set(e.pointerId, {
      offset: _world.clone().sub(e.point),
      point: e.point.clone(),
      pointerPosition: e.pointerPosition.clone(),
    });
    if (grips.size === 2) spanAtGrab = null; // the first two-hand frame records the baseline
  };

  const move = (e: XPointerEvent) => {
    const g = grips.get(e.pointerId);
    if (!g) return;
    g.point.copy(e.point);
    g.pointerPosition.copy(e.pointerPosition);
    const [first] = grips.keys();
    if (e.pointerId !== first) return; // one update per frame, on the first hand's event
    if (grips.size >= 2) {
      twoHanded();
    } else {
      _pos.copy(g.point).add(g.offset);
      if (object.parent) object.parent.worldToLocal(_pos);
      object.position.copy(_pos);
    }
    opts.onMove?.(object);
  };

  // Two hands: the object hangs between them. It moves with the midpoint, scales about the
  // midpoint (not about one hand), and optionally turns with the line between the hands.
  const twoHanded = () => {
    const [a, b] = [...grips.values()];
    const span = a.pointerPosition.distanceTo(b.pointerPosition);
    if (span < 0.02) return; // two fingers on one screen share an origin: nothing to scale by
    _mid.addVectors(a.pointerPosition, b.pointerPosition).multiplyScalar(0.5);
    const yaw = Math.atan2(b.pointerPosition.x - a.pointerPosition.x, b.pointerPosition.z - a.pointerPosition.z);
    if (spanAtGrab === null) {
      spanAtGrab = span;
      yawAtGrab = yaw;
      objectYawAtGrab = object.rotation.y;
      startScale.copy(object.scale);
      object.getWorldPosition(_world);
      midOffset.copy(_world).sub(_mid);
      return;
    }
    let factor = 1;
    if (opts.scale !== false) {
      factor = THREE.MathUtils.clamp(span / spanAtGrab, theme.interact.scaleMin, theme.interact.scaleMax);
      object.scale.copy(startScale).multiplyScalar(factor);
    }
    if (opts.rotate) object.rotation.y = objectYawAtGrab + (yaw - yawAtGrab);
    _pos.copy(_mid).addScaledVector(midOffset, factor);
    if (object.parent) object.parent.worldToLocal(_pos);
    object.position.copy(_pos);
  };

  const up = (e: XPointerEvent) => {
    if (!grips.delete(e.pointerId)) return;
    object.releasePointerCapture(e.pointerId);
    setPointerBusy(e.pointerId, false);
    if (grips.size < 2) spanAtGrab = null;
    if (grips.size === 1) {
      // Back to one hand: re-anchor to it so the object does not jump to where it was first grabbed.
      const [g] = grips.values();
      object.getWorldPosition(_world);
      g.offset.copy(_world).sub(g.point);
    }
    if (grips.size === 0) opts.onDrop?.(object);
  };

  on(object, 'pointerdown', down);
  on(object, 'pointermove', move);
  on(object, 'pointerup', up);
  on(object, 'pointercancel', up);
  return () => {
    for (const id of grips.keys()) {
      object.releasePointerCapture(id);
      setPointerBusy(id, false);
    }
    grips.clear();
    off(object, 'pointerdown', down);
    off(object, 'pointermove', move);
    off(object, 'pointerup', up);
    off(object, 'pointercancel', up);
  };
}
