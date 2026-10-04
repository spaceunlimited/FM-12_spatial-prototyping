// Everything the two immersive profiles share: one XR session, one reference space, a
// @pmndrs/pointer-events pointer set per hand, controller or screen touch (ray + grab + fingertip
// touch where there is a hand), the surface hit-test, grip anchors, and the viewer's exit.
//
// Nothing above this file knows what a pinch is. phone-webxr and headset-webxr only declare
// what the device can do; the plumbing is here.
import * as THREE from 'three';
import { CombinedPointer, createGrabPointer, createRayPointer, createTouchPointer, type Pointer } from '@pmndrs/pointer-events';
import type { Capabilities, DeviceProfile, PlacementStrategy, ProfileContext, ProfileId, SurfaceHit } from './Profile';
import { registerPointer, visibleFilter } from '../interaction';
import { bindPointerXRInputSourceEvent } from '../vendor/pmndrs-xr/event';
import { XRSpaceObject } from '../xr/space';
import { ControllerVisual, HandVisual, PointerVisual } from '../xr/visuals';

// Without hand tracking, "the fingertip" is a point this far ahead of the controller's grip.
const CONTROLLER_TIP_AHEAD = 0.05;
// A pinch or trigger counts as a click when released within this time (IWSDK uses 800 ms).
const XR_CLICK_MS = 800;

export interface WebXRProfileConfig {
  id: ProfileId;
  label: string;
  startHint: string;
  startButtonLabel: string;
  capabilities: Capabilities;
  placementStrategies: PlacementStrategy[];
  /** Extra optional session features (e.g. dom-overlay on the phone). */
  optionalFeatures?: string[];
  simulated?: boolean;
}

interface InputRec {
  source: XRInputSource;
  hand: 'left' | 'right' | 'none';
  raySpace: XRSpaceObject;
  gripSpace: XRSpaceObject | null;
  tipSpace: XRSpaceObject | null;
  combined: CombinedPointer;
  rayPointer: Pointer;
  grabPointer: Pointer | null;
  touchPointer: Pointer | null;
  hitTest: XRHitTestSource | null;
  surface: THREE.Vector3 | null;
  visual: PointerVisual;
  handVisual: HandVisual | null;
  controllerVisual: ControllerVisual | null;
  selecting: boolean;
  lastMoveAt: number;
  lastDir: THREE.Vector3;
  unbind: (() => void)[];
}

export abstract class WebXRProfile implements DeviceProfile {
  id: ProfileId;
  label: string;
  startHint: string;
  startButtonLabel: string;
  capabilities: Capabilities;
  placementStrategies: PlacementStrategy[];
  immersive = true;
  hasDomOverlay = false;
  ready: Promise<void>;
  private markReady!: () => void;
  private isReady = false;

  protected ctx!: ProfileContext;
  protected session: XRSession | null = null;
  protected mode: XRSessionMode = 'immersive-ar';
  private config: WebXRProfileConfig;
  private viewerHitTest: XRHitTestSource | null = null;
  private viewerSurfaceHit: SurfaceHit | null = null;
  private inputs: InputRec[] = [];
  private exitCbs: (() => void)[] = [];
  private floorKnown = true;

  constructor(config: WebXRProfileConfig) {
    this.config = config;
    this.id = config.id;
    this.label = config.label;
    this.startHint = config.startHint;
    this.startButtonLabel = config.startButtonLabel;
    this.capabilities = { ...config.capabilities, simulated: !!config.simulated };
    this.placementStrategies = [...config.placementStrategies];
    this.ready = new Promise((r) => (this.markReady = r));
  }

  /** Which session mode to ask for. headset-webxr overrides for Vision Pro (VR only). */
  protected async chooseMode(xr: XRSystem): Promise<XRSessionMode> {
    void xr;
    return 'immersive-ar';
  }

  /** Profiles add session options here (phone-webxr keeps the DOM overlay alive). */
  protected extraSessionInit(_ctx: ProfileContext): Partial<XRSessionInit> {
    return {};
  }

