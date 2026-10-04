/**
 * @block interact
 * One vocabulary for every device. A tap on a phone, a pinch or trigger in a headset, a click on
 * the laptop all arrive as `onSelect`. Each function returns a function that removes the handler.
 * @option onSelect(object | 'anywhere', cb) — cb gets { object, point, pointerId, kind }
 * @option onPoint(object, { enter, leave, dwellMs?, dwell?, progress? }) — the device (or a hand) is aimed at the object; dwell fires after `dwellMs` (default 1500) of steady aim
 * @option onLongPress(object | 'anywhere', cb, { ms? = 750, progress? }) — hold the select; suppresses the plain select
 * @option onPoke(object, { touch, release }) — a fingertip touches the object (headset); a select stands in elsewhere
 */
import * as THREE from 'three';
import type { PointerEvent as XPointerEvent } from '@pmndrs/pointer-events';
import { onFrame } from '../runtime/loop';
import { getRuntime } from '../runtime/state';
import { getGazePointer, pointerKindOf, on, off, type PointerKind } from '../runtime/interaction';
import { GazeDwell } from '../runtime/vendor/xrblocks/GazeDwell';
import { theme } from './ui/theme';

export type Target = THREE.Object3D | 'anywhere';

export interface SelectEvent {
  /** The object the handler was registered on (the scene for 'anywhere'). */
  object: THREE.Object3D;
  point: THREE.Vector3;
  pointerId: number;
  kind: PointerKind;
  /** The hand that did it, when known. */
  hand: 'left' | 'right' | 'none';
}

const longPressFired = new WeakMap<THREE.Object3D, Set<number>>();

function toSelect(obj: THREE.Object3D, e: XPointerEvent): SelectEvent {
  return { object: obj, point: e.point.clone(), pointerId: e.pointerId, kind: pointerKindOf(e.pointerType), hand: handOf(e) };
}
function handOf(e: XPointerEvent): 'left' | 'right' | 'none' {
  const h = (e.pointerState as any)?.hand;
  return h === 'left' || h === 'right' ? h : 'none';
}

/** Tap (phone), pinch or trigger (headset), click (laptop) on an object. `'anywhere'` = on nothing. */
export function onSelect(target: Target, cb: (e: SelectEvent) => void): () => void {
  const { ctx } = getRuntime();
  const obj = target === 'anywhere' ? ctx.scene : target;
  const handler = (e: XPointerEvent) => {
    if (target === 'anywhere' && e.object.isVoidObject !== true) return;
    if (e.pointerType === 'gaze') return;
    const fired = longPressFired.get(obj);
    if (fired?.has(e.pointerId)) {
      fired.delete(e.pointerId);
      return;
    }
    cb(toSelect(obj, e));
  };
  on(obj, 'click', handler);
  return () => off(obj, 'click', handler);
}

export interface PointHandlers {
  enter?: (e: SelectEvent) => void;
  leave?: () => void;
  /** Hold the aim this long and `dwell` fires once. Resets when the aim moves fast, not when it trembles. */
  dwellMs?: number;
  dwell?: (e: SelectEvent) => void;
  /** 0–1 every frame while dwelling, so the scene can show a ring filling. */
  progress?: (p: number) => void;
}

/**
 * The viewer aims the phone, their gaze or a hand ray at an object. A finger on a screen does not
 * count as aiming. With `dwellMs` it becomes hold-to-choose.
 */
