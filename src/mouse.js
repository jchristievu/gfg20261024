import * as THREE from 'three';
import { CONFIG } from './config.js';

const M = CONFIG.mouse;

// Tail styles the player can pick from at the start of the game.
export const TAILS = {
  straight: 'Straight',
  curly: 'Curly',
  short: 'Short',
  triple: '3-tail',
  fox: 'Fox',
  finger: 'Human finger',
  fireball: 'Fireball',
};

const tailMat = new THREE.MeshStandardMaterial({ color: 0xe8a0a8, roughness: 0.8 });

function tube(points, radius) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(16, points.length * 2), radius, 6), tailMat);
}

// Tail meshes, built from the base of the tail (local origin) extending back along -z.
function buildTail(style) {
  const g = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  if (style === 'curly') {
    // A short run back, then a tight corkscrew.
    const pts = [V(0, 0, 0), V(0, 0.03, -0.12)];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const a = t * Math.PI * 4;
      pts.push(V(Math.sin(a) * 0.07, 0.1 - Math.cos(a) * 0.07, -0.16 - t * 0.22));
    }
    g.add(tube(pts, 0.022));
  } else if (style === 'short') {
    g.add(tube([V(0, 0, 0), V(0, 0.03, -0.08), V(0, 0.06, -0.15)], 0.03));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), tailMat);
    tip.position.set(0, 0.06, -0.15);
    g.add(tip);
  } else if (style === 'fireball') {
    // Tail curving up into a flickering ball of fire.
    g.add(tube([V(0, 0, 0), V(0, 0.08, -0.25), V(0, 0.28, -0.42), V(0, 0.46, -0.44)], 0.02));
    const fire = new THREE.Group();
    fire.position.set(0, 0.52, -0.44);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
    const glowMat = (color, opacity) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), glowMat(0xffa020, 0.7));
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), glowMat(0xff4a10, 0.35));
    fire.add(core, inner, outer);
    const flames = [];
    for (let i = 0; i < 5; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), glowMat(i % 2 ? 0xff7a18 : 0xffc040, 0.8));
      const a = (i / 5) * Math.PI * 2;
      flame.position.set(Math.cos(a) * 0.05, 0.08, Math.sin(a) * 0.05);
      flame.userData.phase = i * 1.3;
      fire.add(flame);
      flames.push(flame);
    }
    g.add(fire);
    g.userData.fire = { fire, inner, outer, flames };
  } else if (style === 'triple') {
    // Three tails fanning out behind.
    for (const [spread, lift] of [[-0.18, 0.05], [0, 0.09], [0.18, 0.05]]) {
      g.add(tube([V(0, 0, 0), V(spread * 0.4, lift * 0.5, -0.15), V(spread, lift, -0.32), V(spread * 1.3, lift * 1.4, -0.45)], 0.018));
    }
  } else if (style === 'fox') {
    // Big bushy fox tail: overlapping puffs that swell then taper, with a white tip.
    const orange = new THREE.MeshStandardMaterial({ color: 0xd8692a, roughness: 1 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf6f1ea, roughness: 1 });
    const path = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0.12, -0.2), V(0, 0.3, -0.38), V(0, 0.42, -0.48)]);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = 0.04 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.09 + (t > 0.85 ? 0.03 : 0);
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), t > 0.78 ? white : orange);
      puff.position.copy(path.getPoint(t));
      g.add(puff);
    }
  } else if (style === 'finger') {
    // A human index finger curling up from the base: three jointed segments,
    // knuckle creases, and a fingernail at the tip.
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8b496, roughness: 0.7 });
    const crease = new THREE.MeshStandardMaterial({ color: 0xc89070, roughness: 0.8 });
    const nailMat = new THREE.MeshStandardMaterial({ color: 0xf6dcd4, roughness: 0.25 });
    const segments = [
      [0.17, 0.05],
      [0.12, 0.046],
      [0.1, 0.043],
    ];
    let parent = g;
    segments.forEach(([len, r], i) => {
      const joint = new THREE.Group();
      joint.rotation.x = i === 0 ? 0.25 : 0.75; // each joint curls the finger further up
      parent.add(joint);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), skin);
      seg.rotation.x = Math.PI / 2;
      seg.position.z = -len / 2;
      joint.add(seg);
      const knuckle = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.006, 4, 14), crease);
      knuckle.position.z = -0.01;
      joint.add(knuckle);
      if (i === segments.length - 1) {
        const nail = new THREE.Mesh(new THREE.SphereGeometry(r * 0.85, 10, 8), nailMat);
        nail.scale.set(0.9, 0.3, 1.2);
        nail.position.set(0, -r * 0.8, -len * 0.75); // on the back of the fingertip
        joint.add(nail);
      }
      const next = new THREE.Group();
      next.position.z = -len;
      joint.add(next);
      parent = next;
    });
  } else {
    // Straight: medium length, only gently lifted.
    g.add(tube([V(0, 0, 0), V(0, 0.03, -0.18), V(0, 0.05, -0.36), V(0, 0.07, -0.5)], 0.02));
  }
  // Shadows from solid parts only (not the fireball's glow).
  g.traverse((o) => (o.castShadow = o.isMesh && o.material.type === 'MeshStandardMaterial'));
  return g;
}

