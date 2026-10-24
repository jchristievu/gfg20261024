import * as THREE from 'three';
import './style.css';
import { CONFIG } from './config.js';
import { World } from './world.js';
import { Mouse } from './mouse.js';
import { Cat } from './cat.js';
import { Input } from './input.js';
import { ThirdPersonCamera } from './camera.js';
import { Hud } from './hud.js';

// ------------------------------------------------------------------ renderer

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3f0);
scene.fog = new THREE.Fog(0x9fd3f0, 40, 110);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);

scene.add(new THREE.HemisphereLight(0xdff2ff, 0x5a7a3a, 1.1));
const sun = new THREE.DirectionalLight(0xfff4dd, 2.2);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 150 });
sun.shadow.bias = -0.0005;
scene.add(sun);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------------ game objects

const world = new World(scene);
const mouse = new Mouse(scene);
const cat = new Cat(scene, world);
const cam = new ThirdPersonCamera(camera);
const input = new Input(renderer.domElement, (dx, dy) => cam.look(dx, dy));
const hud = new Hud();

// Ring on the ground showing how far the mouse's noise carries.
const noiseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.92, 1, 64),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
);
noiseRing.rotation.x = -Math.PI / 2;
scene.add(noiseRing);

// ------------------------------------------------------------------ game state

// 'start' | 'playing' | 'paused' | 'caught' | 'won' | 'gameover'
let state = 'start';
let lives = CONFIG.game.lives;
let delivered = 0;
let caughtTimer = 0;

function placeAtHome() {
  mouse.reset(world.mouseSpawn);
  cam.faceToward(world.mouseSpawn, world.foodSpot);
  cat.reset();
}

function newGame() {
  lives = CONFIG.game.lives;
  delivered = 0;
  world.setFoodCount(CONFIG.game.foodToWin);
  world.clearDroppedFood();
  placeAtHome();
}

function loseLife(title, gameOverText) {
  lives -= 1;
  if (mouse.carrying) world.setFoodCount(world.foodCount + 1);
  mouse.carrying = false;
  if (lives <= 0) {
    state = 'gameover';
    document.exitPointerLock();
    hud.showOverlay(title, gameOverText, 'Click to try again');
  } else {
    state = 'caught';
    caughtTimer = CONFIG.game.caughtPause;
    hud.toast(`${title} ${lives} ${lives === 1 ? 'life' : 'lives'} left`, caughtTimer);
  }
}

function updatePlaying(dt) {
  mouse.update(dt, input, cam.yaw, world);

  const puddle = mouse.enteredWater;
  if (puddle && mouse.carrying) {
    // The cheese is left on the bank where the mouse went in.
    const dx = mouse.position.x - puddle.x;
    const dz = mouse.position.z - puddle.z;
    const d = Math.hypot(dx, dz) || 1;
    world.dropFood(puddle.x + (dx / d) * (puddle.r + 0.6), puddle.z + (dz / d) * (puddle.r + 0.6));
    mouse.carrying = false;
    hud.toast('Splash! You dropped the cheese.');
  }
  if (mouse.swimming && mouse.stamina <= 0) {
    loseLife('Too tired to swim!', 'You ran out of stamina in the puddle.');
    return;
  }

  if (!mouse.carrying && mouse.position.y < 0.5 && !mouse.swimming) {
    const toFood = Math.hypot(mouse.position.x - world.foodSpot.x, mouse.position.z - world.foodSpot.z);
    if (world.takeDroppedFood(mouse.position, CONFIG.game.foodPickupRadius)) {
      mouse.carrying = true;
      hud.toast('Got the cheese back!');
    } else if (world.foodCount > 0 && toFood < CONFIG.game.foodPickupRadius) {
      mouse.carrying = true;
      world.setFoodCount(world.foodCount - 1);
      hud.toast('Got the cheese! Get it home.');
    }
  }

  if (mouse.carrying && mouse.inHome) {
    mouse.carrying = false;
    delivered += 1;
    if (delivered >= CONFIG.game.foodToWin) {
      state = 'won';
      document.exitPointerLock();
      hud.showOverlay('You made it!', 'The pantry is stocked and the cat is none the wiser.', 'Click to play again');
      return;
    }
    hud.toast(`Food stored! ${CONFIG.game.foodToWin - delivered} to go.`);
  }

  if (cat.update(dt, mouse) === 'caught') loseLife('Caught!', 'The farm cat got you. Better luck next time.');
}

// ------------------------------------------------------------------ flow control

hud.showOverlay(
  'Farm Mouse',
  `Sneak across the farm, grab ${CONFIG.game.foodToWin} pieces of cheese from the farmhouse, and bring them home one at a time. ` +
    'Hide in tall grass or cardboard boxes to lose the cat, and keep quiet: sprinting and jumping make noise. ' +
    "Cats hate water, but swimming wears you out and you'll drop your cheese.",
);

let pausedFrom = 'playing';

hud.overlay.addEventListener('click', () => {
  if (state === 'start' || state === 'won' || state === 'gameover') newGame();
  state = state === 'paused' ? pausedFrom : 'playing';
  hud.hideOverlay();
  input.lock();
});

document.addEventListener('pointerlockchange', () => {
  if (!input.locked && (state === 'playing' || state === 'caught')) {
    pausedFrom = state;
    state = 'paused';
    hud.showOverlay('Paused', '', 'Click to resume');
  }
});

// ------------------------------------------------------------------ main loop

const clock = new THREE.Clock();
placeAtHome();
world.setFoodCount(CONFIG.game.foodToWin);

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'playing') {
    updatePlaying(dt);
  } else if (state === 'caught') {
    caughtTimer -= dt;
    if (caughtTimer <= 0) {
      placeAtHome();
      input.consumeJump();
      state = 'playing';
    }
  }

  world.update(dt, mouse);
  hud.update(dt, { lives, delivered, mouse, cat });

  noiseRing.visible = state === 'playing' && mouse.noise > 0.1;
  noiseRing.position.set(mouse.position.x, mouse.position.y + 0.03, mouse.position.z);
  noiseRing.scale.setScalar(Math.max(0.01, mouse.noise));

  cam.update(mouse.position, world.cameraBlockers);
  renderer.render(scene, camera);
});
