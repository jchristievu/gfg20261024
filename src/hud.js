import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.level = $('level-name');
    this.lives = $('lives');
    this.food = $('food');
    this.catStatus = $('cat-status');
    this.hidden = $('hidden-indicator');
    this.staminaFill = $('stamina-fill');
    this.toastEl = $('toast');
    this.overlay = $('overlay');
    this.overlayTitle = $('overlay-title');
    this.overlayText = $('overlay-text');
    this.overlayButtons = $('overlay-buttons');
    this.overlayHint = $('overlay-hint');
    this.toastTimer = 0;
    this.radar = $('radar');
    this.radarCtx = this.radar.getContext('2d');
    this.menuButtons = [];
    this.focusIndex = -1;
    this.onBack = null;
  }

  // Which controls to show and whether menus show a controller highlight.
  setScheme(scheme) {
    document.body.classList.toggle('gamepad', scheme === 'gamepad');
    if (scheme === 'gamepad' && this.focusIndex < 0) this.focusDefault();
  }

  setPadConnected(connected) {
    document.body.classList.toggle('pad-connected', connected);
  }

  get menuOpen() {
    return !this.overlay.classList.contains('hidden');
  }

  // ---- controller menu navigation

  focusDefault() {
    const enabled = this.menuButtons.filter((b) => !b.disabled);
    const pick = enabled.find((b) => b.classList.contains('primary')) ?? enabled[0];
    this.setFocus(this.menuButtons.indexOf(pick));
  }

  setFocus(i) {
    this.menuButtons.forEach((b, j) => b.classList.toggle('focused', j === i));
    this.focusIndex = i;
    if (i >= 0) this.menuButtons[i].scrollIntoView?.({ block: 'nearest' });
  }

  navigate(dir) {
    if (!this.menuOpen || !this.menuButtons.length) return;
    if (this.focusIndex < 0) return this.focusDefault();
    let i = this.focusIndex;
    for (let n = 0; n < this.menuButtons.length; n++) {
      i = (i + dir + this.menuButtons.length) % this.menuButtons.length;
      if (!this.menuButtons[i].disabled) break;
    }
    this.setFocus(i);
  }

  select() {
    if (!this.menuOpen) return;
    if (this.focusIndex < 0) return this.focusDefault();
    this.menuButtons[this.focusIndex]?.click();
  }

  back() {
    if (this.menuOpen) this.onBack?.();
  }

  update(dt, { levelName, lives, delivered, foodToWin, foodName, mouse, threat, spotted }) {
    this.level.textContent = levelName;
    this.lives.textContent = '♥'.repeat(lives) + '♡'.repeat(Math.max(0, CONFIG.game.lives - lives));
    const carrying = mouse.carrying ? ' (carrying 1)' : '';
    this.food.textContent = `${foodName}: ${delivered}/${foodToWin}${carrying}`;
    this.catStatus.textContent = threat.statusLabel();
    this.catStatus.className = `panel ${threat.statusClass()}`;

    const stunned = mouse.stunTimer > 0;
    this.hidden.style.display = mouse.hidden || mouse.swimming || stunned ? 'block' : 'none';
    let label = 'Hidden';
    if (stunned) label = 'Stunned!';
    else if (mouse.swimming) label = 'Swimming';
    else if (mouse.inHome) label = 'Safe at home';
    else if (spotted) label = 'Spotted!';
    this.hidden.textContent = label;
    this.hidden.classList.toggle('spotted', spotted && !stunned);
    this.hidden.classList.toggle('swimming', mouse.swimming && !stunned);
    this.hidden.classList.toggle('stunned', stunned);
    this.staminaFill.classList.toggle('swimming', mouse.swimming);

    const pct = (mouse.stamina / CONFIG.mouse.staminaMax) * 100;
    this.staminaFill.style.width = `${pct}%`;
    this.staminaFill.classList.toggle('low', mouse.stamina < CONFIG.mouse.staminaMinToSprint);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }

  // Radar: enemies within RADAR_RANGE, relative to the camera (up = where you're looking).
  // Only shown while something is close. Pass show=false to hide it (menus).
  drawRadar(mouse, enemies, cameraYaw, show = true) {
    const RANGE = 20;
    const near = show ? enemies.filter((e) => Math.hypot(e.position.x - mouse.position.x, e.position.z - mouse.position.z) < RANGE) : [];
    this.radar.classList.toggle('show', near.length > 0);
    if (!near.length) return;

    const ctx = this.radarCtx;
    const size = this.radar.width;
    const c = size / 2;
    const r = c - 6;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(12, 22, 16, 0.6)';
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();
    // Field of view wedge pointing up, range rings and crosshair.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 255, 180, 0.25)';
    ctx.lineWidth = 2;
    for (const f of [1 / 3, 2 / 3, 1]) {
      ctx.beginPath();
      ctx.arc(c, c, r * f, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(c - r, c);
    ctx.lineTo(c + r, c);
    ctx.moveTo(c, c - r);
    ctx.lineTo(c, c + r);
    ctx.stroke();

    // You, in the middle.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c, c, 6, 0, Math.PI * 2);
    ctx.fill();

    // Enemies. Camera forward is (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw).
    const fx = -Math.sin(cameraYaw);
    const fz = -Math.cos(cameraYaw);
    const t = performance.now() / 1000;
    const colors = { chase: '#ff4040', search: '#ffd23f' };
    for (const e of near) {
      const dx = e.position.x - mouse.position.x;
      const dz = e.position.z - mouse.position.z;
      const ahead = dx * fx + dz * fz;
      const right = dx * -fz + dz * fx;
      const px = c + (right / RANGE) * r;
      const py = c - (ahead / RANGE) * r;
      const cls = e.statusClass?.() ?? (e.state === 'flap' ? 'search' : 'minor');
      const color = colors[cls] ?? (e.minor ? '#f2e6c8' : '#8fd3ff');
      const big = !e.minor;
      const pulse = cls === 'chase' ? 1 + Math.sin(t * 10) * 0.25 : 1;
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, (big ? 11 : 7) * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  toast(text, seconds = 2.5) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = seconds;
  }

  // Show the overlay card. `buttons`: [{ label, onClick, primary?, selected?, disabled?, note? }].
  // `side` parks the card on the left so the scene stays visible (e.g. character preview).
  // `field` adds a text box above the buttons: { label, value, maxLength, onInput, onEnter }.
  // `onBack` runs when a controller's B button is pressed on this menu.
  showMenu(title, text, buttons = [], hint = '', { side = false, field = null, onBack = null } = {}) {
    this.onBack = onBack;
    this.overlay.classList.toggle('side', side);
    this.overlayTitle.textContent = title;
    this.overlayText.textContent = text;
    this.overlayHint.textContent = hint;
    const children = [];
    if (field) {
      const label = document.createElement('label');
      label.className = 'field';
      const caption = document.createElement('span');
      caption.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = field.value;
      input.maxLength = field.maxLength ?? 20;
      input.spellcheck = false;
      input.addEventListener('input', () => field.onInput(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') field.onEnter?.();
      });
      label.append(caption, input);
      children.push(label);
    }
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = [b.primary && 'primary', b.selected && 'selected'].filter(Boolean).join(' ');
      el.disabled = !!b.disabled;
      // textContent, not innerHTML: labels can include the player's typed name.
      const label = document.createElement('span');
      label.textContent = b.label;
      el.append(label);
      if (b.note) {
        const note = document.createElement('small');
        note.textContent = b.note;
        el.append(note);
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        b.onClick();
      });
      children.push(el);
    }
    this.overlayButtons.replaceChildren(...children);
    this.overlay.classList.remove('hidden');
    this.menuButtons = children.filter((c) => c.tagName === 'BUTTON');
    this.focusIndex = -1;
    if (document.body.classList.contains('gamepad')) this.focusDefault();
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }
}
