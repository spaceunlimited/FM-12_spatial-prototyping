// Copied from Google XR Blocks (https://github.com/google/xrblocks), commit c737bdf, src/input/headGestures/HeadGestureTypes.ts
// Copyright 2025 XR Blocks Authors. Licensed under the Apache License, Version 2.0; full text in
// THIRD_PARTY_LICENSES/xrblocks-LICENSE. Modified 2026-10-03 for the XR sandbox: none.
import * as THREE from 'three';

export type HeadGestureConfiguration = {
  enabled: boolean;
  /** Detector-specific sensitivity. Built-in heuristics interpret this as radians. */
  threshold?: number;
};

export type HeadPoseSample = {
  timestamp: number;
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
};

export interface HeadGestureContext {
  readonly samples: readonly HeadPoseSample[];
}

export type HeadGestureDetectionResult = {
  confidence: number;
  data?: Record<string, unknown>;
};

export type HeadGestureScoreMap = Record<
  string,
  HeadGestureDetectionResult | undefined
>;

export type HeuristicHeadGestureDetector = (
  context: HeadGestureContext,
  config: HeadGestureConfiguration
) => HeadGestureDetectionResult | undefined;

export interface HeadGestureRecognizer {
  init?(): Promise<void>;
  recognize(
    context: HeadGestureContext
  ): HeadGestureScoreMap | Promise<HeadGestureScoreMap>;
  getGestureConfigurations?(): Record<string, HeadGestureConfiguration>;
  setGestureConfig?(name: string, config: HeadGestureConfiguration): void;
  dispose?(): void;
}
