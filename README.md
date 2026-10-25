# Farm Mouse

A third-person 3D browser game built with [Three.js](https://threejs.org/) and Vite. You're a mouse on a farm: sneak out, grab food, and carry it back to your hole without getting caught. Four levels, each with its own hunters and hazards.

**Play it online: https://jchristievu.github.io/gfg20261024/** (desktop browser with keyboard and mouse, or an Xbox controller).

## Running it

```sh
npm install
npm run dev      # then open the URL Vite prints (usually http://localhost:5173)
npm run build    # production build into dist/
```

Every push to `main` rebuilds the game and publishes it to GitHub Pages ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). The repo's Pages source must be set to **GitHub Actions** (Settings → Pages).

Dev URL options: `?level=N` jumps straight to a level. `?tail=curly` (or `straight`, `short`, `triple`, `fox`, `finger`, `fireball`) previews a tail without saving it; `?head=tophat` (or `normal`, `cap`, `monocle`, `catears`) does the same for head styles. `?controls=gamepad` shows the controller UI without a controller. `?shot` hides the menu for screenshots, and `?shot=x,y,z,tx,ty,tz` also places the camera at `x,y,z` looking at `tx,ty,tz`. `?gfx=low` (or `medium`, `high`) tries a graphics quality without saving it, `?style=cel` (or `basic`, `ink`, `toon`) does the same for the art style, and `?fps` shows the frame-rate readout.

## How to play

The game opens on **Customize your mouse**: name your mouse (it starts with a random cute name, and the dice button rolls another) pick a tail (straight, curly, short, 3-tail, fox, a curled human index finger, or a silly fireball), and a head style (normal, blue baseball cap, top hat, monocle, or cat ears). Each style row steps to the next option when clicked. Your choices are remembered, you can change them any time from the level select screen, and the game uses the name when things go wrong ("Caught! Pip has 2 lives left.").

Each level: bring **3 pieces of food** (yellow beacon) back to your hole (green beacon), one at a time. You have **3 lives** per level. Get caught and you lose a life, drop what you're carrying (it goes back to the pile), and respawn at home. Your hole is always safe.

Beat a level to unlock the next. Progress is saved in your browser, and you can replay any unlocked level from the start screen.

| Keyboard & mouse | Xbox controller | Action |
| --- | --- | --- |
| W A S D / arrows | Left stick | Move (on a stick, a gentle tilt creeps slower and quieter) |
| Mouse | Right stick | Look |
| Shift | LT or click the left stick (RT also works) | Sprint (uses stamina, very noisy) |
| Space | A | Jump (landing makes noise) |
| Esc | Start | Pause (Start also resumes) |
| V | Y | Camera view: Standard, or High (pulled back and locked at a high angle; remembered) |
| Mouse click | D-pad / left stick, A, B | Menus (B goes back) |
| F3 | | Show or hide the FPS and draw-call readout |

**Graphics** (pause menu) sets the quality, and the game remembers it:

- **High** (default): ambient occlusion (soft contact shadows), bloom, anti-aliasing, color grading and a sharper sun shadow.
- **Medium**: drops ambient occlusion and renders at a lower resolution on high-DPI screens.
- **Low**: skips post-processing entirely, for older or integrated graphics.

If the game feels choppy, turn on the FPS readout and step the quality down.

**Style** (pause menu) picks the art style, also remembered, and switches instantly:

- **Basic**: the standard lit, textured look.
- **Ink**: Basic plus cartoon ink outlines.
- **Toon**: cel shading in three light bands, textures kept, with outlines.
- **Cel**: flat colors with cel shading and outlines, for a clean cartoon look.

Outlines are a screen effect, so Ink, Toon and Cel draw them only on Medium or High graphics. On Low, Toon and Cel keep their shading without the outlines.

Controllers work in Chrome and Edge through the browser's Gamepad API, wired or Bluetooth. Browsers only reveal a controller after you press a button on it. You can switch between keyboard/mouse and controller at any time, and the on-screen hints follow whichever you used last. Rumble plays when you're caught or a trap snaps. Name entry needs a keyboard; on a controller, use the Random name button.

The white ring on the ground shows how far your noise carries: anything inside it hears you.

The **radar** (bottom right) appears when an enemy is within 20 units. Up is the way your camera faces. Dots are red when chasing, yellow when searching or about to wake, and blue when napping or distracted; hens are small pale dots.

**Line of sight:** buildings, trees, crates, barrels, the woodpile, the well, wagons and furniture block an enemy's view. Low hay bales, fences and grass don't, since they're below eye level.

**Hiding** only works if nobody watched you go in. Hiding spots are tall grass, cardboard boxes (walk in the open end; enemies see in only from that side), and the gaps under furniture.

### Level 1: The Farmyard

Cheese from the plate by the farmhouse, past the **farm cat** (gray and white).

| Cat state | Icon | What it does |
| --- | --- | --- |
| Napping | z | Short grace period at the start and after a catch. |
| Prowling | | Patrols the middle of the farm between your shed and the cheese, sitting a while between stops, until it senses you. |
| Chasing | ! | Runs at you while it can sense you: it sees you out in the open within 18 units with a clear view, and smells/hears you within 6 units even around obstacles. |
| Searching | ? | You hid. It sniffs around where it last saw you. Stay hidden for 4s and it gives up. |
| Distracted | ♪ | Chases a butterfly for 12–18s. Noise or walking right past it snaps it back. |
| Getting bored | … | Last 4s of a distraction. When it ends, the cat chases you if it can sense you, otherwise it goes back to prowling. |

