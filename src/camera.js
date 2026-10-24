import * as THREE from 'three';

// Camera views the player can toggle between. `pitch: null` leaves vertical look
// free; a number locks the angle there (high view stays high).
export const VIEWS = {
  standard: { label: 'Standard', distance: 4.5, pitch: null },
  high: { label: 'High', distance: 7.5, pitch: 0.95 },
};

// Orbit camera that trails the player and pulls in when a wall is in the way.
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.35;
    this.view = 'standard';
    this.distance = VIEWS.standard.distance;
    this.sensitivity = 0.0025; // radians per pixel of mouse movement
    this.stickSpeed = { yaw: 2.8, pitch: 1.8 }; // radians per second at full right-stick tilt
    this.raycaster = new THREE.Raycaster();
    this.target = new THREE.Vector3();
    this.offset = new THREE.Vector3();
  }

  get pitchLocked() {
    return VIEWS[this.view].pitch !== null;
  }

  setView(view) {
    this.view = VIEWS[view] ? view : 'standard';
  }

  look(dx, dy) {
    this.yaw -= dx * this.sensitivity;
    if (!this.pitchLocked) this.pitch = THREE.MathUtils.clamp(this.pitch + dy * this.sensitivity, 0.05, 1.2);
  }

  // Right-stick camera: x/y in -1..1. Squared response gives fine control near center.
  turn(x, y, dt) {
    const curve = (v) => Math.sign(v) * v * v;
    this.yaw -= curve(x) * this.stickSpeed.yaw * dt;
    if (!this.pitchLocked) this.pitch = THREE.MathUtils.clamp(this.pitch + curve(y) * this.stickSpeed.pitch * dt, 0.05, 1.2);
  }

  // Point the camera so the player faces `point`.
  faceToward(from, point) {
    this.yaw = Math.atan2(-(point.x - from.x), -(point.z - from.z));
  }

  update(focus, blockers, dt = 1 / 60) {
    // Ease toward the current view's distance (and locked angle) so toggling glides.
    const v = VIEWS[this.view];
    const k = Math.min(1, dt * 6);
    this.distance += (v.distance - this.distance) * k;
    if (v.pitch !== null) this.pitch += (v.pitch - this.pitch) * k;
    this.target.set(focus.x, focus.y + 0.5, focus.z);
    this.offset.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );

    let dist = this.distance;
    this.raycaster.set(this.target, this.offset);
    this.raycaster.far = this.distance;
    const hits = this.raycaster.intersectObjects(blockers, false);
    if (hits.length) dist = Math.max(0.6, hits[0].distance - 0.2);

    this.camera.position.copy(this.target).addScaledVector(this.offset, dist);
    this.camera.position.y = Math.max(this.camera.position.y, 0.2);
    this.camera.lookAt(this.target);
  }
}
