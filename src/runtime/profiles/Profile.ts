// The contract every device profile fulfils. Experience code never sees this directly; it uses
// the blocks, which talk to whichever profile is active through the interaction layer.
import * as THREE from 'three';

export type ProfileId = 'phone-camera' | 'phone-webxr' | 'headset-webxr';
export type PlacementStrategy = 'front' | 'surface' | 'hand';

export interface Capabilities {
  positionalTracking: boolean; // does the device know where it is in the room?
  surfaceHitTest: boolean; // can it find tables and floors?
  hands: boolean;
  controllers: boolean;
  passthrough: boolean; // headset see-through
  touch: boolean;
  orientation: boolean; // phone gyroscope look-around
  simulated: boolean; // running on a laptop without a device
}

export interface ProfileContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  viewer: THREE.Group; // the camera's parent; the virtual eye height lives here outside XR
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement;
  overlay: HTMLElement;
}

export interface DeviceProfile {
  id: ProfileId;
  label: string;
  capabilities: Capabilities;
  placementStrategies: PlacementStrategy[];
  /** One line on the start screen telling the viewer how to hold or wear this device. */
  startHint?: string;
  /** What the start button says on this device ("Start", "Enter the room"). */
  startButtonLabel?: string;
  /** True once an immersive session owns the display: no HTML over the scene unless hasDomOverlay. */
  immersive: boolean;
  hasDomOverlay?: boolean;
  /** Runs inside the first user gesture: permissions, camera, XR session. */
  start(ctx: ProfileContext): Promise<void>;
  /**
   * Resolves on the first frame that knows where the viewer is. In a WebXR session the camera
   * sits at the origin until then, so anything placed "in front of the viewer" must wait for it.
   */
  ready: Promise<void>;
  /** Where the viewer is aiming with no hand or finger involved: screen centre, or gaze. */
  getPointerRay(): THREE.Ray | null;
  /** Optional: find a real surface along the ray (WebXR hit-test). */
  hitSurface?(ray: THREE.Ray): THREE.Vector3 | null;
  /** Optional: the real surface straight ahead of the viewer's head, where they are looking, with its normal. */
  viewerSurface?(): SurfaceHit | null;
  /** Optional: an object that follows the physical hand / controller, for placing things in it. */
  getGripAnchor?(hand?: 'left' | 'right'): THREE.Object3D | null;
  /** Optional: the viewer left the immersive session (took the headset off, exited AR). */
  onExit?(cb: () => void): void;
  /** Optional: phone reticle feedback when the gaze pointer is over something interactive. */
  setReticleHot?(hot: boolean): void;
  /** Optional: how many hands/controllers the device tracks right now; the gaze pointer yields to them. */
  trackedPointerCount?(): number;
  update(dt: number, frame?: XRFrame): void;
}

/** A point on a real surface and the direction the surface faces (up for floors and tables). */
export interface SurfaceHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

/** Virtual eye height outside a WebXR session (phone held at chest/eye level, laptop preview). */
export const EYE_HEIGHT = 1.4;
