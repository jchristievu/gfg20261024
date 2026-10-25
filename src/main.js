import * as THREE from 'three';
import './style.css';
import { CONFIG } from './config.js';
import { World } from './world.js';
import { Mouse, TAILS, HEADS } from './mouse.js';
import { Input } from './input.js';
import { ThirdPersonCamera, VIEWS } from './camera.js';
import { Hud } from './hud.js';
import { Sky, SKY } from './sky.js';
import { Effects, windTime } from './effects.js';
import { LEVELS, unlockedLevel, unlockLevel } from './levels/index.js';

const FOOD_NAMES = {
  cheese: { title: 'Cheese', noun: 'cheese' },
  cookie: { title: 'Cookies', noun: 'cookie' },
  corn: { title: 'Corn', noun: 'corn' },
  candy: { title: 'Candy', noun: 'candy' },
};

// ------------------------------------------------------------------ renderer

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
const cam = new ThirdPersonCamera(camera);
const input = new Input(renderer.domElement, (dx, dy) => cam.look(dx, dy));
const hud = new Hud();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// The sun's shadow box follows the player, so a small box gives crisp shadows.
const SHADOW_RANGE = 28;

function makeSun(intensity) {
  const sun = new THREE.DirectionalLight(0xfff0d6, intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -SHADOW_RANGE,
    right: SHADOW_RANGE,
    top: SHADOW_RANGE,
    bottom: -SHADOW_RANGE,
    near: 1,
    far: 200,
  });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  return sun;
}

function placeSun(sun, focus) {
  // Snap to shadow-map texels so shadows don't shimmer as the player moves.
  const texel = (SHADOW_RANGE * 2) / sun.shadow.mapSize.x;
  const x = Math.round(focus.x / texel) * texel;
  const z = Math.round(focus.z / texel) * texel;
  sun.target.position.set(x, 0, z);
  sun.position.set(x, 0, z).addScaledVector(SKY.sunDirection, 80);
}

function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      m.map?.dispose();
      m.dispose();
    }
  });
  scene.environment?.dispose();
}

// ------------------------------------------------------------------ level setup

let g = null; // everything belonging to the loaded level
let state = 'menu'; // 'menu' | 'customize' | 'playing' | 'paused' | 'caught' | 'won' | 'gameover'

// The player's character choices, remembered in the browser.
const TAIL_KEY = 'farmMouse.tail';
let tail = 'straight';
try {
  if (TAILS[localStorage.getItem(TAIL_KEY)]) tail = localStorage.getItem(TAIL_KEY);
} catch {
  // Storage unavailable: the choice just won't persist.
}
const NAME_KEY = 'farmMouse.name';
const MOUSE_NAMES = ['Pip', 'Nibbles', 'Squeak', 'Biscuit', 'Mochi', 'Peanut', 'Clover', 'Button', 'Whiskers', 'Crumb'];
const randomName = (except) => {
  const pool = MOUSE_NAMES.filter((n) => n !== except);
  return pool[Math.floor(Math.random() * pool.length)];
};
let mouseName = randomName();
try {
  mouseName = localStorage.getItem(NAME_KEY)?.trim() || mouseName;
} catch {
  // Storage unavailable.
}
function setMouseName(name) {
  mouseName = name.trim();
  try {
    if (mouseName) localStorage.setItem(NAME_KEY, mouseName);
  } catch {
    // Storage unavailable.
  }
}
// The name as used in messages ("Pip"), falling back if the box was left empty.
const who = () => mouseName || 'Your mouse';

// Camera view (standard / high), remembered between visits.
const VIEW_KEY = 'farmMouse.view';
try {
  cam.setView(localStorage.getItem(VIEW_KEY));
} catch {
  // Storage unavailable.
}
function toggleView() {
  cam.setView(cam.view === 'high' ? 'standard' : 'high');
  try {
    localStorage.setItem(VIEW_KEY, cam.view);
  } catch {
    // Storage unavailable.
  }
  hud.toast(`${VIEWS[cam.view].label} view`, 1.2);
}

