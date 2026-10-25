import * as THREE from 'three';
import { texturedMat } from '../textures.js';
import { mat } from '../builders.js';
import { Cat } from '../enemies/cat.js';
import { addArchedHole } from './level1.js';
import { wall, legs, couch, table, chair, raisedCabinet, windowPane } from './level2.js';

// Level 4: upstairs in the farmhouse. The candy stash is on top of a tall
// bookcase in the study, so the mouse has to climb: footstool -> chair -> desk
// -> book stack -> wall shelves -> bookcase (the long, safe way), or up a
// staircase of moving boxes (short, but the cat can reach the bottom of it).
// The ragdoll can hop onto anything up to 2 units high, so the climb is safe
// once you're well above that, but every landing makes noise.
const WALL_H = 10;
const BOOKCASE = { x: 21, z: -17.8, w: 7, d: 2.4, h: 6 };

export default {
  id: 4,
  name: 'Upstairs',
  intro:
    "The kids hid their candy on top of the bookcase in the study. Climb up and bring 3 pieces home. " +
    'Jump from furniture to furniture: footstool, chair, desk, books, shelves. The stacked boxes in the corner are quicker, ' +
    'but the ragdoll can reach the bottom of them. Every landing makes noise, and a missed jump drops you to the floor.',
  outro: 'Three candies, one sugar rush, zero cats the wiser.',
  outdoor: false,
  size: [56, 40],
  home: [-25.3, 0, 12],
  mouseSpawn: [-25.6, 0, 12],
  foodSpot: [BOOKCASE.x, BOOKCASE.h, BOOKCASE.z],
  food: 'candy',
  spinFood: true,
  nestColor: 0x8a9ac0,
  lights: [
    [-14, 8, 0, 8, 0xffe2b8],
    [14, 8, -4, 9, 0xfff0d8],
  ],

  createEnemies(scene, world) {
    return [new Cat(scene, world, 'ragdoll', [17, 0, 7])];
  },

  build(world) {
    world.buildGroundPlane('woodFloor', { size: 200, tile: 8, tint: 0xd8c0a0 });
    buildWalls(world);
    buildBedroom(world);
    buildStudy(world);
    addArchedHole(world.scene, -26.98, 12, Math.PI / 2, 0xf4efe6);

    const traps = [
      [-20, -6, 0.4], // in front of the bed
      [-8, 6, 1.2],
      [0, 1.5, Math.PI / 2], // middle of the doorway
      [9.5, -8.6, 0], // right in front of the footstool
      [22, -12, 0.5],
      [24.2, -7.4, 1.4], // at the foot of the box stairs
    ];
    for (const [x, z, a] of traps) world.addTrap(x, z, a);
  },
};

