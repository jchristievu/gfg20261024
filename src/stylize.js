import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Art styles (the Style setting):
//  basic: the standard lit, textured look
//  ink:   standard lighting plus ink outlines
//  toon:  banded cel shading, textures kept, outlines
//  cel:   banded cel shading on simplified colors (textures softened to a hint), outlines
// Outlines are a post-processing effect, so they need Medium or High graphics.
export const STYLES = {
  basic: { label: 'Basic', toon: false, flat: false, ink: false },
  ink: { label: 'Ink', toon: false, flat: false, ink: true },
  toon: { label: 'Toon', toon: true, flat: false, ink: true },
  cel: { label: 'Cel', toon: true, flat: true, ink: true },
};

// Three light bands: shadow, mid, lit. Foliage gets gentler bands: thin blades
// face every which way, and full-strength shadow bands turn them near black.
const gradients = {};
function gradientMap(soft) {
  const key = soft ? 'soft' : 'solid';
  if (!gradients[key]) {
    const [lo, mid] = soft ? [175, 215] : [110, 180];
    const g = new THREE.DataTexture(new Uint8Array([lo, lo, lo, 255, mid, mid, mid, 255, 255, 255, 255, 255]), 3, 1);
    g.minFilter = g.magFilter = THREE.NearestFilter;
    g.needsUpdate = true;
    gradients[key] = g;
  }
  return gradients[key];
}

// A texture's main surface color: the average of its brighter half, so dark
// detail (board gaps, mortar, speckles) doesn't muddy it.
function surfaceColor(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data;
  const lum = [];
  for (let i = 0; i < data.length; i += 4) lum.push(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
  const median = [...lum].sort((a, b) => a - b)[lum.length >> 1];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < lum.length; i++) {
    if (lum[i] < median) continue;
    r += data[i * 4];
    g += data[i * 4 + 1];
    b += data[i * 4 + 2];
    n++;
  }
  return `rgb(${(r / n) | 0},${(g / n) | 0},${(b / n) | 0})`;
}

// The cel look's version of a texture: its surface color with a soft, faint
// hint of the original pattern (board lines, grass streaks), so big surfaces
// aren't dead flat.
const simplified = new Map();
function simplifiedCanvas(image) {
  if (!simplified.has(image)) {
    const n = 128;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0, n, n);
    ctx.fillStyle = surfaceColor(ctx, n, n);
    ctx.fillRect(0, 0, n, n);
    ctx.globalAlpha = 0.3;
    ctx.filter = 'blur(1.5px)';
    ctx.drawImage(image, 0, 0, n, n);
    simplified.set(image, c);
  }
  return simplified.get(image);
}

function toonFrom(m, flat) {
  let map = m.map;
  if (flat && map?.image && !m.transparent) {
    map = map.clone(); // keeps the repeat
    map.image = simplifiedCanvas(m.map.image);
    map.needsUpdate = true;
  }
  const t = new THREE.MeshToonMaterial({
    color: m.color.clone(),
    map,
    gradientMap: gradientMap(m.userData.wind),
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side,
    alphaTest: m.alphaTest,
    vertexColors: m.vertexColors,
    emissive: m.emissive,
    emissiveIntensity: m.emissiveIntensity,
    normalMap: flat ? null : m.normalMap,
    normalScale: m.normalScale,
    depthWrite: m.depthWrite,
    fog: m.fog,
  });
  t.userData = { ...m.userData };
  // Wind sway and water ripples carry over.
  t.onBeforeCompile = m.onBeforeCompile;
  t.customProgramCacheKey = m.customProgramCacheKey;
  if (m.userData.wind) {
    // Foliage normals point up so both faces catch the sun, but double-sided
    // rendering flips them on the back face. Toon shading has no sky fill
    // from below to hide that, so undo the flip.
    t.onBeforeCompile = (shader, renderer) => {
      m.onBeforeCompile(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n\tnormal *= faceDirection;\n#endif',
      );
    };
    t.customProgramCacheKey = () => `${m.customProgramCacheKey()}up`;
  }
  return t;
}

// Each original material's toon / cel stand-ins, made on first use.
const variants = new WeakMap();
function variant(base, flat) {
  if (!variants.has(base)) variants.set(base, {});
  const v = variants.get(base);
  const key = flat ? 'cel' : 'toon';
  v[key] ??= toonFrom(base, flat);
  return v[key];
}

// The stand-ins made for a material, so they can be disposed with it.
export function styleVariants(base) {
  return Object.values(variants.get(base) ?? {}).flatMap((v) => (v.map && v.map !== base.map ? [v, v.map] : [v]));
}

// Put the scene in the given style. Each mesh remembers its original material,
// so this can switch styles back and forth, and calling it again after adding
// meshes styles just the new ones. Shared materials stay shared.
export function applyStyle(scene, name) {
  const style = STYLES[name] ?? STYLES.basic;
  // Toon shading ignores the sky's environment light, so lift the ambient, but
  // less outdoors (fogged scenes), where it would wash out the shadow bands.
  const lift = style.toon ? (scene.fog ? 1.35 : 1.6) : 1;
  scene.traverse((o) => {
    if (o.isHemisphereLight) {
      o.userData.baseIntensity ??= o.intensity;
      o.intensity = o.userData.baseIntensity * lift;
    }
    if (!o.isMesh) return;
    const base = o.userData.baseMaterial ?? o.material;
    if (!base?.isMeshStandardMaterial) return;
    o.userData.baseMaterial = base;
    o.material = style.toon ? variant(base, style.flat) : base;
  });
}

