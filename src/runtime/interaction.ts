// The pointer layer. Every way of pointing — a finger on the screen, the phone's centre, a hand
// ray, a controller ray, a fingertip — is a @pmndrs/pointer-events Pointer. They all emit the same
// W3C-style events (pointerenter, pointerdown, click, …) on three.js objects, which is what the
// interaction blocks and the uikit-based UI listen for. Experience code never raycasts.
import * as THREE from 'three';
import { forwardHtmlEvents, createRayPointer, type Pointer, type CombinedPointer, type AllowedPointerEvents, type PointerEvent as XPointerEvent } from '@pmndrs/pointer-events';
import type { DeviceProfile, ProfileContext } from './profiles/Profile';
import { isObjectTreeVisible } from './vendor/iwsdk/visibility';

export type PointerKind = 'screen' | 'gaze' | 'ray' | 'grab' | 'touch';
export type Hand = 'left' | 'right' | 'none';

export interface PointerEntry {
  pointer: Pointer | CombinedPointer;
  kind: PointerKind;
  hand: Hand;
  /** The object whose world transform drives this pointer (hand ray space, camera, …). */
  space?: THREE.Object3D;
}

let profile: DeviceProfile | null = null;
let ctx: ProfileContext | null = null;
let html: ReturnType<typeof forwardHtmlEvents> | null = null;
const entries: PointerEntry[] = [];
/** Pointers currently moving an object, so look-around and other fallbacks leave them alone. */
const busy = new Set<number>();

/** Hidden objects (or uikit nodes hidden through their own visibility) are never hit. */
export function visibleFilter(object: THREE.Object3D, _pe: AllowedPointerEvents): boolean {
  return isObjectTreeVisible(object);
}

const POINTER_OPTIONS = { filter: visibleFilter, clickThresholdMs: 400 };

/** Called by core once the profile has started. */
export function initInteraction(p: DeviceProfile, c: ProfileContext) {
  profile = p;
  ctx = c;
  // A screen (phone without WebXR, laptop preview): mouse and touch events from the canvas.
  if (!p.immersive) html = forwardHtmlEvents(c.canvas, () => c.camera, c.scene, POINTER_OPTIONS);
  // The gaze pointer: what the device itself is looking at. The phone's screen centre, the
  // headset's head direction. It hovers but never selects.
  const gaze = createRayPointer(() => c.camera, { current: c.camera }, {}, { ...POINTER_OPTIONS, minDistance: 0.05 }, 'gaze');
  entries.push({ pointer: gaze, kind: 'gaze', hand: 'none', space: c.camera });
  p.onExit?.(() => {
    for (const e of entries) if ('exit' in e.pointer) e.pointer.exit({ timeStamp: performance.now() });
    busy.clear();
  });
}

/** WebXR profiles add one entry per hand/controller pointer; core removes them on exit. */
export function registerPointer(entry: PointerEntry): () => void {
  entries.push(entry);
  return () => unregisterPointer(entry.pointer);
}

export function unregisterPointer(pointer: Pointer | CombinedPointer) {
  const i = entries.findIndex((e) => e.pointer === pointer);
  if (i < 0) return;
  const p = entries[i].pointer;
  if ('exit' in p) p.exit({ timeStamp: performance.now() });
  entries.splice(i, 1);
}

export function getPointerEntries(): readonly PointerEntry[] {
  return entries;
}

export function getPointerEntry(pointerId: number): PointerEntry | undefined {
  return entries.find((e) => 'id' in e.pointer && e.pointer.id === pointerId);
}

/** A block took hold of an object with this pointer (drag). Fallbacks such as look-around check it. */
export function setPointerBusy(pointerId: number, isBusy: boolean) {
  if (isBusy) busy.add(pointerId);
  else busy.delete(pointerId);
}
export function isPointerBusy(pointerId: number): boolean {
  return busy.has(pointerId);
}

/** Called by core every frame, before the UI and the experience callbacks. */
export function updateInteraction() {
  if (!profile || !ctx) return;
  const nativeEvent = { timeStamp: performance.now() };
  html?.update();
  // In a headset the gaze yields to hands and controllers: hovering by head direction while a
  // hand ray is out would light up two things at once.
  const gaze = entries.find((e) => e.kind === 'gaze');
  if (gaze && profile.immersive) (gaze.pointer as Pointer).setEnabled((profile.trackedPointerCount?.() ?? 0) === 0, nativeEvent);
  for (const e of entries) e.pointer.move(ctx.scene, nativeEvent);
  const hit = (gaze?.pointer as Pointer | undefined)?.getIntersection();
  profile.setReticleHot?.(!!hit && hit.object.isVoidObject !== true);
}

/** The gaze pointer, for blocks that want to know what the device itself is aimed at. */
export function getGazePointer(): Pointer | undefined {
  return entries.find((e) => e.kind === 'gaze')?.pointer as Pointer | undefined;
}

/** Which kind of pointer an event came from, by its pointerType string. */
export function pointerKindOf(pointerType: string): PointerKind {
  if (pointerType.startsWith('screen-')) return 'screen';
  if (pointerType === 'gaze') return 'gaze';
  if (pointerType === 'grab') return 'grab';
  if (pointerType === 'touch') return 'touch';
  return 'ray';
}

/**
 * Listen for a pointer event on an object; `off` removes it again. Typed by hand on purpose: uikit
 * and pointer-events both augment three's Object3DEventMap with their own event type, and which
 * one TypeScript picks depends on the order files enter the program. The events are the same at
 * runtime, so the blocks name the pointer-events type and stay out of that fight.
 */
export function on(object: THREE.Object3D, name: PointerEventName, cb: (e: XPointerEvent) => void) {
  object.addEventListener(name as never, cb as never);
}
export function off(object: THREE.Object3D, name: PointerEventName, cb: (e: XPointerEvent) => void) {
  object.removeEventListener(name as never, cb as never);
}
export type PointerEventName = 'pointerdown' | 'pointerup' | 'pointermove' | 'pointercancel' | 'pointerenter' | 'pointerleave' | 'pointerover' | 'pointerout' | 'click' | 'dblclick' | 'contextmenu';
