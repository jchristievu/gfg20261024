import * as THREE from 'three';
import { texturedMat } from '../textures.js';
import { mat, pitchedRoof } from '../builders.js';
import { scatterDecor } from '../decor.js';
import { Cat } from '../enemies/cat.js';

// Level 1: the farmyard. Sneak from the mouse hole in the garden shed to the cheese
// plate by the farmhouse, past the farm cat.
export default {
  id: 1,
  name: 'The Farmyard',
  intro:
    'Sneak across the farm, grab 3 pieces of cheese from the plate by the farmhouse, and bring them home one at a time. ' +
    'Hide in tall grass or cardboard boxes to lose the cat, and keep quiet: sprinting and jumping make noise. ' +
    "Cats hate water, but swimming wears you out and you'll drop your cheese.",
  outro: 'The pantry is stocked and the cat is none the wiser.',
  outdoor: true,
  size: [100, 100],
  home: [-40, 0, 42.8],
  mouseSpawn: [-40, 0, 42.5],
  foodSpot: [36, 0, -31],
  food: 'cheese',

  createEnemies(scene, world) {
    return [new Cat(scene, world, 'farm', [0, 0, 16])];
  },

  build(world) {
    world.buildGroundPlane('grass');
    // Dirt paths loosely connecting home, barn and farmhouse.
    world.addPath(-40, 40, -10, 12, 3);
    world.addPath(-10, 12, 8, 12, 3);
    world.addPath(8, 12, 24, -24, 3);
    world.addPath(24, -24, 36, -32, 3);

    // Low fence marking the edge of the farm.
    const h = 50;
    world.buildFence(-h, -h, h, -h, false);
    world.buildFence(-h, h, h, h, false);
    world.buildFence(-h, -h, -h, h, false);
    world.buildFence(h, -h, h, h, false);

    buildHomeShed(world);
    buildFoodArea(world);
    buildBarn(world, -4, 1);
    buildFarmhouse(world, 38, -42);
    buildSilo(world, 10, -14);
    buildTractor(world, 18, 9.5);

    // Hay bales: [x, z, w, d, h]. The two at -6,14 form a staircase.
    const bales = [
      [-30, 38, 2, 1.2, 0.9],
      [-14, 36, 1.2, 2, 0.9],
      [-6, 14, 2, 1.2, 1.8],
      [-6, 15.2, 2, 1.2, 0.9],
      [14, -22, 2, 1.2, 0.9],
      [26, 4, 2, 1.2, 0.9],
    ];
    for (const [x, z, w, d, bh] of bales) world.addBox(x, z, w, d, bh, texturedMat('hay', 1, bh / 0.9));

    // Cardboard boxes: [x, z, open side] where open side is 0:+z 1:+x 2:-z 3:-x.
    const cardboard = [
      [-24, 22, 3],
      [8, -4, 0],
      [22, -28, 3],
      [-16, -2, 1],
    ];
    for (const [x, z, side] of cardboard) world.buildCardboardBox(x, z, side);

    const puddles = [
      [-20, 4, 2.5],
      [26, -2, 3],
    ];
    for (const [x, z, r] of puddles) world.buildPuddle(x, z, r);

    const crates = [
      [20, -12],
      [21.4, -12],
      [30, -26],
      [-34, 8],
      [4, 30],
    ];
    const crateMat = texturedMat('crate');
    for (const [x, z] of crates) world.addBox(x, z, 1.4, 1.4, 1.5, crateMat);

    world.addBox(-14, 24, 4, 1.2, 0.7, texturedMat('metal', 2, 0.5, { color: 0x9aa4ab, metalness: 0.5, roughness: 0.5 }));
    const troughWater = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x4f7fa8, roughness: 0.05, metalness: 0.3 }),
    );
    troughWater.rotation.x = -Math.PI / 2;
    troughWater.position.set(-14, 0.705, 24);
    world.scene.add(troughWater);

    world.buildFence(-30, -20, -30, 8);
    world.buildFence(6, 15, 30, 15);

    // Tall clutter that blocks the cat's view, so it can't watch you duck into cover.
    buildShed(world, -31.5, 13);
    // Two stacked crates: one solid collider, two crate visuals.
    world.addBox(-32, 40, 1.4, 1.4, 1.5, crateMat, { collide: false });
    world.addBox(-32.1, 40.1, 1.4, 1.4, 1.5, crateMat, { collide: false, y: 1.5 }).rotation.y = 0.15;
    world.addCollider(-32, 40, 1.5, 1.5, 3);
    buildBarrels(world, -6, 26);
    world.addBox(-9, -11.5, 5, 1.6, 2, texturedMat('bark', 3, 1, { color: 0xa88060 }), { blocksCamera: true }); // woodpile
    buildWell(world, 28.5, -14);
    buildHayWagon(world, 11, -27);

    for (const [x, z] of [[-44, 0], [-20, -36], [44, 10], [0, 40], [26, 36], [-44, -44]]) world.buildTree(x, z);

    const grass = [
      [-35, 36, 3.5], // first cover outside the mouse hole
      [-15, 7, 2], // between the west grass and the box by the barn
      [6.5, 11.5, 2.5], // east of the barn, splits the run to the tractor
      [30, -31.5, 2.5], // next to the cheese plate
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
      [39.5, -24.5, 3], // cover east of the cheese plate
      [16, -36, 3],
      [-4, -20, 3.5],
      [28, 24, 4],
      [-38, -30, 4],
      [40, 30, 4],
    ];
    for (const [x, z, r] of grass) world.buildGrassPatch(x, z, r);

    scatterDecor(world);
  },
};

