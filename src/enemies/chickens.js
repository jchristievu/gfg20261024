import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Creature, dist2d } from './creature.js';

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
}

// Chicken model, facing +z. `rooster` adds a big comb, wattles, hackles and a sickle tail.
function buildChicken({ scale = 1, body, wing, rooster = false }) {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const bodyMat = std(body);
  const wingMat = std(wing);
  const red = std(0xd42a1e, { roughness: 0.6 });
  const yellow = std(0xf2b630, { roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), bodyMat);
  torso.scale.set(0.85, 0.9, 1.15);
  torso.position.y = 0.85;
  bodyGroup.add(torso);

  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.28, 0.95, 0);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), wingMat);
    w.scale.set(0.3, 0.7, 1.1);
    w.position.set(s * 0.04, -0.08, -0.05);
    pivot.add(w);
    bodyGroup.add(pivot);
    wings.push(pivot);
  }

  // Head on a pivot so it can bob and peck.
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0.3);
  bodyGroup.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.35, 10), rooster ? std(0xd98b2b) : bodyMat);
  neck.position.set(0, 0.05, 0);
  neck.rotation.x = 0.35;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), rooster ? std(0xd98b2b) : bodyMat);
  skull.position.set(0, 0.25, 0.06);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), yellow);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.23, 0.22);
  head.add(neck, skull, beak);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), std(0x111111, { roughness: 0.2 }));
    eye.position.set(s * 0.1, 0.28, 0.12);
    head.add(eye);
  }
  // Comb along the top of the head, and wattle under the beak.
  const combCount = rooster ? 4 : 2;
  for (let i = 0; i < combCount; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(rooster ? 0.06 : 0.04, 8, 6), red);
    c.scale.set(0.5, 1.2, 1);
    c.position.set(0, 0.4 + (rooster ? 0.03 : 0), 0.13 - i * 0.06);
    head.add(c);
  }
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(rooster ? 0.05 : 0.03, 8, 6), red);
  wattle.scale.set(0.6, 1.4, 0.6);
  wattle.position.set(0, 0.12, 0.17);
  head.add(wattle);

  // Tail: a sweep of dark sickle feathers for the rooster, a stubby tuft for hens.
  const tailMat = rooster ? std(0x1d3a2c, { metalness: 0.4, roughness: 0.4 }) : wingMat;
  const feathers = rooster ? 5 : 3;
  for (let i = 0; i < feathers; i++) {
    const spread = (i - (feathers - 1) / 2) * 0.12;
    const len = rooster ? 0.75 + (i % 2) * 0.15 : 0.3;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(spread * 0.3, 0.9, -0.35),
      new THREE.Vector3(spread, 0.9 + len * 0.8, -0.45 - len * 0.2),
      new THREE.Vector3(spread * 1.3, 0.9 + len * 0.9, -0.55 - len * 0.6),
      new THREE.Vector3(spread * 1.5, 0.9 + len * 0.4, -0.6 - len * 0.9),
    ]);
    bodyGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, rooster ? 0.045 : 0.06, 6), tailMat));
  }

  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.12, 0.5, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), yellow);
    leg.position.y = -0.25;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.16), yellow);
    foot.position.set(0, -0.5, 0.04);
    hip.add(leg, foot);
    root.add(hip);
    legs.push(hip);
  }

  root.scale.setScalar(scale);
  root.traverse((o) => (o.castShadow = o.isMesh));
  return { root, body: bodyGroup, head, wings, legs, iconHeight: 1.9 };
}

function animateChicken(model, speed, t, pecking, flapping) {
  const walk = speed > 0.1;
  model.legs.forEach((hip, i) => (hip.rotation.x = walk ? Math.sin(t * speed * 5 + i * Math.PI) * 0.6 : 0));
  // Chickens bob their heads as they walk; pecking dips the head to the ground.
  model.head.rotation.x = pecking ? Math.max(0, Math.sin(t * 9)) * 1.1 : walk ? Math.sin(t * speed * 5) * 0.15 : 0;
  model.head.position.z = 0.3 + (walk ? Math.sin(t * speed * 5) * 0.04 : 0);
  model.wings.forEach((w, i) => (w.rotation.z = flapping ? (i ? -1 : 1) * (0.4 + Math.sin(t * 30) * 0.6) : 0));
}

const ROOSTER_ICONS = {
  guard: ['', ''],
  charge: ['!', '#ff4040'],
  chase: ['!', '#ff4040'],
  return: ['…', '#cccccc'],
};

// Guards a post. Charges at whatever a hen squawks about (or a loud noise),
// chases the mouse while he can see it, and never searches: lose him and he
// struts straight back to his post.
export class Rooster extends Creature {
  constructor(scene, world, post, facing = Math.PI) {
    const model = buildChicken({ scale: 1.1, body: 0xa8452a, wing: 0x6e2c1c, rooster: true });
    super(scene, world, model, CONFIG.rooster.radius, model.iconHeight);
    this.p = CONFIG.rooster;
    this.caughtTitle = 'Pecked!';
    this.caughtText = 'The rooster ran {name} out of the yard.';
    this.post = new THREE.Vector3(...post);
    this.facing = facing;
    this.target = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.position.copy(this.post);
    this.heading = this.facing;
    this.setState('guard');
    this.pause = 1;
    this.strutPoint = null;
  }

  setState(state) {
    this.state = state;
    this.tracking = state === 'chase';
    this.lostTimer = 0;
    this.icon.userData.draw(...ROOSTER_ICONS[state]);
  }

