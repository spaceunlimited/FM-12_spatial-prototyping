// Copied from Google XR Blocks (https://github.com/google/xrblocks), commit c737bdf, src/utils/HelperConstants.ts
// Copyright 2025 XR Blocks Authors. Licensed under the Apache License, Version 2.0; full text in
// THIRD_PARTY_LICENSES/xrblocks-LICENSE. Modified 2026-10-03 for the XR sandbox: none.
import * as THREE from 'three';

export const DOWN = Object.freeze(new THREE.Vector3(0, -1, 0));
export const UP = Object.freeze(new THREE.Vector3(0, 1, 0));
export const FORWARD = Object.freeze(new THREE.Vector3(0, 0, -1));
export const BACK = Object.freeze(new THREE.Vector3(0, 0, 1));
export const LEFT = Object.freeze(new THREE.Vector3(-1, 0, 0));
export const RIGHT = Object.freeze(new THREE.Vector3(1, 0, 0));
export const ZERO_VECTOR3 = Object.freeze(new THREE.Vector3(0, 0, 0));
