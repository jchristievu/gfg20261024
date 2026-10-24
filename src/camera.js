import * as THREE from 'three';

// Orbit camera that trails the player and pulls in when a wall is in the way.
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.35;
    this.distance = 4.5;
    this.sensitivity = 0.0025;
    this.raycaster = new THREE.Raycaster();
    this.target = new THREE.Vector3();
    this.offset = new THREE.Vector3();
  }

  look(dx, dy) {
    this.yaw -= dx * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * this.sensitivity, 0.05, 1.2);
  }

  // Point the camera so the player faces `point`.
  faceToward(from, point) {
    this.yaw = Math.atan2(-(point.x - from.x), -(point.z - from.z));
  }

  update(focus, blockers) {
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
