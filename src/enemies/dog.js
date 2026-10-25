import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { texturedMat } from '../textures.js';
import { Creature } from './creature.js';

// German shorthaired pointer in black roan, facing +z: athletic and long-legged
// with a deep chest and tucked waist, solid black head with broad hanging ears,
// a long square muzzle, ticked white-and-black coat, and a short docked tail.
function buildModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Coat for a part `around` x `along` units in texture space, at one ticking
  // density everywhere so the spots stay the same size across the joins.
  const coatFor = (around, along) => texturedMat('pointerCoat', around * 1.25, along * 1.25, { roughness: 0.85 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1a1a, roughness: 0.55 }); // short glossy coat
  const white = new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.85 });
  const brown = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe8701e, roughness: 0.5 }); // hunting collar

  const legLen = 0.84;
  const bodyR = 0.26;
  const bodyLen = 1.05;
  const bodyY = legLen + bodyR * 0.5;
  const front = bodyLen / 2 + bodyR;

  // One smooth torso, lathed along z from the rump (t=0) to the chest (t=1):
  // a level back with the body hanging below it, so the deep chest drops under
  // the belly line and the waist tucks up, the pointer's outline.
  const radii = new THREE.SplineCurve(
    [[0, 0], [0.015, 0.09], [0.05, 0.16], [0.14, 0.22], [0.28, 0.23], [0.48, 0.19], [0.68, 0.25], [0.84, 0.28], [0.93, 0.25], [0.975, 0.17], [0.995, 0.07], [1, 0]]
      .map(([t, r]) => new THREE.Vector2(t, r)),
  );
  const rearZ = -(bodyLen / 2 + 0.24);
  const length = bodyLen + 0.5;
  const topY = bodyY + bodyR;
  // The spline's points aren't evenly spaced in t, so sample it into a table and look radii up by t.
  const table = radii.getPoints(200);
  const radiusAt = (t) => {
    const i = Math.max(1, table.findIndex((p) => p.x >= t));
    const a = table[i - 1];
    const b = table[i] ?? a;
    return Math.max(0, b.x > a.x ? a.y + ((b.y - a.y) * (t - a.x)) / (b.x - a.x) : a.y);
  };
  const profile = [];
  const STEPS = 60;
  for (let i = 0; i <= STEPS; i++) profile.push(new THREE.Vector2(radiusAt(i / STEPS), (i / STEPS) * length));
  const torsoGeo = new THREE.LatheGeometry(profile, 32);
  torsoGeo.rotateX(Math.PI / 2); // lathe axis along +z; the texture seam ends up underneath
  const tp = torsoGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const t = tp.getZ(i) / length;
    const center = topY - Math.max(radiusAt(t), 0.2); // hang from the topline; the tips meet at tail/neck height
    tp.setXYZ(i, tp.getX(i) * 0.85, tp.getY(i) + center, rearZ + tp.getZ(i));
  }
  torsoGeo.computeVertexNormals();
  // A plain white bib on the front of the chest, where the wrapped coat
  // texture would otherwise pinch into a starburst. LatheGeometry indexes by
  // column, so regroup its faces: coat first, then the bib rings.
  const BIB = Math.round(STEPS * 0.91);
  const cols = profile.length;
  const coatIdx = [];
  const bibIdx = [];
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = j + i * cols;
      const b = j + (i + 1) * cols;
      (j >= BIB ? bibIdx : coatIdx).push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  torsoGeo.setIndex([...coatIdx, ...bibIdx]);
  torsoGeo.clearGroups();
  torsoGeo.addGroup(0, coatIdx.length, 0);
  torsoGeo.addGroup(coatIdx.length, bibIdx.length, 1);
  const torso = new THREE.Mesh(torsoGeo, [coatFor(1.4, length), white]);
  // A solid black saddle patch across the back.
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), black);
  saddle.scale.set(0.82, 0.6, 1.5);
  saddle.position.set(0, topY - 0.13, -0.05); // just breaks the top line of the back
  body.add(torso, saddle);

  // Neck and head on a pivot so it can look around and bark.
  const head = new THREE.Group();
  head.position.set(0, bodyY + 0.18, front - 0.12);
  body.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.58, 20), coatFor(0.9, 0.58));
  neck.position.set(0, 0.2, 0.08);
  neck.rotation.x = 0.6;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 18), orange);
  collar.rotation.x = Math.PI / 2 - 0.6;
  collar.position.set(0, 0.12, 0.05);
  // Solid black head: domed skull, a long square muzzle, big nose.
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 28, 20), black);
  skull.scale.set(0.85, 0.9, 1.1);
  skull.position.set(0, 0.51, 0.22);
  // Muzzle: a rounded-top block that tapers slightly toward the nose.
  const muzzleGeo = new THREE.BoxGeometry(0.15, 0.13, 0.28, 1, 1, 2);
  const mp = muzzleGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const front = (mp.getZ(i) + 0.14) / 0.28; // 0 at the back, 1 at the nose
    mp.setX(i, mp.getX(i) * (1 - front * 0.18));
  }
  muzzleGeo.computeVertexNormals();
  const muzzle = new THREE.Mesh(muzzleGeo, black);
  muzzle.position.set(0, 0.45, 0.44);
  const muzzleTop = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.22, 4, 10), black);
  muzzleTop.rotation.x = Math.PI / 2;
  muzzleTop.position.set(0, 0.49, 0.44);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), new THREE.MeshStandardMaterial({ color: 0x0c0b0b, roughness: 0.2 }));
  nose.scale.set(1.3, 0.95, 0.8);
  nose.position.set(0, 0.48, 0.59);
  // Lower jaw: black lip outside, red mouth only shows when it drops open to bark.
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.385, 0.32);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.25), black);
  lip.position.z = 0.12;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.01, 0.22), new THREE.MeshStandardMaterial({ color: 0x8a2a2a }));
  mouth.position.set(0, 0.022, 0.12);
  jaw.add(lip, mouth);
  // Narrow white blaze up the forehead.
  const blaze = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.2), white);
  blaze.position.set(0, 0.645, 0.27);
  blaze.rotation.x = 0.25;
  head.add(neck, collar, skull, muzzle, muzzleTop, nose, jaw, blaze);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), brown);
    eye.position.set(s * 0.085, 0.54, 0.35);
    // Broad, flat, rounded ears hanging close to the head down to the jaw line.
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), black);
    ear.scale.set(0.22, 1.35, 0.95);
    ear.position.set(s * 0.155, 0.4, 0.18);
    ear.rotation.z = s * 0.1;
    head.add(eye, ear);
  }

  // Long, lean legs; ticked white paws.
  const legs = [];
  const legCoat = coatFor(0.36, legLen);
  const pawCoat = coatFor(0.4, 0.2);
  const lx = bodyR * 0.65;
  const lz = bodyLen / 2;
  for (const [x, z] of [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]]) {
    const hip = new THREE.Group();
    hip.position.set(x, legLen, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, legLen, 12), legCoat);
    leg.position.y = -legLen / 2;
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), pawCoat);
    paw.scale.set(1, 0.6, 1.35);
    paw.position.set(0, -legLen + 0.03, 0.03);
    hip.add(leg, paw);
    body.add(hip);
    legs.push(hip);
  }

  // Short docked tail held out level.
  const tail = new THREE.Group();
  tail.position.set(0, bodyY + 0.08, -(bodyLen / 2 + bodyR * 0.85));
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.04, -0.14),
    new THREE.Vector3(0, 0.08, -0.28),
  ]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.045, 8), coatFor(0.3, 0.3)));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 6), black);
  tip.position.set(0, 0.08, -0.28);
  tail.add(tip);
  body.add(tail);

  root.traverse((o) => (o.castShadow = o.isMesh));
  return { root, body, head, jaw, legs, tail, iconHeight: bodyY + 1.4 };
}

