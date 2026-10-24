import { CONFIG } from './config.js';

const CAT_LABELS = {
  sleep: 'Cat: napping',
  chase: 'Cat: CHASING YOU!',
  search: 'Cat: searching…',
  distracted: 'Cat: distracted',
};

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.lives = $('lives');
    this.food = $('food');
    this.catStatus = $('cat-status');
    this.hidden = $('hidden-indicator');
    this.staminaFill = $('stamina-fill');
    this.toastEl = $('toast');
    this.overlay = $('overlay');
    this.overlayTitle = $('overlay-title');
    this.overlayText = $('overlay-text');
    this.overlayHint = $('overlay-hint');
    this.toastTimer = 0;
  }

  update(dt, { lives, delivered, mouse, cat }) {
    this.lives.textContent = '♥'.repeat(lives) + '♡'.repeat(Math.max(0, CONFIG.game.lives - lives));
    const carrying = mouse.carrying ? ' (carrying 1)' : '';
    this.food.textContent = `Food: ${delivered}/${CONFIG.game.foodToWin}${carrying}`;
    this.catStatus.textContent = CAT_LABELS[cat.state];
    this.catStatus.className = `panel ${cat.state}`;
    this.hidden.style.display = mouse.hidden || mouse.swimming ? 'block' : 'none';
    const spotted = mouse.hidden && !mouse.inHome && cat.tracking;
    this.hidden.textContent = mouse.swimming
      ? 'Swimming'
      : mouse.inHome
        ? 'Safe at home'
        : spotted
          ? 'Spotted!'
          : 'Hidden';
    this.hidden.classList.toggle('spotted', spotted);
    this.hidden.classList.toggle('swimming', mouse.swimming);
    this.staminaFill.classList.toggle('swimming', mouse.swimming);

    const pct = (mouse.stamina / CONFIG.mouse.staminaMax) * 100;
    this.staminaFill.style.width = `${pct}%`;
    this.staminaFill.classList.toggle('low', mouse.stamina < CONFIG.mouse.staminaMinToSprint);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }

  toast(text, seconds = 2.5) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = seconds;
  }

  showOverlay(title, text, hint = 'Click to play') {
    this.overlayTitle.textContent = title;
    this.overlayText.textContent = text;
    this.overlayHint.textContent = hint;
    this.overlay.classList.remove('hidden');
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }
}
