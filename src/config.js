// All gameplay tuning lives here so balancing doesn't mean hunting through code.

const farmCat = {
  radius: 0.5,
  chaseSpeed: 5.4,
  searchSpeed: 3,
  distractedSpeed: 2.2,
  catchDistance: 0.85,
  sniffDistance: 0.9, // finds a hidden mouse this close while searching
  sightRange: 12, // while chasing, hiding won't fool a cat that can see you within this range
  spotRange: 18, // spots a mouse out in the open this far away, given a clear line of sight
  senseRange: 6, // smells/hears an exposed mouse this close even without line of sight
  wanderSpeed: 2.2, // prowling speed when it doesn't know where the mouse is
  prowlPause: [1.5, 4], // sits for this long between prowling legs
  loseTrackTime: 1.0, // seconds without seeing/hearing the mouse before a chase becomes a search
  noticeDistance: 3, // a distracted or napping cat notices a visible mouse this close
  hideTimeToDistract: 4, // seconds the mouse must stay hidden
  distraction: 'butterfly', // what it does after giving up: 'butterfly' or 'nap'
  distractionDuration: [12, 18], // random range, seconds
  boredWarning: 4, // HUD warns this many seconds before a distraction ends
  butterflyHomeClearance: 10, // the butterfly leads the cat away from the mouse hole
  searchRadius: 4,
  napTime: [3, 3], // grace period at start / after a catch
  wakesOnNoise: false,
  chaseStamina: Infinity, // seconds of chasing before it tires out
  hatesWater: true,
};

export const CONFIG = {
  mouse: {
    radius: 0.25,
    height: 0.45, // for ducking under roofs and furniture
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

  // Shared by every animal that hunts the mouse.
  enemy: {
    jumpHeight: 2.0, // hops onto anything this tall or shorter
    clearance: 1.4, // walks under anything whose underside is at least this high
    eyeHeight: 1.2, // obstacles taller than this block the view
  },

  cats: {
    farm: farmCat,
    // Level 2: lazy indoor cat. Has to actually see you, tires quickly, naps a lot.
    ragdoll: {
      ...farmCat,
      radius: 0.6,
      chaseSpeed: 4.8,
      searchSpeed: 2.2,
      wanderSpeed: 1.4,
      sightRange: 9,
      spotRange: 9,
      senseRange: 2,
      loseTrackTime: 0.8,
      hideTimeToDistract: 3,
      distraction: 'nap',
      distractionDuration: [14, 22], // nap after giving up a search
      tiredNap: [7, 10], // flops down after chasing too long
      chaseStamina: 5,
      napTime: [8, 8], // napping when the level starts / after a catch
      wakesOnNoise: true,
      hatesWater: false,
    },
  },

  // Level 2: patrols the house and barks to alert the ragdoll. Never attacks.
  dog: {
    radius: 0.6,
    patrolSpeed: 2.4,
    sightRange: 10,
    fov: 150, // degrees
    barkTime: 1.4, // stands and barks this long
    barkCooldown: 6,
    pause: [1, 2.5], // looks around this long at each patrol stop
  },

  // Level 3: charges where hens squawk, chases while he can see you, never searches.
  rooster: {
    radius: 0.45,
    strutSpeed: 1.5,
    chargeSpeed: 6.6,
    chaseSpeed: 6.2,
    returnSpeed: 3.0,
    sightRange: 9,
    fov: 140, // degrees; he only sees what's in front of him
    catchDistance: 0.8,
    postRadius: 3.5, // struts around his guard post
    loseSightGrace: 0.3,
  },

  hen: {
    radius: 0.38,
    wanderSpeed: 1.0,
    wanderRadius: 4.5,
    alertRadius: 4.5, // squawks at a visible mouse this close
    squawkCooldown: 5,
  },

  trap: {
    stunTime: 2, // brushing the edge of a trap
    snapNoise: 16, // hearing radius of a snap
  },

  // Radius (world units) at which enemies hear the mouse.
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