const HEAD_KEY = 'farmMouse.head';
let head = 'normal';
try {
  if (HEADS[localStorage.getItem(HEAD_KEY)]) head = localStorage.getItem(HEAD_KEY);
} catch {
  // Storage unavailable.
}
function setHead(style) {
  head = style;
  g.mouse.setHead(style);
  try {
    localStorage.setItem(HEAD_KEY, style);
  } catch {
    // Storage unavailable.
  }
}

// Next key in an options object, wrapping around (for the customize cyclers).
const nextOption = (options, current) => {
  const keys = Object.keys(options);
  return keys[(keys.indexOf(current) + 1) % keys.length];
};

function setTail(style) {
  tail = style;
  g.mouse.setTail(style);
  try {
    localStorage.setItem(TAIL_KEY, style);
  } catch {
    // Storage unavailable.
  }
}
let lives = CONFIG.game.lives;
let delivered = 0;
let caughtTimer = 0;
let dustTimer = 0;

function loadLevel(index) {
  if (g) disposeScene(g.scene);
  const level = LEVELS[index];
  const scene = new THREE.Scene();
  const sky = new Sky(scene, renderer);
  if (!level.outdoor) {
    scene.fog = null;
    for (const c of sky.clouds) c.visible = false; // indoors: no sky to see
  }

  scene.add(
    level.outdoor
      ? new THREE.HemisphereLight(0xd8ecff, 0x6b7f4a, 0.7)
      : new THREE.HemisphereLight(0xfff2e0, 0x8a7060, 1.0),
  );
  const sun = makeSun(level.outdoor ? 2.6 : 1.6);
  scene.add(sun, sun.target);
  for (const [x, y, z, intensity, color] of level.lights ?? []) {
    const light = new THREE.PointLight(color, intensity, 45, 1);
    light.position.set(x, y, z);
    scene.add(light);
  }

  const world = new World(scene, level);
  const mouse = new Mouse(scene, world.makeFoodMesh(), tail, head);
  const enemies = level.createEnemies(scene, world);
  const effects = new Effects(scene);

  // Ring on the ground showing how far the mouse's noise carries.
  const noiseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  noiseRing.rotation.x = -Math.PI / 2;
  scene.add(noiseRing);

  g = { index, level, scene, sky, sun, world, mouse, enemies, effects, noiseRing, food: FOOD_NAMES[level.food] };
  lives = CONFIG.game.lives;
  delivered = 0;
  world.setFoodCount(world.foodToWin);
  placeAtHome();
}

function placeAtHome() {
  g.mouse.reset(g.world.mouseSpawn);
  cam.faceToward(g.world.mouseSpawn, g.world.foodSpot);
  for (const e of g.enemies) e.reset();
}

// `gameOverText` may contain {name}, filled in with the mouse's name.
function loseLife(title, gameOverText) {
  const { world, mouse } = g;
  lives -= 1;
  if (mouse.carrying) world.setFoodCount(world.foodCount + 1);
  mouse.carrying = false;
  input.rumble(1, 0.7, 400);
  if (lives <= 0) {
    state = 'gameover';
    document.exitPointerLock();
    hud.showMenu(title, gameOverText.replaceAll('{name}', who()), [
      { label: `Try again with ${who()}`, primary: true, onClick: () => startLevel(g.index) },
      { label: 'Level select', onClick: showLevelSelect },
    ]);
  } else {
    state = 'caught';
    caughtTimer = CONFIG.game.caughtPause;
    hud.toast(`${title} ${who()} has ${lives} ${lives === 1 ? 'life' : 'lives'} left.`, caughtTimer);
  }
}

function levelComplete() {
  state = 'won';
  document.exitPointerLock();
  const next = g.index + 1;
  unlockLevel(next + 1);
  if (next < LEVELS.length) {
    hud.showMenu(`Nice work, ${who()}!`, g.level.outro, [
      { label: `Next: Level ${next + 1}, ${LEVELS[next].name}`, primary: true, onClick: () => showLevelIntro(next) },
      { label: 'Replay this level', onClick: () => showLevelIntro(g.index) },
      { label: 'Level select', onClick: showLevelSelect },
    ]);
  } else {
    hud.showMenu(`${who()} beat the game!`, `${g.level.outro} The farm's pantries are yours.`, [
      { label: 'Level select', primary: true, onClick: showLevelSelect },
    ]);
  }
}