  /** Runs inside the start button's click, where the browser allows us to ask for a session. */
  async start(ctx: ProfileContext) {
    this.ctx = ctx;
    const xr = (navigator as any).xr as XRSystem;
    this.mode = await this.chooseMode(xr);
    const optional = ['local-floor', 'hit-test', 'hand-tracking', 'anchors', ...(this.config.optionalFeatures || [])];
    const session = await xr.requestSession(this.mode, {
      requiredFeatures: [],
      optionalFeatures: optional,
      ...this.extraSessionInit(ctx),
    } as XRSessionInit);
    this.session = session;

    // A headset knows where the floor is; some phones do not. Ask for the better space, fall
    // back to the one that always exists, and remember which we got.
    let spaceType: XRReferenceSpaceType = 'local-floor';
    try {
      await session.requestReferenceSpace('local-floor');
    } catch {
      spaceType = 'local';
      this.floorKnown = false;
    }
    ctx.renderer.xr.enabled = true;
    ctx.renderer.xr.setReferenceSpaceType(spaceType);
    await ctx.renderer.xr.setSession(session);

    // In a session the device reports the real head pose, so the virtual eye height has to go
    // or everything sits a head above where it belongs.
    ctx.viewer.position.set(0, 0, 0);
    ctx.viewer.quaternion.identity();
    document.body.classList.add('xr-session');
    this.hasDomOverlay = !!(session as any).domOverlayState;

    // A surface hit-test along the viewer's own forward ray: the phone's screen centre, the
    // headset's gaze. Pointer rays get their own sources as hands and controllers show up.
    try {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      this.viewerHitTest = (await (session as any).requestHitTestSource?.({ space: viewerSpace })) || null;
    } catch {
      this.viewerHitTest = null;
    }
    this.capabilities.surfaceHitTest = !!this.viewerHitTest;
    if (this.viewerHitTest) {
      if (!this.placementStrategies.includes('surface')) this.placementStrategies.unshift('surface');
    } else {
      this.placementStrategies = this.placementStrategies.filter((s) => s !== 'surface');
    }

    this.syncInputSources(session.inputSources);
    session.addEventListener('inputsourceschange', () => this.syncInputSources(session.inputSources));
    session.addEventListener('end', () => {
      this.session = null;
      this.viewerHitTest = null;
      this.viewerSurfaceHit = null;
      for (const rec of [...this.inputs]) this.removeInput(rec);
      document.body.classList.remove('xr-session');
      for (const cb of this.exitCbs) cb();
    });
  }

  // ---------------------------------------------------------------- input sources → pointers

  private syncInputSources(sources: XRInputSourceArray | readonly XRInputSource[]) {
    const list = Array.from(sources);
    for (const rec of [...this.inputs]) if (!list.includes(rec.source)) this.removeInput(rec);
    for (const source of list) if (!this.inputs.some((r) => r.source === source)) this.addInput(source);
  }