export function onPoint(object: THREE.Object3D, handlers: PointHandlers): () => void {
  const hovering = new Set<number>();
  let lastEnter: XPointerEvent | null = null;
  const enter = (e: XPointerEvent) => {
    if (pointerKindOf(e.pointerType) === 'screen') return;
    const was = hovering.size;
    hovering.add(e.pointerId);
    lastEnter = e;
    if (was === 0) handlers.enter?.(toSelect(object, e));
  };
  const leave = (e: XPointerEvent) => {
    if (!hovering.delete(e.pointerId)) return;
    if (hovering.size === 0) handlers.leave?.();
  };
  on(object, 'pointerenter', enter);
  on(object, 'pointerleave', leave);

  let stopFrame: (() => void) | null = null;
  if (handlers.dwellMs || handlers.dwell) {
    const dwell = new GazeDwell();
    const seconds = (handlers.dwellMs ?? theme.interact.dwellMs) / 1000;
    stopFrame = onFrame((dt) => {
      const gaze = getGazePointer();
      if (!gaze) return;
      const hit = gaze.getIntersection();
      const isOn = !!hit && hovering.has(gaze.id) && isInside(hit.object, object);
      const r = dwell.update(gaze.id, isOn ? object : undefined, isOn ? hit!.point : undefined, dt, false, seconds);
      handlers.progress?.(r.progress);
      if (r.completed && lastEnter) handlers.dwell?.(toSelect(object, lastEnter));
    });
  }
  return () => {
    off(object, 'pointerenter', enter);
    off(object, 'pointerleave', leave);
    stopFrame?.();
  };
}

function isInside(o: THREE.Object3D | null, root: THREE.Object3D): boolean {
  for (; o; o = o.parent) if (o === root) return true;
  return false;
}

/** Hold the select on an object. The plain select for that press is swallowed. */
export function onLongPress(
  target: Target,
  cb: (e: SelectEvent) => void,
  opts: { ms?: number; progress?: (p: number) => void } = {},
): () => void {
  const object = target === 'anywhere' ? getRuntime().ctx.scene : target;
  const ms = opts.ms ?? theme.interact.longPressMs;
  let held: { e: XPointerEvent; since: number; fired: boolean } | null = null;
  const down = (e: XPointerEvent) => {
    if (e.pointerType === 'gaze') return;
    if (target === 'anywhere' && e.object.isVoidObject !== true) return;
    held = { e, since: performance.now(), fired: false };
  };
  const release = (e: XPointerEvent) => {
    if (held && held.e.pointerId === e.pointerId) {
      held = null;
      opts.progress?.(0);
    }
  };
  on(object, 'pointerdown', down);
  on(object, 'pointerup', release);
  on(object, 'pointerleave', release);
  on(object, 'pointercancel', release);
  const stopFrame = onFrame(() => {
    if (!held || held.fired) return;
    const p = Math.min(1, (performance.now() - held.since) / ms);
    opts.progress?.(p);
    if (p >= 1) {
      held.fired = true;
      let set = longPressFired.get(object);
      if (!set) longPressFired.set(object, (set = new Set()));
      set.add(held.e.pointerId);
      cb(toSelect(object, held.e));
    }
  });
  return () => {
    off(object, 'pointerdown', down);
    off(object, 'pointerup', release);
    off(object, 'pointerleave', release);
    off(object, 'pointercancel', release);
    stopFrame();
  };
}

export interface PokeHandlers {
  /** The fingertip made contact: give feedback now. */
  touch?: (e: SelectEvent) => void;
  /** The finger came out again: the action belongs here. */
  release?: (e: SelectEvent) => void;
}

/**
 * Touch a thing in the room with a fingertip (hand tracking). Where there is no fingertip in the
 * room — a phone, a controller, the laptop — a select on the object fires touch then release.
 */
export function onPoke(object: THREE.Object3D, handlers: PokeHandlers): () => void {
  const down = (e: XPointerEvent) => {
    if (pointerKindOf(e.pointerType) === 'touch') handlers.touch?.(toSelect(object, e));
  };
  const up = (e: XPointerEvent) => {
    if (pointerKindOf(e.pointerType) === 'touch') handlers.release?.(toSelect(object, e));
  };
  const click = (e: XPointerEvent) => {
    const kind = pointerKindOf(e.pointerType);
    if (kind === 'touch' || kind === 'gaze') return;
    const se = toSelect(object, e);
    handlers.touch?.(se);
    handlers.release?.(se);
  };
  on(object, 'pointerdown', down);
  on(object, 'pointerup', up);
  on(object, 'click', click);
  return () => {
    off(object, 'pointerdown', down);
    off(object, 'pointerup', up);
    off(object, 'click', click);
  };
}
