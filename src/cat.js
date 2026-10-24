import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.cat;

// Icon floating over the cat's head for each state.
const ICONS = {
  sleep: ['z', '#9bd4ff'],
  chase: ['!', '#ff4040'],
  search: ['?', '#ffd23f'],
  distracted: ['♪', '#8fd3ff'],
};

function buildModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const fur = new THREE.MeshStandardMaterial({ color: 0xe08a3c, roughness: 1 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf5d7b0, roughness: 1 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe8a0a8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x9be05a, emissive: 0x2a4a10 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 6, 12), fur);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.6;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), fur);
  head.position.set(0, 0.88, 0.78);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), light);
  muzzle.scale.set(1.3, 0.8, 0.8);
  muzzle.position.set(0, 0.8, 1.04);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), pink);
  nose.position.set(0, 0.86, 1.13);
  body.add(torso, head, muzzle, nose);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 4), fur);
    ear.position.set(side * 0.17, 1.17, 0.74);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeMat);
    eye.position.set(side * 0.13, 0.95, 1.05);
    body.add(ear, eye);
  }

  const legs = [];
  for (const [x, z] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.45, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 8), fur);
    leg.position.y = -0.22;
    hip.add(leg);
    body.add(hip);
    legs.push(hip);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.7, -0.75);
  const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.9, 8), fur);
  tailMesh.position.y = 0.45;
  tail.add(tailMesh);
  tail.rotation.x = -0.6;
  body.add(tail);

  root.traverse((o) => (o.castShadow = true));
  return { root, body, legs, tail };
}

function buildButterfly() {
  const root = new THREE.Group();
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide });
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), wingMat);
    wing.position.x = side * 0.11;
    wing.rotation.x = -Math.PI / 2;
    pivot.add(wing);
    pivot.userData.side = side;
    root.add(pivot);
    wings.push(pivot);
  }
  root.visible = false;
  return { root, wings };
}

