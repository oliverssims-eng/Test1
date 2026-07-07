/* ============================================================
   GRIMVEIL — battle engine + battle screen.
   A round = both players take a turn, then the cards fight.
   ============================================================ */

/* ---------- shared UI helpers (cards, tooltip, floating text) ---------- */
const UI = (() => {
  const tooltip = () => document.getElementById('tooltip');

  function statLine(c){
    return `<span class="stat-hp"><span class="hrt">♥</span>${c.hp}</span>` +
      (c.type === 'A' ? `&nbsp; <span class="stat-dmg"><span class="skl">☠</span>${c.dmg}</span>` : '');
  }

  function showTooltip(card, x, y, live){
    const t = tooltip();
    const pack = Cards.packByKey[card.pack];
    const hp = live ? `${live.hp}/${live.maxHp}` : card.hp;
    const dmg = card.type === 'A' ? (live ? live.card.dmg + live.frenzy + (live.tempAtk || 0) : card.dmg) : null;
    t.innerHTML =
      `<div class="t-name">${card.name}</div>` +
      `<div class="t-meta">${card.type === 'A' ? 'ATTACK' : 'SUPPORT'} · costs ${card.cost} energy</div>` +
      `<div class="t-stats"><span class="stat-hp"><span class="hrt">♥</span>${hp}</span>` +
      (dmg !== null ? ` &nbsp;<span class="stat-dmg"><span class="skl">☠</span>${dmg}</span>` : '') +
      (live && live.usesLeft !== null && live.usesLeft !== undefined ? ` &nbsp;<span style="color:#e8b64c">◈ ${live.usesLeft} uses left</span>` : '') +
      `</div>` +
      `<div class="t-desc">${card.desc}</div>` +
      `<div class="t-pack">❖ ${pack ? pack.name : ''}</div>`;
    t.classList.remove('hidden');
    positionTooltip(x, y);
  }
  function positionTooltip(x, y){
    const t = tooltip();
    const r = t.getBoundingClientRect();
    let tx = x + 18, ty = y + 14;
    if (tx + r.width > innerWidth - 8) tx = x - r.width - 14;
    if (ty + r.height > innerHeight - 8) ty = innerHeight - r.height - 8;
    t.style.left = tx + 'px'; t.style.top = ty + 'px';
  }
  function hideTooltip(){ tooltip().classList.add('hidden'); }

  const STATUS_ICONS = { poison: '☣', burn: '🔥', frost: '❄', daze: '💫', regen: '✚', curse: '⇣' };
  const STATUS_COLORS = { poison: '#a8e063', burn: '#ff9040', frost: '#7ad8ff', daze: '#f0a0ff', regen: '#6de89a', curse: '#c0b0d0' };

  /* Build a card DOM element. live = battle unit (optional). */
  function cardEl(card, opts){
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'card ' + (card.type === 'A' ? 'attack' : 'support') + (opts.cls ? ' ' + opts.cls : '');
    const live = opts.live;
    const hp = live ? live.hp : card.hp;
    const dmg = live ? card.dmg + live.frenzy + (live.tempAtk || 0) : card.dmg;
    el.innerHTML =
      `<div class="c-cost">${card.cost}</div>` +
      `<div class="c-name">${card.name}</div>` +
      `<div class="c-art"></div>` +
      `<div class="c-stats">` +
        `<span class="stat-hp"><span class="hrt">♥</span>${hp}</span>` +
        (card.type === 'A' ? `<span class="stat-dmg"><span class="skl">☠</span>${dmg}</span>` : `<span style="color:#6aa8c7;font-size:15px">✦</span>`) +
      `</div>` +
      `<div class="c-type">${card.type === 'A' ? '— ATTACK —' : '— SUPPORT —'}</div>`;
    const artBox = el.querySelector('.c-art');
    const src = Cards.artCanvas(card);
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    artBox.appendChild(cv);
    if (live){
      // status icons
      const st = document.createElement('div'); st.className = 'c-status';
      for (const k in STATUS_ICONS){
        if (live.status[k]) st.innerHTML += `<span style="color:${STATUS_COLORS[k]}">${STATUS_ICONS[k]}</span>`;
      }
      el.appendChild(st);
      if (live.shield > 0){ const s = document.createElement('div'); s.className = 'c-shield'; s.textContent = live.shield; el.appendChild(s); }
      if (card.traits.charge){ const cdiv = document.createElement('div'); cdiv.className = 'c-charge'; cdiv.textContent = `${Math.min(live.chargeCtr, card.traits.charge)}/${card.traits.charge}`; cdiv.style.fontSize = '12px'; el.appendChild(cdiv); }
      if (live.usesLeft !== null && live.usesLeft !== undefined){ const u = document.createElement('div'); u.className = 'count-badge'; u.style.borderColor = '#e8b64c'; u.textContent = live.usesLeft; el.appendChild(u); }
      if (hp < card.hp * 0.4) el.style.filter = 'saturate(.7) brightness(.85)';
    }
    el.addEventListener('mousemove', e => { showTooltip(card, e.clientX, e.clientY, live); });
    el.addEventListener('mouseleave', hideTooltip);
    return el;
  }

  function floatText(el, text, color){
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'float-num';
    d.textContent = text;
    d.style.color = color || '#fff';
    d.style.left = (r.left + r.width / 2 - 20 + (Math.random() * 24 - 12)) + 'px';
    d.style.top = (r.top + r.height / 3) + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }

  function banner(text){
    const b = document.createElement('div');
    b.className = 'banner'; b.textContent = text;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1500);
  }

  function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  return { cardEl, showTooltip, hideTooltip, floatText, banner, toast, sleep, statLine };
})();

