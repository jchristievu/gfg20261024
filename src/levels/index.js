import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';
import level4 from './level4.js';

export const LEVELS = [level1, level2, level3, level4];

// Highest unlocked level, remembered in the browser.
const KEY = 'farmMouse.unlocked';

export function unlockedLevel() {
  try {
    return Math.max(1, Math.min(LEVELS.length, Number(localStorage.getItem(KEY)) || 1));
  } catch {
    return 1;
  }
}

export function unlockLevel(n) {
  try {
    if (n > unlockedLevel()) localStorage.setItem(KEY, String(Math.min(n, LEVELS.length)));
  } catch {
    // Storage unavailable (private window etc.): progress just won't persist.
  }
}
