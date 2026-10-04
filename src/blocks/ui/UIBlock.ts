// Shared behaviour of every spatial UI block: a uikit root inside a three.js Group that faces
// the viewer, keeps its angular size, can trail the viewer or ride on an object, and appears
// with a short scale-in. Subclasses only build the uikit tree.
import * as THREE from 'three';
import { Container, type InProperties } from '@pmndrs/uikit';
import { theme, scaleForDistance } from './theme';
import { faceCameraQuaternion, faceCameraSlerpAlpha } from '../../runtime/vendor/xrblocks/FaceCameraMath';

export type FollowMode = 'world' | 'lazy' | 'object';

export interface UIBlockOptions {
  /** 'world' stays put, 'lazy' trails the viewer, 'object' rides on the object given to attachTo(). */
  follow?: FollowMode;
  /** Metres in front of the viewer for 'lazy'; default theme.distance. */
  distance?: number;
  /** 'bottom': the block grows upward from its position, so it never sinks into what it labels. */
  anchor?: 'center' | 'bottom';
  /** Keep the same visual angle at any distance (default true). */
  scaleWithDistance?: boolean;
  /** Turn to face the viewer, upright (default true). */
  billboard?: boolean;
}

const registry = new Set<UIBlock>();
/** Called by core every frame. */
export function updateUI(dt: number, camera: THREE.Camera) {
  for (const b of registry) b.update(dt, camera);
}

const _camPos = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _parentQuat = new THREE.Quaternion();
const _targetQuat = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _desired = new THREE.Vector3();

export abstract class UIBlock extends THREE.Group {
  readonly root: Container;
  protected follow: FollowMode;
  protected distance: number;
  protected scaleWithDistance: boolean;
  protected billboard: boolean;
  private attachedTo: THREE.Object3D | null = null;
  private attachOffset = new THREE.Vector3(0, 0.2, 0);
  private lazyTarget = new THREE.Vector3();
  private appearT = 0;
  private disposed = false;

  constructor(rootProps: InProperties, opts: UIBlockOptions = {}) {
    super();
    this.follow = opts.follow ?? 'world';
    this.distance = opts.distance ?? theme.distance;
    this.scaleWithDistance = opts.scaleWithDistance ?? true;
    this.billboard = opts.billboard ?? true;
    this.root = new Container({
      pixelSize: theme.pixelSize,
      anchorY: opts.anchor === 'bottom' ? 'bottom' : 'center',
      renderOrder: 10,
      ...rootProps,
    });
    this.add(this.root);
    this.scale.setScalar(0.001);
    registry.add(this);
  }

  /** Ride on an object: the block sits `offset` metres from the object's origin and follows it. */
  attachTo(object: THREE.Object3D, opts: { offset?: [number, number, number] } = {}): this {
    this.attachedTo = object;
    if (opts.offset) this.attachOffset.set(...opts.offset);
    this.follow = 'object';
    (object.parent ?? object).add(this);
    this.position.copy(object.position).add(this.attachOffset);
    this.appearT = 0;
    return this;
  }

  /** Change how the block follows the viewer after creation. */
  setFollow(mode: FollowMode, opts: { distance?: number } = {}) {
    this.follow = mode;
    if (opts.distance != null) this.distance = opts.distance;
    if (mode === 'lazy') this.lazyTarget.set(0, 0, 0);
  }

  update(dt: number, camera: THREE.Camera) {
    if (this.disposed) return;
    camera.getWorldPosition(_camPos);

    if (this.follow === 'object' && this.attachedTo) {
      if (this.parent !== (this.attachedTo.parent ?? this.attachedTo)) (this.attachedTo.parent ?? this.attachedTo).add(this);
      this.position.copy(this.attachedTo.position).add(this.attachOffset);
    } else if (this.follow === 'lazy') {
      camera.getWorldDirection(_fwd);
      _fwd.y = 0;
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
      _fwd.normalize();
      _desired.copy(_camPos).addScaledVector(_fwd, this.distance);
      _desired.y = _camPos.y + theme.heightOffset;
      // Only move when the viewer has turned past the dead zone, then ease over.
      const cur = this.lazyTarget.clone().sub(_camPos).setY(0);
      const want = _desired.clone().sub(_camPos).setY(0);
      if (cur.lengthSq() === 0 || cur.angleTo(want) > theme.followDeadZoneRad) this.lazyTarget.copy(_desired);
      const k = 1 - Math.exp((-dt * 1000) / theme.followLagMs);
      const local = this.parent ? this.parent.worldToLocal(this.lazyTarget.clone()) : this.lazyTarget;
      this.position.lerp(local, k);
    }

    this.getWorldPosition(_worldPos);
    const dist = _worldPos.distanceTo(_camPos);

    if (this.billboard) {
      if (this.parent) this.parent.getWorldQuaternion(_parentQuat);
      else _parentQuat.identity();
      const q = faceCameraQuaternion(_worldPos, _camPos, _parentQuat, 'capsule', 0.25, _targetQuat);
      if (q) this.quaternion.slerp(q, faceCameraSlerpAlpha(0.1, dt));
    }

    // Appear: scale in over appearMs with a cubic ease-out. Then hold the distance-constant size.
    let s = this.scaleWithDistance ? scaleForDistance(dist) : 1;
    if (this.appearT < 1) {
      this.appearT = Math.min(1, this.appearT + (dt * 1000) / theme.appearMs);
      s *= 0.001 + (1 - Math.pow(1 - this.appearT, 3)) * 0.999;
    }
    this.scale.setScalar(s);

    this.root.update(dt * 1000);
  }

  /** Remove from the scene and free uikit resources. */
  dispose() {
    this.disposed = true;
    registry.delete(this);
    this.removeFromParent();
    this.root.dispose();
  }
}
