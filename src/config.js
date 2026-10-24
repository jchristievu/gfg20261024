// All gameplay tuning lives here so balancing doesn't mean hunting through code.
export const CONFIG = {
  world: {
    size: 100,
  },

  mouse: {
    radius: 0.25,
    height: 0.45, // for ducking under box roofs
    swimSpeed: 3.6, // swimming drains stamina like sprinting; running out costs a life
    walkSpeed: 4.5,
    sprintSpeed: 8,
    carrySpeedMultiplier: 0.85, // slower while hauling food
    jumpVelocity: 8,
    gravity: 25,
    stepHeight: 0.15,
    staminaMax: 2.5, // seconds of sprint
    staminaRegen: 0.8, // stamina per second while not sprinting
    staminaMinToSprint: 0.5, // need this much to start sprinting again
  },

  cat: {
    radius: 0.55,
    jumpHeight: 2.0, // cat hops over anything this tall or shorter
    chaseSpeed: 5.4,
    searchSpeed: 3,
    distractedSpeed: 2.2,
    catchDistance: 0.85,
    sniffDistance: 0.9, // finds a hidden mouse this close while searching
    sightRange: 12, // while chasing, grass won't hide a mouse the cat can see within this range
    eyeHeight: 1.2, // obstacles taller than this block the cat's view
    loseTrackTime: 1.0, // seconds without seeing/hearing the mouse before a chase becomes a search
    noticeDistance: 3, // a distracted cat notices a visible mouse this close
    hideTimeToDistract: 4, // seconds the mouse must stay hidden
    distractionDuration: [12, 18], // random range, seconds
    searchRadius: 4,
    napTime: 3, // grace period at start / after a catch
  },

  // Radius (world units) at which the cat hears the mouse.
  noise: {
    walk: 1.5,
    sprint: 14,
    jumpLand: 6,
  },

  game: {
    lives: 3,
    foodToWin: 3,
    homeRadius: 1.6,
    foodPickupRadius: 1.4,
    caughtPause: 2,
  },
};
