# Shinobi Protocol — Shadows Die Thrice

A 3D third-person combat sandbox built around **Sekiro-style posture/parry
combat**: tight parry windows, yellow deflect sparks, posture bars that break
into staggers, perilous unblockable attacks, and enemies you summon by
stepping on plates. Runs in any modern browser with no build step.

## How to run

Three.js is vendored in `../vendor/`, so nothing to install:

- **Easiest:** open `sekiro/index.html` directly in Chrome/Edge/Firefox.
- **Or serve it:** `python3 -m http.server` from the repo root, then open
  <http://localhost:8000/sekiro/>.

Click the title screen to lock the mouse. `Esc` releases it.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move (camera-relative) |
| Mouse | Third-person camera |
| **Mouse 1** | Swing weapon — chains into combos; works midair as an air attack |
| **Mouse 2 (tap)** | **Parry** — small window; a successful deflect throws yellow sparks and spikes the attacker's posture |
| **Mouse 2 (hold)** | **Block** — held past the parry frames it becomes a guard; blocked hits cost no HP but raise **your** posture |
| **Space** + WASD | Dash — forward dash / side dash / backstep depending on held direction, with a few i-frames |
| **F** | Jump — attack while rising or falling |
| **E** | Interact (open the chest to restore vitality) |
| **R / T / C / G** | The four abilities of your equipped power |
| **M** | Loadout menu — choose weapon and power |

## The posture system

- Every actor has an HP bar and a **posture bar**.
- **Parrying** an attack barely costs you anything and dumps posture onto the
  attacker. **Blocking** keeps your HP but fills your posture. Getting **hit**
  costs HP.
- When a posture bar fills, that fighter is **posture-broken**: staggered,
  wide open, and taking **2.2× damage** until they regain composure.
- Posture drains over time — faster while healthy, faster still while
  actively blocking.
- A red **危** kanji flashes for perilous attacks (the ogre's charging grab).
  Those ignore both parry and block — dodge or jump.

## Weapons (M menu)

- **Katana** — fast three-cut combo, lives on the deflect.
- **Great Sword** — two colossal swings, huge posture damage, carried on the shoulder.
- **Spear** — longest reach, thrust / sweep / lunging skewer.

## Powers (M menu) — each kit binds R, T, C, G with at least one mobility art

- **Fire** — Fire Bolt, Flame Wave, *Cinder Dash* (mobility), Meteor Fall (mobility + slam).
- **Ice** — Ice Lance (slows), Frost Nova (freezes), *Frost Glide* (mobility), Glacial Spikes.
- **Wind** — Wind Cutter, Vacuum Pull, *Gale Vault* (mobility — works midair as a double jump), Tempest.
- **Lightning** — Thunder Bolt, Static Burst (stuns), *Flash Step* (mobility — 9m blink), Judgment.

## Enemies — step on a plate to summon

- **Zombie** (green plate) — can't block, dies fast, and **loses a limb with
  every hit**; severed arms, legs and heads tumble across the plate.
- **Swordsman** (blue plate) — spawns with a random katana, great sword, or
  spear. Circles, runs combos, raises his guard, and will **deflect you** if
  you swing predictably.
- **Ogre** (red plate) — huge, ugly, slow. Haymakers and a double-fist slam
  that are brutally punishing unless parried, plus an unblockable perilous
  charge grab.

## Tech

- `../vendor/three.min.js` — Three.js r147 (vendored, works from `file://`).
- `js/rig.js` — segmented-mannequin character builder (player, zombie,
  swordsman, ogre) + weapon meshes, all plain boxes on a shared bone scheme.
- `js/anim.js` — procedural keyframe animator: sparse-pose clips with easing
  and event tracks, blended over a procedural walk/run/air locomotion layer,
  everything exponentially damped so nothing pops.
- `js/combat.js` — the Sekiro rules: parry window → block → clean hit
  resolution, facing checks, posture math, projectiles, AoE.
- `js/fx.js` — spark streaks (the parry flash), puffs, shockwave rings,
  lightning bolts, sword trails, floating damage numbers, hit-stop, shake.
- `js/player.js`, `js/enemy.js`, `js/powers.js`, `js/main.js` — controller,
  the three AI archetypes with dismemberment debris, the four elemental kits,
  and the arena/HUD/loop.
