# Test1 — browser games

Three standalone browser games live in this repo:

- **Shinobi Protocol** (`sekiro/`) — 3D Sekiro-like posture/parry combat
  sandbox. **Just want to play? Download the all-in-one
  [`ShinobiProtocol.html`](ShinobiProtocol.html) and double-click it** — no
  install, works offline. Source lives in `sekiro/`; see
  [`sekiro/README.md`](sekiro/README.md) for controls and mechanics.
- **Voxel Monk Fighter** (repo root) — 3D third-person voxel brawler. See below.
- **GRIMVEIL** (`card-game/`) — a gloomy 2D pixel-art card battler. Open
  `card-game/index.html` in any modern browser to play; see
  [`card-game/README.md`](card-game/README.md) for the full rules.

---

# Voxel Monk Fighter

A 3D third-person voxel brawler for PC that runs in any modern browser. You play
a voxel monk on an empty grassy plain, fighting a voxel AI challenger. The camera
sits behind the character, and every attack is fully animated with a procedural
keyframe rig.

## How to run

No build step and no server needed — Three.js is vendored locally.

- **Easiest:** double-click `index.html` (or drag it into Chrome/Edge/Firefox).
- **Or serve it:** `python3 -m http.server` in this folder, then open
  <http://localhost:8000>.

Click the title screen to lock the mouse and start fighting. Press `Esc` to
release the mouse.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Camera (third-person, behind the monk) |
| Left click | Jab — fast left-hand snap punch |
| Right click | Heavy punch — slow right straight, **breaks block** |
| R | Front kick — big pushback |
| G | Haymaker — huge wind-up hook with the opposite hand |
| F (hold) | Block — stops normal attacks from the front |
| Z | Dropkick — flying attack that **breaks block** and **knocks the enemy down**; you land flat on the floor and are stuck in a get-up animation afterward |
| Enter | Next round (after a KO) |

## Fight rules

- Blocking negates frontal damage from jabs, kicks, and haymakers.
- The heavy punch and the dropkick smash through a raised guard — a broken
  guard leaves the defender staggered wide open.
- A landed dropkick flattens the enemy, but you also hit the floor and have to
  climb back up, so a whiffed dropkick is very punishable.
- The AI challenger closes distance, circles, mixes up all the same moves,
  raises its guard against your attacks, and goes for heavy punches when you
  turtle behind your block.

## Tech

- `vendor/three.min.js` — Three.js r147 (vendored, works offline / from `file://`).
- `game.js` — everything else: voxel character rig built from boxes, a small
  keyframe-clip animation system with smoothing, hit detection, block/break
  logic, knockdowns, AI state machine, procedural sound effects, and hit sparks.