// ------------------------------------------------------------------ gameplay

function updatePlaying(dt) {
  const { world, mouse, enemies, effects, food } = g;
  mouse.update(dt, input, cam.yaw, world);

  if (mouse.landed) effects.dust(mouse.position, 10);
  if (mouse.enteredWater) effects.splash(mouse.position);
  dustTimer -= dt;
  if (mouse.sprinting && mouse.onGround && !mouse.swimming && dustTimer <= 0) {
    effects.dust(mouse.position, 2);
    dustTimer = 0.07;
  }
  if (mouse.swimming && mouse.moving && dustTimer <= 0) {
    effects.ripple(mouse.position, 1.2, 0.8);
    dustTimer = 0.35;
  }

  // Mousetraps: a full step on the trigger is fatal, brushing one stuns and makes a racket.
  const snap = world.checkTraps(mouse);
  if (snap) {
    effects.emit(mouse.position, { count: 14, color: 0xe8d8b0, speed: 2.5, up: 3, size: 0.8, life: 0.5, gravity: 10 });
    mouse.makeNoise(CONFIG.trap.snapNoise);
    input.rumble(0.4, 1, 180);
    if (snap.full) {
      loseLife('Snap!', 'A mousetrap got {name}.');
      return;
    }
    mouse.stun(CONFIG.trap.stunTime);
    hud.toast('SNAP! Stunned, and that was loud!', 1.8);
  }

  const puddle = mouse.enteredWater;
  if (puddle && mouse.carrying) {
    // The food is left on the bank where the mouse went in.
    const dx = mouse.position.x - puddle.x;
    const dz = mouse.position.z - puddle.z;
    const d = Math.hypot(dx, dz) || 1;
    world.dropFood(puddle.x + (dx / d) * (puddle.r + 0.6), puddle.z + (dz / d) * (puddle.r + 0.6));
    mouse.carrying = false;
    hud.toast(`Splash! You dropped the ${food.noun}.`);
  }
  if (mouse.swimming && mouse.stamina <= 0) {
    loseLife('Too tired to swim!', '{name} ran out of stamina in the puddle.');
    return;
  }

  if (!mouse.carrying && !mouse.swimming) {
    if (mouse.position.y < 0.5 && world.takeDroppedFood(mouse.position, CONFIG.game.foodPickupRadius)) {
      mouse.carrying = true;
      hud.toast(`Got the ${food.noun} back!`);
    } else if (world.foodCount > 0 && world.atFood(mouse.position)) {
      mouse.carrying = true;
      world.setFoodCount(world.foodCount - 1);
      hud.toast(`Got the ${food.noun}! Get it home.`);
    }
  }

  if (mouse.carrying && mouse.inHome) {
    mouse.carrying = false;
    delivered += 1;
    if (delivered >= world.foodToWin) {
      levelComplete();
      return;
    }
    hud.toast(`Food stored! ${world.foodToWin - delivered} to go.`);
  }

  for (const e of enemies) {
    const result = e.update(dt, mouse);
    if (result === 'caught') {
      loseLife(e.caughtTitle, e.caughtText);
      return;
    }
    if (result?.alert) {
      // A hen squawked or the dog barked: everyone who listens for alerts comes running.
      for (const other of enemies) if (other !== e) other.alert?.(result.alert);
      if (result.feathers) effects.emit(result.from, { count: 10, color: 0xffffff, speed: 1.5, up: 2.5, size: 0.7, life: 0.9, gravity: 2 });
      hud.toast(result.message, 1.5);
      input.rumble(0.3, 0.3, 120);
    }
  }
}

// ------------------------------------------------------------------ menus

function startPlaying() {
  state = 'playing';
  hud.hideOverlay();
  input.consumeJump(); // the A press that started the level shouldn't also jump
  input.lock();
}

function startLevel(index) {
  loadLevel(index);
  startPlaying();
}

