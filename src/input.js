export class Input {
  constructor(dom, onLook) {
    this.dom = dom;
    this.keys = new Set();
    this.jumpQueued = false;

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        if (!e.repeat) this.jumpQueued = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (this.locked) onLook(e.movementX, e.movementY);
    });
  }

  has(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  get forward() {
    return this.has('KeyW', 'ArrowUp');
  }
  get back() {
    return this.has('KeyS', 'ArrowDown');
  }
  get left() {
    return this.has('KeyA', 'ArrowLeft');
  }
  get right() {
    return this.has('KeyD', 'ArrowRight');
  }
  get sprint() {
    return this.has('ShiftLeft', 'ShiftRight');
  }

  consumeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  get locked() {
    return document.pointerLockElement === this.dom;
  }

  lock() {
    this.dom.requestPointerLock();
  }
}