  private addInput(source: XRInputSource) {
    const { scene, camera } = this.ctx;
    const session = this.session!;
    const hand = source.handedness === 'left' || source.handedness === 'right' ? source.handedness : 'none';
    const xrHand = (source as any).hand as XRHand | undefined;
    const isTracked = source.targetRayMode === 'tracked-pointer';
    const state = { hand, source, kind: source.targetRayMode };
    if (xrHand) this.capabilities.hands = true;
    else if (isTracked) this.capabilities.controllers = true;

    const raySpace = new XRSpaceObject(source.targetRaySpace, `ray-${hand}`);
    scene.add(raySpace);
    const gripSpace = source.gripSpace ? new XRSpaceObject(source.gripSpace, `grip-${hand}`) : null;
    if (gripSpace) scene.add(gripSpace);
    let tipSpace: XRSpaceObject | null = null;
    if (xrHand) {
      const tipJoint = (xrHand as any).get?.('index-finger-tip') as XRSpace | undefined;
      if (tipJoint) {
        tipSpace = new XRSpaceObject(tipJoint, `tip-${hand}`);
        scene.add(tipSpace);
      }
    } else if (gripSpace) {
      // A controller has no fingertip; a point just ahead of the grip stands in for poking.
      tipSpace = new XRSpaceObject(source.gripSpace!, `tip-${hand}`);
      scene.add(tipSpace);
    }

    const getCamera = () => camera;
    const combined = new CombinedPointer(false);
    const opts = { filter: visibleFilter, clickThresholdMs: XR_CLICK_MS, contextMenuButton: -1 };
    // The ray is the default pointer; it ignores the first 20 cm so a hand touching something
    // does not also "point" at it.
    const rayPointer = createRayPointer(getCamera, { current: raySpace }, state, { ...opts, minDistance: isTracked ? 0.2 : 0 }, 'ray');
    combined.register(rayPointer, true);
    let grabPointer: Pointer | null = null;
    let touchPointer: Pointer | null = null;
    if (gripSpace && isTracked) {
      grabPointer = createGrabPointer(getCamera, { current: gripSpace }, state, { ...opts, radius: 0.07 }, 'grab');
      combined.register(grabPointer);
    }
    if (tipSpace && isTracked) {
      touchPointer = createTouchPointer(getCamera, { current: tipSpace }, state, { ...opts, hoverRadius: 0.1, downRadius: 0.03 }, 'touch');
      combined.register(touchPointer);
    }

    // WebXR select → pointer down/up. Hands: pinch drives both ray and grab. Controllers: the
    // trigger drives the ray, the squeeze drives the grab.
    const unbind: (() => void)[] = [];
    unbind.push(bindPointerXRInputSourceEvent(rayPointer, session, source, 'select', [], { button: 0 }));
    if (grabPointer) unbind.push(bindPointerXRInputSourceEvent(grabPointer, session, source, xrHand ? 'select' : 'squeeze', [], { button: 0 }));
    const onSelectStart = (e: XRInputSourceEvent) => {
      if (e.inputSource !== source) return;
      rec.selecting = true;
      this.pulse(source);
    };
    const onSelectEnd = (e: XRInputSourceEvent) => {
      if (e.inputSource === source) rec.selecting = false;
    };
    session.addEventListener('selectstart', onSelectStart);
    session.addEventListener('selectend', onSelectEnd);
    unbind.push(() => {
      session.removeEventListener('selectstart', onSelectStart);
      session.removeEventListener('selectend', onSelectEnd);
    });

    const rec: InputRec = {
      source,
      hand,
      raySpace,
      gripSpace,
      tipSpace,
      combined,
      rayPointer,
      grabPointer,
      touchPointer,
      hitTest: null,
      surface: null,
      visual: new PointerVisual(raySpace, scene),
      handVisual: xrHand ? new HandVisual(scene, xrHand) : null,
      controllerVisual: !xrHand && gripSpace && isTracked ? new ControllerVisual(gripSpace) : null,
      selecting: false,
      lastMoveAt: 0,
      lastDir: new THREE.Vector3(),
      unbind,
    };
    if (source.targetRayMode === 'screen') rec.visual.ray.visible = false;
    unbind.push(registerPointer({ pointer: combined as any, kind: isTracked ? 'ray' : 'screen', hand, space: raySpace }));
    if (isTracked) {
      (session as any)
        .requestHitTestSource?.({ space: source.targetRaySpace })
        .then((s: XRHitTestSource) => (rec.hitTest = s))
        .catch(() => {});
    }
    this.inputs.push(rec);
  }

  private removeInput(rec: InputRec) {
    const i = this.inputs.indexOf(rec);
    if (i >= 0) this.inputs.splice(i, 1);
    for (const u of rec.unbind) u();
    const ev = { timeStamp: performance.now() };
    rec.rayPointer.exit(ev);
    rec.grabPointer?.exit(ev);
    rec.touchPointer?.exit(ev);
    rec.hitTest?.cancel?.();
    rec.visual.dispose();
    rec.handVisual?.dispose();
    rec.controllerVisual?.dispose();
    rec.raySpace.removeFromParent();
    rec.gripSpace?.removeFromParent();
    rec.tipSpace?.removeFromParent();
  }

  /** A short buzz in the controller, the headset equivalent of a tap landing. */
  private pulse(source: XRInputSource) {
    try {
      (source.gamepad as any)?.hapticActuators?.[0]?.pulse?.(0.4, 40);
    } catch {}
  }

  // ---------------------------------------------------------------- per frame

  private _dir = new THREE.Vector3();