The farm cat has to sense you to know where you are. Out of smelling range (6 units), buildings and other tall objects hide you even while you run, and if it can't see you duck into cover it isn't sure where you went. Your noise still carries, though: sprinting can be heard 14 units away. The tool shed, crate stack, rain barrels, woodpile, well and hay wagon are placed along the routes as cover, and you can hide under the wagon.

**Puddles:** the cat hates water and loses interest the moment you swim. Swimming drains stamina, and running out costs a life. Jumping in with food drops it on the bank.

### Level 2: The Farmhouse

Cookies from the pantry, through the living room and kitchen.

- **Ragdoll cat:** lazy. It has to actually see you (walls and furniture block its view). It tires out after about 7 seconds of chasing and flops down for a nap. It naps after giving up a search, too. Noise wakes it, and "stirring…" warns you it's about to get up.
- **Dog:** a black-and-white German shorthaired pointer that patrols a loop through the living room, doorway and kitchen, stopping to look around. It has wide vision (150°, 10 units) but needs a clear line of sight, and it hears loud noise. If it notices you it stops and barks, and the ragdoll (even mid-nap) heads straight for that spot and searches there. The dog never hurts you and doesn't set off traps.
- **Mousetraps:** brushing a trap's edge snaps it: you're stunned for 2 seconds and the snap is loud enough to wake the cat. Stepping on the trigger plate costs a life. Sprung traps stay sprung.
- Hide under the sofa, armchair, dresser, hutch and rolling cart, or in the shoebox, pet carrier, soda case and paper bag. You can walk under the tables and chairs, and so can the cat.

### Level 3: The Chicken Coop

Corn from inside the coop.

- **Hens** wander and peck. If one sees you close by, or hears you, it squawks. Hens never attack.
- **Rooster:** guards the coop door. He charges at whatever a hen squawks about (or a loud noise) and chases you while he can see you. He only sees what's in front of him, and he **never searches**: the moment you hide or get out of sight, he struts back to his post.
- The front door is the short, risky way in. There's a mouse-sized gap in the coop's back wall (hens and the rooster can't fit), watched over by a hen that wanders along the back of the coop, and you can hide under the nesting boxes inside.

### Level 4: Upstairs

Candy from on top of the tall bookcase in the study, on the farmhouse's second floor. You have to climb:

- **Furniture route:** footstool → desk chair → desk → book stack → wall shelf → higher shelf → bookcase top.
- **Box stairs:** a quicker staircase of stacked moving boxes in the corner, but the ragdoll can hop onto the lower boxes.
- The ragdoll can reach anything up to about 2 units high. Higher than that, it can only watch. If it can't reach you for a few seconds, it loses interest and wanders off ("lost interest, wandering off"). That's your chance to come down, but landings are noisy and noise brings it back.
- A missed jump drops you to the floor. Mousetraps wait near the bases of both climbs and in the doorway. Hide under the bed, dresser or armchair, or in the toy box.

## Code layout

| File | Purpose |
| --- | --- |
| [src/config.js](src/config.js) | All gameplay tuning: speeds, senses, timers, lives, per-enemy profiles |
| [src/main.js](src/main.js) | Renderer, level loading, game loop, menus and progression |
| [src/graphics.js](src/graphics.js) | Quality presets, post-processing (AO, bloom, color grade) and the FPS readout |
| [src/stylize.js](src/stylize.js) | Art styles: toon / flat-cel material swaps and the ink-outline pass |
| [src/levels/](src/levels/) | One file per level (layout, food, enemies), plus `index.js` with the level list and unlock state |
| [src/world.js](src/world.js) | Shared level engine: collision, hiding spots, food, home, traps, enemy steering and line of sight |
| [src/builders.js](src/builders.js) | Shared building helpers (roofs, materials) and food models |
| [src/mouse.js](src/mouse.js) | Player movement, stamina, jumping, noise, hiding, stun |
| [src/enemies/creature.js](src/enemies/creature.js) | Base class for animals: steering, sight, state icons |
| [src/enemies/cat.js](src/enemies/cat.js) | Farm cat and ragdoll models and AI |
| [src/enemies/chickens.js](src/enemies/chickens.js) | Rooster and hen models and AI |
| [src/traps.js](src/traps.js) | Mousetrap model and contact rules |
| [src/camera.js](src/camera.js) | Third-person orbit camera |
| [src/input.js](src/input.js) | Keyboard, pointer-lock mouse and gamepad input, merged into one set of controls |
| [src/hud.js](src/hud.js) | On-screen HUD and menus |
| [src/textures.js](src/textures.js) | Procedural canvas textures and bump maps, water ripple normals (no image assets) |
| [src/sky.js](src/sky.js) | Sky dome, clouds, environment lighting |
| [src/decor.js](src/decor.js) | Scattered grass tufts, flowers, rocks |
| [src/effects.js](src/effects.js) | Wind sway, dust, splashes, ripples |