  // A hen squawked at `point`.
  alert(point) {
    if (this.state === 'chase') return;
    this.target.copy(point);
    this.setState('charge');
  }

  update(dt, mouse) {
    const P = this.p;
    this.speedThisFrame = 0;
    const toMouse = dist2d(this.position, mouse.position);
    const heard = !mouse.inHome && mouse.noise > 0 && toMouse <= mouse.noise;

    if (this.state !== 'chase' && this.canSee(mouse, P.sightRange, P.fov)) this.setState('chase');
    else if (heard && (this.state === 'guard' || this.state === 'return')) this.alert(mouse.position);

    switch (this.state) {
      case 'guard':
        // Strut around the post, stopping now and then to look about.
        if (this.pause > 0) {
          this.pause -= dt;
          this.heading += Math.sin(performance.now() / 700) * dt * 1.5;
        } else if (!this.strutPoint || this.moveToward(this.strutPoint, P.strutSpeed, dt)) {
          this.strutPoint = this.randomPointNear(this.post.x, this.post.z, 0.5, P.postRadius);
          this.pause = 0.8 + Math.random() * 1.8;
        }
        break;

      case 'charge':
        if (this.moveToward(this.target, P.chargeSpeed, dt, 0.8)) this.setState('return');
        break;

      case 'chase':
        if (this.canSee(mouse, P.sightRange * 1.3)) {
          this.lostTimer = 0;
          this.moveToward(mouse.position, P.chaseSpeed, dt, 0.2);
          if (toMouse < P.catchDistance && Math.abs(mouse.position.y - this.position.y) < 1.0) return 'caught';
        } else {
          this.lostTimer += dt;
          if (this.lostTimer > P.loseSightGrace) this.setState('return');
        }
        break;

      case 'return':
        if (this.moveToward(this.post, P.returnSpeed, dt, 1.0)) {
          this.setState('guard');
          this.pause = 1.5;
        }
        break;
    }

    this.followGround(dt);
    animateChicken(this.model, this.speedThisFrame, performance.now() / 1000, false, this.state === 'charge');
    return null;
  }

  statusLabel() {
    return {
      guard: 'Rooster: guarding',
      charge: 'Rooster: CHARGING!',
      chase: 'Rooster: CHASING YOU!',
      return: 'Rooster: strutting back',
    }[this.state];
  }

  statusClass() {
    return { guard: 'sleep', charge: 'chase', chase: 'chase', return: 'search' }[this.state];
  }
}

const HEN_COLORS = [
  [0x9a6a3a, 0x7a4f28],
  [0xf2efe6, 0xd8d2c4],
  [0x3a3330, 0x262220],
  [0xc8873e, 0xa66a2c],
];

// Wanders and pecks. Squawks when it sees or hears the mouse nearby, which
// brings the rooster running. Hens never attack.
export class Hen extends Creature {
  constructor(scene, world, home, variant = 0) {
    const [body, wing] = HEN_COLORS[variant % HEN_COLORS.length];
    const model = buildChicken({ scale: 0.8, body, wing });
    super(scene, world, model, CONFIG.hen.radius, model.iconHeight);
    this.p = CONFIG.hen;
    this.minor = true; // small dot on the radar: hens alert, they don't attack
    this.home = new THREE.Vector3(home[0], 0, home[1]);
    this.reset();
  }

  reset() {
    this.position.copy(this.home);
    this.heading = Math.random() * Math.PI * 2;
    this.state = 'peck';
    this.timer = Math.random() * 2;
    this.cooldown = 0;
    this.tracking = false;
    this.wanderPoint = null;
    this.icon.userData.draw('', '');
  }

  // Returns { alert: point } when it squawks.
  update(dt, mouse) {
    const P = this.p;
    this.speedThisFrame = 0;
    this.cooldown -= dt;
    this.timer -= dt;
    const toMouse = dist2d(this.position, mouse.position);
    const heard = !mouse.inHome && mouse.noise > 0 && toMouse <= mouse.noise;
    let result = null;

    if (this.cooldown <= 0 && (heard || this.canSee(mouse, P.alertRadius))) {
      // SQUAWK! Flap and scurry away from the mouse.
      this.cooldown = P.squawkCooldown;
      this.state = 'flap';
      this.timer = 1.4;
      this.icon.userData.draw('!', '#ffd23f');
      const away = Math.atan2(this.position.x - mouse.position.x, this.position.z - mouse.position.z);
      this.wanderPoint = this.randomPointNear(this.position.x + Math.sin(away) * 3, this.position.z + Math.cos(away) * 3, 0, 1.5);
      result = { alert: mouse.position.clone(), from: this.position.clone(), message: 'SQUAWK! A hen spotted you!', feathers: true };
    }

    switch (this.state) {
      case 'peck':
        if (this.timer <= 0) {
          this.state = 'walk';
          this.wanderPoint = this.randomPointNear(this.home.x, this.home.z, 0, P.wanderRadius);
        }
        break;
      case 'walk':
        if (!this.wanderPoint || this.moveToward(this.wanderPoint, P.wanderSpeed, dt)) {
          this.state = 'peck';
          this.timer = 1 + Math.random() * 3;
        }
        break;
      case 'flap':
        if (this.wanderPoint) this.moveToward(this.wanderPoint, P.wanderSpeed * 3, dt);
        if (this.timer <= 0) {
          this.state = 'peck';
          this.timer = 1;
          this.icon.userData.draw('', '');
        }
        break;
    }

    this.followGround(dt);
    animateChicken(this.model, this.speedThisFrame, performance.now() / 1000 + this.home.x, this.state === 'peck', this.state === 'flap');
    return result;
  }
}