function makeIcon() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(0.7, 0.7, 1);
  sprite.renderOrder = 10;
  sprite.userData.draw = (text, color) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(text, 64, 70);
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 70);
    texture.needsUpdate = true;
  };
  return sprite;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export class Cat {
  constructor(scene, world) {
    this.world = world;
    this.model = buildModel();
    this.position = this.model.root.position;
    this.icon = makeIcon();
    this.icon.position.y = 1.8;
    this.model.root.add(this.icon);
    this.butterfly = buildButterfly();
    scene.add(this.model.root, this.butterfly.root);

    this.lastKnown = new THREE.Vector3();
    this.searchPoint = new THREE.Vector3();
    this.butterflyTarget = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.position.copy(this.world.catSpawn);
    this.heading = 0;
    this.walkPhase = 0;
    this.speedThisFrame = 0;
    this.setState('sleep');
    this.timer = C.napTime;
  }

  setState(state) {
    this.state = state;
    this.tracking = false;
    this.icon.userData.draw(...ICONS[state]);
    this.butterfly.root.visible = state === 'distracted';
  }

  startChase(mouse) {
    this.setState('chase');
    this.lastKnown.copy(mouse.position);
    this.lostTimer = 0;
  }

  // Can a chasing cat keep track of the mouse right now?
  canTrack(mouse, toMouse, heard) {
    if (mouse.inHome || mouse.swimming) return false;
    if (!mouse.hidden || heard) return true;
    // Hiding doesn't fool a cat that's watching you dive in.
    if (toMouse >= C.sightRange || !this.world.hasLineOfSight(this.position, mouse.position)) return false;
    // A cardboard box can only be seen into through its open end.
    const b = mouse.box;
    return !b || (this.position.x - b.x) * b.openX + (this.position.z - b.z) * b.openZ > 0;
  }

  // Returns 'caught' when the cat gets the mouse.
  update(dt, mouse) {
    const toMouse = dist2d(this.position, mouse.position);
    const heard = !mouse.inHome && mouse.noise > 0 && toMouse <= mouse.noise;
    this.speedThisFrame = 0;

    // Cats hate water: a swimming mouse isn't worth the trouble.
    if (mouse.swimming && (this.state === 'chase' || this.state === 'search')) this.startDistraction();

    switch (this.state) {
      case 'sleep':
        this.timer -= dt;
        if (this.timer <= 0) this.startChase(mouse);
        break;

      case 'chase':
        this.tracking = this.canTrack(mouse, toMouse, heard);
        if (this.tracking) {
          this.lastKnown.copy(mouse.position);
          this.lostTimer = 0;
        } else {
          // Brief grace before giving up, so it doesn't flicker between states.
          this.lostTimer += dt;
          if (this.lostTimer >= C.loseTrackTime) {
            this.startSearch(this.lastKnown);
            break;
          }
        }
        {
          // A mouse in a cardboard box gets pawed out through the open end.
          const box = this.world.cardboardAt(this.lastKnown.x, this.lastKnown.z);
          this.moveToward(box ? box.entrance : this.lastKnown, C.chaseSpeed, dt);
        }
        if (mouse.box) {
          if (dist2d(this.position, mouse.box.entrance) < 0.6) return 'caught';
        } else if (toMouse < C.catchDistance && Math.abs(mouse.position.y - this.position.y) < 1.0) {
          return 'caught';
        }
        break;

      case 'search': {
        // It can see an exposed mouse, hear a noisy one, or sniff one out up close.
        const sniffed = mouse.box
          ? dist2d(this.position, mouse.box.entrance) < C.sniffDistance
          : toMouse < C.sniffDistance && !mouse.inHome;
        if (!mouse.hidden || heard || sniffed) {
          this.startChase(mouse);
          break;
        }
        this.timer += dt;
        if (this.timer >= C.hideTimeToDistract) {
          this.startDistraction();
          break;
        }
        this.searchPointTimer -= dt;
        if (this.moveToward(this.searchPoint, C.searchSpeed, dt) || this.searchPointTimer <= 0) {
          this.pickSearchPoint();
        }
        break;
      }

      case 'distracted': {
        this.timer -= dt;
        const noticed = !mouse.hidden && !mouse.swimming && toMouse < C.noticeDistance;
        if (heard || noticed) {
          this.startChase(mouse);
          break;
        }
        if (this.timer <= 0) {
          // Snaps out of it and goes back to looking where it last saw the mouse.
          this.startSearch(this.lastKnown);
          break;
        }
        this.updateButterfly(dt);
        this.moveToward(this.butterfly.root.position, C.distractedSpeed, dt, 1.0);
        break;
      }
    }

    this.animate(dt);
    return null;
  }

  startSearch(lastSeen) {
    this.lastKnown.copy(lastSeen);
    this.timer = 0;
    this.setState('search');
    this.searchPoint.copy(this.lastKnown);
    this.searchPointTimer = 3;
  }

  pickSearchPoint() {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * C.searchRadius;
      const x = this.lastKnown.x + Math.cos(a) * d;
      const z = this.lastKnown.z + Math.sin(a) * d;
      if (this.world.isValidCatPoint(x, z, C.radius)) {
        this.searchPoint.set(x, 0, z);
        break;
      }
    }
    this.searchPointTimer = 3;
  }

  startDistraction() {
    this.setState('distracted');
    const [min, max] = C.distractionDuration;
    this.timer = min + Math.random() * (max - min);
    const b = this.butterfly.root.position;
    b.set(this.position.x + Math.sin(this.heading) * 1.5, 1.2, this.position.z + Math.cos(this.heading) * 1.5);
    this.pickButterflyTarget();
  }

  pickButterflyTarget() {
    const b = this.butterfly.root.position;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 3 + Math.random() * 6;
      const x = b.x + Math.cos(a) * d;
      const z = b.z + Math.sin(a) * d;
      if (this.world.isValidCatPoint(x, z, C.radius)) {
        this.butterflyTarget.set(x, 0, z);
        return;
      }
    }
    this.butterflyTarget.set(this.world.catSpawn.x, 0, this.world.catSpawn.z);
  }

  updateButterfly(dt) {
    const b = this.butterfly.root.position;
    const dx = this.butterflyTarget.x - b.x;
    const dz = this.butterflyTarget.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) this.pickButterflyTarget();
    else {
      const step = Math.min(d, C.distractedSpeed * 1.2 * dt);
      b.x += (dx / d) * step;
      b.z += (dz / d) * step;
      this.butterfly.root.rotation.y = Math.atan2(dx, dz);
    }
    const t = performance.now() / 1000;
    b.y = 1.2 + Math.sin(t * 2.3) * 0.35;
    for (const w of this.butterfly.wings) w.rotation.z = w.userData.side * Math.sin(t * 25) * 0.9;
  }

  // Walk toward target, detouring around tall obstacles. Returns true on arrival.
  moveToward(target, speed, dt, stopDistance = 0.4) {
    const waypoint = this.world.steer(this.position, target, C.radius);
    const dx = waypoint.x - this.position.x;
    const dz = waypoint.z - this.position.z;
    const len = Math.hypot(dx, dz);
    if (dist2d(this.position, target) < stopDistance) return true;
    if (len > 1e-4) {
      const step = Math.min(len, speed * dt);
      const before = this.position.clone();
      this.position.x += (dx / len) * step;
      this.position.z += (dz / len) * step;
      this.world.resolveCat(this.position, C.radius);
      this.speedThisFrame = dist2d(before, this.position) / dt;
      this.heading = angleLerp(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 8));
    }
    return false;
  }

  animate(dt) {
    // Hop up onto anything low enough to jump on.
    const ground = this.world.groundHeightAt(this.position.x, this.position.z, C.jumpHeight);
    this.position.y += (ground - this.position.y) * Math.min(1, dt * 10);

    this.model.root.rotation.y = this.heading;
    this.walkPhase += dt * this.speedThisFrame * 2.2;
    const swing = this.speedThisFrame > 0.1 ? 0.7 : 0;
    this.model.legs.forEach((hip, i) => {
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      hip.rotation.x = Math.sin(this.walkPhase + phase) * swing;
    });
    const t = performance.now() / 1000;
    this.model.tail.rotation.z = Math.sin(t * (this.state === 'chase' ? 8 : 2)) * 0.4;
    // Curled up and low while napping.
    const targetScaleY = this.state === 'sleep' ? 0.6 : 1;
    this.model.body.scale.y += (targetScaleY - this.model.body.scale.y) * Math.min(1, dt * 6);
  }
}