// Head styles. `hidesEars` swaps the mouse's round ears out for the accessory's own.
export const HEADS = {
  normal: { label: 'Normal' },
  cap: { label: 'Blue baseball cap' },
  tophat: { label: 'Top hat' },
  monocle: { label: 'Monocle' },
  catears: { label: 'Cat ears', hidesEars: true },
};

// Head accessories, positioned around the head (center ~(0, 0.28, 0.33), radius ~0.15).
function buildHead(style) {
  const g = new THREE.Group();
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
  if (style === 'cap') {
    const blue = std(0x2f6fd0);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), blue);
    crown.scale.set(1, 0.75, 1.05);
    crown.position.set(0, 0.36, 0.31);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.018, 16, 1, false, -Math.PI / 2, Math.PI), blue);
    brim.scale.set(1, 1, 1.4);
    brim.position.set(0, 0.365, 0.43);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), std(0xffffff));
    button.position.set(0, 0.48, 0.31);
    g.add(crown, brim, button);
    g.rotation.x = -0.12; // tipped back a touch
  } else if (style === 'tophat') {
    const black = std(0x16161a, { roughness: 0.4 });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.22, 18), black);
    crown.position.set(0, 0.54, 0.3);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 20), black);
    brim.position.set(0, 0.43, 0.3);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.04, 18), std(0xa8323a));
    band.position.set(0, 0.46, 0.3);
    g.add(crown, brim, band);
    g.rotation.z = 0.15; // jaunty tilt
  } else if (style === 'monocle') {
    const gold = std(0xd8b04a, { metalness: 0.9, roughness: 0.25 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 8, 20), gold);
    rim.position.set(0.075, 0.325, 0.485);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.038, 20),
      new THREE.MeshStandardMaterial({ color: 0xddeeff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3 }),
    );
    lens.position.copy(rim.position);
    const chain = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.11, 0.3, 0.48),
          new THREE.Vector3(0.16, 0.2, 0.42),
          new THREE.Vector3(0.2, 0.18, 0.3),
          new THREE.Vector3(0.21, 0.22, 0.18),
        ]),
        12,
        0.004,
        4,
      ),
      gold,
    );
    g.add(rim, lens, chain);
  } else if (style === 'catears') {
    // A headband with pointy cat ears (the mouse's own round ears are hidden).
    const dark = std(0x2a2a2e);
    const pink = std(0xf2a8b8);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20, Math.PI), dark);
    band.position.set(0, 0.29, 0.29); // arcs over the top of the head, ear to ear
    g.add(band);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), dark);
      ear.position.set(s * 0.085, 0.45, 0.29);
      ear.rotation.z = -s * 0.25;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 4), pink);
      inner.position.set(s * 0.083, 0.44, 0.31);
      inner.rotation.z = -s * 0.25;
      g.add(ear, inner);
    }
  }
  g.traverse((o) => (o.castShadow = o.isMesh));
  return g;
}

