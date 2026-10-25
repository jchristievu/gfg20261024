import * as THREE from 'three';

export const SKY = {
  top: new THREE.Color(0x4f8fd6),
  horizon: new THREE.Color(0xcfe6f2),
  ground: new THREE.Color(0xcfe6f2), // matches the fog so the land fades into the sky
  sunDirection: new THREE.Vector3(30, 50, 20).normalize(),
};

function skyDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY.top },
      horizon: { value: SKY.horizon },
      ground: { value: SKY.ground },
      sunDir: { value: SKY.sunDirection },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w; // always at the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, horizon, ground, sunDir;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = h > 0.0
          ? mix(horizon, top, pow(smoothstep(0.0, 0.6, h), 0.8))
          : mix(horizon, ground, smoothstep(0.0, -0.15, h));
        float sun = max(dot(vDir, sunDir), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(sun, 600.0) * 2.0 + pow(sun, 12.0) * 0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

function cloud(rng) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, fog: false });
  const puffs = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < puffs; i++) {
    const r = 3 + rng() * 4;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), material);
    puff.position.set((i - puffs / 2) * 4 + rng() * 2, rng() * 2, (rng() - 0.5) * 5);
    puff.scale.y = 0.6;
    group.add(puff);
  }
  return group;
}

export class Sky {
  constructor(scene, renderer) {
    this.dome = skyDome();
    scene.add(this.dome);
    scene.fog = new THREE.Fog(SKY.horizon, 60, 220);

    // Use the sky as an environment map for soft ambient light and reflections.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(skyDome());
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.5;
    pmrem.dispose();

    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.clouds = [];
    for (let i = 0; i < 14; i++) {
      const c = cloud(rng);
      c.position.set((rng() - 0.5) * 300, 45 + rng() * 25, (rng() - 0.5) * 300);
      c.userData.speed = 1 + rng() * 1.5;
      scene.add(c);
      this.clouds.push(c);
    }
  }

  update(dt, camera) {
    this.dome.position.copy(camera.position);
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 160) c.position.x = -160;
    }
  }
}
