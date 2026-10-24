import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Icon sprite that floats over an animal's head ("!", "?", "z"...).
export function makeIcon() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(0.7, 0.7, 1);
  sprite.renderOrder = 10;
  let current = '';
  sprite.userData.draw = (text, color) => {
    if (current === text + color) return;
    current = text + color;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    sprite.visible = !!text;
    if (!text) return;
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

// Base for every animal on the map: a model, steering around obstacles, and
// hopping up onto low things.
export class Creature {
  constructor(scene, world, model, radius, iconHeight) {
    this.world = world;
    this.model = model;
    this.radius = radius;
    this.position = model.root.position;
    this.heading = 0;
    this.speedThisFrame = 0;
    this.avoidWater = true;
    this.icon = makeIcon();
    this.icon.position.y = iconHeight;
    model.root.add(this.icon);
    scene.add(model.root);
  }

  // Walk toward target, detouring around obstacles. Returns true on arrival.
  moveToward(target, speed, dt, stopDistance = 0.4) {
    if (dist2d(this.position, target) < stopDistance) return true;
    const waypoint = this.world.steer(this.position, target, this.radius);
    const dx = waypoint.x - this.position.x;
    const dz = waypoint.z - this.position.z;
    const len = Math.hypot(dx, dz);
    if (len > 1e-4) {
      const step = Math.min(len, speed * dt);
      const bx = this.position.x;
      const bz = this.position.z;
      this.position.x += (dx / len) * step;
      this.position.z += (dz / len) * step;
      this.world.resolveEnemy(this.position, this.radius, this.avoidWater);
      this.speedThisFrame = Math.hypot(this.position.x - bx, this.position.z - bz) / dt;
      this.heading = angleLerp(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 8));
    }
    return false;
  }

  turnToward(point, dt, rate = 6) {
    this.heading = angleLerp(this.heading, Math.atan2(point.x - this.position.x, point.z - this.position.z), Math.min(1, dt * rate));
  }

  randomPointNear(cx, cz, minD, maxD, tries = 12) {
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = minD + Math.random() * (maxD - minD);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (this.world.isValidEnemyPoint(x, z, this.radius, this.avoidWater)) return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  // Can it see the (exposed) mouse right now? Optional field of view in degrees.
  canSee(mouse, range, fov = 360) {
    if (mouse.hidden || mouse.swimming) return false;
    const d = dist2d(this.position, mouse.position);
    if (d > range) return false;
    if (fov < 360) {
      const toMouse = Math.atan2(mouse.position.x - this.position.x, mouse.position.z - this.position.z);
      let diff = Math.abs(toMouse - this.heading) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > THREE.MathUtils.degToRad(fov / 2)) return false;
    }
    return this.world.hasLineOfSight(this.position, mouse.position);
  }

  followGround(dt) {
    const ground = this.world.groundHeightAt(this.position.x, this.position.z, CONFIG.enemy.jumpHeight, true);
    this.position.y += (ground - this.position.y) * Math.min(1, dt * 10);
    this.model.root.rotation.y = this.heading;
  }
}
