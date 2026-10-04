/**
 * @block assets
 * Files from `public/` into the room, at a size that makes sense. Put the file anywhere under
 * `public/` and refer to it by its path from there: `public/models/robot.glb` is `/models/robot.glb`.
 * Every loader returns a plain three.js object that works with `stage`, `place`, `draggable` and
 * `onSelect`. Sound is `voice.playClip`. Formats: glb (uncompressed), png/jpg/webp, mp4 (H.264)/webm.
 * A file that fails to load says so in a toast and the promise rejects.
 * @option model(url, { size? = 0.3, anchor? = 'center' | 'bottom', animate? = true }) → Promise<Group> — a glb scaled so its largest side is `size` m, centred (or standing on) its origin; plays its first animation clip when it has one
 * @option image(url, { width? = 0.3 }) → Promise<Mesh> — a picture on a plane; height follows the image's aspect ratio
 * @option video(url, { width? = 0.4, loop? = true, muted? = false, autoplay? = true }) → Promise<VideoMesh> — a video on a plane with `play()`, `pause()` and the `video` element; sound needs the viewer's first tap, which the start screen gives
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { onFrame } from '../runtime/loop';
import { toast } from './ui/toast';

export interface ModelOptions {
  /** Largest side in metres after scaling. */
  size?: number;
  /** 'center' puts the model's middle at its origin; 'bottom' makes it stand on its origin (for surfaces). */
  anchor?: 'center' | 'bottom';
  /** Play the first animation clip in the file, looping. */
  animate?: boolean;
}

/** Load a glb, scale it to `size` and centre it. The returned group carries the file's `animations`. */
export async function model(url: string, opts: ModelOptions = {}): Promise<THREE.Group> {
  const size = opts.size ?? 0.3;
  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(url);
  } catch (e) {
    const msg = String((e as any)?.message ?? e);
    if (/DRACOLoader/i.test(msg)) throw fail(`${url} is Draco-compressed, which this sandbox does not decode. Re-export it without compression.`);
    if (/KTX2Loader/i.test(msg)) throw fail(`${url} uses KTX2 textures, which this sandbox does not decode. Re-export with plain png/jpg textures.`);
    throw fail(`Could not load ${url}. Is the file in public/ and the path spelled like that?`);
  }
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const extent = box.getSize(new THREE.Vector3());
  const largest = Math.max(extent.x, extent.y, extent.z) || 1;
  const scale = size / largest;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  root.position.sub(centre);
  if (opts.anchor === 'bottom') root.position.y += (box.max.y - box.min.y) / 2;

  const group = new THREE.Group();
  group.name = url;
  group.add(root);
  group.animations = gltf.animations;

  if (opts.animate !== false && gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(gltf.animations[0]).play();
    onFrame((dt) => mixer.update(dt));
  }
  return group;
}

export interface ImageOptions {
  /** Width in metres; the height follows the picture. */
  width?: number;
}

/** A picture on a plane, in correct colours, readable over passthrough. */
export async function image(url: string, opts: ImageOptions = {}): Promise<THREE.Mesh> {
  const width = opts.width ?? 0.3;
  let texture: THREE.Texture;
  try {
    texture = await new THREE.TextureLoader().loadAsync(url);
  } catch {
    throw fail(`Could not load ${url}. Is the file in public/ and the path spelled like that?`);
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const img = texture.image as { width: number; height: number };
  const height = width * (img.height / img.width);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), plainMaterial(texture));
  mesh.name = url;
  return mesh;
}

export interface VideoOptions {
  width?: number;
  loop?: boolean;
  muted?: boolean;
  /** Start as soon as it is in the scene. Falls back to muted playback where sound is not allowed yet. */
  autoplay?: boolean;
}
export interface VideoMesh extends THREE.Mesh {
  video: HTMLVideoElement;
  play(): Promise<void>;
  pause(): void;
}

/** A video on a plane. mp4 (H.264) plays everywhere; webm on Quest and Android only. */
export async function video(url: string, opts: VideoOptions = {}): Promise<VideoMesh> {
  const width = opts.width ?? 0.4;
  const el = document.createElement('video');
  el.src = url;
  el.loop = opts.loop ?? true;
  el.muted = opts.muted ?? false;
  el.playsInline = true;
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';
  await new Promise<void>((resolve, reject) => {
    el.onloadedmetadata = () => resolve();
    el.onerror = () => reject(fail(`Could not load ${url}. Is the file in public/, and is it an mp4 (H.264)?`));
  });
  const texture = new THREE.VideoTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  const height = width * (el.videoHeight / el.videoWidth || 9 / 16);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), plainMaterial(texture)) as unknown as VideoMesh;
  mesh.name = url;
  mesh.video = el;
  mesh.play = async () => {
    try {
      await el.play();
    } catch {
      // No user activation yet (or none at all in automated checks): play silently rather than not at all.
      el.muted = true;
      await el.play().catch(() => {});
    }
  };
  mesh.pause = () => el.pause();
  if (opts.autoplay !== false) void mesh.play();
  return mesh;
}

/** Unlit and untouched by tone mapping: the pixels of the file are the pixels in the room. */
function plainMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, side: THREE.DoubleSide });
}

function fail(message: string): Error {
  console.error('[assets]', message);
  toast(message, 6000);
  return new Error(message);
}
