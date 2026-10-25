import * as THREE from 'three';
import { CONFIG } from './config.js';
import { texture, texturedMat, waterNormals } from './textures.js';
import { addWind, addRipples } from './effects.js';
import { bladeGeometry } from './decor.js';
import { mat, FOOD_MODELS } from './builders.js';
import { Mousetrap } from './traps.js';

const E = CONFIG.enemy;

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

// The play space for one level: collision, hiding spots, food, home and traps.
// Level files (src/levels/) lay out the geometry using the builders below.
export class World {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    // Collision volumes: { minX, maxX, minZ, maxZ, top, bottom?, catOnly? }.
    // `bottom` > 0 makes a roof/furniture the mouse can walk under; `catOnly`
    // volumes block only enemies.
    this.boxes = [];
    this.grassPatches = []; // round hiding spots: { x, z, r, material }
    this.hideZones = []; // rectangular hiding spots, e.g. under the sofa
    this.cardboardBoxes = []; // { x, z, openX, openZ, inner, entrance }
    this.puddles = []; // { x, z, r }
    this.traps = [];
    this.cameraBlockers = []; // meshes the camera should not clip through
    this.foodItems = [];
    this.droppedFood = []; // food dropped by the mouse (e.g. jumping into a puddle)
    this.paths = []; // [x1, z1, x2, z2, width] for decoration placement
    this.rippleTimer = 0;
    this.foodCount = 0;
    this.time = 0;

    this.halfX = level.size[0] / 2;
    this.halfZ = level.size[1] / 2;
    this.home = new THREE.Vector3(...level.home);
    this.mouseSpawn = new THREE.Vector3(...level.mouseSpawn);
    this.foodSpot = new THREE.Vector3(...level.foodSpot);
    this.foodToWin = level.foodToWin ?? CONFIG.game.foodToWin;
    this.makeFoodMesh = FOOD_MODELS[level.food];

