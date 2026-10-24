import * as THREE from 'three';
import { texturedMat } from './textures.js';
import { mat } from './builders.js';

const HALF_LEN = 0.55; // base half-size along its length (local x)
const HALF_WID = 0.25; // base half-size across (local z)
const PLATE = { x: 0.24, z: 0.18 }; // trigger plate half-size around the bait

// A classic snap trap. Brushing the edge of the base snaps it (the mouse is
// stunned and the snap is loud); stepping onto the trigger plate catches the mouse.
export class Mousetrap {
  constructor(x, z, angle = 0) {
    this.x = x;
    this.z = z;
    this.angle = angle;
    this.sprung = false;
    this.snapT = 1;

    const g = (this.group = new THREE.Group());
    g.position.set(x, 0, z);
    g.rotation.y = angle;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(HALF_LEN * 2, 0.08, HALF_WID * 2),
      texturedMat('wood', 1, 0.5, { color: 0xf0d2a0 }),
    );
    base.position.y = 0.04;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const metal = mat(0xb9bec2, { metalness: 0.8, roughness: 0.35 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(PLATE.x * 2, 0.02, PLATE.z * 2), metal);
    plate.position.set(0, 0.09, 0);
    const bait = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 3), mat(0xffd23f, { roughness: 0.6 }));
    bait.position.set(0, 0.13, 0);
    this.bait = bait;
    for (const s of [-1, 1]) {
      const spring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), metal);
      spring.position.set(-0.05, 0.12, s * 0.17);
      g.add(spring);
    }
    g.add(plate, bait);

    // The snap bar: a U of wire hinged across the middle of the base. Armed, it's
    // pulled all the way back (rotated PI); when sprung it slams over to the front.
    this.bar = new THREE.Group();
    this.bar.position.set(-0.05, 0.1, 0);
    const wire = (w, h, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metal);
      m.position.set(x, 0, z);
      m.castShadow = true;
      this.bar.add(m);
    };
    wire(0.42, 0.025, 0.025, 0.21, -HALF_WID + 0.04);
    wire(0.42, 0.025, 0.025, 0.21, HALF_WID - 0.04);
    wire(0.025, 0.025, HALF_WID * 2 - 0.08, 0.42, 0);
    this.bar.rotation.z = Math.PI;
    g.add(this.bar);
  }

  // 'full' if the mouse is on the trigger plate, 'edge' if it's brushing the base, else null.
  check(pos, radius) {
    if (this.sprung) return null;
    const dx = pos.x - this.x;
    const dz = pos.z - this.z;
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    let hit = null;
    if (Math.abs(lx) <= PLATE.x && Math.abs(lz) <= PLATE.z) hit = 'full';
    else {
      const cx = THREE.MathUtils.clamp(lx, -HALF_LEN, HALF_LEN);
      const cz = THREE.MathUtils.clamp(lz, -HALF_WID, HALF_WID);
      if (Math.hypot(lx - cx, lz - cz) < radius) hit = 'edge';
    }
    if (hit) this.spring();
    return hit;
  }

  spring() {
    this.sprung = true;
    this.snapT = 0;
    this.bait.visible = false;
  }

  update(dt) {
    if (this.snapT >= 1) return;
    this.snapT = Math.min(1, this.snapT + dt / 0.08);
    this.bar.rotation.z = Math.PI * (1 - this.snapT);
    this.group.position.y = this.snapT < 1 ? Math.sin(this.snapT * Math.PI) * 0.06 : 0;
  }
}
