import * as THREE from 'three';

// Shared clock for vertex-shader wind on grass.
export const windTime = { value: 0 };

// Make an instanced foliage material sway in the wind. Geometry must have its
// base at y=0; the sway grows with height.
export function addWind(material, strength = 0.08) {
  material.userData.wind = true; // lets the AO and outline passes sway it in step
  // The shader code differs by strength, but onBeforeCompile's source doesn't,
  // so key compiled programs by strength too.
  material.customProgramCacheKey = () => `wind${strength}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float windTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec2 p = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          float h = max(position.y, 0.0);
          float w = sin(windTime * 1.7 + p.x * 0.3 + p.y * 0.2) + 0.35 * sin(windTime * 3.3 + p.x * 0.9 - p.y * 0.7);
          transformed.x += w * ${strength.toFixed(3)} * h * h;
          transformed.z += w * ${(strength * 0.5).toFixed(3)} * h * h;
        }`,
      );
  };
  return material;
}

// Animate a water material's normal map: two copies of the ripple texture
// drift in different directions so the surface shimmers instead of sliding.
export function addRipples(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windTime;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float windTime;')
      .replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        `vec3 mapN = texture2D( normalMap, vNormalMapUv + windTime * vec2( 0.035, 0.02 ) ).xyz * 2.0 - 1.0;
        mapN += texture2D( normalMap, vNormalMapUv * 1.6 + windTime * vec2( -0.03, 0.04 ) ).xyz * 2.0 - 1.0;
        mapN.z *= 0.5;`,
      );
  };
  return material;
}

// Small pooled particle system for dust puffs and splashes.
export class Effects {
  constructor(scene) {
    this.max = 300;
    this.particles = [];
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, depthWrite: false }),
      this.max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color()); // allocate instance colors before first compile
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // Expanding rings on water.
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    this.scene = scene;

    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.color = new THREE.Color();
  }

  emit(pos, { count = 6, color = 0xc8b08a, speed = 1.5, up = 1.5, size = 1, life = 0.6, gravity = 3 } = {}) {
    for (let i = 0; i < count && this.particles.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        p: new THREE.Vector3(pos.x, pos.y + 0.05, pos.z),
        v: new THREE.Vector3(Math.cos(a) * v, up * (0.5 + Math.random() * 0.5), Math.sin(a) * v),
        life,
        age: 0,
        size: size * (0.6 + Math.random() * 0.8),
        color: new THREE.Color(color),
        gravity,
      });
    }
  }

  dust(pos, amount = 6) {
    this.emit(pos, { count: amount, color: 0xc9b38c, speed: 1.2, up: 0.8, size: 1.3, life: 0.7, gravity: 0.5 });
  }

  splash(pos) {
    this.emit(pos, { count: 24, color: 0xdcefff, speed: 2.2, up: 3.5, size: 0.8, life: 0.7, gravity: 12 });
    this.ripple(pos, 2.5);
  }

  ripple(pos, maxScale = 1.5, life = 1.2) {
    const ring = new THREE.Mesh(
      this.ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.045, pos.z);
    ring.scale.setScalar(0.1);
    this.scene.add(ring);
    this.rings.push({ ring, age: 0, life, maxScale });
  }

  update(dt) {
    this.particles = this.particles.filter((pt) => {
      pt.age += dt;
      if (pt.age >= pt.life) return false;
      pt.v.y -= pt.gravity * dt;
      pt.v.multiplyScalar(1 - dt * 1.5);
      pt.p.addScaledVector(pt.v, dt);
      if (pt.p.y < 0.02) pt.p.y = 0.02;
      return true;
    });
    this.particles.forEach((pt, i) => {
      const t = pt.age / pt.life;
      this.s.setScalar(pt.size * (1 + t) * (1 - t * t));
      this.m.compose(pt.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, pt.color);
    });
    this.mesh.count = this.particles.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.material.opacity = 0.8;

    this.rings = this.rings.filter((r) => {
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) {
        this.scene.remove(r.ring);
        r.ring.material.dispose();
        return false;
      }
      r.ring.scale.setScalar(0.1 + t * r.maxScale);
      r.ring.material.opacity = 0.5 * (1 - t);
      return true;
    });
  }
}