function showLevelSelect() {
  state = 'menu';
  document.exitPointerLock();
  const unlocked = unlockedLevel();
  hud.showMenu(
    'Farm Mouse',
    'You are a mouse on a farm. Sneak out, grab food, and get it home without getting caught. Beat a level to unlock the next.',
    [
      ...LEVELS.map((level, i) => ({
        label: `Level ${level.id}: ${level.name}`,
        note: i + 1 > unlocked ? '\u{1F512} Locked' : '',
        disabled: i + 1 > unlocked,
        primary: i + 1 === unlocked,
        onClick: () => showLevelIntro(i),
      })),
      {
        label: 'Customize your mouse',
        note: `${who()}: ${TAILS[tail].toLowerCase()} tail${head === 'normal' ? '' : `, ${HEADS[head].label.toLowerCase()}`}`.replace('3-tail tail', '3 tails'),
        onClick: () => showCustomize(),
      },
    ],
    '',
    { onBack: showCustomize },
  );
}

// Character customization, shown at game start. The live mouse in the scene
// is the preview: the camera swings round to it while this menu is open.
// `keepFocus` keeps the controller highlight on the same row when the menu redraws.
function showCustomize(keepFocus = false) {
  const focus = hud.focusIndex;
  if (g.index !== 0) loadLevel(0);
  state = 'customize';
  document.exitPointerLock();
  hud.showMenu(
    'Customize your mouse',
    'Name your mouse and choose its look. Click a style to try the next one.',
    [
      {
        label: 'Random name',
        note: '\u{1F3B2}',
        onClick: () => {
          setMouseName(randomName(mouseName));
          showCustomize(true);
        },
      },
      // One row per feature; each click steps to the next option.
      {
        label: `Tail: ${TAILS[tail]}`,
        note: `${Object.keys(TAILS).indexOf(tail) + 1}/${Object.keys(TAILS).length} ▸`,
        onClick: () => {
          setTail(nextOption(TAILS, tail));
          showCustomize(true);
        },
      },
      {
        label: `Head: ${HEADS[head].label}`,
        note: `${Object.keys(HEADS).indexOf(head) + 1}/${Object.keys(HEADS).length} ▸`,
        onClick: () => {
          setHead(nextOption(HEADS, head));
          showCustomize(true);
        },
      },
      { label: 'Continue', primary: true, onClick: finishCustomize },
    ],
    '',
    {
      side: true,
      field: { label: 'Name', value: mouseName, maxLength: 16, onInput: setMouseName, onEnter: finishCustomize },
    },
  );
  if (keepFocus && focus >= 0 && document.body.classList.contains('gamepad')) hud.setFocus(focus);
}

function finishCustomize() {
  if (!mouseName) setMouseName(randomName());
  showLevelSelect();
}

function showLevelIntro(index) {
  state = 'menu';
  loadLevel(index);
  const level = LEVELS[index];
  hud.showMenu(
    `Level ${level.id}: ${level.name}`,
    level.intro,
    [
      { label: 'Start', primary: true, onClick: startPlaying },
      { label: 'Back to level select', onClick: showLevelSelect },
    ],
    '',
    { onBack: showLevelSelect },
  );
}

// ------------------------------------------------------------------ pause & controller

let pausedFrom = 'playing';

function pauseGame() {
  if (state !== 'playing' && state !== 'caught') return;
  pausedFrom = state;
  state = 'paused';
  document.exitPointerLock();
  hud.showMenu(
    'Paused',
    '',
    [
      { label: 'Resume', primary: true, onClick: resumeGame },
      {
        label: 'Camera view',
        note: `${VIEWS[cam.view].label} (V / Y)`,
        onClick: () => {
          toggleView();
          state = pausedFrom;
          pauseGame(); // redraw the menu with the new setting
        },
      },
      { label: 'Restart level', onClick: () => startLevel(g.index) },
      { label: 'Level select', onClick: showLevelSelect },
    ],
    '',
    { onBack: resumeGame },
  );
}

function resumeGame() {
  if (state !== 'paused') return;
  state = pausedFrom;
  hud.hideOverlay();
  input.consumeJump();
  input.lock();
}