// The mouse's home: a garden shed with a mouse hole at the base of its front
// wall, facing out over the farm. The nest sits just in front of the hole.
function buildHomeShed(world) {
  const x = -40;
  const front = 44; // z of the front wall's outer face
  const w = 8;
  const d = 5.5;
  const h = 4;
  const z = front + d / 2;
  const siding = texturedMat('siding', 2, 1.2, { color: 0xa9bcc6 });
  world.addBox(x, z, w, d, h, siding, { blocksCamera: true });
  const roof = pitchedRoof(w, d, 2.2, texturedMat('siding', 2, 0.6, { color: 0xa9bcc6 }), { overhang: 0.5, shingleColor: 0x6a7a82 });
  roof.position.set(x, h, z);
  world.scene.add(roof);
  roof.traverse((o) => o.isMesh && world.cameraBlockers.push(o));

  const g = new THREE.Group();
  g.position.set(x, 0, z);
  world.scene.add(g);
  const white = mat(0xf4f1ea, { roughness: 0.7 });
  const face = -d / 2 - 0.06; // just in front of the front wall
  // Stone foundation, white corner boards and eave trim.
  world.trim(g, w + 0.16, 0.55, d + 0.16, 0, 0.27, 0, texturedMat('stone', 4, 0.3, { color: 0xb8b2a8 }));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) world.trim(g, 0.25, h, 0.25, sx * (w / 2), h / 2, sz * (d / 2), white);
  }
  world.trim(g, w + 0.2, 0.22, 0.1, 0, h, face, white);
  // Door (right of the hole) and a window with flower box (left).
  world.trim(g, 1.6, 2.9, 0.1, 2.3, 1.45 + 0.1, face, texturedMat('planks', 1, 1, { color: 0x7a8a6a }));
  world.trim(g, 1.9, 0.18, 0.12, 2.3, 3.05, face - 0.01, white);
  world.trim(g, 0.12, 0.12, 0.08, 2.9, 1.5, face - 0.08, mat(0xc8a040, { metalness: 0.7, roughness: 0.3 }));
  world.trim(g, 1.5, 1.1, 0.08, -2.3, 2.3, face, mat(0x6f9fc0, { roughness: 0.08, metalness: 0.6 }));
  for (const [ww, hh, wx, wy] of [[1.7, 0.14, -2.3, 2.9], [1.7, 0.14, -2.3, 1.7], [0.12, 1.1, -3.1, 2.3], [0.12, 1.1, -1.5, 2.3], [0.08, 1.1, -2.3, 2.3]]) {
    world.trim(g, ww, hh, 0.1, wx, wy, face - 0.02, white);
  }
  world.trim(g, 1.7, 0.3, 0.35, -2.3, 1.5, face - 0.18, texturedMat('wood', 1, 1, { color: 0x9a6a40 }));
  const flowerColors = [0xff8fab, 0xffe066, 0xffffff, 0xc792ea];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), mat(flowerColors[i % flowerColors.length]));
    f.position.set(-2.95 + i * 0.26, 1.72, face - 0.18);
    g.add(f);
  }
  // A little "home" sign above the mouse hole.
  world.trim(g, 0.9, 0.3, 0.05, 0, 1.25, face - 0.01, texturedMat('wood', 1, 1, { color: 0xc8a070 }));

  addArchedHole(world.scene, x, front - 0.1, Math.PI, 0x8a857c); // in front of the foundation
}

