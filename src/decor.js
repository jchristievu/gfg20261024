import * as THREE from 'three';
import { addWind } from './effects.js';

// Two crossed tapered blades, base at y=0, 1 unit tall. Darker at the root via
// vertex colors (multiplied with per-instance color).
export function bladeGeometry(width) {
  const w = width / 2;
  const positions = [
    -w, 0, 0, w, 0, 0, 0, 1, 0, // blade facing z
    0, 0, -w, 0, 0, w, 0, 1, 0, // blade facing x
  ];
  const colors = [];
  for (let i = 0; i < positions.length; i += 3) {
    const v = positions[i + 1] > 0 ? 1 : 0.45;
    colors.push(v, v, v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // Point normals up so both sides catch sunlight like the ground does.
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return geo;
}

function makeRng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Scatter non-gameplay decoration over open ground: short grass tufts,
// wildflowers and rocks. Short enough that they never read as hiding spots.
// `exclude` lists extra [minX, maxX, minZ, maxZ] areas to keep clear (e.g. indoors).
export function scatterDecor(world, { tuftCount = 1800, flowerCount = 420, rockCount = 90, exclude = [] } = {}) {
  const rng = makeRng(42);
  const sx = world.halfX * 2 - 2;
  const sz = world.halfZ * 2 - 2;
  const spot = (margin) => {
    for (let i = 0; i < 30; i++) {
      const x = (rng() - 0.5) * sx;
      const z = (rng() - 0.5) * sz;
      if (exclude.some(([a, b, c, d]) => x > a && x < b && z > c && z < d)) continue;
      if (world.isOpenGround(x, z, margin)) return [x, z];
    }
    return null;
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();

  // Grass tufts: clusters of short blades.
  const bladesPerTuft = 5;
  const tufts = new THREE.InstancedMesh(
    bladeGeometry(0.09),
    addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), 0.06),
    tuftCount * bladesPerTuft,
  );
  let n = 0;
  for (let t = 0; t < tuftCount; t++) {
    const at = spot(0.3);
    if (!at) continue;
    const hue = 0.22 + rng() * 0.07;
    for (let b = 0; b < bladesPerTuft; b++) {
      p.set(at[0] + (rng() - 0.5) * 0.35, 0, at[1] + (rng() - 0.5) * 0.35);
      e.set((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.5);
      q.setFromEuler(e);
      s.set(1, 0.2 + rng() * 0.3, 1);
      m.compose(p, q, s);
      tufts.setMatrixAt(n, m);
      c.setHSL(hue, 0.5, 0.36 + rng() * 0.12);
      tufts.setColorAt(n, c);
      n++;
    }
  }
  tufts.count = n;
  tufts.receiveShadow = true;
  world.scene.add(tufts);

  // Wildflowers: stem + head.
  const stems = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.008, 0.012, 1, 3).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x4f7f34, roughness: 1 }),
    flowerCount,
  );
  const heads = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.06, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    flowerCount,
  );
  const petals = [0xffffff, 0xffe066, 0xc792ea, 0xff8fab, 0xffffff];
  n = 0;
  for (let i = 0; i < flowerCount; i++) {
    const at = spot(0.3);
    if (!at) continue;
    const h = 0.25 + rng() * 0.2;
    q.identity();
    m.compose(p.set(at[0], 0, at[1]), q, s.set(1, h, 1));
    stems.setMatrixAt(n, m);
    m.compose(p.set(at[0], h, at[1]), q, s.set(1, 0.6, 1));
    heads.setMatrixAt(n, m);
    heads.setColorAt(n, c.set(petals[Math.floor(rng() * petals.length)]));
    n++;
  }
  stems.count = heads.count = n;
  world.scene.add(stems, heads);

  // Rocks.
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.3, 0),
    new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
    rockCount,
  );
  n = 0;
  for (let i = 0; i < rockCount; i++) {
    const at = spot(0.6);
    if (!at) continue;
    const r = 0.4 + rng() * 0.9;
    e.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    q.setFromEuler(e);
    m.compose(p.set(at[0], 0.05 * r, at[1]), q, s.set(r, r * (0.4 + rng() * 0.3), r));
    rocks.setMatrixAt(n, m);
    const v = 0.45 + rng() * 0.2;
    rocks.setColorAt(n, c.setRGB(v, v * 0.98, v * 0.94));
    n++;
  }
  rocks.count = n;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  world.scene.add(rocks);
}