    this.buildBounds();
    level.build(this);
    this.buildHomeMarker(level.nestColor);
    this.buildFood();
  }

  // ---------------------------------------------------------------- building

  addCollider(x, z, w, d, top, extra = {}) {
    const box = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top, ...extra };
    this.boxes.push(box);
    return box;
  }

  addBox(x, z, w, d, h, colorOrMaterial, { blocksCamera = false, collide = true, y = 0 } = {}) {
    const material = colorOrMaterial instanceof THREE.Material ? colorOrMaterial : mat(colorOrMaterial);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collide) this.addCollider(x, z, w, d, y + h, y > 0 ? { bottom: y } : {});
    if (blocksCamera) this.cameraBlockers.push(mesh);
    return mesh;
  }

  // Trim board (thin box) added to a parent, for corners, frames and the like.
  trim(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Invisible walls just outside the level's bounds.
  buildBounds() {
    const t = 2;
    const { halfX: hx, halfZ: hz } = this;
    this.addCollider(0, -hz - t / 2, hx * 2 + 2 * t, t, 20);
    this.addCollider(0, hz + t / 2, hx * 2 + 2 * t, t, 20);
    this.addCollider(-hx - t / 2, 0, t, hz * 2, 20);
    this.addCollider(hx + t / 2, 0, t, hz * 2, 20);
  }

  // A big textured ground plane with low-frequency color variation to hide tiling.
  buildGroundPlane(textureName, { size = 900, tile = 6, tint = 0xffffff, y = 0, roughness = 1 } = {}) {
    const geo = new THREE.PlaneGeometry(size, size, Math.min(150, Math.ceil(size / 6)), Math.min(150, Math.ceil(size / 6)));
    const pos = geo.attributes.position;
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getY(i);
      const n = Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * 0.5 + Math.sin(z * 0.11 - x * 0.03) * 0.3 + Math.sin((x + z) * 0.23) * 0.2;
      const light = 1 + n * 0.1;
      colors.push(light * (1 + n * 0.04), light, light * (1 - n * 0.06));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(
      geo,
      texturedMat(textureName, size / tile, size / tile, { roughness, vertexColors: true, color: tint }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = y;
    ground.receiveShadow = true;
    this.scene.add(ground);
    return ground;
  }

  addPath(x1, z1, x2, z2, width) {
    this.paths.push([x1, z1, x2, z2, width]);
    // Extend past each end so neighboring segments overlap at the bends, and fade
    // the ends out with vertex alpha so they don't stop in a hard line.
    const len = Math.hypot(x2 - x1, z2 - z1) + width;
    const geo = new THREE.PlaneGeometry(width * 1.6, len, 1, Math.ceil(len));
    const pos = geo.attributes.position;
    const rgba = [];
    for (let i = 0; i < pos.count; i++) {
      const fromEnd = len / 2 - Math.abs(pos.getY(i));
      rgba.push(1, 1, 1, THREE.MathUtils.clamp(fromEnd / width, 0, 1));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(rgba, 4));
    const path = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: texture('path', 1, len / (width * 1.6)),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = Math.atan2(x2 - x1, z2 - z1);
    path.position.set((x1 + x2) / 2, 0.01 + this.paths.length * 0.002, (z1 + z2) / 2);
    path.receiveShadow = true;
    this.scene.add(path);
  }

  buildFence(x1, z1, x2, z2, collide = true) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(x2 - x1, z2 - z1);
    const group = new THREE.Group();
    group.position.set(x1, 0, z1);
    group.rotation.y = angle;

    const woodMat = texturedMat('wood', 1, 1);
    const postCount = Math.max(2, Math.round(len / 2.5) + 1);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1.1, 0.2), woodMat, postCount);
    const m = new THREE.Matrix4();
    for (let i = 0; i < postCount; i++) {
      m.makeTranslation(0, 0.55, (i / (postCount - 1)) * len);
      posts.setMatrixAt(i, m);
    }
    posts.castShadow = true;
    group.add(posts);

    const railMat = texturedMat('wood', len / 3, 1);
    for (const y of [0.4, 0.85]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, len), railMat);
      rail.position.set(0, y, len / 2);
      rail.castShadow = true;
      group.add(rail);
    }
    this.scene.add(group);

    if (collide) {
      // Fences only run along an axis, so an AABB is exact.
      const w = Math.abs(x2 - x1) + 0.25;
      const d = Math.abs(z2 - z1) + 0.25;
      this.addCollider((x1 + x2) / 2, (z1 + z2) / 2, w, d, 1.0);
    }
  }

  buildTree(x, z) {
    const rng = () => Math.abs(Math.sin(x * 12.9898 + z * 78.233 + (this._treeSeed = (this._treeSeed ?? 0) + 1)) * 43758.5453) % 1;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 4.5, 8), texturedMat('bark', 2, 2));
    trunk.position.set(x, 2.25, z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    const greens = [0x3f8a3a, 0x4d9a40, 0x357a33, 0x5aa648];
    for (let i = 0; i < 5; i++) {
      const r = 1.6 + rng() * 1.1;
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(greens[i % greens.length], { flatShading: true }));
      const a = rng() * Math.PI * 2;
      blob.position.set(x + Math.cos(a) * 1.3 * (i ? 1 : 0), 5.2 + rng() * 1.6 + (i ? 0 : 0.8), z + Math.sin(a) * 1.3 * (i ? 1 : 0));
      blob.castShadow = true;
      blob.receiveShadow = true;
      this.scene.add(blob);
    }
    this.cameraBlockers.push(trunk);
    this.addCollider(x, z, 1, 1, 6);
  }

  // A box lying on its side with one end open. Built facing +z, then turned
  // in 90-degree steps so every collider stays axis-aligned.
  // side: 0 opens toward +z, 1 +x, 2 -z, 3 -x.
  buildCardboardBox(x, z, side, { w = 1.6, d = 1.2, h = 0.9, material = null } = {}) {
    const t = 0.06;
    const angle = side * (Math.PI / 2);
    const sin = Math.round(Math.sin(angle));
    const cos = Math.round(Math.cos(angle));
    const toWorld = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
    const swap = side % 2 === 1;

    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    const outside = material ?? texturedMat('cardboard', 1, 1);
    const inside = mat(0x6f5236);

    // [local x, local z, width, depth, bottom, top]
    const parts = [
      [-w / 2 + t / 2, 0, t, d, 0, h], // left wall
      [w / 2 - t / 2, 0, t, d, 0, h], // right wall
      [0, -d / 2 + t / 2, w, t, 0, h], // back wall
      [0, 0, w, d, h - t, h], // roof
    ];
    for (const [lx, lz, pw, pd, bottom, top] of parts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, top - bottom, pd), [
        outside, outside, outside, inside, outside, outside,
      ]);
      mesh.position.set(lx, (top + bottom) / 2, lz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const [cx, cz] = toWorld(lx, lz);
      const [cw, cd] = swap ? [pd, pw] : [pw, pd];
      this.addCollider(cx, cz, cw, cd, top, bottom > 0 ? { bottom } : {});
    }

    if (!material) {
      // Cardboard flaps folded open around the entrance.
      const flapMat = texturedMat('cardboard', 0.5, 0.3, { color: 0xe6d3bf });
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
    }
    group.traverse((o) => (o.castShadow = true));
    this.scene.add(group);

    // Enemies are too big to climb on or squeeze in, so they treat the box as solid.
    const [fw, fd] = swap ? [d, w] : [w, d];
    this.addCollider(x, z, fw, fd, h, { catOnly: true });

    const [ix, iz] = swap ? [d / 2 - t - 0.1, w / 2 - t - 0.1] : [w / 2 - t - 0.1, d / 2 - t - 0.1];
    const reach = d / 2 + CONFIG.cats.farm.radius + 0.3;
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
    const mud = new THREE.Mesh(
      new THREE.CircleGeometry(r + 0.5, 40),
      texturedMat('dirt', r / 2, r / 2, { color: 0x8a7258, roughness: 0.7 }),
    );
    mud.rotation.x = -Math.PI / 2;
    mud.position.set(x, 0.015, z);
    mud.receiveShadow = true;
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(r, 48),
      addRipples(
        new THREE.MeshStandardMaterial({
          color: 0x3f6f9a,
          roughness: 0.06,
          metalness: 0.2,
          transparent: true,
          opacity: 0.88,
          envMapIntensity: 1.8,
          normalMap: waterNormals(r / 1.5),
          normalScale: new THREE.Vector2(0.3, 0.3),
        }),
      ),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, 0.03, z);
    water.receiveShadow = true;
    this.scene.add(mud, water);
    this.puddles.push({ x, z, r });

    // A few reeds around the bank.
    const reedMat = mat(0x5d7a35);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.sin(x + i) * 0.4;
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.8 + (i % 3) * 0.3, 4), reedMat);
      reed.position.set(x + Math.cos(a) * (r + 0.3), 0.45, z + Math.sin(a) * (r + 0.3));
      reed.rotation.z = Math.sin(i * 3.1) * 0.2;
      reed.castShadow = true;
      this.scene.add(reed);
    }
  }

  // Round patch of tall blades the mouse can hide in: grass, weeds or loose straw.
  buildGrassPatch(x, z, r, { hue = 0.25, hueRange = 0.06, sat = 0.55, light = 0.28, height = 0.9, wind = 0.12 } = {}) {
    const count = Math.floor(r * r * 22);
    const material = addWind(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        transparent: true,
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
      wind,
    );
    const mesh = new THREE.InstancedMesh(bladeGeometry(0.16), material, count);
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
      s.set(1, height + Math.random() * 0.6, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      c.setHSL(hue + Math.random() * hueRange, sat, light + Math.random() * 0.12);
      mesh.setColorAt(i, c);
    }
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.grassPatches.push({ x, z, r, material });
  }

  // Rectangular hiding spot (under furniture and the like). The furniture's own
  // colliders keep enemies out; this just marks where the mouse counts as hidden.
  addHideZone(minX, maxX, minZ, maxZ) {
    this.hideZones.push({ minX, maxX, minZ, maxZ });
  }

  addTrap(x, z, angle = 0) {
    const trap = new Mousetrap(x, z, angle);
    this.scene.add(trap.group);
    this.traps.push(trap);
    return trap;
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

  // Nest disc marking the safe zone, plus the "bring it home" beacon.
  buildHomeMarker(color = 0xb8a070) {
    const nest = new THREE.Mesh(
      new THREE.CylinderGeometry(CONFIG.game.homeRadius, CONFIG.game.homeRadius + 0.1, 0.03, 32),
      texturedMat('straw', 3, 3, { color }),
    );
    nest.position.set(this.home.x, 0.02, this.home.z);
    nest.receiveShadow = true;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.game.homeRadius, 0.06, 5, 32),
      texturedMat('straw', 8, 1, { color: new THREE.Color(color).multiplyScalar(0.9) }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(this.home.x, 0.06, this.home.z);
    rim.receiveShadow = true;
    this.scene.add(nest, rim);

    this.homeBeacon = this.makeBeacon(0x6dff8a);
    this.homeBeacon.position.set(this.home.x, 0, this.home.z);
  }

  // One food item per piece still to collect, arranged around the food spot.
  // The food spot's y is the surface it sits on (0 = floor; Level 4 puts it up
  // on a bookcase). The level draws whatever it sits on (plate, jar, sack).
  buildFood() {
    const { x, y, z } = this.foodSpot;
    for (let i = 0; i < this.foodToWin; i++) {
      const item = this.makeFoodMesh();
      const a = (i / this.foodToWin) * Math.PI * 2;
      item.position.set(x + Math.cos(a) * 0.45, y + 0.16, z + Math.sin(a) * 0.45);
      item.rotation.y = a;
      item.traverse((o) => (o.castShadow = true));
      this.scene.add(item);
      this.foodItems.push(item);
    }
    this.foodBeacon = this.makeBeacon(0xffd23f);
    this.foodBeacon.position.set(x, y, z);
  }

  // Is the mouse close enough to pick up food from the pile?
  atFood(pos) {
    const f = this.foodSpot;
    return Math.hypot(pos.x - f.x, pos.z - f.z) < CONFIG.game.foodPickupRadius && Math.abs(pos.y - f.y) < 0.5;
  }

  // ------------------------------------------------------------------ queries

  // Highest walkable surface under (x, z) that is at or below maxY. `solidOnly`
  // skips raised things (seats, roofs) that an enemy would walk under instead.
  groundHeightAt(x, z, maxY = Infinity, solidOnly = false) {
    let h = 0;
    for (const b of this.boxes) {
      if (b.catOnly || (solidOnly && b.bottom)) continue;
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

  // Does this volume stop an enemy? They hop onto anything low, walk under
  // anything high, and can't enter cardboard boxes.
  blocksEnemy(box) {
    if ((box.bottom ?? 0) >= E.clearance) return false;
    return box.catOnly || box.top > E.jumpHeight;
  }

  // Round areas enemies won't enter: the mouse hole, and puddles for those that hate water.
  keepOuts(radius, avoidWater) {
    const zones = [{ x: this.home.x, z: this.home.z, r: CONFIG.game.homeRadius + radius + 0.2 }];
    if (avoidWater) for (const p of this.puddles) zones.push({ x: p.x, z: p.z, r: p.r + radius * 0.3 });
    return zones;
  }

  resolveEnemy(pos, radius, avoidWater = true) {
    this.resolveCircle(pos, radius, (b) => this.blocksEnemy(b));
    for (const k of this.keepOuts(radius, avoidWater)) {
      const dx = pos.x - k.x;
      const dz = pos.z - k.z;
      const d = Math.hypot(dx, dz);
      if (d < k.r && d > 1e-6) {
        pos.x = k.x + (dx / d) * k.r;
        pos.z = k.z + (dz / d) * k.r;
      }
    }
  }

  isValidEnemyPoint(x, z, radius, avoidWater = true) {
    if (Math.abs(x) > this.halfX - 1 || Math.abs(z) > this.halfZ - 1) return false;
    for (const k of this.keepOuts(radius, avoidWater)) {
      if (Math.hypot(x - k.x, z - k.z) < k.r + 0.3) return false;
    }
    for (const b of this.boxes) {
      if (!this.blocksEnemy(b)) continue;
      if (x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius) return false;
    }
    return true;
  }

  // Next point to walk toward on the way to `to`, detouring around the first
  // obstacle in the way. Cheap stand-in for real pathfinding.
  steer(from, to, radius) {
    let hit = null;
    let hitT = Infinity;
    const inset = radius - 0.05; // slightly smaller than collision so wall-sliding isn't "blocked"
    for (const b of this.boxes) {
      if (!this.blocksEnemy(b)) continue;
      const t = segmentHitsRect(from.x, from.z, to.x, to.z, b.minX - inset, b.maxX + inset, b.minZ - inset, b.maxZ + inset);
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
    // A corner tucked into a neighboring wall (or off the map) is a dead end:
    // heading for it pins the walker in the corner, so leave it out.
    const open = nodes.map(([x, z], i) => {
      if (i === 0 || i === goal) return true;
      if (Math.abs(x) > this.halfX - radius || Math.abs(z) > this.halfZ - radius) return false;
      return !this.boxes.some(
        (b) => b !== hit && this.blocksEnemy(b) && x > b.minX - inset && x < b.maxX + inset && z > b.minZ - inset && z < b.maxZ + inset,
      );
    });
    const visible = (a, b) =>
      open[a] && open[b] &&
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
      // Couldn't find a route (e.g. pinned inside the inset box): aim for the nearest open corner.
      const corners = [1, 2, 3, 4].filter((i) => open[i]);
      const dist2 = (i) => Math.hypot(nodes[i][0] - from.x, nodes[i][1] - from.z);
      if (corners.length) path.push(corners.reduce((best, i) => (dist2(i) < dist2(best) ? i : best)));
    }
    // Skip a corner we're already standing on so we don't stall there.
    const next = path.find((n) => Math.hypot(nodes[n][0] - from.x, nodes[n][1] - from.z) > 0.3) ?? goal;
    return new THREE.Vector3(nodes[next][0], 0, nodes[next][1]);
  }

  // True if nothing between a and b blocks an enemy's eye line.
  hasLineOfSight(a, b) {
    const inside = (p, box) => p.x >= box.minX && p.x <= box.maxX && p.z >= box.minZ && p.z <= box.maxZ;
    for (const box of this.boxes) {
      if (box.top <= E.eyeHeight || (box.bottom ?? 0) >= E.eyeHeight) continue;
      // Standing on top of it (cat on a crate) doesn't block your own view...
      if (inside(a, box)) continue;
      // ...and a mouse standing on top of it is in plain view, not hidden inside it.
      if ((b.y ?? 0) >= box.top - 0.1 && inside(b, box)) continue;
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

  hideZoneAt(x, z) {
    return this.hideZones.find((h) => x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ) ?? null;
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

  // Open ground for decorations: not on paths, water, hiding spots, obstacles or home.
  isOpenGround(x, z, margin = 0.5) {
    if (Math.abs(x) > this.halfX - 1 || Math.abs(z) > this.halfZ - 1) return false;
    if (Math.hypot(x - this.home.x, z - this.home.z) < CONFIG.game.homeRadius + 1) return false;
    if (Math.hypot(x - this.foodSpot.x, z - this.foodSpot.z) < 2) return false;
    if (this.puddleAt(x, z, 0.8)) return false;
    for (const g of this.grassPatches) if (Math.hypot(x - g.x, z - g.z) < g.r + margin) return false;
    for (const b of this.boxes) {
      if (x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin) return false;
    }
    for (const [x1, z1, x2, z2, w] of this.paths) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - (x1 + dx * t), z - (z1 + dz * t)) < w * 0.7) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------- state

  setFoodCount(n) {
    this.foodCount = n;
    this.foodItems.forEach((c, i) => (c.visible = i < n));
  }

  dropFood(x, z) {
    const item = this.makeFoodMesh();
    item.position.set(x, 0.12, z);
    item.traverse((o) => (o.castShadow = true));
    const beacon = this.makeBeacon(0xffd23f);
    beacon.position.set(x, 0, z);
    this.scene.add(item);
    this.droppedFood.push({ item, beacon });
  }

  // Picks up dropped food within `radius` of pos. Returns true if it found some.
  takeDroppedFood(pos, radius) {
    const i = this.droppedFood.findIndex(
      (f) => Math.hypot(f.item.position.x - pos.x, f.item.position.z - pos.z) < radius,
    );
    if (i < 0) return false;
    const [f] = this.droppedFood.splice(i, 1);
    this.scene.remove(f.item, f.beacon);
    f.beacon.geometry.dispose();
    f.beacon.material.dispose();
    return true;
  }

  clearDroppedFood() {
    while (this.droppedFood.length) this.takeDroppedFood(this.droppedFood[0].item.position, 0.01);
  }

  // Checks the mouse against armed traps. Returns { trap, full } for a snap, else null.
  checkTraps(mouse) {
    if (mouse.position.y > 0.3) return null;
    for (const trap of this.traps) {
      const hit = trap.check(mouse.position, CONFIG.mouse.radius);
      if (hit) return { trap, full: hit === 'full' };
    }
    return null;
  }

  update(dt, mouse, effects) {
    this.time += dt;

    // Occasional ripples so the puddles read as water.
    this.rippleTimer -= dt;
    if (effects && this.puddles.length && this.rippleTimer <= 0) {
      this.rippleTimer = 0.8 + Math.random() * 1.2;
      const p = this.puddles[Math.floor(Math.random() * this.puddles.length)];
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * (p.r - 0.8);
      effects.ripple({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }, 0.8, 1.6);
    }
    const patch = mouse.position.y < 0.3 ? this.grassPatchAt(mouse.position.x, mouse.position.z) : null;
    for (const g of this.grassPatches) {
      const target = g === patch ? 0.35 : 1;
      g.material.opacity += (target - g.material.opacity) * Math.min(1, dt * 8);
    }
    for (const trap of this.traps) trap.update(dt);

    for (const item of this.foodItems) item.rotation.y += this.level.spinFood ? dt * 1.5 : 0;
    this.foodBeacon.visible = !mouse.carrying && this.foodCount > 0;
    this.homeBeacon.visible = mouse.carrying;
    const pulse = 0.14 + Math.sin(this.time * 3) * 0.05;
    this.foodBeacon.material.opacity = pulse;
    this.homeBeacon.material.opacity = pulse;
    for (const f of this.droppedFood) {
      f.beacon.visible = !mouse.carrying;
      f.beacon.material.opacity = pulse;
      f.item.rotation.y += dt;
    }
  }
}
