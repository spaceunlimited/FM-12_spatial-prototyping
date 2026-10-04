// Adapted from Google XR Blocks (https://github.com/google/xrblocks), commit c737bdf, src/interaction/GazeDwell.ts
// Copyright 2025 XR Blocks Authors. Licensed under the Apache License, Version 2.0; full text in
// THIRD_PARTY_LICENSES/xrblocks-LICENSE. Modified 2026-10-03 for the XR sandbox: keyed by pointer id
// and fed a plain (target, point) pair instead of XR Blocks' Controller / ResolvedRay types.
import * as THREE from 'three';

interface GazeDwellState {
  target?: THREE.Object3D;
  elapsed: number;
  lastPoint?: THREE.Vector3;
  armed: boolean;
}

export interface GazeDwellUpdate {
  progress: number;
  completed: boolean;
}

export const DWELL_SECONDS = 1.5;
/** Hit-point travel in m/s above which the dwell resets. Hand tremor stays well under this. */
export const MOVEMENT_THRESHOLD = 0.2;

/** Tracks stable gaze time for each pointer and emits one completion per target. */
export class GazeDwell {
  private readonly states = new Map<number, GazeDwellState>();

  update(
    pointerId: number,
    target: THREE.Object3D | undefined,
    point: THREE.Vector3 | undefined,
    deltaSeconds: number,
    paused = false,
    dwellSeconds = DWELL_SECONDS,
  ): GazeDwellUpdate {
    let state = this.states.get(pointerId);
    if (!state || state.target !== target) {
      state = { target, elapsed: 0, lastPoint: point?.clone(), armed: true };
      this.states.set(pointerId, state);
      return { progress: 0, completed: false };
    }
    if (!target || !point) return { progress: 0, completed: false };
    if (paused) {
      state.lastPoint?.copy(point);
      return { progress: state.elapsed / dwellSeconds, completed: false };
    }
    if (!state.armed) {
      state.lastPoint?.copy(point);
      return { progress: 1, completed: false };
    }

    const delta = Math.max(0, deltaSeconds);
    const movement = (state.lastPoint?.distanceTo(point) ?? 0) / Math.max(delta, Number.EPSILON);
    state.lastPoint ??= point.clone();
    state.lastPoint.copy(point);
    if (movement > MOVEMENT_THRESHOLD) state.elapsed = 0;
    else state.elapsed = Math.min(dwellSeconds, state.elapsed + delta);

    const completed = state.elapsed === dwellSeconds;
    if (completed) state.armed = false;
    return { progress: state.elapsed / dwellSeconds, completed };
  }

  remove(pointerId: number): void {
    this.states.delete(pointerId);
  }
}
