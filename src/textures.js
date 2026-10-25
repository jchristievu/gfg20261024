import * as THREE from 'three';

// Procedural canvas textures, so the game ships without any image assets.
// Each generator draws one tile; texture() wraps it with its own repeat.

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

function blotches(ctx, w, h, rng, colors, count, minR, maxR, alpha) {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    const x = rng() * w;
    const y = rng() * h;
    const r = minR + rng() * (maxR - minR);
    // Draw wrapped copies so the tile stays seamless.
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function streaks(ctx, w, h, rng, colors, count, len, width, angleJitter = 0.3, baseAngle = Math.PI / 2) {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    ctx.strokeStyle = colors[Math.floor(rng() * colors.length)];
    ctx.lineWidth = width * (0.5 + rng());
    const x = rng() * w;
    const y = rng() * h;
    const a = baseAngle + (rng() - 0.5) * angleJitter;
    const l = len * (0.5 + rng());
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

const GENERATORS = {
  grass(ctx, w, h) {
    const rng = makeRng(1);
    ctx.fillStyle = '#5f9e43';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, ['#4e8a36', '#6fb04f', '#7bb455', '#56933c'], 60, 20, 70, 0.25);
    streaks(ctx, w, h, rng, ['#4a8433', '#78b752', '#8cc561', '#3f752b'], 2500, 7, 1.4, 0.8, -Math.PI / 2);
  },

  dirt(ctx, w, h) {
    const rng = makeRng(2);
    ctx.fillStyle = '#a3845a';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, ['#8f7149', '#b39469', '#9a7b52'], 50, 10, 40, 0.35);
    blotches(ctx, w, h, rng, ['#6f5838', '#c4a77e', '#857057'], 400, 1, 3, 0.8);
  },

  // Dirt strip that fades to transparent at its left/right edges; tiles along its length.
  path(ctx, w, h) {
    GENERATORS.dirt(ctx, w, h);
    const rng = makeRng(3);
    // Pixel loop, so use the real canvas size rather than the drawing units.
    const pw = ctx.canvas.width;
    const ph = ctx.canvas.height;
    const img = ctx.getImageData(0, 0, pw, ph);
    for (let y = 0; y < ph; y++) {
      const wobble = Math.sin((y / ph) * Math.PI * 2 * 3) * 0.04 + Math.sin((y / ph) * Math.PI * 2 * 7) * 0.02;
      for (let x = 0; x < pw; x++) {
        const u = Math.abs(x / pw - 0.5) * 2 + wobble; // 0 center, 1 edge
        const a = THREE.MathUtils.clamp((1 - u) / 0.35, 0, 1) * (0.85 + rng() * 0.15);
        img.data[(y * pw + x) * 4 + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },

  planks(ctx, w, h, base = '#a8322d', boards = 8) {
    const rng = makeRng(4);
    const bw = w / boards;
    for (let i = 0; i < boards; i++) {
      ctx.fillStyle = shade(base, (rng() - 0.5) * 0.06);
      ctx.fillRect(i * bw, 0, bw, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(i * bw, 0, bw, h);
      ctx.clip();
      streaks(ctx, w, h, rng, [shade(base, -0.06), shade(base, 0.04)], 40, 60, 1, 0.05);
      ctx.restore();
      ctx.fillStyle = shade(base, -0.18);
      ctx.fillRect(i * bw, 0, 2, h);
    }
  },

  shingles(ctx, w, h) {
    const rng = makeRng(5);
    const rows = 8;
    const cols = 8;
    const rh = h / rows;
    const cw = w / cols;
    ctx.fillStyle = '#2e2522';
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * cw * 0.5;
      for (let c = -1; c < cols; c++) {
        ctx.fillStyle = shade('#4a3b36', (rng() - 0.5) * 0.08);
        ctx.fillRect(c * cw + off + 1, r * rh + 1, cw - 2, rh - 3);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(c * cw + off + 1, r * rh + rh - 5, cw - 2, 3);
      }
    }
  },

  siding(ctx, w, h) {
    const rng = makeRng(6);
    const rows = 10;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = shade('#ece2cc', (rng() - 0.5) * 0.03);
      ctx.fillRect(0, r * rh, w, rh);
      const g = ctx.createLinearGradient(0, r * rh, 0, (r + 1) * rh);
      g.addColorStop(0, 'rgba(255,255,255,0.15)');
      g.addColorStop(0.8, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g;
      ctx.fillRect(0, r * rh, w, rh);
    }
  },

  stone(ctx, w, h) {
    const rng = makeRng(7);
    ctx.fillStyle = '#5d5a55';
    ctx.fillRect(0, 0, w, h);
    const rows = 5;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rng() * 40;
      while (x < w) {
        const sw = 40 + rng() * 50;
        ctx.fillStyle = shade('#8d8a85', (rng() - 0.5) * 0.15);
        ctx.beginPath();
        ctx.roundRect(x + 3, r * rh + 3, sw - 6, rh - 6, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 6, r * rh + 5, sw - 14, 4);
        x += sw;
      }
    }
    blotches(ctx, w, h, rng, ['#4d4a46', '#a09d97'], 300, 1, 2, 0.5);
  },

  straw(ctx, w, h) {
    const rng = makeRng(8);
    ctx.fillStyle = '#d9b44f';
    ctx.fillRect(0, 0, w, h);
    streaks(ctx, w, h, rng, ['#e8c867', '#c49b3b', '#f1d886', '#b8902f'], 1800, 14, 1.3, 0.5, 0);
  },

  hay(ctx, w, h) {
    GENERATORS.straw(ctx, w, h);
    // Two twine bands.
    ctx.fillStyle = 'rgba(90,60,30,0.85)';
    ctx.fillRect(w * 0.27, 0, w * 0.035, h);
    ctx.fillRect(w * 0.69, 0, w * 0.035, h);
  },

  crate(ctx, w, h) {
    GENERATORS.planks(ctx, w, h, '#a8743f', 5);
    ctx.strokeStyle = '#7a5129';
    ctx.lineWidth = w * 0.09;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, 0);
    ctx.stroke();
  },

  cardboard(ctx, w, h) {
    const rng = makeRng(9);
    ctx.fillStyle = '#c49a6c';
    ctx.fillRect(0, 0, w, h);
    streaks(ctx, w, h, rng, ['#b88d5f', '#cfa777'], 300, 30, 1, 0.05, 0);
    ctx.fillStyle = 'rgba(225,200,150,0.75)';
    ctx.fillRect(0, h * 0.44, w, h * 0.12);
    ctx.fillStyle = 'rgba(90,60,30,0.6)';
    ctx.font = `bold ${w * 0.1}px sans-serif`;
    ctx.fillText('THIS SIDE UP', w * 0.18, h * 0.3);
  },

  metal(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 16; i++) g.addColorStop(i / 16, i % 2 ? '#9ca3a8' : '#d3d8db');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(80,70,60,0.15)';
    for (let y = 0; y < h; y += h / 6) ctx.fillRect(0, y, w, 2);
  },

  bark(ctx, w, h) {
    const rng = makeRng(10);
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(0, 0, w, h);
    streaks(ctx, w, h, rng, ['#4f3520', '#7f5a3a', '#5a3e27'], 300, 40, 3, 0.15);
  },

  wood(ctx, w, h) {
    const rng = makeRng(11);
    ctx.fillStyle = '#7a5534';
    ctx.fillRect(0, 0, w, h);
    streaks(ctx, w, h, rng, ['#6a4829', '#8a6340', '#5e4024'], 200, 60, 1.5, 0.05, 0);
  },

  grayFur(ctx, w, h) {
    const rng = makeRng(13);
    ctx.fillStyle = '#8b9097';
    ctx.fillRect(0, 0, w, h);
    streaks(ctx, w, h, rng, ['#9ca1a8', '#7a7f86', '#a9aeb5'], 700, 10, 1.5, 0.4);
    // Darker tabby bands (rings around the body).
    ctx.fillStyle = '#5c6168';
    for (let i = 0; i < 8; i++) {
      const y0 = (i + 0.5) * (h / 8);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.06 + i * 1.7) * 4);
      for (let x = w; x >= 0; x -= 8) ctx.lineTo(x, y0 + 5 + Math.sin(x * 0.06 + i * 1.7) * 4);
      ctx.fill();
    }
  },

  // German shorthaired pointer, black roan: white with dense fine black ticking
  // and a few solid black patches.
  pointerCoat(ctx, w, h) {
    const rng = makeRng(18);
    ctx.fillStyle = '#e9e7e2';
    ctx.fillRect(0, 0, w, h);
    const wrapped = (draw) => {
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) draw(ox, oy);
    };
    // Patches first so the ticking speckles over their edges.
    ctx.fillStyle = '#1b1a1a';
    for (let i = 0; i < 5; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const rx = 18 + rng() * 26;
      const ry = 14 + rng() * 20;
      const rot = rng() * Math.PI;
      wrapped((ox, oy) => {
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // Ticking: lots of tiny dark flecks, some grey.
    for (let i = 0; i < 2600; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 0.6 + rng() * 1.6;
      ctx.fillStyle = rng() < 0.75 ? '#1b1a1a' : '#6a6866';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  mouseFur(ctx, w, h) {
    const rng = makeRng(19);
    ctx.fillStyle = '#9a8f88';
    ctx.fillRect(0, 0, w, h);
    streaks(ctx, w, h, rng, ['#a89d96', '#8b817a', '#b3a9a2', '#857b74'], 1600, 8, 1, 0.4);
  },

  ragdollFur(ctx, w, h) {
    const rng = makeRng(14);
    ctx.fillStyle = '#ece0cc';
    ctx.fillRect(0, 0, w, h);
    // Long soft fur: lots of gentle streaks, warmer toward one edge.
    streaks(ctx, w, h, rng, ['#f6ecdc', '#ddcdb2', '#e8d8be', '#fff8ec'], 1400, 22, 2, 0.35);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(150,120,90,0.18)');
    g.addColorStop(0.5, 'rgba(150,120,90,0)');
    g.addColorStop(1, 'rgba(150,120,90,0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },

  woodFloor(ctx, w, h) {
    const rng = makeRng(15);
    const rows = 6;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rng() * w * 0.5;
      while (x < w) {
        const len = w * (0.35 + rng() * 0.4);
        ctx.fillStyle = shade('#b07a46', (rng() - 0.5) * 0.1);
        ctx.fillRect(x, r * rh, len, rh);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, r * rh, len, rh);
        ctx.clip();
        streaks(ctx, w, h, rng, ['#9a683a', '#c28c56', '#a8723f'], 30, 80, 1, 0.04, 0);
        ctx.restore();
        ctx.fillStyle = 'rgba(60,35,15,0.5)';
        ctx.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      ctx.fillStyle = 'rgba(60,35,15,0.55)';
      ctx.fillRect(0, r * rh, w, 2);
    }
  },

  wallpaper(ctx, w, h) {
    ctx.fillStyle = '#e9dcc0';
    ctx.fillRect(0, 0, w, h);
    // Soft vertical stripes with a small diamond motif.
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = 'rgba(160,120,80,0.12)';
      ctx.fillRect(x, 0, 12, h);
    }
    ctx.fillStyle = 'rgba(140,70,60,0.25)';
    for (let y = 16; y < h; y += 32) {
      for (let x = 22; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 5);
        ctx.lineTo(x - 4, y);
        ctx.fill();
      }
    }
  },

  tile(ctx, w, h) {
    const rng = makeRng(16);
    const n = 4;
    const s = w / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 ? shade('#e8e4dc', (rng() - 0.5) * 0.04) : shade('#9fb4c4', (rng() - 0.5) * 0.04);
        ctx.fillRect(i * s, j * s, s, s);
      }
    }
    ctx.strokeStyle = 'rgba(80,80,80,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, h);
      ctx.moveTo(0, i * s);
      ctx.lineTo(w, i * s);
      ctx.stroke();
    }
  },

  rug(ctx, w, h) {
    ctx.fillStyle = '#8e3b32';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d9b26a';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = '#2f3f5a';
    ctx.lineWidth = 6;
    ctx.strokeRect(34, 34, w - 68, h - 68);
    ctx.fillStyle = '#d9b26a';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.3);
    ctx.lineTo(w * 0.7, h / 2);
    ctx.lineTo(w / 2, h * 0.7);
    ctx.lineTo(w * 0.3, h / 2);
    ctx.fill();
  },

  // Hexagonal-ish chicken wire on a transparent background.
  chickenWire(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(190,195,200,0.9)';
    ctx.lineWidth = 2;
    const s = 32;
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y);
        ctx.lineTo(x + s, y + s / 4);
        ctx.lineTo(x + s, y + (s * 3) / 4);
        ctx.lineTo(x + s / 2, y + s);
        ctx.lineTo(x, y + (s * 3) / 4);
        ctx.lineTo(x, y + s / 4);
        ctx.closePath();
        ctx.stroke();
      }
    }
  },

  catFur(ctx, w, h) {
    const rng = makeRng(12);
    ctx.fillStyle = '#e08a3c';
    ctx.fillRect(0, 0, w, h);
    streaks(ctx, w, h, rng, ['#ea9a4f', '#d27c30'], 600, 10, 1.5, 0.4);
    // Wavy tabby stripes across the tile (become rings around the body).
    ctx.fillStyle = '#b9601f';
    for (let i = 0; i < 7; i++) {
      const y0 = (i + 0.5) * (h / 7);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 4);
      for (let x = w; x >= 0; x -= 8) ctx.lineTo(x, y0 + 7 + Math.sin(x * 0.05 + i) * 4);
      ctx.fill();
    }
  },
};

