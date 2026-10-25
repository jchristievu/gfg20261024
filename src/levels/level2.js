import * as THREE from 'three';
import { texturedMat } from '../textures.js';
import { mat } from '../builders.js';
import { Cat } from '../enemies/cat.js';
import { Dog } from '../enemies/dog.js';
import { addArchedHole } from './level1.js';

// Level 2: inside the farmhouse. From a mouse hole in the living room to the
// cookies in the pantry, past a lazy ragdoll cat and a scattering of mousetraps.
// Rooms: living room (west), kitchen (east), pantry (northeast corner).
const WALL_H = 10;

export default {
  id: 2,
  name: 'The Farmhouse',
  intro:
    'Sneak through the house and bring 3 cookies home from the pantry. The ragdoll cat is lazy: it has to actually see you, ' +
    'tires out after a short chase, and naps a lot, but noise wakes it. Hide under the furniture. ' +
    "The dog patrols the house. It won't hurt you, but if it spots you it barks and the ragdoll comes running. " +
    'Watch for mousetraps: brushing one stuns you and the snap is loud. Step on the trigger and it gets you.',
  outro: 'Three cookies, zero snapped tails. The ragdoll slept through most of it.',
  outdoor: false,
  size: [64, 44],
  home: [-29.3, 0, 14],
  mouseSpawn: [-29.6, 0, 14],
  foodSpot: [26.5, 0, -16],
  food: 'cookie',
  nestColor: 0xa08878,
  lights: [
    [-14, 8, 0, 9, 0xffe2b8],
    [18, 8, 2, 8, 0xfff0d8],
    [26, 7, -16, 4, 0xffe2b8],
  ],

  createEnemies(scene, world) {
    return [
      new Cat(scene, world, 'ragdoll', [-6, 0, 17.5]),
      // The dog's patrol: a loop through the living room, doorway and kitchen.
      new Dog(scene, world, [
        [-22, 2], [-10, 1], [3, 1.5], [10, 12], [24, 9], [21, -1.5], [8, -2.5], [-4, -10], [-20, -9.5],
      ]),
    ];
  },

  build(world) {
    world.buildGroundPlane('woodFloor', { size: 200, tile: 8 });
    // Kitchen and pantry get tile instead of hardwood.
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(27, 42), texturedMat('tile', 27 / 4, 42 / 4, { roughness: 0.5 }));
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(17.5, 0.004, 0);
    tile.receiveShadow = true;
    world.scene.add(tile);

    buildWalls(world);
    buildLivingRoom(world);
    buildKitchen(world);
    buildPantry(world);

    addArchedHole(world.scene, -30.98, 14, Math.PI / 2, 0xf4efe6);

    const traps = [
      [-24, 1.5, 0.3],
      [-16, -10.6, 0],
      [-9.5, 9.5, 1.2],
      [-12, 15.5, 0.5],
      [4, 0, Math.PI / 2], // middle of the doorway to the kitchen
      [12, -15.5, 0],
      [16, 10.6, 0],
      [24, -10, 0], // pantry doorway
      [25, -13.5, 0.7],
      [28.4, -14.4, 1.2],
    ];
    for (const [x, z, a] of traps) world.addTrap(x, z, a);
  },
};

// ------------------------------------------------------------------ helpers

// These furniture builders are shared with Level 4 (upstairs in the same house).
export function wall(world, x, z, w, d, material) {
  world.addBox(x, z, w, d, WALL_H, material, { blocksCamera: true });
  // Baseboard trim around the foot of the wall.
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.6, d + 0.16), mat(0xf4efe6, { roughness: 0.6 }));
  base.position.set(x, 0.3, z);
  base.receiveShadow = true;
  world.scene.add(base);
}

export function legs(world, cx, cz, w, d, height, size, material) {
  const ox = w / 2 - size / 2 - 0.05;
  const oz = d / 2 - size / 2 - 0.05;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) world.addBox(cx + sx * ox, cz + sz * oz, size, size, height, material);
  }
}

