import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { InkPass, STYLES, swapStandIns, restoreStandIns } from './stylize.js';

// Quality presets. Low renders straight to the screen; medium adds bloom,
// MSAA and a color grade; high adds ambient occlusion and a sharper shadow map.
export const QUALITY = {
  low: { label: 'Low', post: false, ao: false, pixelRatio: 1, shadowMap: 1024 },
  medium: { label: 'Medium', post: true, ao: false, pixelRatio: 1.5, shadowMap: 2048 },
  high: { label: 'High', post: true, ao: true, pixelRatio: 2, shadowMap: 4096 },
};

// Gentle warm grade and vignette, applied after tone mapping.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.06 }, vignette: { value: 0.25 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation, vignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(luma), c.rgb, saturation);
      c.rgb *= vec3(1.02, 1.0, 0.98); // a touch of warmth
      c.rgb = (c.rgb - 0.5) * 1.04 + 0.5; // slight contrast
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.5, 1.0, length(d) * 1.25); // darken the corners only
      gl_FragColor = c;
    }`,
};

// GTAO renders its own normal/depth pass. Draw it with the per-object stand-ins
// from stylize.js instead of one override material, which skips things with no
// real surface (dust, beacons, the sky, wire mesh, icons) and foliage.
class SceneAOPass extends GTAOPass {
  overrideVisibility() {
    this.swapped = swapStandIns(this.scene, 'ao');
  }

  restoreVisibility() {
    restoreStandIns(this.swapped);
  }

  // As GTAOPass's, minus the scene-wide override material (the stand-ins are already in place).
  renderOverride(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {
    renderer.getClearColor(this.originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const originalAutoClear = renderer.autoClear;
    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    renderer.setClearColor(clearColor);
    renderer.setClearAlpha(clearAlpha);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }
}

export class Graphics {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = null;
    this.quality = 'high';
    this.style = 'basic';
    renderer.info.autoReset = false; // count every pass of a frame, not just the last

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(null, camera);
    this.aoPass = new SceneAOPass(null, camera, size.x, size.y);
    this.aoPass.blendIntensity = 1;
    this.aoPass.updateGtaoMaterial({ radius: 2, distanceExponent: 1.5, thickness: 3, distanceFallOff: 0.5, scale: 2.5, samples: 12 });
    this.aoPass.updatePdMaterial({ radius: 6, samples: 12 });    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.5, 0.92);
    this.gradePass = new ShaderPass(GradeShader);
    this.inkPass = new InkPass(null, camera, size.x, size.y);
    this.inkPass.enabled = false;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.aoPass);
    this.composer.addPass(this.inkPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.gradePass);

    // FPS / draw-call readout (F3, or from the pause menu).
    this.fpsEl = document.createElement('div');
    this.fpsEl.id = 'fps';
    this.fpsEl.className = 'hidden';
    document.body.appendChild(this.fpsEl);
    this.frames = 0;
    this.fpsSince = performance.now();
  }

  get showFps() {
    return !this.fpsEl.classList.contains('hidden');
  }

  set showFps(on) {
    this.fpsEl.classList.toggle('hidden', !on);
  }

  setQuality(name) {
    this.quality = QUALITY[name] ? name : 'high';
    const q = QUALITY[this.quality];
    this.aoPass.enabled = q.ao;
    this.setSize(window.innerWidth, window.innerHeight);
  }

  setScene(scene) {
    this.scene = scene;
    this.renderPass.scene = scene;
    this.aoPass.scene = scene;
    this.inkPass.scene = scene;
  }

  // Art style (see stylize.js). Outlines need post-processing, so Low skips them.
  setStyle(name) {
    this.style = STYLES[name] ? name : 'basic';
    this.inkPass.enabled = STYLES[this.style].ink;
  }

  // Resize the sun's shadow map to suit the current quality.
  applyShadowQuality(sun) {
    const n = QUALITY[this.quality].shadowMap;
    if (sun.shadow.mapSize.x === n) return;
    sun.shadow.mapSize.set(n, n);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }

  setSize(w, h) {
    const ratio = Math.min(window.devicePixelRatio, QUALITY[this.quality].pixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);
  }

  render(dt) {
    this.renderer.info.reset();
    if (QUALITY[this.quality].post) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    // Measured on the wall clock: the game's dt is capped, which would hide slow frames.
    this.frames++;
    const now = performance.now();
    const elapsed = (now - this.fpsSince) / 1000;
    if (elapsed >= 0.5) {
      if (this.showFps) {
        const fps = Math.round(this.frames / elapsed);
        this.fpsEl.textContent = `${fps} fps · ${this.renderer.info.render.calls} draws · ${QUALITY[this.quality].label}`;
      }
      this.frames = 0;
      this.fpsSince = now;
    }
  }
}