/* ============================================================ */
const Battle = (() => {

  const DIFFS = [
    { name: 'FLICKER',   desc: 'A gentle haunting. The enemy plays clumsy, weak cards.', reward: 40,  bias: 'weak',   bonus: 0, laziness: .3 },
    { name: 'GLOOM',     desc: 'A fair duel in the dark. The enemy plays honestly.',     reward: 70,  bias: 'any',    bonus: 0, laziness: .08 },
    { name: 'DREAD',     desc: 'The dark plays favorites. Stronger cards, +1 enemy energy per round.', reward: 120, bias: 'strong', bonus: 1, laziness: 0 },
    { name: 'NIGHTMARE', desc: 'You should not have come. Elite cards, +2 enemy energy per round.',    reward: 200, bias: 'elite',  bonus: 2, laziness: 0 },
  ];

  let B = null;          // battle state
  let uidSeq = 1;

  /* ---------- unit ---------- */
  function makeUnit(card, side, row, col){
    return {
      uid: uidSeq++, card, side, row, col,
      hp: card.hp, maxHp: card.hp,
      shield: 0, chargeCtr: 0, frenzy: 0, tempAtk: 0, tempCurse: 0,
      usesLeft: card.type === 'S' && card.traits.uses ? card.traits.uses : null,
      status: {},   // poison:{n,t} burn:{n,t} frost:{t} daze:{t} regen:{n,t} curse:{n,t}
      dead: false,
    };
  }

  /* ---------- deck helpers ---------- */
  function shuffle(a){
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildAIDeck(diff){
    const ranked = Cards.all.slice().sort((a, b) => Cards.power(a) - Cards.power(b));
    const n = ranked.length;
    let pool;
    if (diff.bias === 'weak')   pool = ranked.slice(0, Math.floor(n * .6));
    else if (diff.bias === 'strong') pool = ranked.slice(Math.floor(n * .4));
    else if (diff.bias === 'elite')  pool = ranked.slice(Math.floor(n * .65));
    else pool = ranked;
    const atk = shuffle(pool.filter(c => c.type === 'A'));
    const sup = shuffle(pool.filter(c => c.type === 'S'));
    // starting 8: playable early cards
    const cheapA = atk.filter(c => c.cost <= 4), cheapS = sup.filter(c => c.cost <= 4);
    const start8A = (cheapA.length >= 4 ? cheapA : atk).slice(0, 4);
    const start8S = (cheapS.length >= 4 ? cheapS : sup).slice(0, 4);
    const rest = [];
    for (let i = 0; i < 18; i++) rest.push(atk[(4 + i) % atk.length]);
    for (let i = 0; i < 14; i++) rest.push(sup[(4 + i) % sup.length]);
    return { start8A, start8S, deck: shuffle(rest) };
  }

  function makeSide(isAI, start8A, start8S, deckCards){
    const side = {
      isAI, energy: 4, deck: deckCards.slice(), hand: [],
      front: [null, null, null, null], back: [null, null, null, null],
      extraDraw: 0, fatigue: 0,
    };
    start8A.forEach((c, i) => side.front[i] = makeUnit(c, side, 'front', i));
    start8S.forEach((c, i) => side.back[i] = makeUnit(c, side, 'back', i));
    for (let i = 0; i < 4; i++) if (side.deck.length) side.hand.push(side.deck.pop());
    return side;
  }

  /* ---------- start a battle ---------- */
  function start(diffIndex){
    const diff = DIFFS[diffIndex];
    const prof = Main.profile();
    const s8A = prof.starter.filter(id => Cards.byId[id].type === 'A').map(id => Cards.byId[id]);
    const s8S = prof.starter.filter(id => Cards.byId[id].type === 'S').map(id => Cards.byId[id]);
    const main32 = shuffle(prof.deck.map(id => Cards.byId[id]));

    const ai = buildAIDeck(diff);
    B = {
      diff, diffIndex, round: 1, phase: 'place', selected: -1, busy: false,
      player: makeSide(false, s8A, s8S, main32),
      enemy:  makeSide(true, ai.start8A, ai.start8S, ai.deck),
    };
    render();
    UI.banner('ROUND 1');
  }

  /* ---------- rendering ---------- */
  function el(tag, cls, html){
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function unitDomId(u){ return 'u-' + u.uid; }

  function slotEl(side, row, col){
    const s = el('div', `slot ${row === 'front' ? 'attack-slot' : 'support-slot'}${side.isAI ? ' enemy' : ''}`);
    s.dataset.row = row; s.dataset.col = col;
    const u = side[row][col];
    if (u){
      const c = UI.cardEl(u.card, { live: u });
      c.id = unitDomId(u);
      s.appendChild(c);
    } else if (!side.isAI && B.phase === 'place' && B.selected >= 0){
      const sel = B.player.hand[B.selected];
      if (sel && ((sel.type === 'A' && row === 'front') || (sel.type === 'S' && row === 'back'))){
        s.classList.add('can-drop');
        s.onclick = () => placeSelected(row, col);
      }
    }
    return s;
  }

  function render(){
    const app = document.getElementById('app');
    app.innerHTML = '';
    const scr = el('div', 'screen');

    /* top HUD */
    const top = el('div', 'battle-hud-top');
    top.appendChild(el('div', 'hud-chip', `<span class="ico">👁</span> ${B.diff.name}`));
    top.appendChild(el('div', 'hud-chip energy', `⚡ enemy ${B.enemy.energy}`));
    top.appendChild(el('div', 'hud-chip', `🂠 enemy hand ${B.enemy.hand.length}`));
    scr.appendChild(top);

    /* table + side decks */
    const wrap = el('div', 'battle-wrap');

    const pDeck = el('div', 'deck-pile');
    pDeck.innerHTML = `<div class="lbl">YOUR DECK</div>`;
    const pPile = el('div', 'pile');
    for (let i = 0; i < Math.min(4, Math.max(1, B.player.deck.length)); i++){
      const cb = el('div', 'card-back'); cb.style.left = (i * 2) + 'px'; cb.style.top = (-i * 2) + 'px';
      if (!B.player.deck.length) cb.style.opacity = .15;
      pPile.appendChild(cb);
    }
    pDeck.appendChild(pPile);
    pDeck.appendChild(el('div', 'count', `${B.player.deck.length} <span style="color:#8a7ba8;font-size:17px">cards left</span>`));

    const eDeck = el('div', 'deck-pile');
    eDeck.innerHTML = `<div class="lbl">ENEMY DECK</div>`;
    const ePile = el('div', 'pile');
    for (let i = 0; i < Math.min(4, Math.max(1, B.enemy.deck.length)); i++){
      const cb = el('div', 'card-back'); cb.style.left = (i * 2) + 'px'; cb.style.top = (-i * 2) + 'px';
      if (!B.enemy.deck.length) cb.style.opacity = .15;
      ePile.appendChild(cb);
    }
    eDeck.appendChild(ePile);
    eDeck.appendChild(el('div', 'count', `${B.enemy.deck.length} <span style="color:#8a7ba8;font-size:17px">cards left</span>`));

    const table = el('div', 'table');
    const rows = [
      ['enemy', 'back'], ['enemy', 'front'], null, ['player', 'front'], ['player', 'back'],
    ];
    rows.forEach(spec => {
      if (!spec){ table.appendChild(el('div', 'battle-line')); return; }
      const [who, row] = spec;
      const r = el('div', 'row');
      const side = who === 'enemy' ? B.enemy : B.player;
      for (let c = 0; c < 4; c++) r.appendChild(slotEl(side, row, c));
      table.appendChild(r);
    });

    wrap.appendChild(pDeck); wrap.appendChild(table); wrap.appendChild(eDeck);
    scr.appendChild(wrap);
    // scale the table so all four rows always fit between the HUD and the hand
    requestAnimationFrame(() => {
      const availH = wrap.clientHeight, availW = wrap.clientWidth - 400;
      const s = Math.min(1, availH / table.offsetHeight, availW / table.offsetWidth);
      if (s < 1) table.style.transform = `scale(${s})`;
    });

    /* hand */
    const hand = el('div', 'hand-zone');
    B.player.hand.forEach((c, i) => {
      const cardDom = UI.cardEl(c, { cls: 'in-hand' + (i === B.selected ? ' selected' : '') + (c.cost > B.player.energy ? ' unaffordable' : '') });
      cardDom.onclick = () => {
        if (B.phase !== 'place' || B.busy) return;
        if (c.cost > B.player.energy){ UI.toast('Not enough energy — you gain 2 each round.'); return; }
        B.selected = (B.selected === i ? -1 : i);
        render();
      };
      hand.appendChild(cardDom);
    });
    if (!B.player.hand.length) hand.appendChild(el('div', '', '<span style="color:#8a7ba8">— your hand is empty —</span>'));
    scr.appendChild(hand);

    /* left + right HUD */
    const left = el('div', 'battle-hud-left');
    left.appendChild(el('div', 'round-label', `ROUND ${B.round}`));
    const concede = el('button', 'btn small danger', 'CONCEDE');
    concede.onclick = () => { if (!B.busy) finish(false, true); };
    left.appendChild(concede);
    scr.appendChild(left);

    const right = el('div', 'battle-hud-bottom');
    const orb = el('div', 'energy-orb', `⚡${B.player.energy}`);
    orb.title = 'Your energy — +2 every round';
    right.appendChild(orb);
    const endBtn = el('button', 'btn' + (B.busy ? ' disabled' : ''), 'END TURN');
    endBtn.onclick = () => { if (!B.busy && B.phase === 'place') endTurn(); };
    right.appendChild(endBtn);
    scr.appendChild(right);

    app.appendChild(scr);
  }

  /* ---------- placement ---------- */
  function placeSelected(row, col){
    const c = B.player.hand[B.selected];
    if (!c || B.phase !== 'place') return;
    if (c.cost > B.player.energy) return;
    if (B.player[row][col]) return;
    B.player.energy -= c.cost;
    B.player.hand.splice(B.selected, 1);
    B.selected = -1;
    B.player[row][col] = makeUnit(c, B.player, row, col);
    render();
  }

  /* ---------- AI turn ---------- */
  function aiPlace(){
    const s = B.enemy;
    let guard = 20;
    while (guard-- > 0){
      if (Math.random() < B.diff.laziness) break;
      const empties = [];
      for (let c = 0; c < 4; c++){
        if (!s.front[c]) empties.push(['front', c]);
        if (!s.back[c]) empties.push(['back', c]);
      }
      if (!empties.length) break;
      // pick best affordable hand card that has a legal slot
      const options = s.hand
        .map((card, i) => ({ card, i, q: Cards.power(card) }))
        .filter(o => o.card.cost <= s.energy)
        .filter(o => empties.some(([r]) => (o.card.type === 'A' ? r === 'front' : r === 'back')))
        .sort((a, b) => b.q - a.q);
      if (!options.length) break;
      const pick = options[0];
      const legal = empties.filter(([r]) => (pick.card.type === 'A' ? r === 'front' : r === 'back'));
      // prefer lanes opposite the player's biggest threat
      legal.sort((a, b) => laneThreat(b[1]) - laneThreat(a[1]));
      const [row, col] = legal[0];
      s.energy -= pick.card.cost;
      s.hand.splice(pick.i, 1);
      s[row][col] = makeUnit(pick.card, s, row, col);
    }
  }
  function laneThreat(col){
    const u = B.player.front[col];
    return u ? u.card.dmg + u.frenzy : 0;
  }

  /* ---------- combat resolution ---------- */
  const other = side => side === B.player ? B.enemy : B.player;

  function unitsOf(side){
    return side.front.concat(side.back).filter(u => u && !u.dead);
  }

  function dom(u){ return document.getElementById(unitDomId(u)); }

  function applyStatus(u, kind, n){
    if (!u || u.dead) return;
    if (kind === 'poison') u.status.poison = { n: Math.max(n, u.status.poison ? u.status.poison.n : 0), t: 3 };
    if (kind === 'burn')   u.status.burn   = { n: Math.max(n, u.status.burn ? u.status.burn.n : 0), t: 2 };
    if (kind === 'frost')  u.status.frost  = { t: Math.max(n, u.status.frost ? u.status.frost.t : 0) };
    if (kind === 'daze')   u.status.daze   = { t: Math.max(n, u.status.daze ? u.status.daze.t : 0) };
    if (kind === 'regen')  u.status.regen  = { n, t: 3 };
    if (kind === 'curse')  u.status.curse  = { n, t: 2 };
    UI.floatText(dom(u), { poison: '☣', burn: '🔥', frost: '❄ FROZEN', daze: '💫 DAZED', regen: '✚', curse: '⇣' }[kind],
      { poison: '#a8e063', burn: '#ff9040', frost: '#7ad8ff', daze: '#f0a0ff', regen: '#6de89a', curse: '#c0b0d0' }[kind]);
  }

  /* damage a unit; returns actual damage dealt */
  function hurt(u, amount, opts){
    opts = opts || {};
    if (!u || u.dead || amount <= 0) return 0;
    let dmg = amount;
    if (!opts.sneak){
      const armor = u.card.traits.armor || 0;
      if (armor) dmg = Math.max(1, dmg - armor);
      if (u.shield > 0){
        const absorbed = Math.min(u.shield, dmg);
        u.shield -= absorbed; dmg -= absorbed;
        if (absorbed) UI.floatText(dom(u), `⛨-${absorbed}`, '#8fa2ff');
      }
    }
    if (dmg <= 0) return 0;
    u.hp -= dmg;
    const d = dom(u);
    if (d){ d.classList.remove('anim-hit'); void d.offsetWidth; d.classList.add('anim-hit'); }
    UI.floatText(d, `-${dmg}`, opts.color || '#ff6b81');
    if (u.hp <= 0) kill(u, opts.by);
    return dmg;
  }

  function heal(u, n){
    if (!u || u.dead || n <= 0) return false;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + n);
    if (u.hp > before){ UI.floatText(dom(u), `+${u.hp - before}`, '#6de89a'); return true; }
    return false;
  }

  function kill(u, killer){
    if (u.dead) return;
    u.dead = true;
    const t = u.card.traits;
    if (t.avenge && killer && !killer.dead){
      UI.floatText(dom(u), '☠ VENGEANCE', '#e0455f');
      hurt(killer, t.avenge, { color: '#e0455f' });
    }
    if (t.bomb) detonate(u);
    if (killer && killer.card.traits.bounty && !killer.dead){
      killer.side.energy += killer.card.traits.bounty;
      UI.floatText(dom(killer), `+${killer.card.traits.bounty}⚡`, '#4cc9f0');
    }
    const d = dom(u);
    if (d) d.classList.add('anim-fade');
    // clear from board shortly after so the fade is visible
    u.side[u.row][u.col] = null;
  }

  function detonate(u){
    const foe = other(u.side);
    UI.floatText(dom(u), '💥 BOOM', '#ffc04a');
    unitsOf(foe).forEach(t => hurt(t, u.card.traits.bomb, { color: '#ffc04a' }));
  }

  /* pick attack targets for attacker in lane col */
  function pickTargets(att){
    const foe = other(att.side);
    const t = att.card.traits;
    const col = att.col;
    const F = c => (c >= 0 && c < 4) ? foe.front[c] : null;
    const K = c => (c >= 0 && c < 4) ? foe.back[c] : null;
    const targets = [];
    let main = null;
    if (t.ranged) main = K(col) || F(col);
    else main = F(col) || K(col);
    if (!main){
      // nothing in lane — seek the nearest occupied lane
      for (let d = 1; d < 4 && !main; d++){
        main = F(col - d) || F(col + d) || (t.ranged ? (K(col - d) || K(col + d)) : null);
      }
      if (!main){ const any = unitsOf(foe); main = any.length ? any[Math.floor(Math.random() * any.length)] : null; }
    }
    if (!main) return targets;
    targets.push({ u: main, mult: 1 });
    if (t.pierce){
      const second = (main === F(col)) ? K(col) : (main === K(col) ? F(col) : null);
      if (second) targets.push({ u: second, mult: 1 });
    }
    if (t.diag){
      [F(col - 1), F(col + 1)].forEach(x => { if (x && x !== main) targets.push({ u: x, mult: .5 }); });
    }
    if (t.splash){
      [F(main.col - 1), F(main.col + 1)].forEach(x => {
        if (x && x !== main && main.row === 'front') targets.push({ u: x, mult: .5 });
      });
    }
    return targets;
  }

  function attackerDamage(att){
    const t = att.card.traits;
    let dmg = att.card.dmg + att.frenzy + att.tempAtk;
    if (att.status.curse) dmg = Math.max(0, dmg - att.status.curse.n);
    if (t.charge) dmg = dmg * (t.charge + 1);
    return dmg;
  }

  async function doAttack(att){
    if (att.dead || att.row !== 'front') return;
    const t = att.card.traits;
    if (att.status.frost){ UI.floatText(dom(att), '❄ frozen', '#7ad8ff'); return; }
    // charging?
    if (t.charge && att.chargeCtr < t.charge){
      att.chargeCtr++;
      UI.floatText(dom(att), `charging ${att.chargeCtr}/${t.charge}…`, '#ffd67a');
      return;
    }
    // dazed?
    if (att.status.daze){
      const roll = Math.random();
      if (roll < .35){ UI.floatText(dom(att), '💫 fumbles!', '#f0a0ff'); return; }
      if (roll < .6){
        const allies = unitsOf(att.side).filter(x => x !== att);
        if (allies.length){
          const v = allies[Math.floor(Math.random() * allies.length)];
          UI.floatText(dom(att), '💫 confused!', '#f0a0ff');
          hurt(v, Math.max(1, Math.floor(attackerDamage(att) / 2)), { by: att });
          return;
        }
      }
    }
    const targets = pickTargets(att);
    if (!targets.length){
      // nobody left to fight — tear into the enemy's reserves instead
      const foe = other(att.side);
      if (foe.deck.length){
        foe.deck.pop();
        const d0 = dom(att);
        if (d0) d0.classList.add(att.side === B.player ? 'anim-lunge-up' : 'anim-lunge-down');
        UI.floatText(d0, '🂠 burns a card!', '#e8b64c');
      }
      return;
    }
    const d = dom(att);
    if (d){ d.classList.add(att.side === B.player ? 'anim-lunge-up' : 'anim-lunge-down'); }
    await UI.sleep(150);
    const strikes = t.double ? 2 : 1;
    const dmgBase = attackerDamage(att);
    for (let s = 0; s < strikes; s++){
      for (const { u: tgt, mult } of targets){
        if (tgt.dead || att.dead) continue;
        const dealt = hurt(tgt, Math.max(1, Math.round(dmgBase * mult)), { sneak: !!t.sneak, by: att });
        if (dealt > 0 && !tgt.dead){
          if (t.venom) applyStatus(tgt, 'poison', t.venom);
          if (t.burn) applyStatus(tgt, 'burn', t.burn);
          if (t.frost) applyStatus(tgt, 'frost', t.frost);
          if (t.daze) applyStatus(tgt, 'daze', t.daze);
          if (t.execute && tgt.hp > 0 && tgt.hp < tgt.maxHp * .3){
            UI.floatText(dom(tgt), '☠ EXECUTED', '#e0455f');
            kill(tgt, att);
          }
        }
        // thorns (melee only)
        if (!t.ranged && !tgt.dead && tgt.card.traits.thorns) hurt(att, tgt.card.traits.thorns, { color: '#c0e060', by: tgt });
        if (t.lifesteal && dealt > 0) heal(att, dealt);
      }
    }
    if (t.charge) att.chargeCtr = 0;
  }

  /* one support unit takes its action; returns true if it spent a use */
  function doSupport(sup){
    if (sup.dead || sup.card.type !== 'S') return false;
    if (sup.status.frost){ UI.floatText(dom(sup), '❄ frozen', '#7ad8ff'); return false; }
    const t = sup.card.traits, side = sup.side, foe = other(side);
    let used = false;
    const allies = unitsOf(side);
    const front = side.front[sup.col];

    if (t.heal){
      const wounded = allies.filter(a => a.hp < a.maxHp).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (wounded && heal(wounded, t.heal)) used = true;
    }
    if (t.healAll){
      let any = false;
      allies.forEach(a => { if (heal(a, t.healAll)) any = true; });
      if (any) used = true;
    }
    if (t.shield){
      const tgt = front || sup;
      tgt.shield = Math.min(9, tgt.shield + t.shield);
      UI.floatText(dom(tgt), `⛨+${t.shield}`, '#8fa2ff'); used = true;
    }
    if (t.buff && front){ front.tempAtk += t.buff; UI.floatText(dom(front), `☠+${t.buff}`, '#fff'); used = true; }
    if (t.rally){
      side.front.forEach(u => { if (u && !u.dead){ u.tempAtk += t.rally; } });
      UI.floatText(dom(sup), `☠+${t.rally} ALL`, '#fff'); used = true;
    }
    const hexTarget = () => {
      const enemies = unitsOf(foe);
      if (!enemies.length) return null;
      return foe.front[sup.col] || foe.back[sup.col] || enemies[Math.floor(Math.random() * enemies.length)];
    };
    if (t.hexPoison){ const v = hexTarget(); if (v){ applyStatus(v, 'poison', t.hexPoison); used = true; } }
    if (t.hexBurn){ const v = hexTarget(); if (v){ applyStatus(v, 'burn', t.hexBurn); used = true; } }
    if (t.hexFrost){ const v = hexTarget(); if (v){ applyStatus(v, 'frost', t.hexFrost); used = true; } }
    if (t.hexDaze){ const v = hexTarget(); if (v){ applyStatus(v, 'daze', t.hexDaze); used = true; } }
    if (t.curse){ const v = foe.front[sup.col] || null; if (v){ applyStatus(v, 'curse', t.curse); used = true; } }
    if (t.cleanse){
      let any = false;
      allies.forEach(a => {
        if (a.status.poison || a.status.burn || a.status.frost || a.status.daze || a.status.curse){
          delete a.status.poison; delete a.status.burn; delete a.status.frost; delete a.status.daze; delete a.status.curse;
          UI.floatText(dom(a), '✨ cleansed', '#fff'); any = true;
        }
      });
      if (any) used = true;
    }
    if (t.energy){ side.energy += t.energy; UI.floatText(dom(sup), `+${t.energy}⚡`, '#4cc9f0'); used = true; }
    if (t.draw){ side.extraDraw += 1; UI.floatText(dom(sup), '+1 card', '#e8b64c'); used = true; }
    if (t.regen && front){ applyStatus(front, 'regen', t.regen); used = true; }

    if (used){
      const d = dom(sup);
      if (d) d.classList.add('anim-support');
      if (sup.usesLeft !== null){
        sup.usesLeft--;
        if (sup.usesLeft <= 0){
          UI.floatText(dom(sup), 'purpose served…', '#c9bfe0');
          if (t.bomb) detonate(sup);
          sup.dead = true;
          const d2 = dom(sup);
          if (d2) d2.classList.add('anim-fade');
          side[sup.row][sup.col] = null;
        }
      }
    }
    return used;
  }

  function tickStatuses(side){
    unitsOf(side).forEach(u => {
      const s = u.status;
      if (s.poison){ hurt(u, s.poison.n, { color: '#a8e063', sneak: true }); if (--s.poison.t <= 0) delete s.poison; }
      if (u.dead) return;
      if (s.burn){ hurt(u, s.burn.n, { color: '#ff9040', sneak: true }); if (--s.burn.t <= 0) delete s.burn; }
      if (u.dead) return;
      if (s.regen){ heal(u, s.regen.n); if (--s.regen.t <= 0) delete s.regen; }
      if (s.frost && --s.frost.t <= 0) delete s.frost;
      if (s.daze && --s.daze.t <= 0) delete s.daze;
      if (s.curse && --s.curse.t <= 0) delete s.curse;
    });
  }

  function drawUp(side){
    const cap = 4 + Math.min(1, side.extraDraw);
    let extra = side.extraDraw;
    side.extraDraw = 0;
    while (side.hand.length < cap && side.deck.length){
      side.hand.push(side.deck.pop());
      if (extra > 0) extra--;
    }
  }

  function sideDefeated(side){
    return unitsOf(side).length === 0 && side.hand.length === 0 && side.deck.length === 0;
  }
  function sideOutOfCards(side){
    return unitsOf(side).length === 0 && side.hand.length === 0 && side.deck.length === 0;
  }

  /* ---------- turn / round flow ---------- */
  async function endTurn(){
    if (B.busy) return;
    B.busy = true; B.selected = -1; B.phase = 'resolving';
    render();
    UI.hideTooltip();

    // enemy takes its turn
    await UI.sleep(420);
    aiPlace();
    render();
    await UI.sleep(520);

    // === THE CARDS FIGHT ===
    // 1) supports act (player first, then enemy)
    for (const side of [B.player, B.enemy]){
      for (const u of side.back.slice()){
        if (u && !u.dead && u.card.type === 'S'){
          if (doSupport(u)) await UI.sleep(240);
        }
      }
    }
    render(); await UI.sleep(220);

    // 2) swift strikes first
    const swifts = [], normals = [];
    for (let c = 0; c < 4; c++){
      [B.player.front[c], B.enemy.front[c]].forEach(u => {
        if (u && !u.dead && u.card.type === 'A') (u.card.traits.swift ? swifts : normals).push(u);
      });
    }
    for (const u of swifts){ if (!u.dead){ await doAttack(u); await UI.sleep(300); } }
    if (swifts.length){ render(); await UI.sleep(180); }

    // 3) everyone else
    for (const u of normals){ if (!u.dead){ await doAttack(u); await UI.sleep(300); } }
    render(); await UI.sleep(200);

    // 4) lingering effects tick
    tickStatuses(B.player); tickStatuses(B.enemy);

    // 4b) fatigue — an empty deck invites the dark in, so games always end
    let fatigueShown = false;
    for (const side of [B.player, B.enemy]){
      if (side.deck.length === 0){
        side.fatigue++;
        if (!fatigueShown && side.fatigue === 1){ UI.banner('THE DARK CLOSES IN'); fatigueShown = true; }
        unitsOf(side).forEach(u => {
          UI.floatText(dom(u), `☾-${side.fatigue}`, '#8b5cf6');
          hurt(u, side.fatigue, { sneak: true, color: '#8b5cf6' });
        });
      }
    }
    render(); await UI.sleep(260);

    // 5) survivors grow: frenzy stacks; temp buffs wear off
    [B.player, B.enemy].forEach(side => unitsOf(side).forEach(u => {
      if (u.card.traits.frenzy) u.frenzy += u.card.traits.frenzy;
      u.tempAtk = 0;
    }));

    // 6) fallen cards are replaced from the deck
    drawUp(B.player); drawUp(B.enemy);

    // 7) win / lose?
    const pDead = sideOutOfCards(B.player), eDead = sideOutOfCards(B.enemy);
    if (pDead || eDead){ finish(eDead && !pDead, false); return; }

    // next round
    B.round++;
    B.player.energy = Math.min(15, B.player.energy + 2);
    B.enemy.energy = Math.min(15, B.enemy.energy + 2 + B.diff.bonus);
    B.phase = 'place'; B.busy = false;
    render();
    UI.banner('ROUND ' + B.round);
  }

  /* ---------- battle end ---------- */
  function finish(playerWon, conceded){
    B.busy = true; B.phase = 'over';
    const prof = Main.profile();
    let reward = 0;
    if (playerWon){ reward = B.diff.reward; }
    else { reward = conceded ? 0 : 15; }
    prof.tokens += reward;
    prof.stats = prof.stats || { wins: 0, losses: 0 };
    playerWon ? prof.stats.wins++ : prof.stats.losses++;
    Main.save();

    const ov = el('div', 'overlay');
    ov.appendChild(el('div', 'big ' + (playerWon ? 'win' : 'lose'), playerWon ? 'VICTORY' : 'DEFEAT'));
    ov.appendChild(el('div', 'screen-sub', playerWon
      ? 'The dark recedes… for now.'
      : (conceded ? 'You fold your cards and back away from the table.' : 'You have no more cards to place.')));
    if (reward) ov.appendChild(el('div', 'reward', `+${reward} ⬤ tokens ${playerWon ? '' : '(consolation)'}`));
    const row = el('div', 'menu-col');
    const again = el('button', 'btn', 'REMATCH');
    again.onclick = () => { document.body.removeChild(ov); start(B.diffIndex); };
    const back = el('button', 'btn blue', 'RETURN TO SANCTUM');
    back.onclick = () => { document.body.removeChild(ov); Main.showHub(); };
    row.appendChild(again); row.appendChild(back);
    ov.appendChild(row);
    document.body.appendChild(ov);
  }

  return { start, DIFFS };
})();
