// Laptop preview backdrop: an HDR panorama, blurred once at full resolution on the GPU, used as
// the scene background. three.js' own `backgroundBlurriness` blurs a tiny prefiltered cube map,
// which looks pixelated; this keeps the panorama sharp-edged-free and smooth.
import * as THREE from 'three';

export interface SimRoomOptions {
  /** Width of the blurred panorama in pixels (height is half). Default 1024. */
  size?: number;
  /** Blur strength: number of separable Gaussian passes with growing radius. 0 = no blur. Default 4. */
  passes?: number;
}

export interface SimRoom {
  background: THREE.Texture; // blurred, for scene.background (set backgroundBlurriness = 0)
  environment: THREE.Texture; // the unblurred panorama, for scene.environment (lighting)
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;
// 9-tap Gaussian, separable. `step` is one texel in the blur direction times the pass radius.
const FRAG = /* glsl */ `
  uniform sampler2D tex;
  uniform vec2 step;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tex, vUv).rgb * 0.2270270270;
    c += texture2D(tex, vUv + step * 1.0).rgb * 0.1945945946;
    c += texture2D(tex, vUv - step * 1.0).rgb * 0.1945945946;
    c += texture2D(tex, vUv + step * 2.0).rgb * 0.1216216216;
    c += texture2D(tex, vUv - step * 2.0).rgb * 0.1216216216;
    c += texture2D(tex, vUv + step * 3.0).rgb * 0.0540540541;
    c += texture2D(tex, vUv - step * 3.0).rgb * 0.0540540541;
    c += texture2D(tex, vUv + step * 4.0).rgb * 0.0162162162;
    c += texture2D(tex, vUv - step * 4.0).rgb * 0.0162162162;
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** Load an equirectangular .hdr and return a blurred copy for the background plus the original for lighting. */
export async function loadSimRoom(renderer: THREE.WebGLRenderer, url: string, opts: SimRoomOptions = {}): Promise<SimRoom> {
  const size = opts.size ?? 1024;
  const passes = opts.passes ?? 4;
  const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
  const { FullScreenQuad } = await import('three/examples/jsm/postprocessing/Pass.js');

  const hdr = await new HDRLoader().loadAsync(url);
  hdr.mapping = THREE.EquirectangularReflectionMapping;

  const w = size;
  const h = Math.round(size / 2);
  const makeTarget = () =>
    new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping, // a panorama wraps around horizontally, so the blur must too
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    });
  let a = makeTarget();
  let b = makeTarget();

  const mat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: hdr }, step: { value: new THREE.Vector2(0, 0) } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(mat);

  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false;

  // Pass 0: resample the HDR into target A (step 0 = plain copy at the working resolution).
  mat.uniforms.step.value.set(0, 0);
  renderer.setRenderTarget(a);
  quad.render(renderer);

  // Then horizontal + vertical Gaussian, widening the radius each pass for a soft, wide blur.
  for (let i = 0; i < passes; i++) {
    const radius = i + 1;
    mat.uniforms.tex.value = a.texture;
    mat.uniforms.step.value.set(radius / w, 0);
    renderer.setRenderTarget(b);
    quad.render(renderer);

    mat.uniforms.tex.value = b.texture;
    mat.uniforms.step.value.set(0, radius / h);
    renderer.setRenderTarget(a);
    quad.render(renderer);
  }

  renderer.setRenderTarget(prevTarget);
  renderer.autoClear = prevAutoClear;
  quad.dispose();
  mat.dispose();
  b.dispose();

  const background = a.texture;
  background.mapping = THREE.EquirectangularReflectionMapping;
  background.colorSpace = hdr.colorSpace;
  return { background, environment: hdr };
}
