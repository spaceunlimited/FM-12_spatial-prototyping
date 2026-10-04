// What the viewer sees of their own pointing in a headset: a short fading ray out of each hand or
// controller, a cursor that lands flat on whatever the ray hits, joint dots for tracked hands,
// and a small block where a controller is. All offline; no model downloads.
import * as THREE from 'three';
import type { Pointer } from '@pmndrs/pointer-events';
import { PointerRayMaterial, updatePointerRayModel } from '../vendor/pmndrs-xr/ray';
import { PointerCursorMaterial, updatePointerCursorModel } from '../vendor/pmndrs-xr/cursor';
import { defaultRayPointerOpacity } from '../vendor/pmndrs-xr/default';
import { theme } from '../../blocks/ui/theme';

const RAY_LENGTH = 1.0;
const RAY_SIZE = 0.004;
const CURSOR_SIZE = 0.03;
const JOINT_RADIUS = 0.006;

export class PointerVisual {
  readonly ray: THREE.Mesh;
  readonly cursor: THREE.Mesh;
  private rayMat = new PointerRayMaterial();
  private cursorMat = new PointerCursorMaterial();

  constructor(raySpace: THREE.Object3D, scene: THREE.Scene) {
    this.ray = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.rayMat);
    this.ray.name = 'pointer-ray';
    this.ray.renderOrder = 2;
    this.ray.matrixAutoUpdate = false;
    this.ray.pointerEvents = 'none';
    raySpace.add(this.ray);
    this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.cursorMat);
    this.cursor.name = 'pointer-cursor';
    this.cursor.renderOrder = 3;
    this.cursor.matrixAutoUpdate = false;
    this.cursor.pointerEvents = 'none';
    scene.add(this.cursor);
  }

  update(pointer: Pointer, pressed: boolean) {
    updatePointerRayModel(this.ray, this.rayMat, pointer, {
      maxLength: RAY_LENGTH,
      size: RAY_SIZE,
      color: pressed ? theme.accent : 'white',
      opacity: defaultRayPointerOpacity,
    });
    updatePointerCursorModel(this.cursor.parent ?? this.cursor, this.cursor, this.cursorMat, pointer, {
      size: pressed ? CURSOR_SIZE * 0.7 : CURSOR_SIZE,
      color: pressed ? theme.accent : 'white',
      opacity: 0.8,
      cursorOffset: 0.005,
    });
    // A hit at the void (nothing interactive) still deserves a faint cursor so the viewer knows where they aim.
    const hit = pointer.getIntersection();
    if (hit && hit.object.isVoidObject) {
      this.cursor.visible = false;
      this.ray.visible = true;
      this.ray.scale.set(RAY_SIZE, RAY_SIZE, 0.4);
      this.ray.position.z = -0.2;
      this.ray.updateMatrix();
    }
  }

  dispose() {
    this.ray.removeFromParent();
    this.cursor.removeFromParent();
    this.ray.geometry.dispose();
    this.cursor.geometry.dispose();
    this.rayMat.dispose();
    this.cursorMat.dispose();
  }
}

/** Small dots on the 25 joints of a tracked hand. */
export class HandVisual {
  readonly group = new THREE.Group();
  private dots: THREE.Mesh[] = [];
  private static geometry = new THREE.SphereGeometry(JOINT_RADIUS, 8, 6);
  private static material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });

  constructor(scene: THREE.Scene, private hand: XRHand) {
    this.group.name = 'hand-joints';
    this.group.pointerEvents = 'none';
    for (let i = 0; i < 25; i++) {
      const dot = new THREE.Mesh(HandVisual.geometry, HandVisual.material);
      dot.matrixAutoUpdate = false;
      this.dots.push(dot);
      this.group.add(dot);
    }
    scene.add(this.group);
  }

  update(frame: XRFrame, referenceSpace: XRReferenceSpace) {
    const getJointPose = (frame as any).getJointPose as ((j: XRSpace, r: XRReferenceSpace) => XRPose | undefined) | undefined;
    if (!getJointPose) return;
    let i = 0;
    let any = false;
    for (const joint of (this.hand as any).values() as Iterable<XRSpace>) {
      const dot = this.dots[i++];
      if (!dot) break;
      const pose = getJointPose.call(frame, joint, referenceSpace);
      dot.visible = !!pose;
      if (pose) {
        any = true;
        dot.matrix.fromArray(pose.transform.matrix);
        const r = (pose as any).radius as number | undefined;
        if (r) dot.matrix.scale(new THREE.Vector3(r / JOINT_RADIUS, r / JOINT_RADIUS, r / JOINT_RADIUS));
      }
    }
    this.group.visible = any;
  }

  dispose() {
    this.group.removeFromParent();
  }
}

/** A controller stand-in: a small rounded block at the grip. No model download needed. */
export class ControllerVisual {
  readonly mesh: THREE.Mesh;
  constructor(gripSpace: THREE.Object3D) {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x33333a, roughness: 0.5, metalness: 0.2 }),
    );
    this.mesh.name = 'controller';
    this.mesh.pointerEvents = 'none';
    this.mesh.position.z = 0.02;
    gripSpace.add(this.mesh);
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}