function buildWalls(world) {
  const paper = (len) => texturedMat('wallpaper', len / 6, WALL_H / 6, { color: 0xd8e4f0 });
  const paint = (len) => texturedMat('siding', len / 8, 1, { color: 0xe8e0cc });
  wall(world, -14, -19.5, 28, 1, paper(28)); // bedroom
  wall(world, -14, 19.5, 28, 1, paper(28));
  wall(world, 14, -19.5, 28, 1, paint(28)); // study
  wall(world, 14, 19.5, 28, 1, paint(28));
  wall(world, -27.5, 0, 1, 40, paper(40));
  wall(world, 27.5, 0, 1, 40, paint(40));
  // Bedroom / study divider with a doorway at z -4..4.
  wall(world, 0, -11.75, 1, 15.5, paper(15.5));
  wall(world, 0, 11.75, 1, 15.5, paper(15.5));
  const trimMat = mat(0xf4efe6, { roughness: 0.6 });
  for (const s of [-1, 1]) world.addBox(0, s * 4.1, 1.3, 0.25, 8, trimMat, { collide: false });
  world.addBox(0, 0, 1.3, 8.4, 0.4, trimMat, { collide: false, y: 8 });

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(56, 40), mat(0xf2ede4, { side: THREE.DoubleSide }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_H;
  world.scene.add(ceiling);
  windowPane(world, -14, 6, -18.95, 5, 3.5);
  windowPane(world, 4, 6, 18.95, 5, 3.5, Math.PI);
  windowPane(world, 18, 6, 18.95, 5, 3.5, Math.PI);
}

function buildBedroom(world) {
  const wood = texturedMat('wood', 1, 1, { color: 0xc89a6a });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), texturedMat('rug', 1, 1, { color: 0xa8c0e8, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-15, 0.01, -2);
  rug.receiveShadow = true;
  world.scene.add(rug);

  // Bed on legs: hide underneath. The mattress is too high for the cat to hop onto.
  legs(world, -17, -13, 7, 9, 0.6, 0.35, wood);
  world.addBox(-17, -13, 7, 9, 1.6, mat(0xf2ede4, { roughness: 1 }), { y: 0.6 });
  world.addBox(-17, -12, 7.3, 7.3, 0.12, mat(0x5f8fd0, { roughness: 1 }), { collide: false, y: 2.2 }); // blanket
  world.addBox(-17, -16.3, 4, 1.2, 0.4, mat(0xffffff, { roughness: 1 }), { collide: false, y: 2.2 }); // pillow
  world.addBox(-17, -17.75, 7.4, 0.5, 3.6, wood, { blocksCamera: true }); // headboard
  world.addHideZone(-20.1, -13.9, -17.1, -8.9);

  world.addBox(-23, -17, 2, 2, 2.0, wood); // nightstand (the cat can hop up here)
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 0.7, 12, 1, true), mat(0xf2e6c8, { side: THREE.DoubleSide, emissive: 0x403020 }));
  lamp.position.set(-23, 2.9, -17);
  world.scene.add(lamp);

  raisedCabinet(world, -12, 18.2, 6, 2, 3.4, texturedMat('wood', 2, 1, { color: 0xd8b088 })); // dresser
  world.buildCardboardBox(-21, 3, 0, { w: 1.8, d: 1.4, h: 1.1, material: mat(0xe8a040, { roughness: 0.6 }) }); // toy box

  // Banister around the top of the stairs: cover from the cat's view.
  const rail = texturedMat('wood', 3, 1, { color: 0x8a5a34 });
  world.addBox(-6, 13.5, 7, 0.3, 2.6, rail);
  for (let i = 0; i < 8; i++) world.addBox(-9.3 + i * 0.95, 13.5, 0.12, 0.12, 2.6, rail, { collide: false });
  // Scattered toy blocks: solid, and small enough to hop onto.
  const toyColors = [0xe8434b, 0x3fa7e0, 0x8fd14f, 0xf2b630];
  for (let i = 0; i < 6; i++) {
    const bx = -11 + (i % 3) * 0.9;
    const bz = 2 + Math.floor(i / 3) * 0.8;
    world.addBox(bx, bz, 0.4, 0.4, 0.4, mat(toyColors[i % 4], { roughness: 0.5 }));
  }
  // A flowerpot on the nightstand (out of the way of every climb).
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 10), mat(0xb86a3a));
  pot.position.set(-22.4, 2.2, -16.4);
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat(0x3f8a3a, { flatShading: true }));
  leaves.position.set(-22.4, 2.6, -16.4);
  world.scene.add(pot, leaves);
}