function buildModel() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while running
  root.add(body);

  const fur = new THREE.MeshStandardMaterial({ color: 0x9a8f88, roughness: 1 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe8a0a8, roughness: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), fur);
  torso.scale.set(0.9, 0.75, 1.3);
  torso.position.y = 0.2;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), fur);
  head.scale.set(1, 0.95, 1.2);
  head.position.set(0, 0.28, 0.33);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), pink);
  nose.position.set(0, 0.27, 0.51);

  body.add(torso, head, nose);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xd9cfc4, roughness: 1 }),
  );
  belly.scale.set(0.85, 0.6, 1.1);
  belly.position.set(0, 0.15, 0.04);
  body.add(belly);

  const whiskerMat = new THREE.LineBasicMaterial({ color: 0xf2eee8, transparent: true, opacity: 0.8 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const earInner = new THREE.MeshStandardMaterial({ color: 0xf2b8c0, roughness: 0.8 });
  const ears = []; // hidden when a head style replaces them (cat ears)
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), fur);
    ear.scale.set(1, 1, 0.3);
    ear.position.set(side * 0.1, 0.42, 0.28);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), earInner);
    inner.scale.set(1, 1, 0.3);
    inner.position.set(side * 0.1, 0.415, 0.295);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), black);
    eye.position.set(side * 0.07, 0.32, 0.45);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), shine);
    glint.position.set(side * 0.075, 0.33, 0.475);
    body.add(ear, inner, eye, glint);
    ears.push(ear, inner);

    // Whiskers fanning out from the nose.
    const pts = [];
    for (const dy of [-0.02, 0, 0.02]) {
      pts.push(new THREE.Vector3(side * 0.03, 0.27, 0.49), new THREE.Vector3(side * 0.2, 0.27 + dy * 3, 0.44));
    }
    body.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), whiskerMat));

    for (const z of [0.18, -0.18]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pink);
      foot.scale.set(1, 0.5, 1.4);
      foot.position.set(side * 0.13, 0.02, z);
      body.add(foot);
    }
  }

  // The tail mesh itself is swapped in by Mouse.setTail().
  const tail = new THREE.Group();
  tail.position.set(0, 0.18, -0.3);
  body.add(tail);

  // Slot for the head accessory, swapped in by Mouse.setHead().
  const headwear = new THREE.Group();
  body.add(headwear);

  // Slot on its back for the food it's carrying (the level supplies the model).
  const carry = new THREE.Group();
  carry.position.set(0, 0.42, -0.05);
  carry.scale.setScalar(0.7);
  carry.visible = false;
  body.add(carry);

  // Little stars circling its head while stunned.
  const stars = new THREE.Group();
  stars.position.set(0, 0.62, 0.25);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  for (let i = 0; i < 4; i++) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), starMat);
    const a = (i / 4) * Math.PI * 2;
    star.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
    stars.add(star);
  }
  stars.visible = false;
  body.add(stars);

  root.traverse((o) => (o.castShadow = o.isMesh));

  // Ripple around the mouse while swimming.
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.42, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.05;
  ripple.visible = false;
  root.add(ripple);

  return { root, body, tail, headwear, ears, carry, stars, ripple };
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Mouse {
  constructor(scene, carryModel, tail = 'straight', head = 'normal') {
    this.model = buildModel();
    if (carryModel) this.model.carry.add(carryModel);
    this.setTail(tail);
    this.setHead(head);
    scene.add(this.model.root);
    this.position = this.model.root.position;
    this.reset(new THREE.Vector3());
  }

  setTail(style) {
    const slot = this.model.tail;
    for (const old of [...slot.children]) {
      slot.remove(old);
      old.traverse((o) => {
        o.geometry?.dispose();
        if (o.material !== tailMat) o.material?.dispose();
      });
    }
    this.tailMesh = buildTail(TAILS[style] ? style : 'straight');
    slot.add(this.tailMesh);
  }

  setHead(style) {
    const key = HEADS[style] ? style : 'normal';
    const slot = this.model.headwear;
    for (const old of [...slot.children]) {
      slot.remove(old);
      old.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    slot.add(buildHead(key));
    for (const ear of this.model.ears) ear.visible = !HEADS[key].hidesEars;
  }

  // Runs every frame, even in menus, so the fireball keeps burning.
  animateTail(dt) {
    const f = this.tailMesh.userData.fire;
    if (!f) return;
    const t = performance.now() / 1000;
    const flicker = 1 + Math.sin(t * 23) * 0.08 + Math.sin(t * 37) * 0.06;
    f.inner.scale.setScalar(flicker);
    f.outer.scale.setScalar(1 + Math.sin(t * 17 + 1) * 0.12);
    f.fire.rotation.y += dt * 3;
    for (const flame of f.flames) {
      const s = 0.8 + Math.abs(Math.sin(t * 14 + flame.userData.phase)) * 0.6;
      flame.scale.set(1, s, 1);
      flame.position.y = 0.06 + s * 0.04;
    }
  }

  // Knocked silly by a trap: can't move for a moment.
  stun(seconds) {
    this.stunTimer = seconds;
  }

  // A one-off loud sound at the mouse's position (e.g. a trap snapping).
  makeNoise(radius) {
    this.landingNoise = Math.max(this.landingNoise, radius);
  }

  reset(pos) {
    this.position.copy(pos);
    this.velocityY = 0;
    this.onGround = true;
    this.stamina = M.staminaMax;
    this.sprinting = false;
    this.moving = false;
    this.heading = 0;
    this.carrying = false;
    this.hidden = false;
    this.inHome = true;
    this.box = null; // cardboard box the mouse is hiding in
    this.swimming = false;
    this.enteredWater = null; // the puddle, on the frame the mouse splashes in
    this.noise = 0; // current hearing radius, world units
    this.landingNoise = 0;
    this.stunTimer = 0;
    this.animTime = 0;
  }

  update(dt, input, cameraYaw, world) {
    // --- movement input, relative to the camera (none while stunned)
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    const stunned = this.stunTimer > 0;
    // moveAxes is analog on a stick; plain direction flags (used by test bots) also work.
    const axes = input.moveAxes ?? {
      x: (input.right ? 1 : 0) - (input.left ? 1 : 0),
      z: (input.forward ? 1 : 0) - (input.back ? 1 : 0),
    };
    const ix = stunned ? 0 : axes.x;
    const iz = stunned ? 0 : axes.z;
    // How hard the stick is pushed: a light tilt creeps along slower and quieter.
    const tilt = Math.min(1, Math.hypot(ix, iz));
    const dir = new THREE.Vector3();
    if (tilt > 0) {
      const fx = -Math.sin(cameraYaw);
      const fz = -Math.cos(cameraYaw);
      const rx = Math.cos(cameraYaw);
      const rz = -Math.sin(cameraYaw);
      dir.set(fx * iz + rx * ix, 0, fz * iz + rz * ix).normalize();
    }
    this.moving = tilt > 0;

    // --- sprint & stamina (swimming drains it like sprinting, moving or not)
    const wantsSprint = input.sprint && this.moving && !this.swimming;
    const canSprint = this.sprinting ? this.stamina > 0 : this.stamina >= M.staminaMinToSprint;
    this.sprinting = wantsSprint && canSprint;
    if (this.sprinting || this.swimming) this.stamina = Math.max(0, this.stamina - dt);
    else this.stamina = Math.min(M.staminaMax, this.stamina + M.staminaRegen * dt);

    let speed = this.swimming ? M.swimSpeed : this.sprinting ? M.sprintSpeed : M.walkSpeed;
    if (this.carrying) speed *= M.carrySpeedMultiplier;
    if (!this.sprinting) speed *= Math.max(0.35, tilt);
    this.tilt = tilt;
    this.position.addScaledVector(dir, speed * dt);

    // --- jumping & gravity
    if (input.consumeJump() && this.onGround && !this.swimming && !stunned) {
      this.velocityY = M.jumpVelocity;
      this.onGround = false;
    }
    const prevHead = this.position.y + M.height;
    this.velocityY -= M.gravity * dt;
    this.position.y += this.velocityY * dt;

    // --- collision: bump our head on roofs first, so a roof we're under never acts as a wall
    const ceiling = world.ceilingAbove(this.position.x, this.position.z, prevHead);
    if (this.position.y + M.height > ceiling) {
      this.position.y = ceiling - M.height;
      this.velocityY = Math.min(0, this.velocityY);
    }
    // Walls are anything taller than we can step onto that isn't a roof overhead.
    const y = this.position.y;
    world.resolveCircle(
      this.position,
      M.radius,
      (b) => !b.catOnly && b.top > y + M.stepHeight && (b.bottom ?? 0) < y + M.height,
    );
    const ground = world.groundHeightAt(this.position.x, this.position.z, this.position.y + M.stepHeight);
    this.landed = false;
    if (this.position.y <= ground) {
      if (!this.onGround && this.velocityY < -4) {
        this.landingNoise = CONFIG.noise.jumpLand;
        this.landed = true;
      }
      this.position.y = ground;
      this.velocityY = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // --- water
    const onFloor = this.onGround && this.position.y < 0.3;
    const puddle = onFloor ? world.puddleAt(this.position.x, this.position.z, -0.1) : null;
    this.enteredWater = puddle && !this.swimming ? puddle : null;
    this.swimming = puddle !== null;

    // --- noise & hiding
    let footsteps = 0;
    if (this.moving && this.onGround && !this.swimming) {
      footsteps = this.sprinting ? CONFIG.noise.sprint : CONFIG.noise.walk * Math.max(0.35, this.tilt);
    }
    this.landingNoise = Math.max(0, this.landingNoise - dt * CONFIG.noise.jumpLand * 3);
    this.noise = Math.max(footsteps, this.landingNoise);

    const toHome = Math.hypot(this.position.x - world.home.x, this.position.z - world.home.z);
    this.inHome = toHome < CONFIG.game.homeRadius && onFloor;
    const inGrass = onFloor && world.grassPatchAt(this.position.x, this.position.z) !== null;
    this.box = onFloor ? world.cardboardAt(this.position.x, this.position.z) : null;
    const underFurniture = onFloor && world.hideZoneAt(this.position.x, this.position.z) !== null;
    this.hidden = this.inHome || inGrass || underFurniture || this.box !== null;

    // --- visuals
    if (this.moving) this.heading = angleLerp(this.heading, Math.atan2(dir.x, dir.z), Math.min(1, dt * 14));
    this.model.root.rotation.y = this.heading;
    this.animTime += dt * (this.moving ? speed * 3 : 2);
    if (this.swimming) {
      this.model.body.position.y = -0.14 + Math.sin(this.animTime * 0.5) * 0.02;
    } else {
      this.model.body.position.y = this.moving && this.onGround ? Math.abs(Math.sin(this.animTime)) * 0.06 : 0;
    }
    this.model.ripple.visible = this.swimming;
    if (this.swimming) this.model.ripple.scale.setScalar(1 + (this.animTime * 0.15) % 0.6);
    this.model.tail.rotation.y = Math.sin(this.animTime * 0.7) * 0.4;
    this.model.carry.visible = this.carrying;
    this.model.stars.visible = stunned;
    if (stunned) this.model.stars.rotation.y += dt * 8;
  }
}
