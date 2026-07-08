# Shinobi Protocol — Shadows Die Thrice

A 3D third-person combat sandbox built around **Sekiro-style posture/parry
combat**: tight parry windows, yellow deflect sparks, posture bars that break
into staggers, perilous unblockable attacks, and enemies you summon by
stepping on plates. Runs in any modern browser with no build step.

## How to run

- **Easiest — single file:** download
  [`ShinobiProtocol.html`](../ShinobiProtocol.html) from the repo root and
  double-click it. Everything (Three.js included) is bundled inside; it works
  offline with no install and no server.
- **From a clone:** open `sekiro/index.html` directly in
  Chrome/Edge/Firefox (Three.js is vendored in `../vendor/`).
- **Or serve it:** `python3 -m http.server` from the repo root, then open
  <http://localhost:8000/sekiro/>.

To rebuild the single file after editing `sekiro/`, run the inline script in
the repo root: it replaces each `<script src>` in `sekiro/index.html` with the
file's contents and writes `ShinobiProtocol.html`.

Click the title screen to lock the mouse. `Esc` releases it.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move (camera-relative) |
| **Shift (hold)** | Sprint — works in any direction |
| Mouse | Third-person camera |
| **Mouse 1** | Swing weapon — chains into combos; works midair as an air attack |
| **Mouse 2 (tap)** | **Parry** — small window; a successful deflect throws yellow sparks and spikes the attacker's posture |
| **Mouse 2 (hold)** | **Block** — held past the parry frames it becomes a guard; blocked hits cost no HP but raise **your** posture |
| **Space** + WASD | Dash — forward dash / side dash / backstep depending on held direction, with a few i-frames |
| **F** | Jump — attack while rising or falling |
| **E** | Interact (open the chest to restore vitality) |
| **R / T / C / G** | The four abilities of your equipped power |
| **M** | Loadout menu — weapon, power, and options (Shift Lock toggle) |

## The posture system

- Every actor has an HP bar and a **posture bar**.
- **Parrying** an attack barely costs you anything and dumps posture onto the
  attacker. **Blocking** keeps your HP but fills your posture. Getting **hit**
  costs HP.
- When a posture bar fills, that fighter is **posture-broken**: staggered,
  wide open, and taking **2.2× damage** until they regain composure.
- Posture drains over time — faster while healthy, faster still while
  actively blocking.
- A red **危** kanji flashes for perilous attacks (the ogre's charging grab,
  the Lancer's skewer). Those ignore both parry and block — dodge or jump.
- Enemy swings carry real weight: long, readable windups with a glint cue
  just before the strike lands. Learn the rhythm, then deflect on the glint.
- A deflected enemy visibly loses their stance for a beat — weapon rung wide,
  body whipped back, shoved off the clash — before they recompose.
- **Shift Lock** (in the M menu) switches to camera-locked strafing — your
  character always faces where the camera looks and A/D sidestep, with an
  over-the-shoulder camera.

## Weapons (M menu)

- **Katana** — fast three-cut combo, lives on the deflect.
- **Great Sword** — two colossal swings, huge posture damage, held in a low two-hand guard.
- **Spear** — longest reach, couched at the hip like a real spear: snap thrust, stepping thrust, then a lunging skewer. Air attack becomes a dive-bomb skewer.

## Powers (M menu) — every art MOVES you, and no two elements play alike

- **Fire — relentless advance.** Blazing Crescent (dash-leap with the blade
  ablaze, crashing down in a burning crescent), Flame Waltz (dance through up
  to 3 enemies, one burning slash each), *Cinder Trail* (mobility — the dash
  leaves a wall of fire), Vesuvius (rocket up, come down as an eruption that
  keeps burning).
- **Ice — the flowing glacier.** Frozen Lunge (glide in and ram the point
  home, freezing), Crystal Pirouette (steerable spinning glide ending in a
  flash-freeze), *Frost Glide* (mobility), Winter's Rampart (backflip away as
  a wall of ice spikes erupts where you stood).
- **Wind — master of the sky.** Sky Dancer (rising spiral slash that launches
  YOU — works midair), Swallow Dive (pass untouchably straight through them,
  ending behind with your blade turned), *Gale Vault* (mobility — double
  jump), Maelstrom (BECOME the tornado for 1.6s, steered with WASD).
- **Lightning — the instant.** Thunder Pierce (flash through the nearest
  enemy, reappearing behind mid-slash), Storm Circuit (chain-blink through up
  to 4 enemies, striking each), *Flash Step* (mobility — 9m blink), Heaven's
  Wrath (ascend on a thunderhead raining bolts, then crash down as one).

## Enemies — step on a plate to summon

- **Zombie** (green plate) — can't block, dies fast, and **loses a limb with
  every hit**; severed arms, legs and heads tumble across the plate.
- **Swordsman** (blue plate) — spawns with a random katana, great sword, or
  spear. Circles, runs combos, raises his guard, and will **deflect you** if
  you swing predictably.
- **Ogre** (red plate) — huge, ugly, slow. Haymakers and a double-fist slam
  that are brutally punishing unless parried, plus an unblockable perilous
  charge grab.
- **BOSS: The Veiled Lancer** (gold plate) — a cloaked duelist with a bow
  AND a long spear, and his own boss bar. Arrow volleys at range (deflect
  them!), spear combos and a vaulting slam up close, and a perilous
  gap-closing skewer that must be dodged. Only one can hunt you at a time.

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