// Sofa or armchair (w along x, d along z) raised on short legs so the mouse
// can hide underneath. `back` is the side the backrest is on: 'n' 's' 'e' 'w'.
export function couch(world, cx, cz, w, d, back, fabric) {
  const clear = 0.6;
  const wood = texturedMat('wood', 1, 1, { color: 0x5a3a24 });
  legs(world, cx, cz, w, d, clear, 0.3, wood);
  world.addBox(cx, cz, w, d, 1.0, fabric, { y: clear });
  const b = 0.9;
  const backRect = {
    n: [cx, cz - d / 2 + b / 2, w, b],
    s: [cx, cz + d / 2 - b / 2, w, b],
    w: [cx - w / 2 + b / 2, cz, b, d],
    e: [cx + w / 2 - b / 2, cz, b, d],
  }[back];
  world.addBox(backRect[0], backRect[1], backRect[2], backRect[3], 2.7, fabric, { y: clear });
  const alongX = back === 'n' || back === 's';
  for (const s of [-1, 1]) {
    if (alongX) world.addBox(cx + s * (w / 2 - 0.4), cz, 0.8, d, 1.7, fabric, { y: clear });
    else world.addBox(cx, cz + s * (d / 2 - 0.4), w, 0.8, 1.7, fabric, { y: clear });
  }
  // Seat cushions (visual only).
  const cushion = mat(new THREE.Color(fabric.color).offsetHSL(0, 0, 0.05).getHex(), { roughness: 1 });
  const n = Math.max(1, Math.round((alongX ? w : d) / 3));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const c = new THREE.Mesh(new THREE.BoxGeometry(alongX ? (w - 1.8) / n - 0.1 : d - 1.4, 0.35, alongX ? d - 1.4 : (d - 1.8) / n - 0.1), cushion);
    c.position.set(cx + (alongX ? t * (w - 1.8) : 0), clear + 1.18, cz + (alongX ? 0 : t * (d - 1.8)));
    c.castShadow = true;
    world.scene.add(c);
  }
  world.addHideZone(cx - w / 2 + 0.45, cx + w / 2 - 0.45, cz - d / 2 + 0.45, cz + d / 2 - 0.45);
}

// The armchair from couch(), turned to face `yaw` (radians; 0 faces +z) so it
// can sit angled in a corner. Colliders are axis-aligned, so the angled shape
// is approximated: seat, backrest and arms each get a box inside their outline.
export function cornerArmchair(world, cx, cz, yaw, fabric, { w = 3.6, d = 3.4 } = {}) {
  const clear = 0.6;
  const wood = texturedMat('wood', 1, 1, { color: 0x5a3a24 });
  const cushionMat = mat(new THREE.Color(fabric.color).offsetHSL(0, 0, 0.05).getHex(), { roughness: 1 });
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  group.rotation.y = yaw;
  world.scene.add(group);
  // Local layout, seat facing +z.
  const part = (lx, lz, pw, pd, h, y, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, h, pd), material);
    mesh.position.set(lx, y + h / 2, lz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const toWorld = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(group.position);
  const collider = (lx, lz, size, top, bottom) => {
    const p = toWorld(lx, lz);
    world.addCollider(p.x, p.z, size, size, top, bottom ? { bottom } : {});
  };

  const lx = w / 2 - 0.2;
  const lz = d / 2 - 0.2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      part(sx * lx, sz * lz, 0.3, 0.3, clear, 0, wood);
      collider(sx * lx, sz * lz, 0.3, clear);
    }
  }
  const b = 0.9;
  part(0, 0, w, d, 1.0, clear, fabric); // base
  part(0, -d / 2 + b / 2, w, b, 2.7, clear, fabric); // backrest
  for (const s of [-1, 1]) part(s * (w / 2 - 0.4), 0, 0.8, d, 1.7, clear, fabric); // arms
  part(0, b / 2 - 0.25, w - 1.8, d - 1.4, 0.35, clear + 1.0, cushionMat); // seat cushion

  // Collision: the seat block, a block in the middle of the backrest, one per arm.
  const inner = Math.min(w, d) / Math.SQRT2;
  collider(0, 0.2, inner, clear + 1.0, clear);
  collider(0, -d / 2 + b / 2, 1.2, clear + 2.7, clear);
  for (const s of [-1, 1]) collider(s * (w / 2 - 0.4), 0, 0.8, clear + 1.7, clear);
  // Hide underneath: the square that fits inside the angled footprint.
  const h = inner / 2 - 0.3;
  world.addHideZone(cx - h, cx + h, cz - h, cz + h);
}

