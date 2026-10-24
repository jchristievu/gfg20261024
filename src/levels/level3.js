import * as THREE from 'three';
import { texture, texturedMat } from '../textures.js';
import { mat, pitchedRoof } from '../builders.js';
import { scatterDecor } from '../decor.js';
import { Rooster, Hen } from '../enemies/chickens.js';

// Level 3: the chicken yard. From a burrow under the west fence to the spilled
// corn inside the coop. Hens squawk when they spot you; the rooster guarding the
// coop door charges at the noise, chases you while he can see you, and never searches.
const COOP = { minX: 14, maxX: 30, minZ: -8, maxZ: 6, h: 5 };

export default {
  id: 3,
  name: 'The Chicken Coop',
  intro:
    'Steal 3 cobs of corn from inside the coop. Hens squawk if they see or hear you, and the rooster comes charging. ' +
    'He only sees what is in front of him, chases you while he can see you, and gives up the moment you hide. ' +
    'The front door is guarded, but there is a mouse-sized gap in the back wall.',
  outro: 'The corn is home and the rooster is still crowing about nothing.',
  outdoor: true,
  size: [70, 56],
  home: [-31, 0, 0],
  mouseSpawn: [-31.2, 0, 0],
  foodSpot: [24.5, 0, -3],
  food: 'corn',
  nestColor: 0x9a7a52,
  lights: [[22, 4, -1, 6, 0xffe2b0]],

  createEnemies(scene, world) {
    const enemies = [new Rooster(scene, world, [10, 0, -1], -Math.PI / 2)];
    // The last hen keeps watch along the back of the coop, near the mouse-sized gap.
    const hens = [[-4, 3], [-8, -12], [6, -17], [-18, 14], [20, -15], [2, 22], [33, -3]];
    hens.forEach((home, i) => enemies.push(new Hen(scene, world, home, i)));
    return enemies;
  },

  build(world) {
    world.buildGroundPlane('grass');
    // Bare dirt inside the yard.
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(70, 56), texturedMat('dirt', 70 / 6, 56 / 6, { roughness: 1, color: 0xd8c8a8 }));
    yard.rotation.x = -Math.PI / 2;
    yard.position.y = 0.006;
    yard.receiveShadow = true;
    world.scene.add(yard);

    buildWireFence(world);
    buildBurrow(world);
    buildCoop(world);

    const weeds = [
      [-27, 8, 3], [-20, -6, 3], [-12, 12, 2.5], [-5, -2, 3], [-2, -16, 3], [2, 8, 2.5], [8, 17, 3],
      [9, -11, 2.5], [-28, -15, 3], [-16, 21, 3], [33, 12, 2], [32, -17, 2], [21, 14, 3], [22, -16, 3], [5, 2, 1.8],
    ];
    for (const [x, z, r] of weeds) world.buildGrassPatch(x, z, r, { hue: 0.2, light: 0.3 });

    world.addBox(-24, 18, 6, 2, 2.4, texturedMat('bark', 3, 1, { color: 0xa88060 }), { blocksCamera: true }); // woodpile
    buildWheelbarrow(world, -9, 6);
    for (const [x, z, w, d] of [[-4, 22, 2, 1.2], [14, 17, 1.2, 2], [-18, -21, 2, 1.2], [11, -6, 2, 1.2]]) {
      world.addBox(x, z, w, d, 0.9, texturedMat('hay', 1, 1));
    }
    const crate = texturedMat('crate');
    world.addBox(11, 5, 1.4, 1.4, 1.5, crate);
    world.addBox(12.4, 5, 1.4, 1.4, 1.5, crate);
    world.addBox(0, -24, 4, 1.2, 0.7, texturedMat('metal', 2, 0.5, { color: 0x9aa4ab, metalness: 0.5, roughness: 0.5 })); // water trough
    world.buildCardboardBox(-14, -12, 1);
    world.buildCardboardBox(26, -21, 3);
    world.buildPuddle(-8, -8, 2);

    // A few trees and the farm's barn beyond the fence.
    for (const [x, z] of [[-42, 12], [42, -20], [12, 36], [-22, -36], [30, 34]]) world.buildTree(x, z);
    world.addBox(-6, 62, 16, 14, 8, texturedMat('planks', 4, 1), { collide: false });
    const roof = pitchedRoof(16, 14, 4, texturedMat('planks', 4, 0.5));
    roof.position.set(-6, 8, 62);
    world.scene.add(roof);

    scatterDecor(world, { tuftCount: 900, flowerCount: 160, rockCount: 60, exclude: [[COOP.minX, COOP.maxX, COOP.minZ, COOP.maxZ]] });
  },
};