// Generators draw in TILE units onto a canvas SCALE times larger, for sharper detail.
const TILE = 256;
const SCALE = 2;

// How strongly each texture's light/dark pattern reads as surface relief:
// dark grooves (mortar, board gaps, bark furrows) sink in. Unlisted = flat.
const BUMP = {
  grass: 0.5,
  dirt: 1,
  planks: 1,
  shingles: 2,
  siding: 1.5,
  stone: 2.5,
  straw: 0.8,
  hay: 0.8,
  crate: 1,
  cardboard: 0.3,
  metal: 0.3,
  bark: 2.5,
  wood: 0.8,
  woodFloor: 0.8,
  wallpaper: 0.3,
  tile: 1,
  rug: 0.6,
  catFur: 0.5,
  mouseFur: 0.4,
  grayFur: 0.5,
  ragdollFur: 0.5,
  pointerCoat: 0.3,
};

// Three's bump mapping normalizes screen-space slopes that can be zero (surfaces
// seen edge-on), giving NaN pixels that bloom then smears into black blocks.
// Fall back to the unbumped normal there.
THREE.ShaderChunk.bumpmap_pars_fragment = THREE.ShaderChunk.bumpmap_pars_fragment
  .replace(
    /vec3 vSigmaX = normalize\( dFdx\( surf_pos\.xyz \) \);\s*vec3 vSigmaY = normalize\( dFdy\( surf_pos\.xyz \) \);/,
    `vec3 vSigmaX = dFdx( surf_pos.xyz );
    vec3 vSigmaY = dFdy( surf_pos.xyz );
    if ( dot( vSigmaX, vSigmaX ) < 1e-20 || dot( vSigmaY, vSigmaY ) < 1e-20 ) return surf_norm;
    vSigmaX = normalize( vSigmaX );
    vSigmaY = normalize( vSigmaY );`,
  )
  .replace(
    'return normalize( abs( fDet ) * surf_norm - vGrad );',
    'vec3 bumped = abs( fDet ) * surf_norm - vGrad;\n\t\treturn dot( bumped, bumped ) > 1e-20 ? normalize( bumped ) : surf_norm;',
  );

