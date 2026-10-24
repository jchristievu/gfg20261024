import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { texturedMat } from '../textures.js';
import { Creature } from './creature.js';

// Large, trim Dalmatian facing +z: white with black spots, black floppy ears.
function buildModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const coat = texturedMat('dalmatian', 1, 2, { roughness: 0.9 });
  const coatSmall = texturedMat('dalmatian', 0.6, 0.6, { roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1a1a, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });

  const legLen = 0.8;
  const bodyR = 0.3;
  const bodyLen = 1.1;
  const bodyY = legLen + bodyR * 0.55;
  const front = bodyLen / 2 + bodyR;

  // Deep chest, tucked waist.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(bodyR, bodyLen, 8, 16), coat);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = bodyY;
  const chest = new THREE.Mesh(new THREE.SphereGeometry(bodyR * 1.15, 14, 10), coatSmall);
  chest.scale.set(0.95, 1.1, 1);
  chest.position.set(0, bodyY - 0.03, front - bodyR * 0.9);
  body.add(torso, chest);

  // Neck and head on a pivot so it can look around and bark.
  const head = new THREE.Group();
  head.position.set(0, bodyY + 0.2, front - 0.1);
  body.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.55, 10), coatSmall);
  neck.position.set(0, 0.2, 0.08);
  neck.rotation.x = 0.55;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), white);
  skull.scale.set(0.95, 0.9, 1.1);
  skull.position.set(0, 0.48, 0.25);
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 10), white);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.42, 0.5);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), black);
  nose.position.set(0, 0.45, 0.66);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: 0x8a2a2a }));
  jaw.position.set(0, 0.34, 0.5);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), red);
  collar.rotation.x = Math.PI / 2 - 0.55;
  collar.position.set(0, 0.08, 0.02);
  head.add(neck, skull, snout, nose, jaw, collar);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), black);
    eye.position.set(s * 0.1, 0.54, 0.43);
    // Black floppy ears hanging down the sides of the head.
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), black);
    ear.scale.set(0.35, 1.2, 0.8);
    ear.position.set(s * 0.19, 0.42, 0.2);
    ear.rotation.z = s * 0.25;
    head.add(eye, ear);
  }
  const spot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), black);
  spot.scale.set(1, 0.4, 1);
  spot.position.set(0.06, 0.66, 0.2);
  head.add(spot);

  // Long legs with a black spot or two.
  const legs = [];
  const lx = bodyR * 0.62;
  const lz = bodyLen / 2;
  for (const [x, z] of [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]]) {
    const hip = new THREE.Group();
    hip.position.set(x, legLen, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, legLen, 8), coatSmall);
    leg.position.y = -legLen / 2;
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), white);
    paw.scale.set(1, 0.6, 1.3);
    paw.position.set(0, -legLen + 0.03, 0.03);
    hip.add(leg, paw);
    body.add(hip);
    legs.push(hip);
  }

  // Thin tail curving up, black tip.
  const tail = new THREE.Group();
  tail.position.set(0, bodyY + 0.1, -(bodyLen / 2 + bodyR * 0.8));
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.15, -0.25),
    new THREE.Vector3(0, 0.38, -0.4),
    new THREE.Vector3(0, 0.6, -0.42),
  ]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.045, 6), white));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.047, 6, 4), black);
  tip.position.set(0, 0.6, -0.42);
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
    this.model.tail.rotation.z = Math.sin(t * (barking ? 14 : 6)) * 0.5;
  }
}
