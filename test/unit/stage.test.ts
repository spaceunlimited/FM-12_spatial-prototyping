import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { poseInFront } from '../../src/blocks/stage';
import { scaleForDistance } from '../../src/blocks/ui/theme';

describe('stage pose', () => {
  it('sits 1.5 m ahead and 0.15 m below the eye, facing the viewer, upright', () => {
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0, 1.6, 0);
    cam.rotation.y = Math.PI / 2; // looking along -X
    cam.updateMatrixWorld();
    const { position, quaternion } = poseInFront(cam);
    expect(position.x).toBeCloseTo(-1.5, 5);
    expect(position.z).toBeCloseTo(0, 5);
    expect(position.y).toBeCloseTo(1.45, 5);
    const plusZ = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    expect(plusZ.x).toBeCloseTo(1, 5); // +Z points back at the viewer
    expect(plusZ.y).toBeCloseTo(0, 5); // and stays level even if the viewer looks down
  });
  it('ignores pitch: looking down still places the stage ahead, not under the feet', () => {
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0, 1.6, 0);
    cam.rotation.x = -0.8;
    cam.updateMatrixWorld();
    const { position } = poseInFront(cam, { distance: 2, heightOffset: 0 });
    expect(position.z).toBeCloseTo(-2, 5);
    expect(position.y).toBeCloseTo(1.6, 5);
  });
  it('scaleForDistance is constant-angle to 1.75 m and slower beyond', () => {
    expect(scaleForDistance(1)).toBe(1);
    expect(scaleForDistance(1.5)).toBe(1.5);
    expect(scaleForDistance(3.75)).toBeCloseTo(2.75, 5);
    expect(scaleForDistance(0.1)).toBe(0.5);
  });
});