function buildStudy(world) {
  const wood = texturedMat('wood', 1, 1, { color: 0xa87a4a });
  const books = texturedMat('planks', 3, 1.5, { color: 0xc0a080 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), texturedMat('rug', 1, 1, { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(14, 0.01, 2);
  rug.receiveShadow = true;
  world.scene.add(rug);

  // The tall bookcase with the candy on top.
  const { x, z, w, d, h } = BOOKCASE;
  world.addBox(x, z, w, d, h, texturedMat('wood', 2, 2, { color: 0x8a6040 }), { blocksCamera: true });
  const bookColors = [0x8e3b32, 0x2f5a3a, 0x2f3f5a, 0xc8a050, 0x5a3a5a];
  for (let shelf = 0; shelf < 5; shelf++) {
    for (let i = 0; i < 12; i++) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85 + (i % 3) * 0.12, 0.3), mat(bookColors[(i + shelf) % 5]));
      book.position.set(x - w / 2 + 0.5 + i * 0.52, 0.6 + shelf * 1.15, z + d / 2 + 0.1);
      world.scene.add(book);
    }
  }
  // A candy dish on top.
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 0.15, 24), mat(0xddeeff, { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.7 }));
  dish.position.set(x, h + 0.08, z);
  world.scene.add(dish);

  // Climb A: footstool -> desk chair -> desk -> book stack -> wall shelf -> higher shelf -> bookcase.
  world.addBox(9.5, -11, 1.6, 1.6, 0.9, texturedMat('wood', 1, 1, { color: 0x7a5534 })); // footstool, top 0.9
  chair(world, 9.5, -14, 'e', wood); // seat top 1.8
  table(world, 9.5, -17.5, 6, 3, 2.7, wood); // desk, top 2.7
  world.addBox(11.6, -17.8, 1.2, 1.4, 0.9, books, { y: 2.7 }); // stack of books, top 3.6
  // Globe on a little stand at the desk's west end: solid to a mouse on the desk.
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mat(0x3f7fb0, { roughness: 0.5 }));
  globe.position.set(7.5, 3.45, -17.8);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, 0.3, 12), mat(0x8a6a3a, { metalness: 0.4, roughness: 0.4 }));
  stand.position.set(7.5, 2.85, -17.8);
  world.scene.add(globe, stand);
  world.addCollider(7.5, -17.8, 0.9, 0.9, 3.9, { bottom: 2.7 });
  const shelfMat = texturedMat('wood', 1, 0.3, { color: 0xb08a5a });
  world.addBox(14, -18.5, 2, 1, 0.12, shelfMat, { y: 4.38 }); // wall shelf, top 4.5
  world.addBox(16.4, -18.5, 1.6, 1, 0.12, shelfMat, { y: 5.28 }); // higher wall shelf, top 5.4
  for (const [bx, by] of [[13.3, 4.1], [14.7, 4.1], [16, 5.0], [16.8, 5.0]]) world.addBox(bx, -18.9, 0.08, 0.2, 0.5, mat(0x3a3a3a), { collide: false, y: by });

  // Climb B: a staircase of stacked moving boxes up the east wall.
  const steps = [
    [26.1, -8.6, 1],
    [26.1, -10.8, 2],
    [26.1, -13.0, 3],
    [26.1, -15.2, 4],
    [25.8, -17.6, 5],
  ];
  for (const [bx, bz, top] of steps) world.addBox(bx, bz, 1.6, 1.6, top, texturedMat('cardboard', 1, top), { blocksCamera: top > 2 });

  couch(world, 6, 12, 3.6, 3.4, 's', mat(0x6a8a5a, { roughness: 1 })); // armchair: hide underneath
  // The ragdoll's bed.
  world.addCollider(17, 7, 2.6, 2.6, 0.4);
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.4, 24), mat(0x8a7ac8, { roughness: 1 }));
  cushion.position.set(17, 0.2, 7);
  world.scene.add(cushion);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.3, 8, 24), mat(0x7a6ab8, { roughness: 1 }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(17, 0.5, 7);
  world.scene.add(rim);

  // Wastebasket and a floor lamp.
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 1.4, 14), mat(0x6a6f74, { metalness: 0.5, roughness: 0.4 }));
  bin.position.set(4, 0.7, -17.8);
  world.scene.add(bin);
  world.addCollider(4, -17.8, 1.2, 1.2, 1.4);
  world.addBox(25.5, 16, 0.4, 0.4, 7, mat(0x3a3a3a, { metalness: 0.5 }));
}