// Patrols a loop of waypoints. If it notices the mouse it stops and barks,
// which brings the ragdoll running. It never attacks.
export class Dog extends Creature {
  constructor(scene, world, patrol) {
    const model = buildModel();
    super(scene, world, model, CONFIG.dog.radius, model.iconHeight);
    this.p = CONFIG.dog;
    this.patrol = patrol.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.minor = true; // pale dot on the radar: alerts, doesn't attack
    this.reset();
  }

  reset() {
    this.position.copy(this.patrol[0]);
    this.heading = 0;
    this.next = 1;
    this.state = 'patrol';
    this.timer = 0;
    this.cooldown = 2;
    this.tracking = false;
    this.walkPhase = 0;
    this.icon.userData.draw('', '');
  }

  // Returns { alert, from, message } when it barks.
  update(dt, mouse) {
    const P = this.p;
    this.speedThisFrame = 0;
    this.cooldown -= dt;
    this.timer -= dt;
    const toMouse = Math.hypot(mouse.position.x - this.position.x, mouse.position.z - this.position.z);
    const heard = !mouse.inHome && mouse.noise > 0 && toMouse <= mouse.noise;
    let result = null;

    if (this.state !== 'bark' && this.cooldown <= 0 && (heard || this.canSee(mouse, P.sightRange, P.fov))) {
      this.state = 'bark';
      this.timer = P.barkTime;
      this.cooldown = P.barkCooldown;
      this.icon.userData.draw('!', '#ffd23f');
      result = { alert: mouse.position.clone(), from: this.position.clone(), message: 'WOOF! The dog spotted you!' };
    }

    switch (this.state) {
      case 'patrol':
        if (this.moveToward(this.patrol[this.next], P.patrolSpeed, dt, 0.6)) {
          this.state = 'look';
          this.timer = P.pause[0] + Math.random() * (P.pause[1] - P.pause[0]);
          this.next = (this.next + 1) % this.patrol.length;
        }
        break;
      case 'look':
        // Sniff and glance around before moving on.
        this.heading += Math.sin(performance.now() / 500) * dt * 1.8;
        if (this.timer <= 0) this.state = 'patrol';
        break;
      case 'bark':
        this.turnToward(mouse.position, dt, 8);
        if (this.timer <= 0) {
          this.state = 'patrol';
          this.icon.userData.draw('', '');
        }
        break;
    }

    this.animate(dt);
    return result;
  }

  statusClass() {
    return this.state === 'bark' ? 'search' : 'minor';
  }

  animate(dt) {
    this.followGround(dt);
    this.walkPhase += dt * this.speedThisFrame * 2;
    const swing = this.speedThisFrame > 0.1 ? 0.6 : 0;
    this.model.legs.forEach((hip, i) => {
      hip.rotation.x = Math.sin(this.walkPhase + (i === 0 || i === 3 ? 0 : Math.PI)) * swing;
    });
    const t = performance.now() / 1000;
    const barking = this.state === 'bark';
    // Barking: head bobs and the jaw snaps; otherwise a happy tail wag.
    this.model.head.rotation.x = barking ? -0.15 + Math.max(0, Math.sin(t * 14)) * 0.2 : 0;
    this.model.jaw.rotation.x = barking ? Math.max(0, Math.sin(t * 14)) * 0.5 : 0;
    this.model.tail.rotation.y = Math.sin(t * (barking ? 14 : 6)) * 0.5; // docked tail wags side to side
  }
}