// Dark arched mouse hole on a wall face, with a rim. `rotY` turns it to face out.
export function addArchedHole(scene, x, z, rotY, rimColor, size = 0.6) {
  const hole = new THREE.Mesh(new THREE.CircleGeometry(size, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x0d0805 }));
  hole.position.set(x, 0, z);
  hole.rotation.y = rotY;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(size * 1.1, 0.08, 8, 24, Math.PI),
    new THREE.MeshStandardMaterial({ color: rimColor, roughness: 1 }),
  );
  rim.position.set(x, 0, z);
  rim.rotation.y = rotY;
  scene.add(hole, rim);
}

// Small tool shed with a pitched roof and a door facing east.
function buildShed(world, x, z) {
  const walls = texturedMat('wood', 2, 1, { color: 0xb08860 });
  world.addBox(x, z, 4, 3, 3, walls, { blocksCamera: true });
  const roof = pitchedRoof(4, 3, 1.2, walls, { overhang: 0.35, shingleColor: 0x8a9aa0 });
  roof.position.set(x, 3, z);
  world.scene.add(roof);
  roof.traverse((o) => o.isMesh && world.cameraBlockers.push(o));
  world.addBox(x + 2.03, z, 0.06, 1.4, 2.2, mat(0x5a3d26), { collide: false });
}

// A pair of rain barrels with iron hoops.
function buildBarrels(world, x, z) {
  const wood = texturedMat('wood', 2, 1, { color: 0x9a6a40 });
  const hoop = mat(0x4a4a4a, { metalness: 0.6, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 16), wood);
    barrel.position.set(x + s * 0.65, 0.8, z);
    barrel.castShadow = true;
    world.scene.add(barrel);
    for (const y of [0.25, 1.35]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.03, 6, 20), hoop);
      band.rotation.x = Math.PI / 2;
      band.position.set(x + s * 0.65, y, z);
      world.scene.add(band);
    }
  }
  world.addCollider(x, z, 2.5, 1.2, 1.6);
}

// Stone well with a little roof on posts.
function buildWell(world, x, z) {
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.15, 1.5, 20, 1, true), texturedMat('stone', 3, 0.6, { side: THREE.DoubleSide }));
  ring.position.set(x, 0.75, z);
  ring.castShadow = true;
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), mat(0x2f4f6a, { roughness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 1.0, z);
  world.scene.add(ring, water);
  const wood = texturedMat('wood', 1, 1);
  for (const s of [-1, 1]) world.addBox(x + s * 1.0, z, 0.15, 0.15, 2.8, wood, { collide: false });
  const roof = pitchedRoof(2.6, 1.4, 0.8, wood, { overhang: 0.2, shingleColor: 0x8a6a50 });
  roof.position.set(x, 2.8, z);
  world.scene.add(roof);
  world.addCollider(x, z, 2.3, 2.3, 1.5);
}

// Hay wagon on wheels: blocks the view, and the mouse can hide underneath.
function buildHayWagon(world, x, z) {
  const wood = texturedMat('wood', 2, 1, { color: 0x8a5a34 });
  world.addBox(x, z, 4, 2, 0.3, wood, { collide: false, y: 1.0 }); // bed
  world.addBox(x, z, 3.7, 1.8, 1.2, texturedMat('hay', 2, 1), { collide: false, y: 1.3 }); // hay load
  world.addCollider(x, z, 4, 2, 2.5, { bottom: 1.0 });
  const tire = mat(0x3a2a1a);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.15, 14), tire);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x + sx * 1.4, 0.5, z + sz * 0.95);
      wheel.castShadow = true;
      world.scene.add(wheel);
      world.addCollider(x + sx * 1.4, z + sz * 0.95, 0.8, 0.15, 1.0);
    }
  }
  world.addBox(x + 2.8, z, 1.8, 0.12, 0.12, wood, { collide: false, y: 0.8 }); // tongue
  world.addHideZone(x - 1.6, x + 1.6, z - 0.6, z + 0.6);
}

function buildFoodArea(world) {
  const { x, z } = world.foodSpot;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.85, 0.06, 40), mat(0xf7f5ef, { roughness: 0.3 }));
  plate.position.set(x, 0.03, z);
  plate.receiveShadow = true;
  const plateRim = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.035, 6, 40), mat(0x4f78b8, { roughness: 0.3 }));
  plateRim.rotation.x = -Math.PI / 2;
  plateRim.position.set(x, 0.065, z);
  world.scene.add(plate, plateRim);

  // Grain sack: rounded visual over a box collider.
  world.addCollider(x + 2, z - 0.5, 1, 1, 1.2);
  const sack = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.4, 6, 12), texturedMat('straw', 2, 2, { color: 0xb39572 }));
  sack.scale.set(1, 1, 0.9);
  sack.position.set(x + 2, 0.66, z - 0.5);
  sack.castShadow = true;
  const tie = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 8), mat(0xa58864));
  tie.position.set(x + 2, 1.35, z - 0.5);
  world.scene.add(sack, tie);
}

