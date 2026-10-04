// An Object3D whose world matrix is copied from a WebXR space every frame: a hand's target ray,
// a controller grip, a fingertip joint. Pointers and visuals hang off these; nothing else in the
// runtime needs to know about XRFrame. (Pattern from pmndrs/xr `vanilla/space.ts`, rewritten.)
import * as THREE from 'three';

export class XRSpaceObject extends THREE.Object3D {
  /**
   * false this frame when the device gave no pose for the space (hand out of view). A pose whose
   * position is only inferred (`emulatedPosition`, e.g. a 3DoF controller or the emulator) counts.
   */
  tracked = false;

  constructor(public readonly xrSpace: XRSpace, name = 'xr-space') {
    super();
    this.name = name;
    this.matrixAutoUpdate = false;
  }

  /** Copy the pose for this frame. Returns whether a pose existed. */
  updateFromFrame(frame: XRFrame, referenceSpace: XRReferenceSpace): boolean {
    const pose = frame.getPose(this.xrSpace, referenceSpace);
    this.tracked = !!pose;
    if (pose) {
      this.matrix.fromArray(pose.transform.matrix);
      this.matrix.decompose(this.position, this.quaternion, this.scale);
      this.updateMatrixWorld(true);
    }
    return !!pose;
  }

  /** Same, for a hand joint (XRJointSpace) which uses getJointPose. */
  updateFromJoint(frame: XRFrame, referenceSpace: XRReferenceSpace): boolean {
    const getJointPose = (frame as any).getJointPose as ((j: XRSpace, r: XRReferenceSpace) => XRPose | undefined) | undefined;
    const pose = getJointPose ? getJointPose.call(frame, this.xrSpace, referenceSpace) : undefined;
    this.tracked = !!pose;
    if (pose) {
      this.matrix.fromArray(pose.transform.matrix);
      this.matrix.decompose(this.position, this.quaternion, this.scale);
      this.updateMatrixWorld(true);
    }
    return !!pose;
  }
}
