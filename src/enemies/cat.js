import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { texturedMat } from '../textures.js';
import { Creature, dist2d } from './creature.js';

// Icon floating over the cat's head for each state.
const ICONS = {
  sleep: ['z', '#9bd4ff'],
  wander: ['', ''],
  chase: ['!', '#ff4040'],
  search: ['?', '#ffd23f'],
  distracted: ['♪', '#8fd3ff'],
  bored: ['…', '#ffd23f'],
};

const STYLES = {
  // Slim gray-and-white tabby.
  farm: {
    name: 'Cat',
    caught: ['Caught!', 'The farm cat got {name}. Better luck next time.'],
    bodyR: 0.27,
    bodyLen: 1.0,
    legLen: 0.5,
    headR: 0.27,
    tailR: 0.05,
    fur: () => texturedMat('grayFur', 1, 2, { roughness: 1 }),
    headFur: () => texturedMat('grayFur', 1, 1, { roughness: 1 }),
    accent: 0x7d838b, // ears, legs
    light: 0xf4f2ee, // chest, muzzle, paws
    eye: 0xc8d84a,
    tailTip: 0xf4f2ee,
    flops: false,
  },
  // Fluffy cream ragdoll with dark brown points and blue eyes.
  ragdoll: {
    name: 'Ragdoll',
    caught: ['Caught!', 'The ragdoll finally got off the couch, and got {name}.'],
    bodyR: 0.4,
    bodyLen: 0.95,
    legLen: 0.36,
    headR: 0.35,
    tailR: 0.11,
    fur: () => texturedMat('ragdollFur', 1, 2, { roughness: 1 }),
    headFur: () => texturedMat('ragdollFur', 1, 1, { roughness: 1 }),
    accent: 0x5a4434,
    light: 0xfbf7f0,
    eye: 0x4f8fe0,
    tailTip: 0x4a3628,
    mask: 0x6a5240,
    ruff: true,
    flops: true,
  },
};