function buildWireFence(world) {
  const hx = world.halfX;
  const hz = world.halfZ;
  const postMat = texturedMat('wood', 1, 1);
  const sides = [
    [-hx, -hz, hx, -hz],
    [-hx, hz, hx, hz],
    [-hx, -hz, -hx, hz],
    [hx, -hz, hx, hz],
  ];
  for (const [x1, z1, x2, z2] of sides) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const g = new THREE.Group();
    g.position.set(x1, 0, z1);
    g.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    const posts = Math.round(len / 4) + 1;
    for (let i = 0; i < posts; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), postMat);
      p.position.set(0, 1.6, (i / (posts - 1)) * len);
      p.castShadow = true;
      g.add(p);
    }
    const wire = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 3),
      new THREE.MeshStandardMaterial({
        map: texture('chickenWire', len / 1.5, 2),
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        metalness: 0.6,
        roughness: 0.4,
      }),
    );
    wire.rotation.y = Math.PI / 2;
    wire.position.set(0, 1.5, len / 2);
    g.add(wire);
    world.scene.add(g);
    world.cameraBlockers.push(wire); // keep the camera inside the yard
  }
}

function buildBurrow(world) {
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    texturedMat('dirt', 1, 1, { color: 0x8a6a48 }),
  );
  mound.scale.set(1, 0.55, 1.4);
  mound.position.set(-34.6, 0, 0);
  mound.castShadow = true;
  world.scene.add(mound);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x0d0805 }));
  hole.position.set(-33.38, 0, 0);
  hole.rotation.y = Math.PI / 2;
  world.scene.add(hole);
}

function buildWheelbarrow(world, x, z) {
  const metal = mat(0x2f6f9f, { metalness: 0.4, roughness: 0.5 });
  world.addBox(x, z, 2.6, 1.6, 0.9, metal, { y: 0.8 }); // tray, raised: hide underneath
  for (const s of [-1, 1]) world.addBox(x - 1, z + s * 0.6, 0.15, 0.15, 0.8, mat(0x3a3a3a)); // legs
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 16), mat(0x222222));
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(x + 1.5, 0.45, z);
  world.scene.add(wheel);
  world.addCollider(x + 1.5, z, 0.9, 0.3, 0.9);
  for (const s of [-1, 1]) world.addBox(x - 2, z + s * 0.5, 1.6, 0.1, 0.1, mat(0x7a5534), { collide: false, y: 1.3 });
  world.addHideZone(x - 0.9, x + 0.9, z - 0.45, z + 0.45);
}

