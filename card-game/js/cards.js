/* ============================================================
   GRIMVEIL — card library.
   10 packs × 40 cards. Every card is data: stats + traits.
   The battle engine interprets traits; rules text is generated
   from them so what you read is exactly what the card does.
   ============================================================ */
const Cards = (() => {

  /* ---------- trait → rules text ---------- */
  const ATK_TEXT = {
    ranged: () => 'Projectile — fires over the frontline, striking the back row first.',
    pierce: () => 'Piercing — hits both the front and back enemy in its lane.',
    diag:   () => 'Also slashes diagonally, hitting adjacent enemy lanes for half damage.',
    splash: () => 'Splash — deals half damage to enemies beside its target.',
    double: () => 'Strikes twice each round.',
    charge: n => `Charges for ${n} round${n > 1 ? 's' : ''}, then unleashes a devastating ${n + 1}× damage blow.`,
    swift:  () => "Swift — attacks first; foes it slays don't get to fight back.",
    lifesteal: () => 'Lifesteal — heals itself for the damage it deals.',
    sneak:  () => 'Sneaky — its attacks ignore shields and armor.',
    execute:() => 'Executioner — finishes off wounded enemies below 30% health.',
    frenzy: n => `Frenzy — gains +${n} damage at the end of every round it survives.`,
    armor:  n => `Armored — takes ${n} less damage from every hit.`,
    thorns: n => `Thorns — melee attackers take ${n} damage in return.`,
    venom:  n => `Venomous — poisons its victim (${n} damage/round for 3 rounds).`,
    burn:   n => `Fiery — ignites its victim (${n} damage/round for 2 rounds).`,
    frost:  n => `Chilling — frozen victims cannot act for ${n} round${n > 1 ? 's' : ''}.`,
    daze:   n => `Confusing — dazed victims may miss, or strike their own allies, for ${n} round${n > 1 ? 's' : ''}.`,
    avenge: n => `Vengeful — deals ${n} damage to its killer when it dies.`,
    bounty: n => `Bounty — you gain ${n} energy whenever it kills.`,
  };
  const SUP_TEXT = {
    heal:    n => `Mends your most wounded card for ${n} each round.`,
    healAll: n => `Soothes ALL your cards for ${n} each round.`,
    shield:  n => `Wraps the ally ahead in a ${n}-damage shield each round.`,
    buff:    n => `The ally ahead strikes for +${n} damage this round.`,
    rally:   n => `ALL your attackers strike for +${n} damage each round.`,
    hexPoison: n => `Hurls venom across the table — poisons an enemy (${n}/round, 3 rounds).`,
    hexBurn: n => `Sets an enemy alight (${n} damage/round for 2 rounds).`,
    hexFrost:n => `Freezes an enemy solid — it cannot act for ${n} round${n > 1 ? 's' : ''}.`,
    hexDaze: n => `Bewilders an enemy — it may miss or hit its own allies for ${n} round${n > 1 ? 's' : ''}.`,
    curse:   n => `Curses the enemy ahead — it deals ${n} less damage.`,
    cleanse: () => 'Purges every ailment from your cards.',
    energy:  n => `Channels +${n} energy to you each round.`,
    draw:    () => 'Foresight — you draw an extra card each round.',
    regen:   n => `Grants the ally ahead regeneration (${n} healing/round).`,
    bomb:    n => `Unstable — when it fades or dies it detonates for ${n} damage to ALL enemies.`,
    wall:    () => 'A stubborn obstacle. It does nothing but refuse to move.',
    armor:   n => `Armored — takes ${n} less damage from every hit.`,
    thorns:  n => `Thorns — melee attackers take ${n} damage in return.`,
  };

  function describe(c){
    const parts = [];
    const dict = c.type === 'A' ? ATK_TEXT : SUP_TEXT;
    for (const k in c.traits){
      if (k === 'uses') continue;
      const fn = dict[k] || ATK_TEXT[k] || SUP_TEXT[k];
      if (fn) parts.push(fn(c.traits[k]));
    }
    if (!parts.length) parts.push(c.type === 'A'
      ? 'A straightforward fighter. Attacks the enemy ahead each round.'
      : 'It simply stands there, quietly judging.');
    if (c.traits.uses) parts.push(`Fades after ${c.traits.uses} use${c.traits.uses > 1 ? 's' : ''}.`);
    return parts.join(' ');
  }

  /* ---------- rough power score (AI deck building / autofill) ---------- */
  function power(c){
    const t = c.traits; let s = c.hp * .5;
    if (c.type === 'A'){
      s += c.dmg * 1.6;
      if (t.ranged) s += 1.5; if (t.pierce) s += 2.2; if (t.diag) s += 1.6;
      if (t.splash) s += 1.6; if (t.double) s += c.dmg * 1.2; if (t.charge) s += c.dmg * .8;
      if (t.swift) s += 1.3; if (t.lifesteal) s += 1.6; if (t.sneak) s += 1;
      if (t.execute) s += 2.2; if (t.frenzy) s += t.frenzy * 2.2;
      if (t.armor) s += t.armor * 1.3; if (t.thorns) s += t.thorns;
      if (t.venom) s += t.venom * 2; if (t.burn) s += t.burn * 1.6;
      if (t.frost) s += t.frost * 2.2; if (t.daze) s += t.daze * 1.6;
      if (t.avenge) s += t.avenge * .7; if (t.bounty) s += t.bounty;
    } else {
      if (t.heal) s += t.heal * 2; if (t.healAll) s += t.healAll * 3.2;
      if (t.shield) s += t.shield * 1.6; if (t.buff) s += t.buff * 1.6;
      if (t.rally) s += t.rally * 3.4; if (t.hexPoison) s += t.hexPoison * 2.2;
      if (t.hexBurn) s += t.hexBurn * 1.8; if (t.hexFrost) s += t.hexFrost * 2.6;
      if (t.hexDaze) s += t.hexDaze * 2; if (t.curse) s += t.curse * 1.8;
      if (t.cleanse) s += 2.2; if (t.energy) s += t.energy * 2.6;
      if (t.draw) s += 3.2; if (t.regen) s += t.regen * 2;
      if (t.bomb) s += t.bomb * 1.6; if (t.wall) s += c.hp * .4;
      if (t.armor) s += t.armor * 1.2; if (t.thorns) s += t.thorns;
    }
    return s / (c.cost + 2);
  }

  /* ---------- definition helpers ---------- */
  const byId = {}, all = [], PACKS = [];
  let cur = null, idx = 0;

  function A(name, cost, hp, dmg, traits, p, o, pal){
    const c = { id: `${cur.key}-${idx++}`, name, type: 'A', cost, hp, dmg,
      traits: traits || {}, art: { p, o: o || {}, pal: pal || cur.pal, bg: cur.bg }, pack: cur.key };
    c.desc = describe(c); byId[c.id] = c; all.push(c); cur.cards.push(c);
  }
  function S(name, cost, hp, traits, p, o, pal){
    const c = { id: `${cur.key}-${idx++}`, name, type: 'S', cost, hp, dmg: 0,
      traits: traits || {}, art: { p, o: o || {}, pal: pal || cur.pal, bg: cur.bg }, pack: cur.key };
    c.desc = describe(c); byId[c.id] = c; all.push(c); cur.cards.push(c);
  }
  function PACK(key, name, blurb, bg, pal, crate){
    cur = { key, name, blurb, bg, pal, crate, cards: [] }; idx = 0; PACKS.push(cur);
  }

  /* ============================================================
     PACK 1 — GRIMHOLLOW  (dark fantasy base set)
     ============================================================ */
  PACK('grim', 'Grimhollow', 'The founding shadows. Restless dead, pale beasts and candlelight.', 'grim', 'violet',
       { p: 'crate', o: {}, pal: 'violet' });
  A('Gravehound',      2, 6, 3, {},                          'beast', { fangs: 1 }, 'shadow');
  A('Bone Soldier',    2, 5, 3, {},                          'humanoid', { bones: 1, skin: 'bone', weapon: 'sword' }, 'bone');
  A('Crypt Archer',    3, 5, 3, { ranged: 1 },               'humanoid', { bones: 1, skin: 'bone', weapon: 'bow' }, 'bone');
  A('Night Imp',       1, 3, 2, { swift: 1 },                'humanoid', { horns: 1, wings: 1, tail: 1, skin: 'blood' }, 'blood');
  A('Dread Knight',    5, 11, 5, { armor: 1 },               'humanoid', { hat: 'helm', weapon: 'sword', shield: 1 }, 'shadow');
  A('Pale Widow',      3, 6, 3, { venom: 2 },                'spider', { mark: 1 }, 'bone');
  A('Shrieker Bat',    1, 3, 2, { daze: 1 },                 'wing', { bat: 1 }, 'shadow');
  A('Hollow Wolf',     3, 8, 4, {},                          'beast', { fangs: 1, tailUp: 1 }, 'slate');
  A('Grave Golem',     5, 14, 4, { armor: 2 },               'golem', { core: '#8b5cf6', mossy: 1 }, 'slate');
  A('Wraith Blade',    4, 6, 5, { sneak: 1 },                'ghost', { chains: 0, eyeC: '#8b5cf6' }, 'violet');
  A('Coffin Serpent',  3, 7, 3, { venom: 1 },                'serpent', {}, 'shadow');
  A('Ash Reaper',      6, 10, 7, { execute: 1 },             'humanoid', { hat: 'hood', robe: 1, weapon: 'scythe', eyeGlow: '#8b5cf6' }, 'shadow');
  A('Blood Bat',       2, 4, 3, { lifesteal: 1 },            'wing', { bat: 1, eyeC: '#ff4757' }, 'blood');
  A('Doom Hound',      4, 9, 5, {},                          'beast', { fangs: 1, horns: 1, eyeC: '#ff4757' }, 'coal');
  A('Cursed Duelist',  3, 6, 4, { swift: 1 },                'humanoid', { weapon: 'sword', vest: 1 }, 'violet');
  A('Barrow Wight',    4, 8, 4, { frost: 1 },                'ghost', { chains: 1 }, 'frost');
  A('Grinning Ghoul',  2, 6, 2, { frenzy: 1 },               'humanoid', { skin: 'venom', weapon: 'dagger' }, 'venom');
  A('Marrow Brute',    5, 13, 5, {},                         'golem', { core: '#e0e0f0' }, 'bone');
  A('Veil Stalker',    4, 7, 4, { sneak: 1, swift: 1 },      'humanoid', { hat: 'hood', robe: 1, weapon: 'dagger' }, 'violet');
  A('Plague Rat',      1, 3, 1, { venom: 1 },                'beast', { spots: 1 }, 'coal');
  A('Sepulcher Drake', 6, 12, 6, { splash: 1 },              'dragon', { eyeC: '#8b5cf6' }, 'shadow');
  A('Candle Fiend',    2, 4, 2, { burn: 1 },                 'flame', { face: 1 }, 'violet');
  S('Grave Candle',    1, 3, { heal: 2, uses: 4 },           'potion', {}, 'violet');
  S('Bone Charm',      2, 4, { buff: 2, uses: 4 },           'totem', { faces: 2, eyeC: '#8b5cf6' }, 'bone');
  S('Whispering Skull',2, 3, { draw: 1, uses: 3 },           'grave', { wisp: 1 }, 'violet');
  S('Dark Chalice',    3, 4, { energy: 1, uses: 5 },         'potion', {}, 'blood');
  S('Ritual Tome',     3, 4, { hexDaze: 1, uses: 4 },        'humanoid', { robe: 1, hat: 'hood', weapon: 'book' }, 'violet');
  S('Soul Lantern',    2, 4, { regen: 2, uses: 4 },          'wisp', {}, 'frost');
  S('Necrotic Brew',   3, 5, { hexPoison: 2, uses: 4 },      'cauldron', {}, 'venom');
  S('Spirit Ward',     2, 6, { shield: 2, uses: 4 },         'banner', {}, 'violet');
  S("Witch's Familiar",2, 3, { hexDaze: 1, uses: 3 },        'wing', { bat: 1, eyeC: '#8b5cf6' }, 'violet');
  S('Blood Font',      4, 5, { healAll: 1, uses: 4 },        'cauldron', {}, 'blood');
  S('Shadow Veil',     3, 5, { curse: 2, uses: 4 },          'ghost', { eyeC: '#403060' }, 'shadow');
  S('Crypt Moss',      1, 4, { regen: 1, uses: 5 },          'mush', { spores: 1 }, 'venom');
  S('Old Ossuary',     3, 9, { wall: 1, armor: 1 },          'grave', { hand: 1 }, 'bone');
  S('Séance Circle',   4, 4, { draw: 1, energy: 1, uses: 3 },'portal', {}, 'violet');
  S('Grave Mist',      2, 4, { hexFrost: 1, uses: 3 },       'ghost', {}, 'frost');
  S('Ebon Monolith',   4, 10, { wall: 1, thorns: 2 },        'crystal', {}, 'shadow');
  S("Death's Hourglass",4, 4, { rally: 1, uses: 4 },         'crystal', {}, 'violet');
  S('Raven Omen',      1, 2, { curse: 1, uses: 4 },          'wing', {}, 'coal');

  /* ============================================================
     PACK 2 — DUSTWATER COWBOYS
     ============================================================ */
  PACK('cowboy', 'Dustwater Cowboys', 'High noon never ends. Six-guns, snake oil and shallow graves.', 'cowboy', 'sand',
       { p: 'crate', o: {}, pal: 'sand' });
  A('Quickdraw Kid',   3, 5, 4, { swift: 1 },                'humanoid', { hat: 'cowboy', weapon: 'gun', belt: 1 }, 'sand');
  A('Rattlesnake',     1, 3, 2, { venom: 2 },                'serpent', { rattle: 1 }, 'sand');
  A('Bounty Hunter',   4, 8, 4, { bounty: 2 },               'humanoid', { hat: 'cowboy', weapon: 'rifle', vest: 1 }, 'coal');
  A('Saloon Brawler',  2, 7, 3, {},                          'humanoid', { hat: 'bandana', belt: 1 }, 'rust');
  A('Mangy Coyote',    2, 5, 3, { frenzy: 1 },               'beast', { fangs: 1 }, 'sand');
  A('Cattle Rustler',  3, 7, 3, { daze: 1 },                 'humanoid', { hat: 'cowboy', weapon: 'whip' }, 'rust');
  A('Deadeye Dame',    4, 6, 4, { ranged: 1, sneak: 1 },     'humanoid', { hat: 'cowboy', weapon: 'rifle' }, 'blood');
  A('Dynamite Pete',   4, 7, 4, { splash: 1 },               'humanoid', { hat: 'bandana', weapon: 'torch', beard: 1 }, 'ember');
  A('Iron Marshal',    5, 12, 5, { armor: 2 },               'humanoid', { hat: 'cowboy', weapon: 'gun', shield: 1 }, 'steel');
  A('Turkey Vulture',  2, 4, 2, { execute: 1 },              'wing', {}, 'coal');
  A('Gatling Gunner',  6, 9, 4, { double: 1, ranged: 1 },    'cannon', {}, 'steel');
  A('Pale Rider',      5, 8, 5, { lifesteal: 1, swift: 1 },  'humanoid', { hat: 'cowboy', bones: 1, skin: 'bone', weapon: 'gun' }, 'bone');
  A('Tumblefiend',     1, 4, 1, { thorns: 1 },               'slime', { grin: 1 }, 'sand');
  A('Longhorn Bull',   5, 11, 4, { charge: 1 },              'beast', { horns: 1, bulk: 2 }, 'rust');
  A('Gold Digger',     2, 5, 2, { bounty: 2 },               'humanoid', { hat: 'bandana', weapon: 'hammer', beard: 1 }, 'gold');
  A('Card Shark',      3, 5, 4, { sneak: 1 },                'humanoid', { hat: 'top', weapon: 'dagger', vest: 1 }, 'rose');
  A('The Hangman',     5, 9, 6, { execute: 1 },              'tree', { hanged: 1 }, 'coal');
  A('Six-Shot Sam',    5, 7, 3, { double: 1, swift: 1 },     'humanoid', { hat: 'cowboy', weapon: 'gun', beard: 1 }, 'sand');
  A('Wild Mustang',    3, 7, 4, { swift: 1 },                'beast', { mane: 1, tailUp: 1 }, 'rust');
  A('Prairie Wolf',    2, 6, 3, {},                          'beast', { fangs: 1 }, 'sand');
  A('The Outlaw King', 6, 12, 6, { bounty: 2, frenzy: 1 },   'humanoid', { hat: 'crown', weapon: 'gun', vest: 1 }, 'gold');
  A('Dust Scorpion',   2, 4, 2, { venom: 2, armor: 1 },      'spider', { eyeC: '#e8b64c' }, 'sand');
  S('Campfire',        2, 4, { heal: 2, uses: 4 },           'flame', {}, 'ember');
  S('Whiskey Flask',   1, 3, { buff: 2, uses: 3 },           'potion', {}, 'gold');
  S('Wanted Poster',   2, 4, { rally: 1, uses: 4 },          'banner', {}, 'sand');
  S('Snake Oil',       2, 3, { hexDaze: 1, uses: 3 },        'potion', {}, 'venom');
  S('Lucky Horseshoe', 2, 4, { shield: 2, uses: 4 },         'totem', { faces: 1 }, 'gold');
  S('Chuckwagon',      4, 6, { healAll: 1, uses: 4 },        'cannon', {}, 'sand');
  S('Harmonica Hank',  3, 4, { hexDaze: 1, uses: 4 },        'humanoid', { hat: 'cowboy', weapon: 'lute' }, 'sand');
  S('Gold Nugget',     3, 3, { energy: 1, uses: 5 },         'crystal', {}, 'gold');
  S('Old Cactus',      2, 8, { wall: 1, thorns: 2 },         'plant', { jaw: 0 }, 'venom');
  S('Signal Fire',     2, 3, { draw: 1, uses: 3 },           'flame', {}, 'ember');
  S("Sheriff's Badge", 4, 4, { rally: 2, uses: 3 },          'star', {}, 'gold');
  S('Powder Keg',      3, 4, { bomb: 3, uses: 3, curse: 1 }, 'cauldron', {}, 'ember');
  S('Medicine Man',    3, 5, { heal: 3, uses: 4 },           'humanoid', { hat: 'plume', weapon: 'staff', robe: 1, orbC: '#6ab04c' }, 'rust');
  S('Boot Hill Grave', 3, 8, { wall: 1, armor: 1 },          'grave', {}, 'sand');
  S('Telegraph Post',  3, 4, { draw: 1, uses: 4 },           'banner', {}, 'steel');
  S('Prairie Moon',    3, 4, { regen: 2, uses: 5 },          'moon', {}, 'gold');
  S('Rustler Rope',    2, 3, { hexFrost: 1, uses: 3 },       'humanoid', { hat: 'cowboy', weapon: 'whip' }, 'sand');
  S('Spittoon',        1, 5, { wall: 1 },                    'potion', {}, 'steel');

  /* ============================================================
     PACK 3 — IRON CROWN  (medieval)
     ============================================================ */
  PACK('medieval', 'Iron Crown', 'Banners in the rain. Steel, siegecraft and sworn oaths.', 'medieval', 'steel',
       { p: 'crate', o: {}, pal: 'steel' });
  A('Footman',         2, 6, 3, {},                          'humanoid', { hat: 'helm', weapon: 'sword', shield: 1 }, 'steel');
  A('Crossbowman',     3, 5, 3, { ranged: 1 },               'humanoid', { hat: 'helm', weapon: 'bow' }, 'steel');
  A('Knight-Errant',   4, 9, 4, { armor: 1 },                'humanoid', { hat: 'plume', weapon: 'sword', shield: 1 }, 'frost');
  A('Berserker',       3, 7, 3, { frenzy: 1 },               'humanoid', { weapon: 'axe', beard: 1, beardC: '#b06a3b' }, 'rust');
  A('Pikeman',         3, 6, 3, { pierce: 1 },               'humanoid', { hat: 'helm', weapon: 'trident' }, 'steel');
  A('Siege Ram',       5, 12, 4, { charge: 2 },              'golem', { core: '#e8b64c' }, 'coal');
  A('Catapult',        5, 8, 4, { ranged: 1, splash: 1 },    'cannon', {}, 'sand');
  A('The Black Knight',6, 12, 6, { armor: 1, avenge: 3 },    'humanoid', { hat: 'helm', weapon: 'sword', shield: 1 }, 'coal');
  A('Eager Squire',    1, 4, 2, {},                          'humanoid', { weapon: 'dagger', shield: 1 }, 'steel');
  A('Warhound',        2, 5, 3, { swift: 1 },                'beast', { fangs: 1 }, 'slate');
  A('Jouster',         4, 8, 4, { charge: 1, swift: 1 },     'beast', { mane: 1, horns: 1 }, 'frost');
  A('Tower Guard',     4, 11, 3, { thorns: 2, armor: 1 },    'humanoid', { hat: 'helm', weapon: 'hammer', shield: 1 }, 'steel');
  A('Executioner',     5, 9, 6, { execute: 1 },              'humanoid', { hat: 'hood', weapon: 'axe' }, 'blood');
  A("King's Champion", 6, 13, 6, {},                         'humanoid', { hat: 'crown', weapon: 'sword', shield: 1 }, 'gold');
  A('Hunting Falcon',  1, 3, 2, { swift: 1 },                'wing', { tail3: 1 }, 'sand');
  A('Barded Destrier', 4, 10, 4, {},                         'beast', { mane: 1, bulk: 1 }, 'steel');
  A('Longbowman',      4, 5, 4, { ranged: 1 },               'humanoid', { hat: 'hood', weapon: 'bow' }, 'moss');
  A('Mace Sergeant',   3, 8, 4, {},                          'humanoid', { hat: 'helm', weapon: 'hammer' }, 'steel');
  A('Shieldmaiden',    3, 9, 2, { armor: 2 },                'humanoid', { hat: 'plume', weapon: 'sword', shield: 1 }, 'frost');
  A('Dragon Knight',   6, 11, 6, { burn: 2 },                'dragon', { fire: 1 }, 'blood');
  A('Peasant Mob',     2, 8, 2, { avenge: 2 },               'scarecrow', {}, 'moss');
  A('Court Assassin',  4, 6, 5, { sneak: 1, swift: 1 },      'humanoid', { hat: 'hood', weapon: 'dagger' }, 'shadow');
  S('Royal Banner',    3, 5, { rally: 1, uses: 5 },          'banner', {}, 'blood');
  S('Field Medic',     2, 4, { heal: 3, uses: 4 },           'humanoid', { robe: 1, weapon: 'staff', orbC: '#6de89a' }, 'bone');
  S('Blacksmith',      3, 5, { buff: 3, uses: 4 },           'humanoid', { weapon: 'hammer', beard: 1, vest: 1 }, 'coal');
  S('Chapel Bell',     3, 4, { cleanse: 1, heal: 1, uses: 4 },'totem', { faces: 1, eyeC: '#ffe9a0' }, 'gold');
  S('Castle Wall',     3, 12, { wall: 1, armor: 2 },         'golem', {}, 'slate');
  S('Court Wizard',    4, 4, { hexFrost: 1, uses: 4 },       'humanoid', { hat: 'wizard', robe: 1, weapon: 'staff' }, 'frost');
  S('The Herald',      2, 3, { draw: 1, uses: 4 },           'humanoid', { hat: 'plume', weapon: 'lute' }, 'gold');
  S('Royal Granary',   3, 4, { energy: 1, uses: 5 },         'crate', {}, 'sand');
  S('Armory Rack',     2, 5, { shield: 2, uses: 4 },         'banner', {}, 'steel');
  S("King's Decree",   5, 4, { rally: 2, uses: 4 },          'banner', {}, 'gold');
  S('Healing Springs', 4, 5, { healAll: 2, uses: 3 },        'potion', {}, 'frost');
  S('Mad Alchemist',   3, 4, { hexBurn: 2, uses: 4 },        'humanoid', { hat: 'wizard', robe: 1, weapon: 'torch' }, 'ember');
  S('Dungeon Rack',    3, 4, { curse: 2, uses: 4 },          'grave', {}, 'coal');
  S('The Round Table', 4, 6, { buff: 2, heal: 1, uses: 4 },  'crate', {}, 'gold');
  S('Watchtower',      3, 7, { curse: 1, wall: 1 },          'crystal', {}, 'slate');
  S('Cloister Monk',   2, 4, { regen: 2, uses: 4 },          'humanoid', { hat: 'hood', robe: 1 }, 'sand');
  S('Castle Moat',     2, 7, { wall: 1, thorns: 1 },         'jelly', {}, 'sea');
  S('Crown Jewels',    4, 3, { energy: 2, uses: 3 },         'crystal', {}, 'violet');

  /* ============================================================
     PACK 4 — ROTWOOD RISEN  (zombies)
     ============================================================ */
  PACK('zombie', 'Rotwood Risen', 'The soil gave them back. Hungry, patient, and terribly polite.', 'zombie', 'venom',
       { p: 'crate', o: {}, pal: 'venom' });
  A('Shambler',        1, 5, 2, {},                          'humanoid', { skin: 'moss' }, 'moss');
  A('Rotting Brute',   4, 11, 4, {},                         'humanoid', { skin: 'moss', belt: 1 }, 'venom');
  A('Grave Crawler',   1, 4, 2, { sneak: 1 },                'hand', { glow: '#6ab04c' }, 'moss');
  A('Sewer Ghoul',     2, 6, 3, {},                          'humanoid', { skin: 'venom', weapon: 'dagger' }, 'moss');
  A('Plague Bearer',   3, 7, 2, { venom: 2 },                'humanoid', { skin: 'moss', hat: 'hood', robe: 1 }, 'venom');
  A('Corpse Hound',    2, 5, 3, { venom: 1 },                'beast', { fangs: 1, spots: 1 }, 'moss');
  A('Bloated Walker',  3, 8, 2, { avenge: 3 },               'slime', { grin: 1, core: '#6ab04c' }, 'venom');
  A('Headless Axeman', 5, 9, 6, { execute: 1 },              'humanoid', { skin: 'moss', weapon: 'axe' }, 'moss');
  A('Graveyard Sprinter',2, 4, 3, { swift: 1 },              'humanoid', { skin: 'venom' }, 'venom');
  A('Stitched Horror', 6, 15, 5, {},                         'golem', { core: '#6ab04c', mossy: 1 }, 'flesh');
  A('Fungal Shambler', 3, 7, 3, { venom: 1 },                'mush', { spores: 1 }, 'venom');
  A('The Gravedigger', 3, 7, 4, {},                          'humanoid', { hat: 'top', weapon: 'axe', skin: 'moss' }, 'coal');
  A('Rot Wyrm',        4, 9, 4, { venom: 2 },                'serpent', {}, 'venom');
  A('Carrion Crow',    1, 3, 2, { execute: 1 },              'wing', {}, 'coal');
  A('Tomb Burster',    4, 8, 3, { charge: 2 },               'hand', { glow: '#a8e063' }, 'moss');
  A('Zombie Bride',    4, 7, 4, { daze: 1, lifesteal: 1 },   'humanoid', { skin: 'moss', robe: 1, hat: 'hood' }, 'bone');
  A('Infected Rat',    1, 2, 1, { venom: 2 },                'beast', { spots: 1 }, 'venom');
  A('The Butcher',     5, 10, 4, { double: 1 },              'humanoid', { skin: 'flesh', weapon: 'axe', belt: 1 }, 'blood');
  A('Mire Lurker',     3, 6, 4, { sneak: 1 },                'kraken', { eyeC: '#a8e063' }, 'moss');
  A('Necro Hulk',      6, 14, 5, { armor: 1 },               'golem', { core: '#a8e063', mossy: 1 }, 'moss');
  A('Maggot Swarm',    2, 5, 2, { venom: 1, frenzy: 1 },     'slime', {}, 'bone');
  A('Doctor Rot',      5, 8, 4, { venom: 3 },                'humanoid', { hat: 'top', robe: 1, weapon: 'staff', skin: 'moss', orbC: '#a8e063' }, 'venom');
  S('Plague Cloud',    3, 4, { hexPoison: 2, uses: 4 },      'ghost', { eyeC: '#a8e063' }, 'venom');
  S('Embalming Table', 3, 5, { heal: 3, uses: 4 },           'crate', {}, 'moss');
  S('Grave Soil',      2, 4, { regen: 2, uses: 5 },          'grave', { hand: 1 }, 'moss');
  S('Virus Vial',      2, 3, { hexPoison: 2, uses: 3 },      'potion', {}, 'venom');
  S('Corpse Pile',     3, 6, { draw: 1, uses: 4 },           'grave', {}, 'flesh');
  S('Rot Totem',       2, 4, { buff: 2, uses: 4 },           'totem', { eyeC: '#a8e063' }, 'moss');
  S('Quarantine Sign', 2, 4, { curse: 2, uses: 4 },          'banner', {}, 'venom');
  S('Infected Well',   3, 5, { hexPoison: 3, uses: 3 },      'cauldron', {}, 'moss');
  S('Brain in a Jar',  3, 3, { energy: 1, uses: 5 },         'potion', {}, 'flesh');
  S("Surgeon's Kit",   2, 3, { heal: 2, cleanse: 1, uses: 3 },'crate', {}, 'bone');
  S('Funeral Drum',    3, 4, { rally: 1, uses: 5 },          'totem', { faces: 1 }, 'coal');
  S('Creeping Miasma', 3, 4, { hexDaze: 1, uses: 4 },        'ghost', {}, 'venom');
  S('Bone Meal',       1, 2, { buff: 2, uses: 2 },           'potion', {}, 'bone');
  S('Coffin Lid',      2, 6, { shield: 2, uses: 4 },         'grave', {}, 'coal');
  S('Crooked Headstone',2, 8, { wall: 1 },                   'grave', { wisp: 1 }, 'slate');
  S('Alchemy Vat',     4, 5, { healAll: 1, cleanse: 1, uses: 3 },'cauldron', {}, 'venom');
  S('Fly Swarm',       1, 2, { curse: 1, uses: 4 },          'wing', { bat: 1 }, 'coal');
  S('Last Rites',      4, 4, { bomb: 4, uses: 4, regen: 1 }, 'grave', { wisp: 1 }, 'violet');

  /* ============================================================
     PACK 5 — FERAL WILDS  (beasts)
     ============================================================ */
  PACK('beast', 'Feral Wilds', 'No fences out here. Fang, claw, hunger — the old law.', 'beast', 'rust',
       { p: 'crate', o: {}, pal: 'rust' });
  A('Rabid Dog',       2, 5, 3, { venom: 1, frenzy: 1 },     'beast', { fangs: 1 }, 'rust');
  A('Dire Wolf',       3, 8, 4, {},                          'beast', { fangs: 1, tailUp: 1 }, 'slate');
  A('Grizzly',         5, 13, 5, {},                         'beast', { bulk: 2 }, 'rust');
  A('Wild Boar',       3, 8, 3, { charge: 1 },               'beast', { fangs: 1, bulk: 1 }, 'flesh');
  A('Sabretooth',      5, 9, 5, { double: 1 },               'beast', { fangs: 1, mane: 1 }, 'sand');
  A('Alpha Wolf',      5, 10, 5, { frenzy: 1 },              'beast', { fangs: 1, mane: 1, tailUp: 1 }, 'coal');
  A('Red-Tail Hawk',   2, 4, 3, { swift: 1 },                'wing', { tail3: 1 }, 'rust');
  A('Pit Viper',       2, 4, 2, { venom: 2, sneak: 1 },      'serpent', {}, 'venom');
  A('Great Stag',      4, 9, 4, { charge: 1 },               'beast', { horns: 1, bulk: 1 }, 'sand');
  A('Honey Badger',    2, 6, 2, { frenzy: 2 },               'beast', { spots: 1 }, 'coal');
  A('Wolverine',       3, 7, 4, { thorns: 1 },               'beast', { fangs: 1 }, 'coal');
  A('Black Bear',      4, 11, 4, {},                         'beast', { bulk: 1 }, 'coal');
  A('Night Panther',   4, 7, 5, { sneak: 1, swift: 1 },      'beast', { tailUp: 1, eyeC: '#4cc9f0' }, 'shadow');
  A('Bull Moose',      5, 12, 4, { charge: 1, armor: 1 },    'beast', { horns: 1, bulk: 2 }, 'rust');
  A('Timberwolf',      2, 6, 3, {},                          'beast', { fangs: 1 }, 'slate');
  A('Mother Bear',     5, 12, 4, { avenge: 4 },              'beast', { bulk: 2 }, 'rust');
  A('The Rat King',    3, 6, 3, { venom: 1, daze: 1 },       'beast', { spots: 1, tailUp: 1 }, 'coal');
  A('Razorback',       3, 7, 3, { thorns: 2 },               'beast', { spikes: 1, bulk: 1 }, 'rust');
  A('Lynx',            2, 5, 3, { swift: 1 },                'beast', { spots: 1 }, 'sand');
  A('Old Growler',     4, 12, 3, { armor: 2 },               'beast', { bulk: 2, fangs: 1 }, 'coal');
  A('King Cobra',      4, 6, 4, { venom: 3 },                'serpent', { hood: 1 }, 'venom');
  A('Swooping Owl',    3, 5, 3, { ranged: 1, swift: 1 },     'wing', { tail3: 1 }, 'bone');
  S('Bird Nest',       2, 3, { draw: 1, uses: 3 },           'plant', {}, 'sand');
  S('Fresh Kill',      2, 3, { heal: 3, uses: 3 },           'crate', {}, 'blood');
  S('Watering Hole',   4, 5, { healAll: 2, uses: 3 },        'potion', {}, 'sea');
  S('Thorn Bush',      2, 7, { wall: 1, thorns: 2 },         'plant', {}, 'moss');
  S('Pack Howl',       3, 4, { rally: 1, uses: 5 },          'moon', {}, 'slate');
  S('Musk Cloud',      2, 3, { hexDaze: 1, uses: 3 },        'ghost', {}, 'moss');
  S('Angry Beehive',   3, 4, { hexPoison: 2, uses: 4 },      'mush', { spores: 1 }, 'gold');
  S('Salmon Run',      3, 4, { energy: 1, uses: 5 },         'fish', { fin: 1 }, 'rose');
  S('The Old Oak',     4, 10, { wall: 1, regen: 1 },         'tree', { leaves: 1 }, 'moss');
  S('Firefly Swarm',   1, 2, { buff: 1, uses: 5 },           'wisp', {}, 'gold');
  S('Warm Burrow',     2, 5, { shield: 2, uses: 4 },         'grave', {}, 'sand');
  S('Territorial Mark',2, 3, { curse: 2, uses: 3 },          'banner', {}, 'rust');
  S('Full Moon',       5, 4, { rally: 2, uses: 4 },          'moon', {}, 'bone');
  S('Carrion Feast',   3, 4, { heal: 2, energy: 1, uses: 3 },'crate', {}, 'blood');
  S('Antler Totem',    3, 5, { buff: 3, uses: 4 },           'totem', { eyeC: '#e8a15c' }, 'sand');
  S('Spring Bloom',    3, 4, { healAll: 1, cleanse: 1, uses: 3 },'plant', {}, 'rose');
  S('Wolf Pup',        1, 3, { draw: 1, uses: 2 },           'beast', {}, 'slate');
  S("Predator's Eye",  3, 3, { buff: 2, uses: 5 },           'eyeball', {}, 'rust');

  /* ============================================================
     PACK 6 — OLYMPIAN MYTH  (greek mythology)
     ============================================================ */
  PACK('greek', 'Olympian Myth', 'Gods gamble too. Bronze, marble and monsters of legend.', 'greek', 'gold',
       { p: 'crate', o: {}, pal: 'gold' });
  A('Hoplite',         2, 6, 3, { armor: 1 },                'humanoid', { hat: 'plume', weapon: 'trident', shield: 1 }, 'gold');
  A('Minotaur',        5, 12, 5, { charge: 1 },              'humanoid', { horns: 1, skin: 'rust', weapon: 'axe' }, 'rust');
  A('Medusa',          5, 8, 4, { frost: 1 },                'serpent', { heads: 3, eyeC: '#a8e063' }, 'venom');
  A('Cyclops',         6, 14, 6, {},                         'golem', { core: '#ffdf6a' }, 'flesh');
  A('Harpy',           2, 4, 3, { swift: 1 },                'wing', { tail3: 1 }, 'gold');
  A('Cerberus',        6, 12, 5, { double: 1 },              'beast', { fangs: 1, bulk: 1, horns: 1, eyeC: '#ff4757' }, 'coal');
  A('Hydra',           6, 13, 4, { frenzy: 2 },              'serpent', { heads: 3 }, 'moss');
  A('Spartan Champion',4, 9, 5, {},                          'humanoid', { hat: 'plume', weapon: 'sword', shield: 1 }, 'blood');
  A('Centaur Archer',  4, 8, 4, { ranged: 1 },               'beast', { mane: 1 }, 'sand');
  A('Chimera',         5, 10, 4, { burn: 2 },                'dragon', { fire: 1 }, 'ember');
  A('Kraken Spawn',    4, 9, 4, {},                          'kraken', {}, 'sea');
  A('Pegasus',         3, 6, 3, { swift: 1, ranged: 1 },     'wing', { tail3: 1 }, 'bone');
  A("Ares' Zealot",    3, 6, 4, { frenzy: 1 },               'humanoid', { hat: 'helm', weapon: 'sword' }, 'blood');
  A('Titan Shard',     5, 13, 4, { armor: 2 },               'golem', { core: '#8a94ec' }, 'slate');
  A('Siren',           3, 5, 3, { daze: 2 },                 'humanoid', { robe: 1, weapon: 'lute' }, 'sea');
  A('Satyr Skirmisher',2, 5, 3, { diag: 1 },                 'humanoid', { horns: 1, weapon: 'dagger' }, 'moss');
  A('Bronze Colossus', 6, 15, 5, { armor: 2, charge: 1 },    'golem', { core: '#ffc04a' }, 'gold');
  A('Amazon Huntress', 3, 6, 4, { ranged: 1 },               'humanoid', { hat: 'laurel', weapon: 'bow' }, 'moss');
  A('The Fury',        4, 7, 4, { burn: 1, swift: 1 },       'wing', { bat: 1, eyeC: '#ff4757' }, 'blood');
  A('Kalydonian Boar', 4, 10, 4, { charge: 1, thorns: 1 },   'beast', { fangs: 1, bulk: 1, spikes: 1 }, 'coal');
  A('Shade of Hades',  4, 6, 4, { sneak: 1, lifesteal: 1 },  'ghost', { eyeC: '#8b5cf6' }, 'shadow');
  A('Icarus',          2, 3, 4, { swift: 1, avenge: 2 },     'wing', {}, 'gold');
  S('The Oracle',      3, 4, { draw: 1, uses: 4 },           'humanoid', { hat: 'laurel', robe: 1, weapon: 'staff', orbC: '#c4b5fd' }, 'bone');
  S('Ambrosia',        4, 4, { healAll: 2, uses: 3 },        'potion', {}, 'gold');
  S('Olympian Altar',  4, 5, { energy: 2, uses: 4 },         'crystal', {}, 'gold');
  S('Golden Fleece',   3, 5, { shield: 3, uses: 4 },         'banner', {}, 'gold');
  S("Athena's Aegis",  4, 7, { shield: 2, wall: 1 },         'mask', {}, 'frost');
  S("Hermes' Sandals", 2, 3, { buff: 2, uses: 4 },           'wing', {}, 'gold');
  S("Zeus' Omen",      4, 4, { hexDaze: 2, uses: 3 },        'star', {}, 'storm');
  S("Apollo's Lyre",   3, 4, { heal: 3, uses: 4 },           'humanoid', { hat: 'laurel', weapon: 'lute', robe: 1 }, 'gold');
  S("Pandora's Box",   3, 4, { bomb: 4, uses: 3, hexDaze: 1 },'crate', {}, 'violet');
  S('Nectar Chalice',  2, 3, { regen: 2, uses: 4 },          'potion', {}, 'gold');
  S('Laurel Wreath',   3, 4, { rally: 1, uses: 5 },          'banner', {}, 'moss');
  S('Delphic Incense', 2, 3, { hexDaze: 1, uses: 4 },        'flame', {}, 'violet');
  S('Water of Styx',   3, 4, { hexFrost: 1, uses: 4 },       'potion', {}, 'shadow');
  S('Trojan Horse',    4, 9, { wall: 1, draw: 1, uses: 4 },  'beast', { bulk: 2 }, 'sand');
  S('Gorgon Idol',     3, 4, { hexFrost: 1, uses: 3 },       'totem', { eyeC: '#a8e063' }, 'venom');
  S('Titan Chains',    3, 4, { curse: 2, uses: 4 },          'grave', {}, 'slate');
  S('Temple Column',   2, 9, { wall: 1 },                    'crystal', {}, 'bone');
  S('Winged Victory',  5, 5, { rally: 2, heal: 1, uses: 3 }, 'humanoid', { wings: 1, robe: 1 }, 'gold');

  /* ============================================================
     PACK 7 — THE MISFITS
     ============================================================ */
  PACK('misfit', 'The Misfits', 'The alley folk. Crooked, scrappy, weirdly loyal.', 'misfit', 'rose',
       { p: 'crate', o: {}, pal: 'rose' });
  A('Pickpocket',      1, 3, 2, { sneak: 1, bounty: 1 },     'humanoid', { hat: 'hood', weapon: 'dagger' }, 'rose');
  A('The Sewer King',  5, 11, 4, { venom: 1 },               'humanoid', { hat: 'crown', weapon: 'staff', skin: 'moss', orbC: '#6ab04c' }, 'moss');
  A('Backalley Bruiser',3, 9, 3, {},                         'humanoid', { hat: 'bandana', belt: 1 }, 'coal');
  A('Two-Face Tony',   3, 6, 3, { daze: 2 },                 'mask', { sad: 1 }, 'rose');
  A('Knife Juggler',   4, 6, 3, { double: 1, diag: 1 },      'humanoid', { hat: 'jester', weapon: 'dagger' }, 'rose');
  A('Street Rat',      1, 3, 2, {},                          'beast', { spots: 1 }, 'coal');
  A('Gutter Mage',     3, 5, 3, { burn: 1, ranged: 1 },      'humanoid', { hat: 'hood', robe: 1, weapon: 'staff', orbC: '#e07020' }, 'shadow');
  A('Peg-Leg Percy',   2, 7, 3, {},                          'humanoid', { hat: 'bandana', weapon: 'hammer', beard: 1 }, 'sand');
  A('One-Eyed Willa',  4, 6, 4, { ranged: 1, execute: 1 },   'humanoid', { hat: 'top', weapon: 'rifle' }, 'coal');
  A('Rooftop Runner',  2, 4, 3, { swift: 1 },                'humanoid', { hat: 'hood', weapon: 'dagger' }, 'storm');
  A('The Collector',   4, 8, 3, { bounty: 3 },               'humanoid', { hat: 'top', weapon: 'book', vest: 1 }, 'violet');
  A('Angry Mime',      3, 6, 2, { frost: 1 },                'humanoid', { hat: 'top', skin: 'bone' }, 'coal');
  A('Doll Stitcher',   3, 6, 3, { avenge: 3 },               'scarecrow', {}, 'rose');
  A('Trash Golem',     5, 13, 4, { armor: 1, thorns: 1 },    'golem', { core: '#c04a8a', mossy: 1 }, 'coal');
  A('Feral Alley Cat', 1, 3, 2, { swift: 1 },                'beast', { tailUp: 1, eyeC: '#4cc9f0' }, 'coal');
  A('Chain Smoker',    3, 7, 3, { burn: 1 },                 'humanoid', { hat: 'top', vest: 1 }, 'coal');
  A('The Gambler',     4, 7, 5, { daze: 1 },                 'dice', {}, 'rose');
  A('Crowbar Carl',    2, 6, 3, {},                          'humanoid', { hat: 'bandana', weapon: 'hammer' }, 'rust');
  A('Manhole Lurker',  3, 5, 4, { sneak: 1 },                'kraken', { eyeC: '#c04a8a' }, 'coal');
  A('Tattooed Titan',  5, 12, 5, {},                         'humanoid', { belt: 1, skin: 'rose' }, 'rose');
  A('Rat Whisperer',   3, 6, 2, { venom: 2 },                'humanoid', { hat: 'hood', robe: 1 }, 'coal');
  A('Molotov Marla',   4, 6, 4, { burn: 2, splash: 1 },      'humanoid', { hat: 'bandana', weapon: 'torch' }, 'ember');
  S('Loaded Dice',     2, 3, { buff: 2, uses: 4 },           'dice', {}, 'rose');
  S('Crooked Ledger',  3, 3, { energy: 1, uses: 5 },         'crate', {}, 'gold');
  S('Stolen Purse',    2, 2, { energy: 2, uses: 2 },         'crate', {}, 'rose');
  S('Soup Kitchen',    4, 5, { healAll: 1, uses: 5 },        'cauldron', {}, 'sand');
  S('Cardboard Fort',  1, 6, { wall: 1 },                    'crate', {}, 'sand');
  S('Lucky Cat',       2, 3, { draw: 1, uses: 3 },           'beast', { tailUp: 1 }, 'gold');
  S('Moonshine Still', 3, 4, { buff: 3, uses: 3 },           'cauldron', {}, 'steel');
  S('The Pawn Shop',   3, 4, { draw: 1, uses: 4 },           'crate', {}, 'violet');
  S('Graffiti Hex',    2, 3, { curse: 2, uses: 3 },          'banner', {}, 'rose');
  S('Sewer Grate',     2, 6, { shield: 1, wall: 1 },         'grave', {}, 'steel');
  S('Flickering Lamp', 2, 4, { regen: 2, uses: 4 },          'wisp', {}, 'gold');
  S("Beggar's Cup",    1, 2, { energy: 1, uses: 3 },         'potion', {}, 'coal');
  S('Contraband Crate',3, 4, { draw: 1, energy: 1, uses: 2 },'crate', {}, 'rose');
  S('Smoke Bomb',      2, 2, { hexDaze: 2, uses: 2 },        'potion', {}, 'coal');
  S('Itching Powder',  2, 3, { curse: 1, hexDaze: 1, uses: 3 },'potion', {}, 'sand');
  S('Fake Mustache',   1, 3, { shield: 2, uses: 3 },         'mask', {}, 'coal');
  S('Nail Board Trap', 2, 5, { wall: 1, thorns: 3 },         'grave', {}, 'rust');
  S('Alley Oracle',    3, 4, { heal: 2, draw: 1, uses: 3 },  'humanoid', { hat: 'hood', robe: 1, weapon: 'book' }, 'violet');

  /* ============================================================
     PACK 8 — MIDNIGHT CARNIVAL
     ============================================================ */
  PACK('carnival', 'Midnight Carnival', 'The show never closes. Step right up. No refunds.', 'carnival', 'ember',
       { p: 'crate', o: {}, pal: 'ember' });
  A('Mad Clown',       2, 5, 3, { daze: 1 },                 'humanoid', { hat: 'jester', skin: 'bone', weapon: 'dagger' }, 'rose');
  A('Knife Thrower',   3, 5, 3, { ranged: 1, diag: 1 },      'humanoid', { hat: 'top', weapon: 'dagger' }, 'blood');
  A('The Strongman',   5, 12, 5, { charge: 1 },              'humanoid', { belt: 1, weapon: 'hammer' }, 'rust');
  A('Fire Breather',   4, 7, 3, { burn: 2, splash: 1 },      'humanoid', { hat: 'bandana', weapon: 'torch' }, 'ember');
  A('Contortionist',   2, 4, 3, { sneak: 1 },                'humanoid', { skin: 'rose' }, 'rose');
  A('The Ringmaster',  5, 9, 5, { frenzy: 1 },               'humanoid', { hat: 'top', weapon: 'whip', vest: 1 }, 'blood');
  A('Carousel Steed',  3, 7, 3, { charge: 1, swift: 1 },     'beast', { mane: 1 }, 'gold');
  A('Haunted Dummy',   2, 5, 2, { avenge: 3 },               'scarecrow', { eyeC: '#e0455f' }, 'coal');
  A('The Bearded Lady',3, 8, 3, {},                          'humanoid', { beard: 1, beardC: '#7a2a5c', robe: 1 }, 'rose');
  A('Human Cannonball',5, 8, 5, { charge: 2, pierce: 1 },    'cannon', {}, 'ember');
  A('Stilt Stalker',   3, 6, 3, { pierce: 1 },               'scarecrow', {}, 'ember');
  A('Escape Artist',   2, 4, 3, { swift: 1, sneak: 1 },      'humanoid', { hat: 'bandana', skin: 'bone' }, 'steel');
  A('Trapeze Twins',   4, 6, 3, { double: 1 },               'humanoid', { wings: 1 }, 'rose');
  A('Freakshow Brute', 5, 12, 5, {},                         'golem', { core: '#e07020' }, 'flesh');
  A('Candyfloss Horror',3, 7, 2, { daze: 1, lifesteal: 1 },  'slime', { grin: 1, core: '#f090c0' }, 'rose');
  A('Lion Tamer',      3, 6, 4, {},                          'humanoid', { hat: 'top', weapon: 'whip', vest: 1 }, 'gold');
  A('Circus Lion',     4, 9, 5, {},                          'beast', { mane: 1, fangs: 1 }, 'gold');
  A('Juggling Bones',  3, 5, 3, { double: 1 },               'humanoid', { bones: 1, skin: 'bone', hat: 'jester' }, 'bone');
  A('Marionette',      2, 5, 3, { daze: 1 },                 'scarecrow', { eyeC: '#4cc9f0' }, 'frost');
  A('Sword Swallower', 3, 8, 3, { thorns: 2 },               'humanoid', { weapon: 'sword', vest: 1 }, 'steel');
  A("Fortune's Fool",  1, 4, 2, { daze: 1 },                 'humanoid', { hat: 'jester' }, 'gold');
  A('Ferris Wraith',   5, 9, 4, { frost: 1, ranged: 1 },     'ghost', { eyeC: '#e07020' }, 'ember');
  S('Ticket Booth',    3, 4, { energy: 1, uses: 5 },         'tent', {}, 'gold');
  S('Fortune Teller',  3, 4, { draw: 1, uses: 4 },           'humanoid', { hat: 'hood', robe: 1, weapon: 'staff', orbC: '#c4b5fd' }, 'violet');
  S('House of Mirrors',3, 5, { hexDaze: 2, uses: 3 },        'tent', {}, 'frost');
  S('Calliope Organ',  3, 4, { rally: 1, uses: 5 },          'cannon', {}, 'rose');
  S('Popcorn Stand',   2, 4, { heal: 2, uses: 4 },           'tent', {}, 'gold');
  S('The Big Top',     4, 10, { wall: 1, shield: 1 },        'tent', {}, 'ember');
  S('Snake Charmer',   3, 4, { hexDaze: 1, uses: 4 },        'serpent', { hood: 1 }, 'gold');
  S('Carnival Prize',  2, 3, { draw: 1, uses: 2 },           'crate', {}, 'rose');
  S('Pickled Oddity',  2, 3, { hexPoison: 2, uses: 3 },      'potion', {}, 'venom');
  S('Balloon Bundle',  1, 2, { shield: 2, uses: 3 },         'wisp', {}, 'rose');
  S('Ring of Fire',    3, 4, { hexBurn: 2, uses: 4 },        'flame', {}, 'ember');
  S('Tarot Deck',      3, 3, { draw: 1, energy: 1, uses: 3 },'dice', {}, 'violet');
  S('Candy Apple',     1, 2, { heal: 2, uses: 2 },           'potion', {}, 'blood');
  S('Sideshow Banner', 2, 4, { buff: 2, uses: 4 },           'banner', {}, 'ember');
  S('The Dunk Tank',   3, 4, { hexFrost: 1, uses: 3 },       'cauldron', {}, 'sea');
  S("Magician's Box",  3, 4, { cleanse: 1, shield: 1, uses: 4 },'crate', {}, 'violet');
  S('Test of Strength',3, 5, { buff: 3, uses: 4 },           'totem', { faces: 2 }, 'ember');
  S('Hall of Clowns',  4, 5, { hexDaze: 2, curse: 1, uses: 3 },'mask', { sad: 1 }, 'rose');

  /* ============================================================
     PACK 9 — DROWNED DEEP
     ============================================================ */
  PACK('sea', 'Drowned Deep', 'Ten thousand fathoms of bad ideas. The tide keeps receipts.', 'sea', 'sea',
       { p: 'crate', o: {}, pal: 'sea' });
  A('Drowned Sailor',  2, 6, 3, {},                          'humanoid', { skin: 'sea', hat: 'bandana' }, 'sea');
  A('Reef Shark',      4, 8, 5, { frenzy: 1 },               'fish', { teeth: 1, fin: 1 }, 'slate');
  A('Anglerfish',      3, 5, 4, { sneak: 1 },                'fish', { angler: 1, teeth: 1 }, 'shadow');
  A('Giant Crab',      4, 10, 3, { armor: 2 },               'crab', {}, 'rust');
  A('Kraken Cultist',  3, 6, 3, { venom: 1 },                'humanoid', { hat: 'hood', robe: 1, weapon: 'staff', orbC: '#2e8ea0' }, 'sea');
  A('Tide Serpent',    4, 9, 4, {},                          'serpent', {}, 'sea');
  A('Harpooner',       3, 6, 3, { pierce: 1 },               'humanoid', { hat: 'bandana', weapon: 'trident', beard: 1 }, 'sea');
  A('Ghost Pirate',    4, 7, 4, { lifesteal: 1 },            'humanoid', { hat: 'cowboy', bones: 1, skin: 'bone', weapon: 'sword' }, 'sea');
  A('Electric Eel',    3, 5, 3, { frost: 1 },                'serpent', { eyeC: '#4cc9f0' }, 'storm');
  A('Barnacle Brute',  4, 11, 3, { thorns: 2 },              'golem', { core: '#2e8ea0', mossy: 1 }, 'slate');
  A('Deep Siren',      4, 6, 3, { daze: 2 },                 'humanoid', { robe: 1, weapon: 'lute', skin: 'sea' }, 'sea');
  A('Deep One',        3, 7, 4, {},                          'humanoid', { skin: 'sea', weapon: 'trident' }, 'moss');
  A('Swordfish',       3, 5, 4, { swift: 1, pierce: 1 },     'fish', { fin: 1 }, 'frost');
  A("Man o' War",      2, 4, 2, { venom: 2, thorns: 1 },     'jelly', {}, 'rose');
  A('Abyssal Horror',  6, 13, 5, { daze: 1 },                'kraken', { eyeC: '#4cc9f0' }, 'shadow');
  A('Cannon Turtle',   5, 12, 3, { ranged: 1, splash: 1, armor: 1 },'cannon', {}, 'moss');
  A('Piranha Swarm',   2, 4, 2, { frenzy: 2 },               'fish', { teeth: 1 }, 'blood');
  A('Sunken Knight',   4, 10, 4, { armor: 1 },               'humanoid', { hat: 'helm', weapon: 'sword', shield: 1, skin: 'sea' }, 'sea');
  A('Moray Eel',       2, 5, 3, { sneak: 1 },                'serpent', {}, 'moss');
  A('Frost Leviathan', 6, 12, 5, { frost: 1 },               'dragon', { eyeC: '#4cc9f0' }, 'frost');
  A('Coral Golem',     5, 12, 4, { armor: 1, thorns: 1 },    'golem', { core: '#f090c0' }, 'rose');
  A('Pearl Diver',     2, 5, 2, { bounty: 2 },               'humanoid', { hat: 'bandana', weapon: 'dagger', skin: 'sea' }, 'sea');
  S('Bottled Message', 2, 3, { draw: 1, uses: 3 },           'potion', {}, 'sea');
  S('Sea Shanty',      3, 4, { rally: 1, uses: 5 },          'humanoid', { hat: 'bandana', weapon: 'lute', beard: 1 }, 'sea');
  S('Tide Pool',       2, 4, { heal: 2, uses: 4 },           'potion', {}, 'frost');
  S("Ship's Wheel",    3, 4, { buff: 2, uses: 5 },           'totem', { faces: 1 }, 'rust');
  S('Siren Song',      3, 4, { hexDaze: 2, uses: 3 },        'wisp', {}, 'sea');
  S('Whirlpool',       3, 4, { curse: 2, uses: 4 },          'portal', {}, 'sea');
  S('Kelp Forest',     3, 8, { wall: 1, regen: 1 },          'plant', {}, 'moss');
  S('Treasure Chest',  4, 4, { energy: 2, uses: 3 },         'crate', {}, 'gold');
  S('The Lighthouse',  3, 5, { cleanse: 1, buff: 1, uses: 4 },'crystal', {}, 'gold');
  S('Rum Barrel',      2, 4, { buff: 3, uses: 2 },           'crate', {}, 'rust');
  S('Ink Cloud',       2, 3, { hexDaze: 1, curse: 1, uses: 3 },'kraken', {}, 'shadow');
  S('Coral Ward',      2, 5, { shield: 2, uses: 4 },         'crystal', {}, 'rose');
  S('Storm Glass',     3, 4, { hexFrost: 1, uses: 4 },       'potion', {}, 'storm');
  S('Rain of Fish',    3, 4, { healAll: 1, uses: 4 },        'fish', { fin: 1 }, 'sea');
  S('Rusted Anchor',   3, 9, { wall: 1, armor: 1 },          'totem', { faces: 1 }, 'steel');
  S('Glowing Algae',   1, 3, { regen: 2, uses: 4 },          'wisp', {}, 'venom');
  S("Neptune's Idol",  4, 5, { energy: 1, heal: 1, uses: 5 },'totem', { eyeC: '#4cc9f0' }, 'sea');
  S('The Drowned Bell',4, 5, { bomb: 4, uses: 4, hexFrost: 1 },'cauldron', {}, 'sea');

  /* ============================================================
     PACK 10 — VOIDBORN
     ============================================================ */
  PACK('void', 'Voidborn', 'What waits between the stars got bored of waiting.', 'void', 'storm',
       { p: 'crate', o: {}, pal: 'storm' });
  A('Void Stalker',    3, 6, 4, { sneak: 1 },                'beast', { tailUp: 1, eyeC: '#4cc9f0' }, 'shadow');
  A('Star Devourer',   6, 13, 6, {},                         'dragon', { eyeC: '#4cc9f0' }, 'storm');
  A('Null Wraith',     4, 6, 4, { lifesteal: 1 },            'ghost', { eyeC: '#8a94ec' }, 'storm');
  A('Comet Rider',     4, 7, 4, { swift: 1, charge: 1 },     'wing', { tail3: 1 }, 'frost');
  A('Eclipse Serpent', 4, 9, 4, { daze: 1 },                 'serpent', { eyeC: '#4cc9f0' }, 'shadow');
  A('Astral Spider',   3, 6, 3, { venom: 2 },                'spider', { mark: 1, eyeC: '#4cc9f0' }, 'storm');
  A('Event Hound',     3, 7, 4, { swift: 1 },                'beast', { fangs: 1, eyeC: '#8a94ec' }, 'storm');
  A('Nebula Jelly',    2, 5, 2, { daze: 1 },                 'jelly', {}, 'violet');
  A('Meteor Golem',    5, 12, 4, { charge: 1, splash: 1 },   'golem', { core: '#4cc9f0' }, 'coal');
  A('Cosmic Horror',   6, 12, 5, { daze: 2 },                'kraken', { eyeC: '#8a94ec' }, 'violet');
  A('Voidwing',        2, 4, 3, { swift: 1 },                'wing', { bat: 1, eyeC: '#4cc9f0' }, 'storm');
  A('Gravity Fiend',   4, 8, 3, { frost: 1 },                'eyeball', { wings: 1 }, 'storm');
  A('Dark Matter Blob',4, 11, 3, { armor: 2 },               'slime', { core: '#4cc9f0' }, 'shadow');
  A('Star Reaper',     6, 10, 6, { execute: 1, sneak: 1 },   'humanoid', { hat: 'hood', robe: 1, weapon: 'scythe', eyeGlow: '#4cc9f0' }, 'storm');
  A('Moon Cultist',    2, 5, 3, {},                          'humanoid', { hat: 'hood', robe: 1, weapon: 'dagger' }, 'violet');
  A('Twin Paradox',    5, 8, 4, { double: 1 },               'humanoid', { wings: 1, skin: 'storm' }, 'storm');
  A('Entropy Beast',   5, 10, 4, { frenzy: 2 },              'beast', { spikes: 1, bulk: 1, eyeC: '#8a94ec' }, 'shadow');
  A('Void Archer',     4, 6, 4, { ranged: 1, sneak: 1 },     'humanoid', { hat: 'hood', weapon: 'bow', eyeGlow: '#4cc9f0' }, 'storm');
  A('The Singularity', 6, 9, 7, { execute: 1 },              'eyeball', { stalks: 1 }, 'shadow');
  A('Quasar Elemental',4, 8, 4, { burn: 2 },                 'flame', { face: 1 }, 'frost');
  A('Warp Imp',        1, 3, 2, { daze: 1 },                 'humanoid', { horns: 1, wings: 1, tail: 1, skin: 'storm' }, 'storm');
  A('Rift Mantis',     3, 6, 4, { diag: 1 },                 'spider', { eyeC: '#4cc9f0' }, 'venom');
  S('Star Chart',      2, 3, { draw: 1, uses: 4 },           'banner', {}, 'storm');
  S('Void Altar',      4, 5, { energy: 2, uses: 4 },         'crystal', {}, 'shadow');
  S('Event Horizon',   3, 4, { curse: 2, uses: 4 },          'portal', {}, 'shadow');
  S('Stasis Field',    3, 4, { hexFrost: 1, uses: 4 },       'crystal', {}, 'frost');
  S('Astral Beacon',   3, 4, { rally: 1, uses: 5 },          'wisp', {}, 'frost');
  S('Nebula Mist',     2, 3, { hexDaze: 1, uses: 4 },        'ghost', { eyeC: '#8a94ec' }, 'violet');
  S('Dark Ritual',     2, 2, { energy: 2, uses: 2 },         'portal', {}, 'blood');
  S('Wormhole',        3, 3, { draw: 1, energy: 1, uses: 3 },'portal', {}, 'storm');
  S('Cosmic Dust',     3, 4, { healAll: 1, uses: 4 },        'wisp', {}, 'violet');
  S('Void Shard',      2, 3, { buff: 2, uses: 4 },           'crystal', {}, 'storm');
  S('Zero Point',      4, 4, { hexFrost: 2, uses: 3 },       'star', {}, 'frost');
  S('Starlight Well',  2, 4, { heal: 2, uses: 5 },           'potion', {}, 'frost');
  S('Antimatter Vial', 3, 3, { bomb: 5, uses: 3 },           'potion', {}, 'storm');
  S('Orbital Ward',    2, 4, { shield: 2, uses: 4 },         'moon', {}, 'storm');
  S('Silent Monolith', 3, 10, { wall: 1 },                   'crystal', {}, 'shadow');
  S('Moon Prism',      2, 3, { regen: 2, uses: 4 },          'moon', {}, 'violet');
  S('Galaxy Seed',     4, 4, { energy: 1, heal: 1, uses: 5 },'star', {}, 'violet');
  S('The Riftgate',    4, 5, { draw: 1, uses: 5 },           'portal', {}, 'violet');

  /* ---------- art cache ---------- */
  const artCache = {};
  function artCanvas(card){
    if (!artCache[card.id]){
      const spec = Object.assign({}, card.art);
      const o = Object.assign({}, spec.o);
      if (typeof o.skin === 'string') o.skin = Sprites.PALS[o.skin] || undefined;
      spec.o = o;
      artCache[card.id] = Sprites.makeCanvas(spec, card.id + card.name);
    }
    return artCache[card.id];
  }

  /* ---------- starter collection: 40 randomized cards ---------- */
  function starterCollection(rng){
    rng = rng || Math.random;
    const pick = (list, n, out) => {
      for (let i = 0; i < n; i++) out.push(list[Math.floor(rng() * list.length)].id);
    };
    const grim = PACKS[0].cards;
    const atkPool = grim.filter(c => c.type === 'A' && c.cost <= 4);
    const supPool = grim.filter(c => c.type === 'S' && c.cost <= 4);
    const ids = [];
    pick(atkPool, 6, ids);            // guarantee playable attacks
    pick(supPool, 6, ids);            // guarantee playable supports
    pick(grim, 20, ids);              // bulk of the base set
    const others = all.filter(c => c.pack !== 'grim');
    pick(others, 8, ids);             // a taste of the wider world
    return ids;
  }

  const packByKey = {};
  PACKS.forEach(p => packByKey[p.key] = p);

  return { PACKS, packByKey, byId, all, describe, power, artCanvas, starterCollection };
})();