function buildModel(s) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const fur = s.fur();
  const accent = new THREE.MeshStandardMaterial({ color: s.accent, roughness: 1 });
  const light = new THREE.MeshStandardMaterial({ color: s.light, roughness: 1 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe8a0a8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: s.eye, emissive: new THREE.Color(s.eye).multiplyScalar(0.2), roughness: 0.2 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

  const bodyY = s.legLen + s.bodyR * 0.6;
  const front = s.bodyLen / 2 + s.bodyR;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(s.bodyR, s.bodyLen, 8, 16), fur);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = bodyY;
  const chest = new THREE.Mesh(new THREE.SphereGeometry(s.bodyR * 0.85, 12, 10), light);
  chest.scale.set(0.9, 0.95, 0.7);
  chest.position.set(0, bodyY - s.bodyR * 0.15, front - s.bodyR * 0.45);
  body.add(torso, chest);
  if (s.ruff) {
    const ruff = new THREE.Mesh(new THREE.SphereGeometry(s.bodyR * 1.05, 14, 10), light);
    ruff.scale.set(1.05, 1, 0.8);
    ruff.position.set(0, bodyY + s.bodyR * 0.25, front - s.bodyR * 0.6);
    body.add(ruff);
  }

  const h = s.headR;
  const hc = new THREE.Vector3(0, bodyY + s.bodyR * 0.75 + h * 0.3, front + h * 0.45);
  const at = (x, y, z) => new THREE.Vector3(hc.x + x * h, hc.y + y * h, hc.z + z * h);
  const head = new THREE.Mesh(new THREE.SphereGeometry(h, 20, 14), s.headFur());
  head.rotation.x = -Math.PI / 2; // stripes run over the top of the head
  head.position.copy(hc);
  body.add(head);
  if (s.mask) {
    const mask = new THREE.Mesh(new THREE.SphereGeometry(h * 0.75, 14, 10), new THREE.MeshStandardMaterial({ color: s.mask, roughness: 1 }));
    mask.scale.set(1.15, 0.85, 0.6);
    mask.position.copy(at(0, 0.1, 0.55));
    body.add(mask);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(h * 0.47, 12, 8), light);
  muzzle.scale.set(1.3, 0.8, 0.8);
  muzzle.position.copy(at(0, -0.25, 0.81));
  const nose = new THREE.Mesh(new THREE.SphereGeometry(h * 0.12, 8, 6), pink);
  nose.scale.set(1.2, 0.7, 0.8);
  nose.position.copy(at(0, -0.06, 1.13));
  body.add(muzzle, nose);

  const whiskerMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(h * 0.36, h * 0.8, 4), accent);
    ear.position.copy(at(side * 0.55, 0.9, -0.1));
    ear.rotation.z = -side * 0.15;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(h * 0.22, h * 0.55, 4), pink);
    inner.position.copy(at(side * 0.55, 0.85, 0.05));
    inner.rotation.z = -side * 0.15;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(h * 0.19, 12, 10), eyeMat);
    eye.position.copy(at(side * 0.4, 0.22, 0.8));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(h * 0.095, 8, 8), pupilMat);
    pupil.scale.set(0.35, 1.3, 0.5);
    pupil.position.copy(at(side * 0.42, 0.22, 0.97));
    body.add(ear, inner, eye, pupil);

    const pts = [];
    for (const dy of [-0.1, 0, 0.1]) pts.push(at(side * 0.3, -0.25, 1.06), at(side * 1.4, -0.25 + dy * 2.5, 0.75));
    body.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), whiskerMat));
  }

  const legs = [];
  const lx = s.bodyR * 0.6;
  const lz = s.bodyLen / 2;
  for (const [x, z] of [[-lx, lz], [lx, lz], [-lx, -lz], [lx, -lz]]) {
    const hip = new THREE.Group();
    hip.position.set(x, s.legLen, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(s.bodyR * 0.26, s.bodyR * 0.22, s.legLen, 8), accent);
    leg.position.y = -s.legLen / 2;
    const paw = new THREE.Mesh(new THREE.SphereGeometry(s.bodyR * 0.3, 10, 8), light);
    paw.scale.set(1, 0.6, 1.25);
    paw.position.set(0, -s.legLen + 0.02, 0.03);
    hip.add(leg, paw);
    body.add(hip);
    legs.push(hip);
  }

  // Tail curving up and back.
  const tail = new THREE.Group();
  tail.position.set(0, bodyY + s.bodyR * 0.3, -(s.bodyLen / 2 + s.bodyR * 0.85));
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.25, -0.3),
    new THREE.Vector3(0, 0.65, -0.42),
    new THREE.Vector3(0, 0.95, -0.28),
  ]);
  const tailMat = s.mask ? accent : texturedMat(s === STYLES.farm ? 'grayFur' : 'ragdollFur', 3, 1);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, s.tailR, 8), tailMat));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(s.tailR * 1.05, 8, 6), new THREE.MeshStandardMaterial({ color: s.tailTip, roughness: 1 }));
  tip.position.set(0, 0.95, -0.28);
  tail.add(tip);
  body.add(tail);

  root.traverse((o) => (o.castShadow = o.isMesh));
  const iconHeight = hc.y + h + 0.6;
  return { root, body, legs, tail, iconHeight };
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

// A cat that hunts the mouse. `kind` picks a profile from CONFIG.cats:
// the farm cat (always knows where an exposed mouse is, chases a butterfly when
// it gives up) or the indoor ragdoll (has to see you, tires fast, naps a lot).
export class Cat extends Creature {
  constructor(scene, world, kind, spawn) {
    const style = STYLES[kind];
    const model = buildModel(style);
    super(scene, world, model, CONFIG.cats[kind].radius, model.iconHeight);
    this.kind = kind;
    this.style = style;
    [this.caughtTitle, this.caughtText] = style.caught;
    this.p = CONFIG.cats[kind];
    this.spawn = new THREE.Vector3(...spawn);
    this.avoidWater = this.p.hatesWater;
    if (this.p.distraction === 'butterfly') {
      this.butterfly = buildButterfly();
      scene.add(this.butterfly.root);
    }
    this.lastKnown = new THREE.Vector3();
    this.searchPoint = new THREE.Vector3();
    this.wanderPoint = null;
    this.butterflyTarget = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.position.copy(this.spawn);
    this.heading = 0;
    this.walkPhase = 0;
    this.speedThisFrame = 0;
    // Forget the last life's targets so a respawn doesn't replay the same moves.
    this.wanderPoint = null;
    this.prowlPause = 0;
    this.lastKnown.copy(this.spawn);
    this.searchPoint.copy(this.spawn);
    this.nap(this.p.napTime);
  }

  setState(state) {
    this.state = state;
    this.tracking = false;
    this.bored = false;
    this.tired = false;
    this.investigating = false;
    this.icon.userData.draw(...ICONS[state]);
    if (this.butterfly) this.butterfly.root.visible = state === 'distracted';
  }

