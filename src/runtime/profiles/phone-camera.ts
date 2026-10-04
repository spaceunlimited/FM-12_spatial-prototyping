// phone-camera: camera feed behind the 3D scene, gyroscope look-around, touch input.
// Works on iPhone and every Android. On a laptop it is the preview: a blurred studio panorama
// stands in for the room and mouse drag looks around.
import * as THREE from 'three';
import type { DeviceProfile, ProfileContext, Capabilities } from './Profile';
import { isPointerBusy } from '../interaction';

// Laptop preview backdrop: a photo-studio panorama (Poly Haven, CC0), blurred so it reads as
// "a room" without competing with the objects. Served from public/sim/.
const SIM_ROOM_HDR = '/sim/brown_photostudio_02_1k.hdr';
const SIM_ROOM_BLUR_PASSES = 2; // 0 = sharp, 2 = soft focus, 4 = clearly a room but nothing readable

export class PhoneCameraProfile implements DeviceProfile {
  id = 'phone-camera' as const;
  label = 'Phone camera view';
  startHint = 'Hold the phone up like a window. The next screen asks for camera and motion access.';
  startButtonLabel = 'Start';
  immersive = false;
  hasDomOverlay = true;
  capabilities: Capabilities = {
    positionalTracking: false,
    surfaceHitTest: false,
    hands: false,
    controllers: false,
    passthrough: false,
    touch: true,
    orientation: false,
    simulated: false,
  };
  placementStrategies = ['front' as const];
  ready: Promise<void>;
  private markReady!: () => void;

  private ctx!: ProfileContext;
  private raycaster = new THREE.Raycaster();
  private orientation: { alpha: number; beta: number; gamma: number } | null = null;
  private screenAngle = 0;
  private yaw = 0;
  private pitch = 0;
  private forceSim: boolean;

  constructor(opts: { simulate?: boolean } = {}) {
    this.forceSim = !!opts.simulate;
    this.ready = new Promise((r) => (this.markReady = r));
    // On a laptop, "hold the phone up" is nonsense. Say what this device actually does.
    if (this.forceSim || !('ontouchstart' in window)) {
      this.label = 'Laptop preview (phone view)';
      this.startHint = 'Drag to look around, click to tap, drag an object to move it. A quick check, not a substitute for the device.';
    }
  }

  async start(ctx: ProfileContext) {
    this.ctx = ctx;
    // A laptop (no touch screen) always simulates: its webcam is not the room the demo is for.
    const simulate = this.forceSim || !('ontouchstart' in window);
    const gotCamera = !simulate && (await this.startCamera(ctx.video));
    const gotOrientation = !simulate && (await this.startOrientation());
    this.capabilities.orientation = gotOrientation;
    this.capabilities.simulated = !gotCamera;
    if (!gotCamera) {
      document.body.classList.add('simulated');
      this.loadSimRoom(ctx);
    }
    this.bindLookAround(ctx.canvas);
    this.addReticle(ctx.overlay);
    // No tracking to wait for: the viewer is wherever the virtual eye is.
    this.markReady();
  }

  /** Laptop preview: a blurred photo-studio panorama stands in for the room, and lights the objects. */
  private async loadSimRoom(ctx: ProfileContext) {
    try {
      const { loadSimRoom } = await import('./sim-room');
      const room = await loadSimRoom(ctx.renderer, SIM_ROOM_HDR, { passes: SIM_ROOM_BLUR_PASSES });
      ctx.scene.background = room.background;
      ctx.scene.backgroundBlurriness = 0; // already blurred at full resolution (see sim-room.ts)
      ctx.scene.backgroundIntensity = 0.9;
      ctx.scene.environment = room.environment;
    } catch (e) {
      console.warn('[phone-camera] simulated room panorama unavailable, keeping the plain backdrop', e);
    }
  }

  private async startCamera(video: HTMLVideoElement): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      video.classList.add('active');
      await video.play().catch(() => {});
      return true;
    } catch (e) {
      console.warn('[phone-camera] camera unavailable, using simulated background', e);
      return false;
    }
  }

  private async startOrientation(): Promise<boolean> {
    const DOE = (window as any).DeviceOrientationEvent;
    if (!DOE) return false;
    try {
      // iOS: must be asked inside the tap, and only once.
      if (typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        if (res !== 'granted') return false;
      }
    } catch {
      return false;
    }
    return new Promise((resolve) => {
      let got = false;
      const onOrient = (e: DeviceOrientationEvent) => {
        if (e.alpha == null) return;
        this.orientation = { alpha: e.alpha, beta: e.beta || 0, gamma: e.gamma || 0 };
        if (!got) {
          got = true;
          resolve(true);
        }
      };
      window.addEventListener('deviceorientation', onOrient, true);
      const updateScreen = () => (this.screenAngle = (screen.orientation?.angle ?? (window as any).orientation ?? 0) as number);
      updateScreen();
      window.addEventListener('orientationchange', updateScreen);
      setTimeout(() => !got && resolve(false), 1200);
    });
  }

  /**
   * Without a gyroscope (laptop), dragging empty space turns the camera. Taps and object drags
   * are handled by the pointer layer; this only acts when that layer has not taken the pointer.
   */
  private bindLookAround(canvas: HTMLCanvasElement) {
    let down: { id: number; x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      down = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      down.x = e.clientX;
      down.y = e.clientY;
      if (this.orientation || isPointerBusy(e.pointerId)) return;
      this.yaw -= dx * 0.005;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.005, -1.2, 1.2);
    });
    const up = (e: PointerEvent) => {
      if (down && e.pointerId === down.id) down = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  private reticle?: HTMLElement;
  private addReticle(overlay: HTMLElement) {
    this.reticle = document.createElement('div');
    this.reticle.className = 'mr-reticle';
    overlay.appendChild(this.reticle);
  }
  setReticleHot(hot: boolean) {
    this.reticle?.classList.toggle('hot', hot);
  }

  /** Screen centre: what the phone is looking at. */
  getPointerRay(): THREE.Ray {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.ctx.camera);
    return this.raycaster.ray.clone();
  }

  // Gyroscope → camera rotation. Same maths as three.js' former DeviceOrientationControls.
  private zee = new THREE.Vector3(0, 0, 1);
  private euler = new THREE.Euler();
  private q0 = new THREE.Quaternion();
  private q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  update() {
    const cam = this.ctx.camera;
    if (this.orientation) {
      const { alpha, beta, gamma } = this.orientation;
      const a = THREE.MathUtils.degToRad(alpha);
      const b = THREE.MathUtils.degToRad(beta);
      const g = THREE.MathUtils.degToRad(gamma);
      const o = THREE.MathUtils.degToRad(this.screenAngle);
      this.euler.set(b, a, -g, 'YXZ');
      cam.quaternion.setFromEuler(this.euler);
      cam.quaternion.multiply(this.q1);
      cam.quaternion.multiply(this.q0.setFromAxisAngle(this.zee, -o));
    } else {
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
  }
}