  update(_dt: number, frame?: XRFrame) {
    if (!frame || !this.session) return;
    const refSpace = this.ctx.renderer.xr.getReferenceSpace();
    if (!refSpace) return;
    if (!this.isReady && frame.getViewerPose(refSpace)) {
      this.isReady = true;
      this.markReady();
    }
    const now = performance.now();

    if (this.viewerHitTest) {
      const results = frame.getHitTestResults(this.viewerHitTest);
      this.viewerSurfaceHit = results.length ? poseToSurface(results[0].getPose(refSpace)) : null;
    }

    for (const rec of this.inputs) {
      rec.raySpace.updateFromFrame(frame, refSpace);
      rec.gripSpace?.updateFromFrame(frame, refSpace);
      if (rec.tipSpace) {
        if ((rec.source as any).hand) rec.tipSpace.updateFromJoint(frame, refSpace);
        else if (rec.gripSpace) {
          // Controller: a point ahead of the grip.
          rec.tipSpace.matrix.copy(rec.gripSpace.matrix).multiply(new THREE.Matrix4().makeTranslation(0, 0, -CONTROLLER_TIP_AHEAD));
          rec.tipSpace.matrix.decompose(rec.tipSpace.position, rec.tipSpace.quaternion, rec.tipSpace.scale);
          rec.tipSpace.updateMatrixWorld(true);
          rec.tipSpace.tracked = rec.gripSpace.tracked;
        }
      }
      rec.raySpace.getWorldDirection(this._dir);
      if (rec.lastDir.lengthSq() > 0 && rec.lastDir.angleTo(this._dir) > 0.004) rec.lastMoveAt = now;
      rec.lastDir.copy(this._dir);

      if (rec.hitTest) {
        const results = frame.getHitTestResults(rec.hitTest);
        rec.surface = results.length ? poseToVec(results[0].getPose(refSpace)) : null;
      } else rec.surface = rec.source.targetRayMode === 'screen' ? this.viewerSurfaceHit?.point ?? null : null;

      // Enable the pointer set only while the device tracks it; a hand out of view must not hover.
      const ev = { timeStamp: now };
      const tracked = rec.raySpace.tracked || rec.source.targetRayMode === 'screen';
      rec.combined.setEnabled(tracked, ev);
      rec.visual.update(rec.rayPointer, rec.selecting);
      rec.visual.ray.visible = rec.visual.ray.visible && tracked && rec.source.targetRayMode !== 'screen';
      rec.visual.cursor.visible = rec.visual.cursor.visible && tracked;
      rec.handVisual?.update(frame, refSpace);
      if (rec.controllerVisual) rec.controllerVisual.mesh.visible = !!rec.gripSpace?.tracked;
    }
  }

  // ---------------------------------------------------------------- profile contract

  trackedPointerCount(): number {
    return this.inputs.filter((r) => r.raySpace.tracked && r.source.targetRayMode === 'tracked-pointer').length;
  }

  /** The hand the viewer is using (selecting, else most recently moved), or the head. */
  private activeInput(): InputRec | null {
    const usable = this.inputs.filter((r) => r.raySpace.tracked);
    if (!usable.length) return null;
    return usable.find((r) => r.selecting) || [...usable].sort((a, b) => b.lastMoveAt - a.lastMoveAt)[0];
  }

  getPointerRay(): THREE.Ray | null {
    const active = this.activeInput();
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    if (active) {
      active.raySpace.getWorldPosition(origin);
      active.raySpace.getWorldDirection(dir);
      return new THREE.Ray(origin, dir.negate()); // Object3D "direction" is +Z; a ray points down −Z
    }
    const cam = this.ctx?.camera;
    if (!cam) return null;
    cam.getWorldPosition(origin);
    cam.getWorldDirection(dir);
    return new THREE.Ray(origin, dir);
  }

  hitSurface(_ray: THREE.Ray): THREE.Vector3 | null {
    const active = this.activeInput();
    const p = active?.surface || this.viewerSurfaceHit?.point;
    return p ? p.clone() : null;
  }

  viewerSurface(): SurfaceHit | null {
    return this.viewerSurfaceHit ? { point: this.viewerSurfaceHit.point.clone(), normal: this.viewerSurfaceHit.normal.clone() } : null;
  }

  /** Something the viewer holds: the grip of the chosen hand, or whichever hand we have. */
  getGripAnchor(hand?: 'left' | 'right'): THREE.Object3D | null {
    const withGrip = this.inputs.filter((r) => r.gripSpace?.tracked);
    if (hand) return withGrip.find((r) => r.hand === hand)?.gripSpace || withGrip[0]?.gripSpace || null;
    const active = this.activeInput();
    if (active?.gripSpace) return active.gripSpace;
    return withGrip.find((r) => r.hand === 'right')?.gripSpace || withGrip[0]?.gripSpace || null;
  }

  onExit(cb: () => void) {
    this.exitCbs.push(cb);
  }

  end() {
    this.session?.end().catch(() => {});
  }

  /** For tests and debugging: the ray spaces, by hand. */
  debugRaySpaces(): Record<string, THREE.Object3D> {
    const out: Record<string, THREE.Object3D> = {};
    for (const r of this.inputs) out[r.hand] = r.raySpace;
    return out;
  }
}

/** Hit-test poses point their +Y along the surface normal. */
function poseToSurface(pose: XRPose | null | undefined): SurfaceHit | null {
  if (!pose) return null;
  const p = pose.transform.position;
  const o = pose.transform.orientation;
  return {
    point: new THREE.Vector3(p.x, p.y, p.z),
    normal: new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(o.x, o.y, o.z, o.w)).normalize(),
  };
}

function poseToVec(pose: XRPose | null | undefined): THREE.Vector3 | null {
  if (!pose) return null;
  const p = pose.transform.position;
  return new THREE.Vector3(p.x, p.y, p.z);
}
