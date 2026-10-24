import * as THREE from 'three';
import { CONFIG } from './config.js';

const HALF = CONFIG.world.size / 2;

const COLORS = {
  ground: 0x6fae4a,
  path: 0xb59a6a,
  barn: 0xa8322d,
  trim: 0xf2efe6,
  roof: 0x4a3b36,
  house: 0xe8dcc4,
  houseRoof: 0x5a6b7a,
  stone: 0x8d8a85,
  hay: 0xe3c35a,
  crate: 0x9c6b3c,
  wood: 0x7a5534,
  trough: 0x6d7c86,
  leaves: 0x3f8a3a,
  silo: 0xb8bcc0,
  tractor: 0x2f8f3a,
  tire: 0x222222,
  cheese: 0xffd23f,
};

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
}

function roofGeometry(width, height, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// 2D segment vs axis-aligned rectangle (slab test). Returns entry t in [0,1] or null.
function segmentHitsRect(ax, az, bx, bz, minX, maxX, minZ, maxZ) {
  let t0 = 0;
  let t1 = 1;
  const axes = [
    [ax, bx - ax, minX, maxX],
    [az, bz - az, minZ, maxZ],
  ];
  for (const [p, d, min, max] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (p < min || p > max) return null;
    } else {
      let ta = (min - p) / d;
      let tb = (max - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return null;
    }
  }
  return t0;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    // Collision volumes: { minX, maxX, minZ, maxZ, top, bottom?, catOnly? }.
    // `bottom` > 0 makes a roof the mouse can walk under; `catOnly` volumes block just the cat.
    this.boxes = [];
    this.grassPatches = []; // { x, z, r, material }
    this.cardboardBoxes = []; // { x, z, openX, openZ, inner, entrance }
    this.puddles = []; // { x, z, r }
    this.cameraBlockers = []; // meshes the camera should not clip through
    this.cheeses = [];
    this.droppedFood = []; // cheese dropped by the mouse (e.g. jumping into a puddle)
    this.foodCount = 0;
    this.time = 0;

    this.home = new THREE.Vector3(-40, 0, 42.8);
    this.mouseSpawn = new THREE.Vector3(-40, 0, 42.5);
    this.foodSpot = new THREE.Vector3(36, 0, -31);
    this.catSpawn = new THREE.Vector3(0, 0, 16);

    this.build();
  }

  // ---------------------------------------------------------------- building

  addCollider(x, z, w, d, top, extra = {}) {
    const box = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top, ...extra };
    this.boxes.push(box);
    return box;
  }

  addBox(x, z, w, d, h, color, { blocksCamera = false, collide = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collide) this.addCollider(x, z, w, d, h);
    if (blocksCamera) this.cameraBlockers.push(mesh);
    return mesh;
  }

  build() {
    this.buildGround();
    this.buildPerimeter();
    this.buildHome();
    this.buildFood();
    this.buildBarn(-4, 1);
    this.buildFarmhouse(38, -42);
    this.buildSilo(10, -14);
    this.buildTractor(18, 9.5);

    // Hay bales: [x, z, w, d, h]. The two at -6,14 form a staircase.
    const bales = [
      [-30, 38, 2, 1.2, 0.9],
      [-14, 36, 1.2, 2, 0.9],
      [-6, 14, 2, 1.2, 1.8],
      [-6, 15.2, 2, 1.2, 0.9],
      [14, -22, 2, 1.2, 0.9],
      [26, 4, 2, 1.2, 0.9],
    ];
    for (const [x, z, w, d, h] of bales) this.addBox(x, z, w, d, h, COLORS.hay);

    // Cardboard boxes: [x, z, open side] where open side is 0:+z 1:+x 2:-z 3:-x.
    const cardboard = [
      [-24, 22, 3],
      [8, -4, 0],
      [22, -28, 3],
      [-16, -2, 1],
    ];
    for (const [x, z, side] of cardboard) this.buildCardboardBox(x, z, side);

    const puddles = [
      [-20, 4, 2.5],
      [26, -2, 3],
    ];
    for (const [x, z, r] of puddles) this.buildPuddle(x, z, r);

    const crates = [
      [20, -12],
      [21.4, -12],
      [30, -26],
      [-34, 8],
      [4, 30],
    ];
    for (const [x, z] of crates) this.addBox(x, z, 1.4, 1.4, 1.5, COLORS.crate);

    this.addBox(-14, 24, 4, 1.2, 0.7, COLORS.trough);

    this.buildFence(-30, -20, -30, 8);
    this.buildFence(6, 15, 30, 15);

    const trees = [
      [-44, 0],
      [-20, -36],
      [44, 10],
      [0, 40],
      [26, 36],
      [-44, -44],
    ];
    for (const [x, z] of trees) this.buildTree(x, z);

    const grass = [
      [-34, 34, 3],
      [-26, 28, 3.5],
      [-36, 18, 3],
      [-20, 32, 2.5],
      [-22, 14, 3.5],
      [-12, 20, 3],
      [2, 24, 3],
      [-28, 0, 3.5],
      [-18, -12, 3],
      [12, 2, 3],
      [20, -4, 3.5],
      [4, -26, 3],
      [24, -18, 3],
      [32, -10, 2.5],
      [40, -22, 2.5],
      [16, -36, 3],
      [-4, -20, 3.5],
      [28, 24, 4],
      [-38, -30, 4],
      [40, 30, 4],
    ];
    for (const [x, z, r] of grass) this.buildGrassPatch(x, z, r);
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.world.size + 40, CONFIG.world.size + 40),
      mat(COLORS.ground),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Dirt paths loosely connecting home, barn and farmhouse.
    this.addPath(-40, 40, -10, 12, 3);
    this.addPath(-10, 12, 8, 12, 3);
    this.addPath(8, 12, 24, -24, 3);
    this.addPath(24, -24, 36, -32, 3);
  }

  addPath(x1, z1, x2, z2, width) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mat(COLORS.path));
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = Math.atan2(x2 - x1, z2 - z1);
    path.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
    path.receiveShadow = true;
    this.scene.add(path);
  }

  buildPerimeter() {
    // Invisible tall walls keep everyone in; a low fence shows where they are.
    const t = 2;
    this.addCollider(0, -HALF - t / 2, CONFIG.world.size + 2 * t, t, 10);
    this.addCollider(0, HALF + t / 2, CONFIG.world.size + 2 * t, t, 10);
    this.addCollider(-HALF - t / 2, 0, t, CONFIG.world.size, 10);
    this.addCollider(HALF + t / 2, 0, t, CONFIG.world.size, 10);

    this.buildFence(-HALF, -HALF, HALF, -HALF, false);
    this.buildFence(-HALF, HALF, HALF, HALF, false);
    this.buildFence(-HALF, -HALF, -HALF, HALF, false);
    this.buildFence(HALF, -HALF, HALF, HALF, false);
  }

  buildFence(x1, z1, x2, z2, collide = true) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(x2 - x1, z2 - z1);
    const group = new THREE.Group();
    group.position.set(x1, 0, z1);
    group.rotation.y = angle;

    const woodMat = mat(COLORS.wood);
    const postCount = Math.max(2, Math.round(len / 2.5) + 1);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), woodMat, postCount);
    const m = new THREE.Matrix4();
    for (let i = 0; i < postCount; i++) {
      m.makeTranslation(0, 0.55, (i / (postCount - 1)) * len);
      posts.setMatrixAt(i, m);
    }
    posts.castShadow = true;
    group.add(posts);

    for (const y of [0.4, 0.85]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, len), woodMat);
      rail.position.set(0, y, len / 2);
      rail.castShadow = true;
      group.add(rail);
    }
    this.scene.add(group);

    if (collide) {
      // Fences only run along an axis on this map, so an AABB is exact.
      const w = Math.abs(x2 - x1) + 0.25;
      const d = Math.abs(z2 - z1) + 0.25;
      this.addCollider((x1 + x2) / 2, (z1 + z2) / 2, w, d, 1.0);
    }
  }

  buildHome() {
    // Stone wall with a mouse hole at its base.
    const wall = this.addBox(-40, 44.6, 12, 1.2, 2.4, COLORS.stone, { blocksCamera: true });
    wall.material = mat(COLORS.stone, { roughness: 1 });

    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 24, 0, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x120c08 }),
    );
    hole.position.set(-40, 0, 43.99);
    hole.rotation.y = Math.PI;
    this.scene.add(hole);

    const rug = new THREE.Mesh(
      new THREE.CylinderGeometry(CONFIG.game.homeRadius, CONFIG.game.homeRadius, 0.02, 32),
      mat(0xa33f3f),
    );
    rug.position.set(this.home.x, 0.015, this.home.z);
    rug.receiveShadow = true;
    this.scene.add(rug);

    this.homeBeacon = this.makeBeacon(0x6dff8a);
    this.homeBeacon.position.set(this.home.x, 0, this.home.z);
  }

  buildFood() {
    const { x, z } = this.foodSpot;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 32), mat(0xf4f4f4));
    plate.position.set(x, 0.025, z);
    plate.receiveShadow = true;
    this.scene.add(plate);

    // One cheese wedge per piece of food still on the plate.
    const wedgeGeo = (this.wedgeGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 3));
    const cheeseMat = (this.cheeseMat = mat(COLORS.cheese, { roughness: 0.6 }));
    for (let i = 0; i < CONFIG.game.foodToWin; i++) {
      const wedge = new THREE.Mesh(wedgeGeo, cheeseMat);
      const a = (i / CONFIG.game.foodToWin) * Math.PI * 2;
      wedge.position.set(x + Math.cos(a) * 0.45, 0.16, z + Math.sin(a) * 0.45);
      wedge.rotation.y = a;
      wedge.castShadow = true;
      this.scene.add(wedge);
      this.cheeses.push(wedge);
    }

    this.addBox(x + 2, z - 0.5, 1, 1, 1.2, 0x9b7b4f); // grain sack

    this.foodBeacon = this.makeBeacon(0xffd23f);
    this.foodBeacon.position.set(x, 0, z);
  }

  makeBeacon(color) {
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beacon.geometry.translate(0, 15, 0);
    this.scene.add(beacon);
    return beacon;
  }

  buildBarn(x, z) {
    const w = 16;
    const d = 14;
    const h = 8;
    this.addBox(x, z, w, d, h, COLORS.barn, { blocksCamera: true });
    const roof = new THREE.Mesh(roofGeometry(w + 1, 4, d + 1), mat(COLORS.roof));
    roof.position.set(x, h, z);
    roof.castShadow = true;
    this.scene.add(roof);
    this.cameraBlockers.push(roof);

    // Big doors facing +z with white X trim.
    const door = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 0.1), mat(0x8a2622));
    door.position.set(x, 2.5, z + d / 2 + 0.05);
    this.scene.add(door);
    const trimMat = mat(COLORS.trim);
    for (const dir of [1, -1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 0.12), trimMat);
      bar.position.copy(door.position);
      bar.position.z += 0.02;
      bar.rotation.z = dir * Math.atan2(5, 6);
      this.scene.add(bar);
    }
  }

  buildFarmhouse(x, z) {
    const w = 16;
    const d = 12;
    const h = 7;
    this.addBox(x, z, w, d, h, COLORS.house, { blocksCamera: true });
    const roof = new THREE.Mesh(roofGeometry(d + 1, 3.5, w + 1), mat(COLORS.houseRoof));
    roof.rotation.y = Math.PI / 2;
    roof.position.set(x, h, z);
    roof.castShadow = true;
    this.scene.add(roof);
    this.cameraBlockers.push(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.2, 0.1), mat(0x5a3d26));
    door.position.set(x - 2, 1.6, z + d / 2 + 0.05);
    this.scene.add(door);
    for (const wx of [-6, 3, 6]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.1), mat(0x9fd3f0, { roughness: 0.2 }));
      win.position.set(x + wx, 4.5, z + d / 2 + 0.05);
      this.scene.add(win);
    }
  }

  buildSilo(x, z) {
    const r = 3;
    const h = 12;
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat(COLORS.silo, { metalness: 0.3 }));
    silo.position.set(x, h / 2, z);
    silo.castShadow = true;
    this.scene.add(silo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8e9296));
    dome.position.set(x, h, z);
    this.scene.add(dome);
    this.cameraBlockers.push(silo);
    this.addCollider(x, z, r * 2, r * 2, h);
  }

  buildTractor(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 2), mat(COLORS.tractor));
    body.position.y = 1.1;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.8), mat(COLORS.tractor));
    cab.position.set(-0.9, 2.3, 0);
    group.add(body, cab);
    const tireMat = mat(COLORS.tire);
    const wheels = [
      [-1.2, 0.8, 1.1],
      [-1.2, 0.8, -1.1],
      [1.4, 0.5, 1.05],
      [1.4, 0.5, -1.05],
    ];
    for (const [wx, r, wz] of wheels) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 16), tireMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, r, wz);
      group.add(wheel);
    }
    group.traverse((o) => (o.castShadow = true));
    this.scene.add(group);
    this.cameraBlockers.push(body, cab);
    this.addCollider(x, z, 4, 3, 2.2);
  }

  buildTree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 4, 10), mat(COLORS.wood));
    trunk.position.set(x, 2, z);
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 10), mat(COLORS.leaves));
    leaves.position.set(x, 5.2, z);
    leaves.castShadow = true;
    this.scene.add(trunk, leaves);
    this.cameraBlockers.push(trunk);
    this.addCollider(x, z, 1, 1, 6);
  }

  // A box lying on its side with one end open. Built facing +z, then turned
  // in 90-degree steps so every collider stays axis-aligned.
  buildCardboardBox(x, z, side) {
    const w = 1.6;
    const d = 1.2;
    const h = 0.9;
    const t = 0.06;
    const angle = side * (Math.PI / 2);
    const sin = Math.round(Math.sin(angle));
    const cos = Math.round(Math.cos(angle));
    const toWorld = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
    const swap = side % 2 === 1;

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    const cardboard = mat(0xc49a6c);
    const inside = mat(0x8a6a48);

    // [local x, local z, width, depth, bottom, top]
    const parts = [
      [-w / 2 + t / 2, 0, t, d, 0, h], // left wall
      [w / 2 - t / 2, 0, t, d, 0, h], // right wall
      [0, -d / 2 + t / 2, w, t, 0, h], // back wall
      [0, 0, w, d, h - t, h], // roof
    ];
    for (const [lx, lz, pw, pd, bottom, top] of parts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, top - bottom, pd), [
        cardboard, cardboard, cardboard, inside, cardboard, cardboard,
      ]);
      mesh.position.set(lx, (top + bottom) / 2, lz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const [cx, cz] = toWorld(lx, lz);
      const [cw, cd] = swap ? [pd, pw] : [pw, pd];
      this.addCollider(cx, cz, cw, cd, top, bottom > 0 ? { bottom } : {});
    }

    // Flaps folded open around the entrance.
    const flapMat = mat(0xb88d60);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.45), flapMat);
    top.rotation.x = -0.5;
    top.position.set(0, h + Math.sin(0.5) * 0.22, d / 2 + Math.cos(0.5) * 0.22);
    group.add(top);
    for (const s of [-1, 1]) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.03, h * 0.9, 0.4), flapMat);
      flap.rotation.y = s * 0.7;
      flap.position.set(s * (w / 2 + Math.sin(0.7) * 0.2), h * 0.45, d / 2 + Math.cos(0.7) * 0.2);
      group.add(flap);
    }
    group.traverse((o) => (o.castShadow = true));
    this.scene.add(group);

    // The cat is too big to climb on or squeeze in, so it treats the box as solid.
    const [fw, fd] = swap ? [d, w] : [w, d];
    this.addCollider(x, z, fw, fd, h, { catOnly: true });

    const [ix, iz] = swap ? [d / 2 - t - 0.1, w / 2 - t - 0.1] : [w / 2 - t - 0.1, d / 2 - t - 0.1];
    const reach = d / 2 + CONFIG.cat.radius + 0.25;
    this.cardboardBoxes.push({
      x,
      z,
      openX: sin,
      openZ: cos,
      inner: { minX: x - ix, maxX: x + ix, minZ: z - iz, maxZ: z + iz },
      entrance: new THREE.Vector3(x + sin * reach, 0, z + cos * reach),
    });
  }

  buildPuddle(x, z, r) {
    const mud = new THREE.Mesh(new THREE.CircleGeometry(r + 0.35, 40), mat(0x6b5236));
    mud.rotation.x = -Math.PI / 2;
    mud.position.set(x, 0.015, z);
    mud.receiveShadow = true;
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(r, 40),
      new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.03, z);
    water.receiveShadow = true;
    this.scene.add(mud, water);
    this.puddles.push({ x, z, r });
  }

  buildGrassPatch(x, z, r) {
    const count = Math.floor(r * r * 14);
    const blade = new THREE.ConeGeometry(0.09, 1, 4);
    blade.translate(0, 0.5, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true });
    const mesh = new THREE.InstancedMesh(blade, material, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      p.set(x + Math.cos(a) * d, 0, z + Math.sin(a) * d);
      e.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      q.setFromEuler(e);
      const height = 0.9 + Math.random() * 0.6;
      s.set(1, height, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      c.setHSL(0.25 + Math.random() * 0.06, 0.55, 0.28 + Math.random() * 0.12);
      mesh.setColorAt(i, c);
    }
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.grassPatches.push({ x, z, r, material });
  }

  // ------------------------------------------------------------------ queries

  // Highest walkable surface under (x, z) that is at or below maxY.
  groundHeightAt(x, z, maxY = Infinity) {
    let h = 0;
    for (const b of this.boxes) {
      if (b.catOnly) continue;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && b.top <= maxY && b.top > h) {
        h = b.top;
      }
    }
    return h;
  }

  // Lowest roof underside above (x, z) that starts at or above headY.
  ceilingAbove(x, z, headY) {
    let c = Infinity;
    for (const b of this.boxes) {
      if (!b.bottom || b.bottom < headY - 0.05 || b.bottom >= c) continue;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) c = b.bottom;
    }
    return c;
  }

  // Push a circle out of every box for which blocks(box) is true.
  resolveCircle(pos, radius, blocks) {
    for (const b of this.boxes) {
      if (!blocks(b)) continue;
      const cx = Math.min(Math.max(pos.x, b.minX), b.maxX);
      const cz = Math.min(Math.max(pos.z, b.minZ), b.maxZ);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Center is inside the box: push out through the nearest face.
        const pushes = [
          [pos.x - b.minX, -1, 0],
          [b.maxX - pos.x, 1, 0],
          [pos.z - b.minZ, 0, -1],
          [b.maxZ - pos.z, 0, 1],
        ].sort((p, q) => p[0] - q[0]);
        const [dist, sx, sz] = pushes[0];
        pos.x += sx * (dist + radius);
        pos.z += sz * (dist + radius);
      }
    }
  }

  isTallForCat(box) {
    return box.catOnly || box.top > CONFIG.cat.jumpHeight;
  }

  // Round areas the cat won't enter: the mouse hole and the puddles.
  catKeepOuts(radius) {
    return [
      { x: this.home.x, z: this.home.z, r: CONFIG.game.homeRadius + radius + 0.2 },
      ...this.puddles.map((p) => ({ x: p.x, z: p.z, r: p.r + radius * 0.3 })),
    ];
  }

  resolveCat(pos, radius) {
    this.resolveCircle(pos, radius, (b) => this.isTallForCat(b));
    for (const k of this.catKeepOuts(radius)) {
      const dx = pos.x - k.x;
      const dz = pos.z - k.z;
      const d = Math.hypot(dx, dz);
      if (d < k.r && d > 1e-6) {
        pos.x = k.x + (dx / d) * k.r;
        pos.z = k.z + (dz / d) * k.r;
      }
    }
  }

  isValidCatPoint(x, z, radius) {
    if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) return false;
    for (const k of this.catKeepOuts(radius)) {
      if (Math.hypot(x - k.x, z - k.z) < k.r + 0.3) return false;
    }
    for (const b of this.boxes) {
      if (!this.isTallForCat(b)) continue;
      if (x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius) return false;
    }
    return true;
  }

  // Next point to walk toward on the way to `to`, detouring around the first
  // tall obstacle in the way. Cheap stand-in for real pathfinding.
  steer(from, to, radius) {
    let hit = null;
    let hitT = Infinity;
    const inset = radius - 0.05; // slightly smaller than collision so wall-sliding isn't "blocked"
    for (const b of this.boxes) {
      if (!this.isTallForCat(b)) continue;
      const t = segmentHitsRect(
        from.x, from.z, to.x, to.z,
        b.minX - inset, b.maxX + inset, b.minZ - inset, b.maxZ + inset,
      );
      if (t !== null && t < hitT) {
        hit = b;
        hitT = t;
      }
    }
    if (!hit) return to;

    const m = radius + 0.6;
    // Shortest path from -> corners -> to around this one box (6-node Dijkstra).
    const nodes = [
      [from.x, from.z],
      [hit.minX - m, hit.minZ - m],
      [hit.maxX + m, hit.minZ - m],
      [hit.maxX + m, hit.maxZ + m],
      [hit.minX - m, hit.maxZ + m],
      [to.x, to.z],
    ];
    const goal = nodes.length - 1;
    const visible = (a, b) =>
      segmentHitsRect(
        nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1],
        hit.minX - inset, hit.maxX + inset, hit.minZ - inset, hit.maxZ + inset,
      ) === null;
    const dist = nodes.map(() => Infinity);
    const prev = nodes.map(() => -1);
    const done = nodes.map(() => false);
    dist[0] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity || u === goal) break;
      done[u] = true;
      for (let v = 0; v < nodes.length; v++) {
        if (done[v] || !visible(u, v)) continue;
        const d = dist[u] + Math.hypot(nodes[v][0] - nodes[u][0], nodes[v][1] - nodes[u][1]);
        if (d < dist[v]) {
          dist[v] = d;
          prev[v] = u;
        }
      }
    }

    const path = [];
    for (let n = dist[goal] < Infinity ? goal : -1; n > 0; n = prev[n]) path.unshift(n);
    if (!path.length) {
      // Couldn't find a route (e.g. pinned inside the inset box): aim for the nearest corner.
      path.push(1 + [1, 2, 3, 4].map((i) => Math.hypot(nodes[i][0] - from.x, nodes[i][1] - from.z))
        .reduce((best, d, i, arr) => (d < arr[best] ? i : best), 0));
    }
    // Skip a corner we're already standing on so we don't stall there.
    const next = path.find((n) => Math.hypot(nodes[n][0] - from.x, nodes[n][1] - from.z) > 0.3) ?? goal;
    return new THREE.Vector3(nodes[next][0], 0, nodes[next][1]);
  }

  // True if nothing taller than the cat's eye line sits between a and b.
  hasLineOfSight(a, b) {
    for (const box of this.boxes) {
      if (box.top <= CONFIG.cat.eyeHeight) continue;
      // Standing on top of it (cat on a crate) doesn't block your own view.
      if (a.x >= box.minX && a.x <= box.maxX && a.z >= box.minZ && a.z <= box.maxZ) continue;
      if (segmentHitsRect(a.x, a.z, b.x, b.z, box.minX, box.maxX, box.minZ, box.maxZ) !== null) return false;
    }
    return true;
  }

  grassPatchAt(x, z) {
    for (const g of this.grassPatches) {
      if (Math.hypot(x - g.x, z - g.z) < g.r - 0.2) return g;
    }
    return null;
  }

  cardboardAt(x, z) {
    for (const b of this.cardboardBoxes) {
      const { minX, maxX, minZ, maxZ } = b.inner;
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return b;
    }
    return null;
  }

  puddleAt(x, z, margin = 0) {
    for (const p of this.puddles) {
      if (Math.hypot(x - p.x, z - p.z) < p.r + margin) return p;
    }
    return null;
  }

  // ------------------------------------------------------------------- state

  setFoodCount(n) {
    this.foodCount = n;
    this.cheeses.forEach((c, i) => (c.visible = i < n));
  }

  dropFood(x, z) {
    const wedge = new THREE.Mesh(this.wedgeGeo, this.cheeseMat);
    wedge.position.set(x, 0.12, z);
    wedge.castShadow = true;
    const beacon = this.makeBeacon(0xffd23f);
    beacon.position.set(x, 0, z);
    this.scene.add(wedge);
    this.droppedFood.push({ wedge, beacon });
  }

  // Picks up dropped cheese within `radius` of pos. Returns true if it found some.
  takeDroppedFood(pos, radius) {
    const i = this.droppedFood.findIndex(
      (f) => Math.hypot(f.wedge.position.x - pos.x, f.wedge.position.z - pos.z) < radius,
    );
    if (i < 0) return false;
    const [f] = this.droppedFood.splice(i, 1);
    this.scene.remove(f.wedge, f.beacon);
    f.beacon.geometry.dispose();
    f.beacon.material.dispose();
    return true;
  }

  clearDroppedFood() {
    while (this.droppedFood.length) {
      const { wedge } = this.droppedFood[0];
      this.takeDroppedFood(wedge.position, 0.01);
    }
  }

  update(dt, mouse) {
    this.time += dt;
    const patch = mouse.position.y < 0.3 ? this.grassPatchAt(mouse.position.x, mouse.position.z) : null;
    for (const g of this.grassPatches) {
      const target = g === patch ? 0.35 : 1;
      g.material.opacity += (target - g.material.opacity) * Math.min(1, dt * 8);
    }

    this.foodBeacon.visible = !mouse.carrying && this.foodCount > 0;
    this.homeBeacon.visible = mouse.carrying;
    const pulse = 0.14 + Math.sin(this.time * 3) * 0.05;
    this.foodBeacon.material.opacity = pulse;
    this.homeBeacon.material.opacity = pulse;
    for (const f of this.droppedFood) {
      f.beacon.visible = !mouse.carrying;
      f.beacon.material.opacity = pulse;
      f.wedge.rotation.y += dt;
    }
  }
}