function buildCoop(world) {
  const { minX, maxX, minZ, maxZ, h } = COOP;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const t = 0.4;
  const walls = texturedMat('planks', 3, 1, { color: 0xd88a6a });
  const add = (x, z, w, d) => world.addBox(x, z, w, d, h, walls, { blocksCamera: true });
  add(cx, minZ, maxX - minX, t); // north
  add(cx, maxZ, maxX - minX, t); // south
  // West wall with the chicken door (z -3..1).
  add(minX, (minZ - 3) / 2, t, -3 - minZ);
  add(minX, (1 + maxZ) / 2, t, maxZ - 1);
  // East wall with a gap only a mouse fits through (z 1.65..2.35).
  add(maxX, (minZ + 1.65) / 2, t, 1.65 - minZ);
  add(maxX, (2.35 + maxZ) / 2, t, maxZ - 2.35);

  const roof = pitchedRoof(maxZ - minZ, maxX - minX, 3, walls, { shingleColor: 0x9a6a5a });
  roof.rotation.y = Math.PI / 2;
  roof.position.set(cx, h, cz);
  roof.traverse((o) => o.isMesh && world.cameraBlockers.push(o));
  world.scene.add(roof);

  // White trim, door frame and a little ramp up to the door.
  const white = mat(0xf4efe6, { roughness: 0.7 });
  world.addBox(minX - 0.1, -3.1, 0.3, 0.25, 3.5, white, { collide: false });
  world.addBox(minX - 0.1, 1.1, 0.3, 0.25, 3.5, white, { collide: false });
  world.addBox(minX - 0.1, -1, 0.3, 4.4, 0.3, white, { collide: false, y: 3.5 });
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 3.6), texturedMat('wood', 1, 1));
  ramp.rotation.z = 0.08;
  ramp.position.set(minX - 1.3, 0.12, -1);
  ramp.receiveShadow = true;
  world.scene.add(ramp);

  // Straw floor.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX - 0.4, maxZ - minZ - 0.4), texturedMat('straw', 4, 4, { color: 0xcfb880 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0.012, cz);
  floor.receiveShadow = true;
  world.scene.add(floor);

  // Nesting boxes on stilts along the east wall: the mouse can hide underneath.
  const nestX = maxX - 1.3;
  world.addBox(nestX, -3.5, 2.2, 8.2, 1.8, texturedMat('planks', 2, 1, { color: 0xb07a50 }), { y: 1.2 });
  for (const z of [-7.4, 0.4]) {
    for (const s of [-1, 1]) world.addBox(nestX + s * 0.95, z, 0.3, 0.3, 1.2, texturedMat('wood', 1, 1));
  }
  world.addHideZone(nestX - 0.8, nestX + 0.8, -7.2, 0.2);
  const egg = mat(0xf2e8d8, { roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 0.3, 12), texturedMat('straw', 1, 1));
    nest.position.set(nestX - 0.3, 3.15, -6.5 + i * 2);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), egg);
    e.scale.y = 1.3;
    e.position.set(nestX - 0.3, 3.4, -6.5 + i * 2);
    world.scene.add(nest, e);
  }

  // Roosting bars up high (visual only).
  for (const x of [18, 21]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, maxZ - minZ - 0.4, 8), texturedMat('wood', 1, 2));
    bar.rotation.x = Math.PI / 2;
    bar.position.set(x, 3.4, cz);
    world.scene.add(bar);
  }

  world.addBox(19.5, -1, 4, 0.9, 0.8, texturedMat('wood', 2, 1)); // feed trough
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.3, 16), mat(0xc8ccd0, { metalness: 0.6, roughness: 0.3 }));
  water.position.set(24, 0.65, 3.8);
  world.scene.add(water);
  world.addCollider(24, 3.8, 1.3, 1.3, 1.3);

  // Spilled feed sack by the food spot.
  world.addCollider(26.2, -4.8, 1.6, 1.0, 0.9);
  const sack = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.8, 6, 12), texturedMat('straw', 2, 2, { color: 0xb39572 }));
  sack.rotation.z = Math.PI / 2;
  sack.position.set(26.2, 0.45, -4.8);
  sack.castShadow = true;
  world.scene.add(sack);

  // Loose straw piles to hide in.
  for (const [x, z, r] of [[17.5, 3.5, 1.6], [21.5, -5.8, 1.8]]) {
    world.buildGrassPatch(x, z, r, { hue: 0.11, hueRange: 0.03, sat: 0.55, light: 0.5, height: 0.7, wind: 0.02 });
  }
}
