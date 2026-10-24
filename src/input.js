// Keyboard + mouse + gamepad (Xbox layout, via the browser's standard mapping),
// merged into one set of controls. Call poll() once per frame.

// Standard-mapping button indices.
const PAD = {
  A: 0,
  B: 1,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  VIEW: 8,
  START: 9,
  LS: 10,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
};
const DEADZONE = 0.18;
const TRIGGER = 0.4; // how far a trigger has to be pulled to count
const MENU_REPEAT = [0.4, 0.14]; // seconds before the first repeat, then between repeats

// Radial dead zone, rescaled so movement starts smoothly at the edge of it.
function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEADZONE) return { x: 0, y: 0 };
  const s = Math.min(1, (m - DEADZONE) / (1 - DEADZONE)) / m;
  return { x: x * s, y: y * s };
}

export class Input {
  constructor(dom, onLook) {
    this.dom = dom;
    this.keys = new Set();
    this.jumpQueued = false;
    this.scheme = 'keyboard'; // last-used: 'keyboard' or 'gamepad'
    this.padConnected = false;
    this.pad = null; // this frame's gamepad readings
    this.prevButtons = [];
    this.menuRepeat = { dir: 0, timer: 0 };
    this.listeners = {}; // name -> [fn]: 'pause', 'menuMove', 'menuSelect', 'menuBack', 'scheme', 'connect'

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return; // typing in a menu text box
      this.keys.add(e.code);
      this.setScheme('keyboard');
      if (e.code === 'Space') {
        if (!e.repeat) this.jumpQueued = true;
        e.preventDefault();
      }
      // With the cursor locked the browser eats Esc to unlock (which pauses);
      // without a lock (e.g. after playing on a controller) it arrives here.
      if (e.code === 'Escape' && !this.locked) this.emit('pause');
      if (e.code === 'KeyV' && !e.repeat) this.emit('toggleView');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        onLook(e.movementX, e.movementY);
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.setScheme('keyboard');
      }
    });
    window.addEventListener('gamepadconnected', () => {
      this.padConnected = true;
      this.emit('connect');
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.padConnected = [...(navigator.getGamepads?.() ?? [])].some(Boolean);
      if (!this.padConnected) this.setScheme('keyboard');
    });
  }

  on(name, fn) {
    (this.listeners[name] ??= []).push(fn);
  }

  emit(name, arg) {
    for (const fn of this.listeners[name] ?? []) fn(arg);
  }

  setScheme(scheme) {
    if (scheme === this.scheme) return;
    this.scheme = scheme;
    this.emit('scheme', scheme);
  }

  // Read the gamepad and fire edge-triggered events (jump, pause, menu navigation).
  poll(dt) {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) {
      this.pad = null;
      return;
    }
    if (!this.padConnected) {
      this.padConnected = true;
      this.emit('connect');
    }
    const pressed = gp.buttons.map((b) => b.pressed || b.value > TRIGGER);
    const edge = (i) => pressed[i] && !this.prevButtons[i];
    const move = stick(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    const look = stick(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
    this.pad = {
      move,
      look,
      sprint: pressed[PAD.LT] || pressed[PAD.RT] || pressed[PAD.LS],
    };

    const active = pressed.some(Boolean) || Math.hypot(move.x, move.y) > 0 || Math.hypot(look.x, look.y) > 0;
    if (active) this.setScheme('gamepad');

    if (edge(PAD.A)) {
      this.jumpQueued = true;
      this.emit('menuSelect');
    }
    if (edge(PAD.B)) this.emit('menuBack');
    if (edge(PAD.Y)) this.emit('toggleView');
    if (edge(PAD.START)) this.emit('pause', true); // Start toggles pause; Esc only pauses

    // Menu navigation: D-pad or left stick, with key-style auto-repeat.
    let dir = 0;
    if (pressed[PAD.UP] || move.y < -0.6) dir = -1;
    else if (pressed[PAD.DOWN] || move.y > 0.6) dir = 1;
    const r = this.menuRepeat;
    if (dir !== r.dir) {
      r.dir = dir;
      r.timer = MENU_REPEAT[0];
      if (dir) this.emit('menuMove', dir);
    } else if (dir) {
      r.timer -= dt;
      if (r.timer <= 0) {
        r.timer = MENU_REPEAT[1];
        this.emit('menuMove', dir);
      }
    }
    this.prevButtons = pressed;
    this.gamepad = gp;
  }

  has(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // Movement as x (right) / z (forward), each -1..1. Analog on a stick.
  get moveAxes() {
    let x = (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    let z = (this.has('KeyW', 'ArrowUp') ? 1 : 0) - (this.has('KeyS', 'ArrowDown') ? 1 : 0);
    if (this.pad && !x && !z) {
      x = this.pad.move.x;
      z = -this.pad.move.y;
    }
    return { x, z };
  }

  // Right-stick camera input, -1..1 per axis.
  get lookAxes() {
    return this.pad ? this.pad.look : { x: 0, y: 0 };
  }

  get sprint() {
    return this.has('ShiftLeft', 'ShiftRight') || !!this.pad?.sprint;
  }

  consumeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  // Controller rumble, where the browser supports it (Chrome/Edge do for Xbox pads).
  rumble(strong = 0.6, weak = 0.6, ms = 200) {
    this.gamepad?.vibrationActuator?.playEffect?.('dual-rumble', {
      duration: ms,
      strongMagnitude: strong,
      weakMagnitude: weak,
    }).catch?.(() => {});
  }

  get locked() {
    return document.pointerLockElement === this.dom;
  }

  // Lock the cursor for mouse look. Needs a real click/keypress, so it quietly
  // does nothing when the game is started from a controller.
  lock() {
    try {
      this.dom.requestPointerLock()?.catch?.(() => {});
    } catch {
      // No user gesture: fine, controller players don't need the lock.
    }
  }
}