export function table(world, cx, cz, w, d, height, material) {
  const thick = 0.25;
  world.addBox(cx, cz, w, d, thick, material, { y: height - thick });
  legs(world, cx, cz, w, d, height - thick, 0.35, material);
}

export function chair(world, cx, cz, back, material) {
  const s = 1.8;
  world.addBox(cx, cz, s, s, 0.15, material, { y: 1.65 });
  legs(world, cx, cz, s, s, 1.65, 0.2, material);
  const off = s / 2 - 0.08;
  const [bx, bz, bw, bd] = {
    n: [cx, cz - off, s, 0.15],
    s: [cx, cz + off, s, 0.15],
    w: [cx - off, cz, 0.15, s],
    e: [cx + off, cz, 0.15, s],
  }[back];
  world.addBox(bx, bz, bw, bd, 2.2, material, { y: 1.8 });
}

// Tall cabinet/dresser on legs with a mouse-sized gap underneath.
export function raisedCabinet(world, cx, cz, w, d, height, material) {
  const clear = 0.6;
  legs(world, cx, cz, w, d, clear, 0.3, material);
  world.addBox(cx, cz, w, d, height - clear, material, { y: clear });
  world.addHideZone(cx - w / 2 + 0.4, cx + w / 2 - 0.4, cz - d / 2 + 0.4, cz + d / 2 - 0.4);
}

export function windowPane(world, x, y, z, w, h, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xcfe8ff }));
  g.add(glass);
  const frame = mat(0xffffff, { roughness: 0.6 });
  const bar = (bw, bh, bx, by) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.12), frame);
    m.position.set(bx, by, 0.04);
    g.add(m);
  };
  bar(w + 0.3, 0.2, 0, h / 2);
  bar(w + 0.3, 0.3, 0, -h / 2);
  bar(0.2, h, -w / 2, 0);
  bar(0.2, h, w / 2, 0);
  bar(0.1, h, 0, 0);
  bar(w, 0.1, 0, 0);
  world.scene.add(g);
}

// ------------------------------------------------------------------ rooms

