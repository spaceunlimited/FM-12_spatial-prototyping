// Copied from pmndrs/xr (https://github.com/pmndrs/xr), commit 8a0e9e9, packages/xr/src/pointer/default.ts
// MIT License, Copyright 2024 Bela Bohlender, Copyright 2023 Coconut Capital; full text in
// THIRD_PARTY_LICENSES/pmndrs-LICENSE. Modified 2026-10-03 for the XR sandbox: none.
import { Pointer } from '@pmndrs/pointer-events'

export function defaultGrabPointerOpacity(pointer: Pointer) {
  if (pointer.getButtonsDown().size > 0) {
    return 0.6
  }
  return map(pointer.getIntersection()?.distance ?? Infinity, 0.07, 0, 0.2, 0.4)
}

export function defaultRayPointerOpacity(pointer: Pointer) {
  if (pointer.getButtonsDown().size > 0) {
    return 0.6
  }
  return 0.4
}

export function defaultTouchPointerOpacity(pointer: Pointer) {
  return map(pointer.getIntersection()?.distance ?? Infinity, 0.1, 0.03, 0.2, 0.6)
}

function map(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) {
  return toMin + Math.max(0, Math.min(1, (value - fromMin) / (fromMax - fromMin))) * (toMax - toMin)
}