const canvases = new Map();
const heightCanvases = new Map();

function tileCanvas(name) {
  if (!canvases.has(name)) {
    const c = document.createElement('canvas');
    c.width = c.height = TILE * SCALE;
    const ctx = c.getContext('2d');
    ctx.scale(SCALE, SCALE);
    GENERATORS[name](ctx, TILE, TILE);
    canvases.set(name, c);
  }
  return canvases.get(name);
}

// Grayscale, slightly softened copy of a tile for use as a bump map.
function heightCanvas(name) {
  if (!heightCanvases.has(name)) {
    const src = tileCanvas(name);
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.filter = 'grayscale(1) blur(1px)';
    ctx.drawImage(src, 0, 0);
    heightCanvases.set(name, c);
  }
  return heightCanvases.get(name);
}

function wrap(canvas, repeatX, repeatY) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}

// A tiling texture for `name`, repeated repeatX x repeatY times across the UVs.
export function texture(name, repeatX = 1, repeatY = 1) {
  const t = wrap(tileCanvas(name), repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Tileable ripple normal map for water: a sum of waves with whole-number
// frequencies (so the tile wraps), turned into normals from its slope.
let waterCanvas = null;
export function waterNormals(repeat = 1) {
  if (!waterCanvas) {
    const n = 256;
    const rng = makeRng(21);
    const waves = [];
    for (let i = 0; i < 14; i++) {
      const k = 2 + Math.floor(rng() * 9);
      const a = rng() * Math.PI * 2;
      waves.push({ kx: Math.round(Math.cos(a) * k), ky: Math.round(Math.sin(a) * k), amp: 1 / k, phase: rng() * Math.PI * 2 });
    }
    waterCanvas = document.createElement('canvas');
    waterCanvas.width = waterCanvas.height = n;
    const ctx = waterCanvas.getContext('2d');
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let dx = 0;
        let dy = 0;
        for (const w of waves) {
          const c = Math.cos(((w.kx * x + w.ky * y) / n) * Math.PI * 2 + w.phase) * w.amp;
          dx += c * w.kx;
          dy += c * w.ky;
        }
        const len = Math.hypot(dx * 0.15, dy * 0.15, 1);
        const i = (y * n + x) * 4;
        img.data[i] = (-dx * 0.15 / len * 0.5 + 0.5) * 255;
        img.data[i + 1] = (-dy * 0.15 / len * 0.5 + 0.5) * 255;
        img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  return wrap(waterCanvas, repeat, repeat);
}

// Material with a procedural texture. Textures multiply `color`, so default to white.
export function texturedMat(name, repeatX = 1, repeatY = 1, extra = {}) {
  const relief = BUMP[name] ? { bumpMap: wrap(heightCanvas(name), repeatX, repeatY), bumpScale: BUMP[name] } : {};
  return new THREE.MeshStandardMaterial({ map: texture(name, repeatX, repeatY), roughness: 0.9, ...relief, ...extra });
}
