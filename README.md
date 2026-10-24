# Farm Mouse

A third-person 3D browser game built with [Three.js](https://threejs.org/) and Vite. You're a mouse on a farm: sneak to the farmhouse, grab cheese, and carry it back to your hole without getting caught by the farm cat.

## Running it

```sh
npm install
npm run dev      # then open the URL Vite prints (usually http://localhost:5173)
npm run build    # production build into dist/
```

## How to play

- Bring **3 pieces of cheese** from the plate by the farmhouse (yellow beacon) back to your mouse hole (green beacon), one at a time.
- You have **3 lives**. If the cat catches you, you lose a life, drop any cheese you're carrying (it goes back to the plate), and respawn at home.
- Your hole is a safe zone: the cat can't reach you there.
- **Hiding spots:** tall grass and cardboard boxes (walk in the open end). They only work if the cat didn't watch you go in. A cat can see into a box only from the open side, and reaches in to grab you if it knows you're there.
- **Puddles:** the cat hates water and loses interest the moment you swim. Swimming drains stamina even while treading water, and running out costs a life. Jumping in with cheese drops it on the bank, where you can pick it back up.

| Key | Action |
| --- | --- |
| W A S D / arrows | Move |
| Mouse | Look |
| Shift | Sprint (uses stamina, very noisy) |
| Space | Jump (landing makes noise) |
| Esc | Pause |

### The cat

| State | Icon | What it does |
| --- | --- | --- |
| Napping | z | Short grace period at the start and after a catch. |
| Chasing | ! | Runs straight at you whenever it can see you. |
| Searching | ? | You hid in tall grass. It sniffs around where it last saw you. Stay hidden for 4s and it gives up. |
| Distracted | ♪ | Chases a butterfly for 12–18s. Noise or walking right past it snaps it back to chasing. |

The white ring on the ground shows how far your noise carries: if the cat is inside it, it hears you.

## Code layout

| File | Purpose |
| --- | --- |
| [src/config.js](src/config.js) | All gameplay tuning: speeds, noise radii, timers, lives |
| [src/main.js](src/main.js) | Renderer, game loop, win/lose flow |
| [src/world.js](src/world.js) | Farm layout, collision, hiding spots, cat steering |
| [src/mouse.js](src/mouse.js) | Player movement, stamina, jumping, noise, hiding |
| [src/cat.js](src/cat.js) | Cat model and its chase/search/distracted AI |
| [src/camera.js](src/camera.js) | Third-person orbit camera |
| [src/input.js](src/input.js) | Keyboard and pointer-lock mouse input |
| [src/hud.js](src/hud.js) | On-screen HUD and menus |
