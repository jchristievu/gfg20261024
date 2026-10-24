import * as THREE from 'three';
import { texturedMat } from './textures.js';

// Small shared helpers for level construction.

export function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
}

// Triangular prism (gable) of the given footprint, ridge running along z.
export function gableGeometry(width, height, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// Pitched roof over a w x d footprint (ridge along local z): a gable in the wall
// material plus two overhanging shingled slabs and a ridge cap.
export function pitchedRoof(w, d, rise, wallMat, { overhang = 0.6, shingleColor = 0xffffff } = {}) {
  const group = new THREE.Group();
  const gable = new THREE.Mesh(gableGeometry(w, rise, d), wallMat);
  group.add(gable);

  const slope = Math.hypot(w / 2, rise);
  const angle = Math.atan2(rise, w / 2);
  const shingleMat = texturedMat('shingles', slope / 2, (d + overhang * 2) / 2, { color: shingleColor });
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slope + overhang, 0.22, d + overhang * 2), shingleMat);
    slab.rotation.z = -s * angle;
    // Center of each slope, pushed out along its normal to sit on the gable and
    // down-slope so the extra length overhangs the eave.
    slab.position.set(
      s * (w / 4 + Math.sin(angle) * 0.11 + (overhang / 2) * Math.cos(angle)),
      rise / 2 + Math.cos(angle) * 0.11 - (overhang / 2) * Math.sin(angle),
      0,
    );
    group.add(slab);
  }
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.25, d + overhang * 2),
    new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.8 }),
  );
  ridge.position.y = rise + 0.12;
  group.add(ridge);
  group.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return group;
}

// Food models, one per level. Each returns a fresh mesh sized for the plate/pile
// and for carrying on the mouse's back.
export const FOOD_MODELS = {
  cheese() {
    return new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 3), mat(0xffd23f, { roughness: 0.6 }));
  },
  cookie() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), mat(0xc88a4a, { roughness: 0.8 }));
    g.add(base);
    const chip = mat(0x3b2416);
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), chip);
      const a = i * 2.1;
      c.position.set(Math.cos(a) * 0.15 * (i % 2 ? 1 : 0.5), 0.045, Math.sin(a) * 0.15 * (i % 2 ? 1 : 0.5));
      g.add(c);
    }
    return g;
  },
  corn() {
    const g = new THREE.Group();
    const cob = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 10), mat(0xf2c230, { roughness: 0.6 }));
    cob.rotation.z = Math.PI / 2;
    g.add(cob);
    const husk = mat(0x9bb560);
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), husk);
      leaf.rotation.z = -Math.PI / 2;
      leaf.position.set(-0.3, 0, s * 0.04);
      g.add(leaf);
    }
    return g;
  },
};