function buildBarn(world, x, z) {
  const w = 16;
  const d = 14;
  const h = 8;
  world.addBox(x, z, w, d, h, texturedMat('planks', 4, 1), { blocksCamera: true });
  const roof = pitchedRoof(w, d, 4, texturedMat('planks', 4, 0.5));
  roof.position.set(x, h, z);
  world.scene.add(roof);
  roof.traverse((o) => o.isMesh && world.cameraBlockers.push(o));

  const g = new THREE.Group();
  g.position.set(x, 0, z);
  world.scene.add(g);
  const white = mat(0xf2efe6, { roughness: 0.7 });
  const front = d / 2 + 0.06;

  // Corner boards and eave trim.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) world.trim(g, 0.35, h, 0.35, sx * (w / 2), h / 2, sz * (d / 2), white);
  }
  for (const sz of [-1, 1]) world.trim(g, w + 0.2, 0.3, 0.12, 0, h, sz * (d / 2 + 0.05), white);

  // Big doors with white frame and X braces.
  const doorMat = texturedMat('planks', 1.5, 1, { color: 0xd8c8c0 });
  for (const sx of [-1, 1]) {
    const door = world.trim(g, 3, 5, 0.12, sx * 1.5, 2.5, front, doorMat);
    door.castShadow = false;
    const brace = Math.hypot(3, 5);
    for (const dir of [1, -1]) {
      const bar = world.trim(g, brace - 0.4, 0.25, 0.1, sx * 1.5, 2.5, front + 0.07, white);
      bar.rotation.z = dir * Math.atan2(5, 3);
    }
    world.trim(g, 3, 0.25, 0.1, sx * 1.5, 0.15, front + 0.07, white);
    world.trim(g, 3, 0.25, 0.1, sx * 1.5, 4.9, front + 0.07, white);
    world.trim(g, 0.25, 5, 0.1, sx * 2.9, 2.5, front + 0.07, white);
  }
  world.trim(g, 0.15, 5, 0.12, 0, 2.5, front + 0.08, white);

  // Hayloft door up in the gable, with a pulley beam.
  world.trim(g, 2.4, 2, 0.1, 0, h + 0.9, front, mat(0x3a2418));
  world.trim(g, 2.8, 0.2, 0.12, 0, h + 2, front + 0.02, white);
  world.trim(g, 2.8, 0.2, 0.12, 0, h - 0.1, front + 0.02, white);
  world.trim(g, 0.25, 0.25, 1.4, 0, h + 3.2, front + 0.5, mat(0x5a3d26));
}

function buildFarmhouse(world, x, z) {
  const w = 16;
  const d = 12;
  const h = 7;
  world.addBox(x, z, w, d, h, texturedMat('siding', 4, 2), { blocksCamera: true });
  const roof = pitchedRoof(d, w, 3.5, texturedMat('siding', 3, 1), { shingleColor: 0x8aa0b8 });
  roof.rotation.y = Math.PI / 2;
  roof.position.set(x, h, z);
  roof.traverse((o) => o.isMesh && world.cameraBlockers.push(o));
  world.scene.add(roof);

  const g = new THREE.Group();
  g.position.set(x, 0, z);
  world.scene.add(g);
  const white = mat(0xffffff, { roughness: 0.6 });
  const front = d / 2 + 0.06;

  const chimney = world.trim(g, 1.2, 4, 1.2, 5, h + 2, -2, texturedMat('stone', 1, 1, { color: 0xc07a5a }));
  chimney.receiveShadow = true;
  world.trim(g, 1.4, 0.25, 1.4, 5, h + 4.1, -2, mat(0x5a4a42));

  // Door, porch roof on posts, and steps.
  world.trim(g, 1.8, 3, 0.12, -2, 1.5, front, texturedMat('planks', 1, 1, { color: 0x8a6a50 }));
  world.trim(g, 2.2, 0.2, 0.14, -2, 3.1, front + 0.01, white);
  const porch = world.trim(g, 4.5, 0.18, 2.4, -2, 3.6, front + 1.1, texturedMat('shingles', 2, 1, { color: 0x8aa0b8 }));
  porch.rotation.x = 0.12;
  for (const px of [-4, 0]) world.trim(g, 0.18, 3.6, 0.18, px, 1.8, front + 2.1, white);
  world.trim(g, 2.6, 0.2, 0.8, -2, 0.1, front + 0.4, texturedMat('wood', 1, 1));

  // Windows: glass, white frame, cross bars, shutters.
  const glass = mat(0x6f9fc0, { roughness: 0.08, metalness: 0.6 });
  const shutter = mat(0x2f5a3a, { roughness: 0.8 });
  for (const [wx, wy] of [[-6, 4.6], [-2, 4.6], [2, 4.6], [6, 4.6], [-6, 1.8], [2.5, 1.8], [6, 1.8]]) {
    world.trim(g, 1.6, 1.4, 0.08, wx, wy, front, glass).castShadow = false;
    world.trim(g, 1.8, 0.14, 0.12, wx, wy + 0.75, front + 0.02, white);
    world.trim(g, 1.8, 0.14, 0.12, wx, wy - 0.75, front + 0.02, white);
    world.trim(g, 0.1, 1.4, 0.1, wx, wy, front + 0.03, white);
    world.trim(g, 1.6, 0.08, 0.1, wx, wy, front + 0.03, white);
    for (const s of [-1, 1]) world.trim(g, 0.5, 1.5, 0.08, wx + s * 1.15, wy, front + 0.02, shutter);
  }
}

