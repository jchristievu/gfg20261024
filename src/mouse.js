import * as THREE from 'three';
import { CONFIG } from './config.js';

const M = CONFIG.mouse;

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

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), pink);
    ear.scale.set(1, 1, 0.3);
    ear.position.set(side * 0.1, 0.42, 0.28);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), black);
    eye.position.set(side * 0.07, 0.32, 0.45);
    body.add(ear, eye);
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.18, -0.3);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.05, 0.05, -0.2),
    new THREE.Vector3(-0.05, 0.12, -0.4),
    new THREE.Vector3(0, 0.2, -0.55),
  ]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.02, 6), pink));
  body.add(tail);

  // Cheese wedge strapped to its back, shown while carrying food.
  const cheese = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.14, 3),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6 }),
  );
  cheese.position.set(0, 0.44, -0.05);
  cheese.visible = false;
  body.add(cheese);

  root.traverse((o) => (o.castShadow = true));

  // Ripple around the mouse while swimming.
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.42, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.05;
  ripple.visible = false;
  root.add(ripple);

  return { root, body, tail, cheese, ripple };
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Mouse {
  constructor(scene) {
    this.model = buildModel();
    scene.add(this.model.root);
    this.position = this.model.root.position;
    this.reset(new THREE.Vector3());
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
    this.animTime = 0;
  }

  update(dt, input, cameraYaw, world) {
    // --- movement input, relative to the camera
    const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const iz = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const dir = new THREE.Vector3();
    if (ix || iz) {
      const fx = -Math.sin(cameraYaw);
      const fz = -Math.cos(cameraYaw);
      const rx = Math.cos(cameraYaw);
      const rz = -Math.sin(cameraYaw);
      dir.set(fx * iz + rx * ix, 0, fz * iz + rz * ix).normalize();
    }
    this.moving = dir.lengthSq() > 0;

    // --- sprint & stamina (swimming drains it like sprinting, moving or not)
    const wantsSprint = input.sprint && this.moving && !this.swimming;
    const canSprint = this.sprinting ? this.stamina > 0 : this.stamina >= M.staminaMinToSprint;
    this.sprinting = wantsSprint && canSprint;
    if (this.sprinting || this.swimming) this.stamina = Math.max(0, this.stamina - dt);
    else this.stamina = Math.min(M.staminaMax, this.stamina + M.staminaRegen * dt);

    let speed = this.swimming ? M.swimSpeed : this.sprinting ? M.sprintSpeed : M.walkSpeed;
    if (this.carrying) speed *= M.carrySpeedMultiplier;
    this.position.addScaledVector(dir, speed * dt);

    // --- jumping & gravity
    if (input.consumeJump() && this.onGround && !this.swimming) {
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
    if (this.position.y <= ground) {
      if (!this.onGround && this.velocityY < -4) this.landingNoise = CONFIG.noise.jumpLand;
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
      footsteps = this.sprinting ? CONFIG.noise.sprint : CONFIG.noise.walk;
    }
    this.landingNoise = Math.max(0, this.landingNoise - dt * CONFIG.noise.jumpLand * 3);
    this.noise = Math.max(footsteps, this.landingNoise);

    const toHome = Math.hypot(this.position.x - world.home.x, this.position.z - world.home.z);
    this.inHome = toHome < CONFIG.game.homeRadius && onFloor;
    const inGrass = onFloor && world.grassPatchAt(this.position.x, this.position.z) !== null;
    this.box = onFloor ? world.cardboardAt(this.position.x, this.position.z) : null;
    this.hidden = this.inHome || inGrass || this.box !== null;

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
    this.model.cheese.visible = this.carrying;
  }
}