function buildWalls(world) {
  const paper = (len) => texturedMat('wallpaper', len / 6, WALL_H / 6);
  const paint = (len) => texturedMat('siding', len / 8, 1, { color: 0xdfe8e4 });
  wall(world, -14, -21.5, 36, 1, paper(36)); // north, living room
  wall(world, 18, -21.5, 28, 1, paint(28)); // north, kitchen/pantry
  wall(world, -14, 21.5, 36, 1, paper(36));
  wall(world, 18, 21.5, 28, 1, paint(28));
  wall(world, -31.5, 0, 1, 42, paper(42));
  wall(world, 31.5, 0, 1, 42, paint(42));
  // Living room / kitchen divider with a doorway at z -4..4.
  wall(world, 4, -12.5, 1, 17, paper(17));
  wall(world, 4, 12.5, 1, 17, paper(17));
  // Pantry: west wall and a south wall with a doorway at x 22..26.
  wall(world, 20, -15.75, 1, 10.5, paint(10.5));
  wall(world, 21.25, -10, 1.5, 1, paint(1.5));
  wall(world, 28.75, -10, 5.5, 1, paint(5.5));

  // Door frames.
  const trimMat = mat(0xf4efe6, { roughness: 0.6 });
  for (const s of [-1, 1]) world.addBox(4, s * 4.1, 1.3, 0.25, 8, trimMat, { collide: false });
  world.addBox(4, 0, 1.3, 8.4, 0.4, trimMat, { collide: false, y: 8 });
  world.addBox(24, -10, 4.4, 1.3, 0.4, trimMat, { collide: false, y: 7 });

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(64, 44), mat(0xf2ede4, { side: THREE.DoubleSide }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_H;
  world.scene.add(ceiling);

  windowPane(world, -22, 6, -20.95, 5, 3.5);
  windowPane(world, -8, 6, -20.95, 5, 3.5);
  windowPane(world, -20, 6, 20.95, 5, 3.5, Math.PI);
}

function buildLivingRoom(world) {
  const fabric = mat(0x4f6f8f, { roughness: 1 });
  const wood = texturedMat('wood', 1, 1, { color: 0x8a5a36 });

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), texturedMat('rug', 1, 1, { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-16, 0.01, -8.5);
  rug.receiveShadow = true;
  world.scene.add(rug);

  couch(world, -16, -14, 9, 3.6, 'n', fabric); // sofa
  couch(world, -26, -4, 3.6, 3.4, 'w', mat(0x8a5a4a, { roughness: 1 })); // armchair
  table(world, -16, -7, 6, 3, 2.0, wood); // coffee table: walk right under it

  world.addBox(-30.2, -16, 1.6, 7, 8, texturedMat('wood', 1, 2, { color: 0xb08a6a }), { blocksCamera: true }); // bookshelf
  // Books on the shelves (visual only).
  const bookColors = [0x8e3b32, 0x2f5a3a, 0x2f3f5a, 0xc8a050, 0x5a3a5a];
  for (let shelf = 0; shelf < 4; shelf++) {
    for (let i = 0; i < 10; i++) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2 + (i % 3) * 0.2, 0.6), mat(bookColors[(i + shelf) % bookColors.length]));
      book.position.set(-29.3, 1.0 + shelf * 1.9, -19 + i * 0.62);
      world.scene.add(book);
    }
  }
  world.addBox(-28.5, -10, 1.6, 1.2, 0.7, mat(0x8e3b32)); // stack of books to hop on

  // Fireplace with mantel and a low hearth.
  world.addBox(-14, 20.2, 8, 1.6, 6, texturedMat('stone', 2, 1.5, { color: 0xb08070 }), { blocksCamera: true });
  world.addBox(-14, 19.2, 9, 0.6, 0.3, mat(0x5a3a24), { collide: false, y: 6 });
  const firebox = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3), new THREE.MeshBasicMaterial({ color: 0x140c08 }));
  firebox.position.set(-14, 1.5, 19.38);
  firebox.rotation.y = Math.PI;
  world.scene.add(firebox);
  world.addBox(-14, 18.2, 9, 2.4, 0.25, texturedMat('stone', 3, 1, { color: 0x9a8a80 }));

  // The ragdoll's bed by the fire.
  world.addCollider(-6, 17.5, 2.6, 2.6, 0.4);
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.4, 24), mat(0xc87a8a, { roughness: 1 }));
  cushion.position.set(-6, 0.2, 17.5);
  cushion.receiveShadow = true;
  world.scene.add(cushion);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.3, 8, 24), mat(0xb86a7a, { roughness: 1 }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(-6, 0.5, 17.5);
  world.scene.add(rim);

  raisedCabinet(world, -4, -19.8, 7, 2.4, 3.4, texturedMat('wood', 2, 1, { color: 0xd0a070 })); // dresser
  world.buildCardboardBox(-22, 8, 1, { material: texturedMat('cardboard', 1, 1, { color: 0x9fbbe0 }) }); // shoebox
  world.buildCardboardBox(-2, -6, 1, { w: 1.8, d: 1.4, h: 1.1, material: mat(0x8a8f96, { roughness: 0.6 }) }); // pet carrier by the doorway
  world.addBox(-8, 4, 2, 2, 1.4, texturedMat('straw', 2, 1, { color: 0xc8b08a })); // laundry basket

  // Floor lamp and potted plant.
  world.addBox(-29.5, 2, 0.4, 0.4, 7, mat(0x3a3a3a, { metalness: 0.5 }));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 1.4, 16, 1, true), mat(0xf2e6c8, { side: THREE.DoubleSide, emissive: 0x403020 }));
  shade.position.set(-29.5, 7.4, 2);
  world.scene.add(shade);
  world.addBox(-28.5, 19, 1.4, 1.4, 1.6, mat(0xb86a3a));
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mat(0x3f8a3a, { flatShading: true }));
    leaf.position.set(-28.5 + Math.cos(i) * 0.6, 2.4 + (i % 3) * 0.5, 19 + Math.sin(i) * 0.6);
    world.scene.add(leaf);
  }
}

