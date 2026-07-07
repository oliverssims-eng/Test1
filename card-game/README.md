# GRIMVEIL — a card game for gloomy evenings

A standalone 2D card battler with a dark-fantasy atmosphere: a purple-black
table, very dark surroundings, and glowing violet/blue accents. All card
artwork is fine-grained procedural pixel art (48×48 pixel grids upscaled with
nearest-neighbour), so it reads as crisp pixel art rather than big blocky
pixels.

## How to run

**Easiest:** download the single file `Grimveil.html` from the repo root and
double-click it — the whole game (styles, code, art engine) is bundled into
that one file.

Or run it from this folder: open `index.html` in any modern browser
(double-click it, or drag it into Chrome/Edge/Firefox). No build step, no
server, no dependencies either way. Progress (tokens, collection, decks, win
record) is saved in your browser's localStorage automatically.

To regenerate `Grimveil.html` after editing the source: `node card-game/build.js`.

## The flow

- **Title screen** — `PLAY` or `EXIT` (exit closes the window where the
  browser allows it).
- **The Sanctum (hub)** — three doors: **Customize Deck**, **Card Roulette**,
  **Battle**.
- **Battle** — pick one of four difficulties (Flicker / Gloom / Dread /
  Nightmare; harder foes play stronger cards and get bonus energy, but pay
  more tokens on defeat).

## How a battle works

- Your deck is exactly **40 cards**: a **starting eight** (4 attack + 4
  support, chosen by you) that begins the match already placed in 2 rows of 4
  (attackers in front, supports behind), plus a **main deck of 32** on the
  side of the table. The enemy AI mirrors this.
- You hold up to **4 cards in hand**. When a card dies — or a support serves
  its purpose and fades — you draw replacements from your deck at the end of
  the round.
- Placing a card costs **energy** (shown in the blue orb); you gain **+2
  energy every round**.
- A **round** = both players finish their turn, then the cards fight:
  supports act first, then swift attackers, then everyone else. Attackers hit
  the enemy in front of them by default, but almost every card has a gimmick —
  projectiles that arc over the frontline, diagonal slashes, two-turn charge
  attacks, piercing, splash, lifesteal, executes, venom/fire/frost/confusion,
  thorns, vengeance, bounties… **Hover any card to read exactly what it
  does.** ♥ is health, ☠ is damage.
- Attackers with nobody left to fight burn cards straight off the enemy's
  deck, and once a deck runs dry the dark itself starts hurting that side's
  cards — so no game stalls out.
- **You lose when you have no more cards to place** (board, hand and deck all
  empty). Win and you earn tokens.

## Card Roulette

Spend **100 tokens** on a themed pack: the wheel spins, then 8 random cards
from that pack's 40 join your collection. Ten packs ship in the box —
Grimhollow, Dustwater Cowboys, Iron Crown, Rotwood Risen, Feral Wilds,
Olympian Myth, The Misfits, Midnight Carnival, Drowned Deep, and Voidborn —
**400 unique cards** in total, each with its own stats, gimmick, and pixel
artwork.

## Files

- `index.html` — page shell.
- `style.css` — the gloomy look: table, cards, glows, animations.
- `js/sprites.js` — procedural pixel-art engine (palettes, painters, outlines).
- `js/cards.js` — the card library: 10 packs × 40 cards, trait system,
  auto-generated rules text.
- `js/battle.js` — battle engine: turn flow, combat resolution, statuses,
  enemy AI, difficulties.
- `js/main.js` — screens (menu, hub, deck builder, roulette, difficulty),
  profile/save handling, ambient particles.