  nap([min, max]) {
    this.setState('sleep');
    this.timer = min + Math.random() * (max - min);
  }

  startChase(mouse) {
    this.setState('chase');
    this.lastKnown.copy(mouse.position);
    this.lostTimer = 0;
    this.chaseTime = 0;
  }

  // Something (the dog) is raising the alarm about the mouse at `point`: wake up
  // and head there, and don't give up until reaching it.
  alert(point) {
    if (this.state === 'chase' && this.tracking) return;
    this.startChase({ position: point });
    this.investigating = true;
  }

  // Can it tell where an exposed mouse is right now? Close up it smells/hears
  // you through anything; farther out it has to actually see you.
  sees(mouse) {
    if (mouse.hidden || mouse.swimming) return false;
    if (dist2d(this.position, mouse.position) <= this.p.senseRange) return true;
    return this.canSee(mouse, this.p.spotRange);
  }

  // Can a chasing cat keep track of the mouse right now?
  canTrack(mouse, toMouse, heard) {
    if (mouse.inHome || mouse.swimming) return false;
    if (heard) return true;
    if (!mouse.hidden) return this.sees(mouse);
    // Hiding doesn't fool a cat that's watching you dive in.
    if (toMouse >= this.p.sightRange || !this.world.hasLineOfSight(this.position, mouse.position)) return false;
    // A cardboard box can only be seen into through its open end.
    const b = mouse.box;
    return !b || (this.position.x - b.x) * b.openX + (this.position.z - b.z) * b.openZ > 0;
  }