// ------------------------------------------------------------------ normal + depth renders
//
// The AO and outline passes each render the scene's normals and depth. Every
// object is drawn with a stand-in material picked for it, so that in the
// outline render:
//  - swaying grass keeps its sway (the stand-in shares the wind shader code),
//  - see-through things (grass, water, glass) still hide what's behind them,
//    but are marked with alpha 0 so no lines are drawn on them,
//  - always-on-top icons blank out outlines under them,
//  - things with no surface (dust, beacons, the sky, wire mesh) are skipped.

const proxies = new Map();
function proxy(key, make) {
  if (!proxies.has(key)) proxies.set(key, make());
  return proxies.get(key);
}

// Normal material for `m`'s side; `see` marks it see-through (alpha 0).
function normalProxy(m, see) {
  const wind = m.userData?.wind;
  const key = `n${m.side}${see ? 's' : ''}${wind ? m.customProgramCacheKey() : ''}`;
  return proxy(key, () => {
    // NoBlending: the output (alpha included) is written as-is. With normal
    // blending, three treats it as opaque and forces alpha back to 1.
    const p = new THREE.MeshNormalMaterial({ side: m.side, opacity: see ? 0 : 1, blending: THREE.NoBlending });
    if (wind) {
      p.onBeforeCompile = m.onBeforeCompile;
      p.customProgramCacheKey = m.customProgramCacheKey;
    }
    return p;
  });
}

// Icons: clears the alpha under the icon's visible pixels, on top of everything.
function iconProxy(m) {
  if (!m.userData.inkMask) {
    m.userData.inkMask = new THREE.SpriteMaterial({
      map: m.map,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  }
  return m.userData.inkMask;
}

// Stand-in for one object in a 'ao' or 'ink' render, or null to skip it.
function standIn(o, mode) {
  const m = o.material;
  if (o.isSprite) return mode === 'ink' ? iconProxy(m) : null;
  if (!o.isMesh) return null;
  if (Array.isArray(m)) return normalProxy(m[0], false);
  if (m.depthWrite === false || m.side === THREE.BackSide) return null;
  if (m.transparent && m.map) return null; // wire mesh: you see straight through it
  // Thin blades would shade each other near black, so foliage stays out of AO.
  if (mode === 'ao' && m.userData?.wind) return null;
  const see = m.transparent || m.userData?.wind;
  return normalProxy(m, see && mode === 'ink');
}

// Swap stand-ins in (returns what to restore) and back out.
export function swapStandIns(scene, mode) {
  const swapped = [];
  scene.traverse((o) => {
    if (!o.visible || !o.material) return;
    const p = standIn(o, mode);
    swapped.push([o, o.material]);
    if (p) o.material = p;
    else o.visible = false;
  });
  return swapped;
}

export function restoreStandIns(swapped) {
  for (const [o, m] of swapped) {
    o.material = m;
    o.visible = true;
  }
}

// ------------------------------------------------------------------ outline pass

// Ink outlines from the normal + depth render: lines where depth jumps
// (silhouettes) or the surface turns sharply (creases). Alpha marks where
// lines may be drawn: 0 on see-through surfaces and under icons.
const InkShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2() },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 500 },
    ink: { value: new THREE.Color(0x1a1410) },
    thickness: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse, tNormal, tDepth;
    uniform vec2 resolution;
    uniform float cameraNear, cameraFar, thickness;
    uniform vec3 ink;
    varying vec2 vUv;
    float depthAt(vec2 uv) {
      return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
    }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 px = thickness / resolution;
      float d = depthAt(vUv);
      vec4 c = texture2D(tNormal, vUv);
      vec3 n = c.xyz * 2.0 - 1.0;
      // Largest jump across the 8 surrounding samples; taking the max (not a sum)
      // keeps lines an even width and bridges gaps along thin trim.
      float depthEdge = 0.0;
      float normalEdge = 0.0;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;
        vec2 o = vec2(cos(a), sin(a)) * px;
        depthEdge = max(depthEdge, depthAt(vUv + o) - d); // only the nearer side draws
        vec4 cn = texture2D(tNormal, vUv + o);
        // A see-through neighbor (grass blade) makes no crease with this surface.
        normalEdge = max(normalEdge, (1.0 - dot(n, cn.xyz * 2.0 - 1.0)) * cn.a);
      }
      float e = max(smoothstep(0.03, 0.07, depthEdge / d), smoothstep(0.35, 0.6, normalEdge));
      e *= 1.0 - smoothstep(60.0, 140.0, d); // fade lines out in the distance
      e *= c.a; // nothing on see-through surfaces or under icons
      gl_FragColor = vec4(mix(color.rgb, ink, e * 0.85), color.a);
    }`,
};

export class InkPass extends Pass {
  constructor(scene, camera, width, height) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.depthTexture = new THREE.DepthTexture(width, height);
    // Antialiased, so sub-pixel slivers (trim edges) don't break lines into dots.
    this.target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, depthTexture: this.depthTexture, samples: 4 });
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(InkShader.uniforms),
      vertexShader: InkShader.vertexShader,
      fragmentShader: InkShader.fragmentShader,
    });
    this.material.uniforms.tNormal.value = this.target.texture;
    this.material.uniforms.tDepth.value = this.depthTexture;
    this.quad = new FullScreenQuad(this.material);
  }

  setSize(w, h) {
    this.target.setSize(w, h);
    this.material.uniforms.resolution.value.set(w, h);
    this.material.uniforms.thickness.value = Math.max(1.5, h / 520);
  }

  render(renderer, writeBuffer, readBuffer) {
    const clear = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x7f7fff, 1); // empty sky: facing the camera, lines allowed
    renderer.clear();
    const swapped = swapStandIns(this.scene, 'ink');
    renderer.render(this.scene, this.camera);
    restoreStandIns(swapped);
    renderer.setClearColor(clear, alpha);

    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.cameraNear.value = this.camera.near;
    u.cameraFar.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}
