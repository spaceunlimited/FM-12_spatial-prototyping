import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GazeDwell } from '../../src/runtime/vendor/xrblocks/GazeDwell';

describe('gaze dwell', () => {
  it('completes once after 1.5 s of steady aim, then stays armed-off until the target changes', () => {
    const d = new GazeDwell();
    const target = new THREE.Object3D();
    const p = new THREE.Vector3(0, 0, -1);
    let completed = 0;
    for (let i = 0; i < 120; i++) {
      // 1 mm tremor per frame at 60 fps = 0.06 m/s, under the 0.2 m/s reset threshold
      p.x += (i % 2 ? 1 : -1) * 0.001;
      if (d.update(1, target, p, 1 / 60).completed) completed++;
    }
    expect(completed).toBe(1);
  });
  it('a fast move resets the progress', () => {
    const d = new GazeDwell();
    const target = new THREE.Object3D();
    const p = new THREE.Vector3();
    for (let i = 0; i < 60; i++) d.update(1, target, p, 1 / 60);
    const before = d.update(1, target, p, 1 / 60).progress;
    p.x += 0.1; // 0.1 m in one frame = 6 m/s
    const after = d.update(1, target, p, 1 / 60).progress;
    expect(before).toBeGreaterThan(0.6);
    expect(after).toBeLessThan(0.05);
  });
  it('paused holds the progress', () => {
    const d = new GazeDwell();
    const target = new THREE.Object3D();
    const p = new THREE.Vector3();
    for (let i = 0; i < 30; i++) d.update(1, target, p, 1 / 60);
    const held = d.update(1, target, p, 1 / 60, true).progress;
    for (let i = 0; i < 30; i++) d.update(1, target, p, 1 / 60, true);
    expect(d.update(1, target, p, 1 / 60, true).progress).toBeCloseTo(held, 5);
  });
});