// Losing the mouse lock (Esc) pauses; so do Esc without a lock and the Start button.
document.addEventListener('pointerlockchange', () => {
  if (!input.locked) pauseGame();
});
input.on('pause', (toggle) => {
  if (toggle && state === 'paused') resumeGame();
  else pauseGame();
});
input.on('toggleView', () => {
  if (state === 'playing' || state === 'caught') toggleView();
});
input.on('menuMove', (dir) => hud.navigate(dir));
input.on('menuSelect', () => hud.select());
input.on('menuBack', () => hud.back());
input.on('scheme', (scheme) => hud.setScheme(scheme));
input.on('connect', () => hud.setPadConnected(true));
// After playing on a controller (no mouse lock), a click picks the mouse back up.
renderer.domElement.addEventListener('click', () => {
  if (state === 'playing' && !input.locked) input.lock();
});

// Dev: `?level=N` jumps to a level; `?shot` hides the menu for screenshots, and
// `?shot=x,y,z,tx,ty,tz` also parks the camera.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const shotCam = shot ? shot.split(',').map(Number) : null;
const startIndex = THREE.MathUtils.clamp((Number(params.get('level')) || 1) - 1, 0, LEVELS.length - 1);
if (TAILS[params.get('tail')]) tail = params.get('tail'); // dev: preview a tail without saving it
if (HEADS[params.get('head')]) head = params.get('head'); // dev: preview a head style without saving it
if (params.get('controls') === 'gamepad') input.setScheme('gamepad'); // dev: preview controller UI
if (params.has('level')) showLevelIntro(startIndex);
else {
  loadLevel(0);
  showCustomize();
}
if (shot !== null) hud.hideOverlay();

// ------------------------------------------------------------------ main loop

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  input.poll(dt);
  const { world, mouse, enemies, effects, noiseRing, sky, sun, scene } = g;

  if (state === 'playing') {
    const look = input.lookAxes;
    cam.turn(look.x, look.y, dt);
    updatePlaying(dt);
  } else if (state === 'caught') {
    caughtTimer -= dt;
    if (caughtTimer <= 0) {
      placeAtHome();
      input.consumeJump();
      state = 'playing';
    }
  }

  windTime.value += dt;
  world.update(dt, mouse, effects);
  effects.update(dt);
  const spotted = mouse.hidden && !mouse.inHome && enemies.some((e) => e.tracking);
  hud.update(dt, {
    levelName: `Level ${g.level.id}`,
    lives,
    delivered,
    foodToWin: world.foodToWin,
    foodName: g.food.title,
    mouse,
    threat: enemies[0],
    spotted,
  });

  noiseRing.visible = state === 'playing' && mouse.noise > 0.1;
  noiseRing.position.set(mouse.position.x, mouse.position.y + 0.03, mouse.position.z);
  noiseRing.scale.setScalar(Math.max(0.01, mouse.noise));

  mouse.animateTail(dt);
  cam.update(mouse.position, world.cameraBlockers, dt);
  hud.drawRadar(mouse, enemies, cam.yaw, state === 'playing' || state === 'caught');
  if (state === 'customize') {
    // Close-up turntable of the mouse, framed right of center beside the menu card.
    mouse.model.root.rotation.y += dt * 0.7;
    const p = mouse.position;
    camera.position.set(p.x + 1.5, p.y + 0.75, p.z + 1.15);
    const target = new THREE.Vector3(p.x, p.y + 0.25, p.z);
    const forward = target.clone().sub(camera.position).normalize();
    const right = forward.clone().cross(camera.up).normalize();
    camera.lookAt(target.addScaledVector(right, -0.55 * Math.min(1, camera.aspect / 1.4)));
  } else if (shotCam?.length === 6) {
    camera.position.set(shotCam[0], shotCam[1], shotCam[2]);
    camera.lookAt(shotCam[3], shotCam[4], shotCam[5]);
    placeSun(sun, { x: shotCam[3], z: shotCam[5] });
  } else {
    placeSun(sun, mouse.position);
  }
  sky.update(dt, camera);
  renderer.render(scene, camera);
});