  // Returns 'caught' when the cat gets the mouse.
  update(dt, mouse) {
    const C = this.p;
    const toMouse = dist2d(this.position, mouse.position);
    const heard = !mouse.inHome && mouse.noise > 0 && toMouse <= mouse.noise;
    const noticed = !mouse.hidden && !mouse.swimming && toMouse < C.noticeDistance;
    this.speedThisFrame = 0;

    // Cats that hate water won't go after a swimming mouse.
    if (C.hatesWater && mouse.swimming && (this.state === 'chase' || this.state === 'search')) this.startDistraction();

    switch (this.state) {
      case 'sleep': {
        this.timer -= dt;
        if (C.distraction === 'nap') this.setBored(this.timer < C.boredWarning);
        if (C.wakesOnNoise && (heard || noticed)) {
          this.startChase(mouse);
          break;
        }
        if (this.timer <= 0) {
          // Wakes up: goes for the mouse if it can sense it, otherwise prowls.
          if (this.sees(mouse)) this.startChase(mouse);
          else this.setState('wander');
        }
        break;
      }

      case 'wander':
        if (heard || this.sees(mouse)) {
          this.startChase(mouse);
          break;
        }
        // Prowl from spot to spot, sitting a while at each.
        if (this.prowlPause > 0) this.prowlPause -= dt;
        else if (!this.wanderPoint || this.moveToward(this.wanderPoint, C.wanderSpeed, dt)) {
          if (this.wanderPoint) this.prowlPause = C.prowlPause[0] + Math.random() * (C.prowlPause[1] - C.prowlPause[0]);
          this.pickWanderPoint();
        }
        break;

      case 'chase':
        this.tracking = this.canTrack(mouse, toMouse, heard);
        this.chaseTime += dt;
        if (this.chaseTime > C.chaseStamina) {
          // Lazy cat: too much running, time to lie down.
          this.nap(C.tiredNap);
          this.tired = true;
          break;
        }
        if (this.tracking) {
          this.investigating = false;
          this.lastKnown.copy(mouse.position);
          this.lostTimer = 0;
        } else if (this.investigating) {
          // Heading for where the alarm was raised; once there, sniff around.
          if (dist2d(this.position, this.lastKnown) < 1.5) {
            this.startSearch(this.lastKnown);
            break;
          }
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
        if (this.sees(mouse) || heard || sniffed) {
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
        this.setBored(this.timer < C.boredWarning);
        if (heard || noticed) {
          this.startChase(mouse);
          break;
        }
        if (this.timer <= 0) {
          // Snaps out of it: straight for the mouse if it can sense it, otherwise prowls.
          if (this.sees(mouse)) this.startChase(mouse);
          else this.setState('wander');
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

  // Warn the player shortly before a distraction or nap ends.
  setBored(bored) {
    if (bored === this.bored) return;
    this.bored = bored;
    this.icon.userData.draw(...(bored ? ICONS.bored : ICONS[this.state]));
  }

  startSearch(lastSeen) {
    this.lastKnown.copy(lastSeen);
    this.timer = 0;
    this.setState('search');
    this.searchPoint.copy(this.lastKnown);
    this.searchPointTimer = 3;
  }

  pickSearchPoint() {
    const p = this.randomPointNear(this.lastKnown.x, this.lastKnown.z, 0, this.p.searchRadius, 10);
    if (p) this.searchPoint.copy(p);
    this.searchPointTimer = 3;
  }

  // Prowl somewhere nearby, but not around the mouse hole.
  pickWanderPoint() {
    const home = this.world.home;
    for (let i = 0; i < 10; i++) {
      const p = this.randomPointNear(this.position.x, this.position.z, 4, 12, 1);
      if (p && Math.hypot(p.x - home.x, p.z - home.z) >= this.p.butterflyHomeClearance) {
        this.wanderPoint = p;
        return;
      }
    }
    this.wanderPoint = this.spawn.clone();
  }

  startDistraction() {
    if (this.p.distraction === 'nap') {
      this.nap(this.p.distractionDuration);
      return;
    }
    this.setState('distracted');
    const [min, max] = this.p.distractionDuration;
    this.timer = min + Math.random() * (max - min);
    const b = this.butterfly.root.position;
    b.set(this.position.x + Math.sin(this.heading) * 1.5, 1.2, this.position.z + Math.cos(this.heading) * 1.5);
    this.pickButterflyTarget();
  }

  pickButterflyTarget() {
    const b = this.butterfly.root.position;
    for (let i = 0; i < 10; i++) {
      const p = this.randomPointNear(b.x, b.z, 3, 9, 1);
      // Keep the butterfly (and so the cat) from loitering at the mouse's front door.
      if (p && Math.hypot(p.x - this.world.home.x, p.z - this.world.home.z) >= this.p.butterflyHomeClearance) {
        this.butterflyTarget.copy(p);
        return;
      }
    }
    this.butterflyTarget.copy(this.spawn);
  }

  updateButterfly(dt) {
    const b = this.butterfly.root.position;
    const dx = this.butterflyTarget.x - b.x;
    const dz = this.butterflyTarget.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) this.pickButterflyTarget();
    else {
      const step = Math.min(d, this.p.distractedSpeed * 1.2 * dt);
      b.x += (dx / d) * step;
      b.z += (dz / d) * step;
      this.butterfly.root.rotation.y = Math.atan2(dx, dz);
    }
    const t = performance.now() / 1000;
    b.y = 1.2 + Math.sin(t * 2.3) * 0.35;
    for (const w of this.butterfly.wings) w.rotation.z = w.userData.side * Math.sin(t * 25) * 0.9;
  }

  statusLabel() {
    const n = this.style.name;
    if (this.bored) return this.state === 'sleep' ? `${n}: stirring… hide!` : `${n}: getting bored… hide!`;
    if (this.state === 'sleep' && this.tired) return `${n}: worn out, napping`;
    if (this.state === 'chase' && this.investigating) return `${n}: heard the alarm, coming!`;
    return {
      sleep: `${n}: napping`,
      wander: `${n}: prowling`,
      chase: `${n}: CHASING YOU!`,
      search: `${n}: searching…`,
      distracted: `${n}: distracted`,
    }[this.state];
  }

  statusClass() {
    return this.bored ? 'search' : this.state;
  }

  animate(dt) {
    this.followGround(dt);
    this.walkPhase += dt * this.speedThisFrame * 2.2;
    const swing = this.speedThisFrame > 0.1 ? 0.7 : 0;
    this.model.legs.forEach((hip, i) => {
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      hip.rotation.x = Math.sin(this.walkPhase + phase) * swing;
    });
    const t = performance.now() / 1000;
    this.model.tail.rotation.z = Math.sin(t * (this.state === 'chase' ? 8 : 2)) * 0.4;
    const asleep = this.state === 'sleep';
    const body = this.model.body;
    if (this.style.flops) {
      // The ragdoll flops over onto its side to nap.
      body.rotation.z += ((asleep ? 1.35 : 0) - body.rotation.z) * Math.min(1, dt * 5);
      body.position.y += ((asleep ? 0.25 : 0) - body.position.y) * Math.min(1, dt * 5);
    } else {
      body.scale.y += ((asleep ? 0.6 : 1) - body.scale.y) * Math.min(1, dt * 6);
    }
  }
}