function buildSilo(world, x, z) {
  const r = 3;
  const h = 12;
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), texturedMat('metal', 6, 2, { metalness: 0.45, roughness: 0.45 }));
  silo.position.set(x, h / 2, z);
  silo.castShadow = true;
  silo.receiveShadow = true;
  world.scene.add(silo);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 1.03, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xa83a30, { roughness: 0.6 }));
  dome.position.set(x, h, z);
  dome.castShadow = true;
  world.scene.add(dome);
  const bandMat = mat(0x7d858a, { metalness: 0.6, roughness: 0.4 });
  for (const y of [0.2, 4, 8, 11.9]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.08, 6, 40), bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.set(x, y, z);
    world.scene.add(band);
  }
  // Ladder up the side facing the barn.
  const ladderMat = mat(0x5f666b, { metalness: 0.6, roughness: 0.4 });
  for (const s of [-1, 1]) world.trim(world.scene, 0.06, h, 0.06, x - r - 0.15, h / 2, z + s * 0.3, ladderMat);
  for (let y = 0.5; y < h; y += 0.5) world.trim(world.scene, 0.05, 0.05, 0.6, x - r - 0.15, y, z, ladderMat);
  world.cameraBlockers.push(silo);
  world.addCollider(x, z, r * 2, r * 2, h);
}

function buildTractor(world, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const paint = mat(0x2f8f3a, { roughness: 0.45, metalness: 0.1 });
  const yellow = mat(0xf2c230, { roughness: 0.5 });
  const dark = mat(0x222222, { roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.4), paint);
  body.position.set(0.6, 1.3, 0);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 1.2), dark);
  chassis.position.y = 0.75;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.7), paint);
  cab.position.set(-1.1, 2.2, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.9), paint);
  roof.position.set(-1.1, 3.0, 0);
  const window = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.8, 1.5), mat(0x2b3a44, { roughness: 0.1, metalness: 0.6 }));
  window.position.set(-1.1, 2.45, 0);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), dark);
  exhaust.position.set(1.3, 2.3, 0.45);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 1.0), dark);
  grille.position.set(1.92, 1.3, 0);
  group.add(body, chassis, cab, roof, window, exhaust, grille);
  for (const s of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), mat(0xfff2c0, { emissive: 0x665a30 }));
    light.rotation.z = Math.PI / 2;
    light.position.set(1.95, 1.55, s * 0.45);
    group.add(light);
  }
  const tireMat = mat(0x222222, { roughness: 1 });
  for (const [wx, r, wz, wd] of [[-1.2, 0.8, 1.1, 0.5], [-1.2, 0.8, -1.1, 0.5], [1.4, 0.5, 1.0, 0.35], [1.4, 0.5, -1.0, 0.35]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wd, 20), tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, r, wz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, wd + 0.04, 12), yellow);
    hub.rotation.x = Math.PI / 2;
    hub.position.copy(wheel.position);
    group.add(wheel, hub);
  }
  group.traverse((o) => (o.castShadow = true));
  world.scene.add(group);
  world.cameraBlockers.push(body, cab);
  world.addCollider(x, z, 4, 3, 2.2);
}