function buildKitchen(world) {
  const cabinet = texturedMat('siding', 3, 1, { color: 0xf4eee2 });
  const top = mat(0x4a4a50, { roughness: 0.4 });

  // Counters along the north wall with fridge, sink and stove.
  world.addBox(13.5, -19.8, 12, 2.4, 3.6, cabinet, { blocksCamera: true });
  world.addBox(13.5, -19.7, 12.2, 2.7, 0.2, top, { collide: false, y: 3.6 });
  world.addBox(6.25, -19.6, 2.5, 2.8, 7.5, mat(0xeef0f2, { roughness: 0.3, metalness: 0.2 }), { blocksCamera: true });
  world.addBox(16, -19.7, 2.6, 2.2, 0.06, mat(0x222222), { collide: false, y: 3.81 }); // stovetop
  world.addBox(11, -19.6, 2, 1.6, 0.05, mat(0xb9bec2, { metalness: 0.8, roughness: 0.3 }), { collide: false, y: 3.81 }); // sink
  world.addBox(13.5, -20.6, 12, 1.0, 3, cabinet, { collide: false, y: 6.5 }); // upper cabinets

  // Counter along the east wall.
  world.addBox(29.8, -0.5, 2.4, 17, 3.6, cabinet, { blocksCamera: true });
  world.addBox(29.7, -0.5, 2.7, 17.2, 0.2, top, { collide: false, y: 3.6 });

  // Table and chairs: open space underneath, chair legs to weave through.
  const wood = texturedMat('wood', 1, 1, { color: 0xa87a4a });
  table(world, 16, 4, 8, 5, 3, wood);
  chair(world, 13.5, 8.2, 's', wood);
  chair(world, 18.5, 8.2, 's', wood);
  chair(world, 13.5, -0.2, 'n', wood);
  chair(world, 18.5, -0.2, 'n', wood);

  raisedCabinet(world, 18, 20, 8, 2, 6, texturedMat('wood', 2, 1, { color: 0xb8c8a8 })); // hutch
  world.buildCardboardBox(24, 13, 3, { h: 1.1, material: texturedMat('cardboard', 1, 1, { color: 0xd6b48a }) }); // paper bag
  world.buildCardboardBox(12, -7, 3); // empty soda case
  raisedCabinet(world, 24, -4, 3, 2, 3, mat(0xc8ccd0, { metalness: 0.5, roughness: 0.4 })); // rolling cart outside the pantry

  // Cat food and water bowls.
  world.addBox(7, 18, 1, 1, 0.35, mat(0xc0392b, { roughness: 0.4 }));
  world.addBox(8.6, 18, 1, 1, 0.35, mat(0x2f6f9f, { roughness: 0.4 }));
  // Trash can.
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.85, 3, 16), mat(0x9aa4ab, { metalness: 0.6, roughness: 0.4 }));
  can.position.set(29.5, 1.5, 17.5);
  can.castShadow = true;
  world.scene.add(can);
  world.addCollider(29.5, 17.5, 1.9, 1.9, 3);
}

function buildPantry(world) {
  const shelfMat = texturedMat('wood', 2, 2, { color: 0xe0c090 });
  world.addBox(25.75, -20.2, 10.5, 1.6, 8, shelfMat, { blocksCamera: true });
  world.addBox(30.2, -14.95, 1.6, 8.9, 8, shelfMat, { blocksCamera: true });
  // Jars and cans on the shelves (visual only).
  const colors = [0xc0392b, 0xe6b84a, 0x7a9a5a, 0xd8d0c0, 0x8a5a3a];
  for (let i = 0; i < 14; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), mat(colors[i % colors.length], { roughness: 0.5 }));
    jar.position.set(21.2 + (i % 7) * 1.4, 2.5 + Math.floor(i / 7) * 2.4, -20.2);
    world.scene.add(jar);
  }
  world.addBox(22.2, -13.5, 1.4, 1.4, 1.2, texturedMat('straw', 1, 1, { color: 0xe8e0cc })); // flour sack

  // Tipped-over cookie jar and crumbs around the food spot.
  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 1.8, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xddeeff, transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }),
  );
  jar.rotation.z = Math.PI / 2;
  jar.rotation.y = 0.5;
  jar.position.set(28.4, 0.7, -17.6);
  world.scene.add(jar);
  world.addCollider(28.4, -17.6, 1.9, 1.5, 1.4); // the jar lying on its side, roughly
  const crumbMat = mat(0xc88a4a);
  for (let i = 0; i < 14; i++) {
    const crumb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05 + (i % 3) * 0.02, 0), crumbMat);
    crumb.position.set(26.5 + Math.cos(i * 2.4) * (0.9 + (i % 4) * 0.25), 0.04, -16 + Math.sin(i * 2.4) * (0.9 + (i % 4) * 0.25));
    world.scene.add(crumb);
  }
}
