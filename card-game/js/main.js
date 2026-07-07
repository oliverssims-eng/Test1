/* ============================================================
   GRIMVEIL — screens, profile, deck builder, card roulette.
   ============================================================ */
const Main = (() => {

  const SAVE_KEY = 'grimveil_save_v1';
  const PACK_COST = 100;
  let prof = null;

  /* ---------- profile ---------- */
  function newProfile(){
    const collection = Cards.starterCollection();
    const p = { tokens: 60, collection, starter: [], deck: [], stats: { wins: 0, losses: 0 } };
    autoBuildDecks(p);
    return p;
  }

  function autoBuildDecks(p){
    // pick the strongest playable starting 8 (4 attack + 4 support), rest becomes the 32
    const ids = p.collection.slice();
    const cards = ids.map(id => Cards.byId[id]).filter(Boolean);
    const atk = cards.filter(c => c.type === 'A').sort((a, b) => Cards.power(b) - Cards.power(a));
    const sup = cards.filter(c => c.type === 'S').sort((a, b) => Cards.power(b) - Cards.power(a));
    p.starter = atk.slice(0, 4).map(c => c.id).concat(sup.slice(0, 4).map(c => c.id));
    // main deck = 32 from what's left
    const used = {};
    p.starter.forEach(id => used[id] = (used[id] || 0) + 1);
    const rest = [];
    ids.forEach(id => {
      if (used[id] > 0){ used[id]--; return; }
      rest.push(id);
    });
    rest.sort((a, b) => Cards.power(Cards.byId[b]) - Cards.power(Cards.byId[a]));
    p.deck = rest.slice(0, 32);
  }

  function load(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw){
        const p = JSON.parse(raw);
        if (Array.isArray(p.collection) && p.collection.every(id => Cards.byId[id])){
          prof = p;
          prof.starter = (p.starter || []).filter(id => Cards.byId[id]);
          prof.deck = (p.deck || []).filter(id => Cards.byId[id]);
          if (!deckIsValid()) autoBuildDecks(prof);
          return;
        }
      }
    } catch(e){ /* corrupted save — start fresh */ }
    prof = newProfile();
    save();
  }
  function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(prof)); } catch(e){} }

  function deckIsValid(){
    const s = prof.starter.map(id => Cards.byId[id]);
    if (s.length !== 8) return false;
    if (s.filter(c => c.type === 'A').length !== 4) return false;
    if (s.filter(c => c.type === 'S').length !== 4) return false;
    if (prof.deck.length !== 32) return false;
    // everything must actually be owned
    const owned = {};
    prof.collection.forEach(id => owned[id] = (owned[id] || 0) + 1);
    for (const id of prof.starter.concat(prof.deck)){
      if (!owned[id]) return false;
      owned[id]--;
    }
    return true;
  }

  /* ---------- tiny dom helpers ---------- */
  function el(tag, cls, html){
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function clearApp(){
    UI.hideTooltip();
    const app = document.getElementById('app');
    app.innerHTML = '';
    return app;
  }
  function backBtn(fn){
    const b = el('button', 'btn small back-btn', '← BACK');
    b.onclick = fn;
    return b;
  }
  function tokenChip(){
    return el('div', 'hud-chip tokens', `⬤ ${prof.tokens} tokens`);
  }

  /* ============================================================
     MAIN MENU — Play / Exit
     ============================================================ */
  function showMenu(){
    const app = clearApp();
    const scr = el('div', 'screen');
    scr.style.justifyContent = 'center';
    scr.appendChild(el('h1', 'logo', 'GRIMVEIL'));
    scr.appendChild(el('div', 'tagline', 'a card game for gloomy evenings'));

    const col = el('div', 'menu-col');
    const play = el('button', 'btn', '▶ &nbsp;PLAY');
    play.onclick = showHub;
    const exit = el('button', 'btn danger', '✕ &nbsp;EXIT');
    exit.onclick = exitGame;
    col.appendChild(play); col.appendChild(exit);
    scr.appendChild(col);

    scr.appendChild(el('div', '', `<div style="position:absolute;bottom:18px;color:#5a4d78;font-size:17px;letter-spacing:2px">
      ${prof.stats.wins} victories · ${prof.stats.losses} defeats · ${prof.collection.length} cards collected</div>`));
    app.appendChild(scr);
  }

  function exitGame(){
    window.close();  // works when the game was opened by a script/shortcut
    setTimeout(() => {
      const ov = el('div', 'overlay');
      ov.appendChild(el('div', 'big', 'FAREWELL'));
      ov.appendChild(el('div', 'screen-sub', 'The candle is snuffed. Your browser kept the tab alive — close it to leave.'));
      const b = el('button', 'btn', 'RETURN');
      b.onclick = () => document.body.removeChild(ov);
      ov.appendChild(b);
      document.body.appendChild(ov);
    }, 250);
  }

  /* ============================================================
     HUB — customize deck / card roulette / battle
     ============================================================ */
  function showHub(){
    const app = clearApp();
    const scr = el('div', 'screen');
    scr.appendChild(backBtn(showMenu));

    const chips = el('div', '', '');
    chips.style.cssText = 'position:absolute;top:18px;right:18px;display:flex;gap:12px;';
    chips.appendChild(tokenChip());
    scr.appendChild(chips);

    scr.appendChild(el('div', 'screen-title', 'THE SANCTUM'));
    scr.appendChild(el('div', 'screen-sub', 'the table is waiting'));

    const row = el('div', 'hub-row');
    const entries = [
      { title: 'CUSTOMIZE DECK', desc: 'Choose your starting eight and shape your 40-card deck.',
        art: { p: 'banner', o: {}, pal: 'violet', bg: 'grim' }, fn: showBuilder, cls: '' },
      { title: 'CARD ROULETTE', desc: 'Spend tokens on themed card packs. 8 new cards per pack.',
        art: { p: 'crate', o: {}, pal: 'gold', bg: 'grim' }, fn: showRoulette, cls: 'blue' },
      { title: 'BATTLE', desc: 'Face the dark across the table. Win tokens. Try to keep your cards.',
        art: { p: 'humanoid', o: { hat: 'hood', robe: 1, weapon: 'scythe', eyeGlow: '#8b5cf6' }, pal: 'shadow', bg: 'grim' }, fn: showDifficulty, cls: '' },
    ];
    entries.forEach(en => {
      const c = el('div', 'hub-card ' + en.cls);
      c.appendChild(Sprites.makeCanvas(en.art, en.title));
      c.appendChild(el('div', 'h-title', en.title));
      c.appendChild(el('div', 'h-desc', en.desc));
      c.onclick = en.fn;
      row.appendChild(c);
    });
    scr.appendChild(row);

    const help = el('div', '', `<div style="margin-top:34px;color:#5a4d78;font-size:18px;letter-spacing:1px;text-align:center;max-width:900px;line-height:1.4">
      Every round you gain <span style="color:#4cc9f0">+2 ⚡ energy</span> to place cards — attackers on the front row, supports behind.
      When both sides end their turn, the cards fight. Hover any card to read its gimmick.
      Unopposed attackers burn cards off the enemy's deck, and an empty deck invites the dark in.
      Lose your last card and it's over.</div>`);
    scr.appendChild(help);
    app.appendChild(scr);
  }

  /* ============================================================
     DECK BUILDER
     ============================================================ */
  const builder = { tab: 'starter', typeFilter: 'ALL', packFilter: 'ALL' };

  function ownedCounts(){
    const m = {};
    prof.collection.forEach(id => m[id] = (m[id] || 0) + 1);
    return m;
  }
  function usedCounts(){
    const m = {};
    prof.starter.concat(prof.deck).forEach(id => m[id] = (m[id] || 0) + 1);
    return m;
  }

  function showBuilder(){
    const app = clearApp();
    const scr = el('div', 'screen');
    scr.appendChild(backBtn(showHub));
    scr.appendChild(el('div', 'screen-title', 'CUSTOMIZE DECK'));

    const tabs = el('div', 'builder-tabs');
    const t1 = el('button', 'tab-btn' + (builder.tab === 'starter' ? ' active' : ''), 'STARTING EIGHT (4 ⚔ + 4 ✦)');
    const t2 = el('button', 'tab-btn' + (builder.tab === 'main' ? ' active' : ''), 'MAIN DECK (32)');
    t1.onclick = () => { builder.tab = 'starter'; showBuilder(); };
    t2.onclick = () => { builder.tab = 'main'; showBuilder(); };
    tabs.appendChild(t1); tabs.appendChild(t2);
    scr.appendChild(tabs);

    /* status line */
    const s = prof.starter.map(id => Cards.byId[id]);
    const sa = s.filter(c => c.type === 'A').length, ss = s.filter(c => c.type === 'S').length;
    const ok = deckIsValid();
    const status = el('div', 'deck-status',
      `Starting eight: <span class="${sa === 4 && ss === 4 ? 'good' : 'bad'}">${sa}/4 ⚔ &nbsp;${ss}/4 ✦</span>
       &nbsp;·&nbsp; Main deck: <span class="${prof.deck.length === 32 ? 'good' : 'bad'}">${prof.deck.length}/32</span>
       &nbsp;·&nbsp; ${ok ? '<span class="good">READY FOR BATTLE</span>' : '<span class="bad">INCOMPLETE — will be auto-completed if you battle</span>'}`);
    scr.appendChild(status);

    const wrap = el('div', 'builder-wrap');

    /* ------ collection pane ------ */
    const colPane = el('div', 'collection-pane');
    const head = el('div', 'pane-title', `YOUR COLLECTION — click a card to add it`);
    colPane.appendChild(head);

    const filters = el('div', 'filter-row');
    ['ALL', '⚔ ATTACK', '✦ SUPPORT'].forEach((f, i) => {
      const key = ['ALL', 'A', 'S'][i];
      const b = el('button', 'tab-btn' + (builder.typeFilter === key ? ' active' : ''), f);
      b.style.fontSize = '17px';
      b.onclick = () => { builder.typeFilter = key; showBuilder(); };
      filters.appendChild(b);
    });
    const sel = document.createElement('select');
    sel.style.cssText = 'background:#140b22;color:#d8cfe8;border:2px solid #3a2364;font-family:inherit;font-size:17px;padding:4px 8px;';
    sel.innerHTML = `<option value="ALL">ALL PACKS</option>` +
      Cards.PACKS.map(p => `<option value="${p.key}" ${builder.packFilter === p.key ? 'selected' : ''}>${p.name.toUpperCase()}</option>`).join('');
    sel.onchange = () => { builder.packFilter = sel.value; showBuilder(); };
    filters.appendChild(sel);
    colPane.appendChild(filters);

    const owned = ownedCounts(), used = usedCounts();
    const grid = el('div', 'card-grid');
    const uniqueIds = Object.keys(owned).sort((a, b) => {
      const ca = Cards.byId[a], cb = Cards.byId[b];
      return ca.pack === cb.pack ? ca.cost - cb.cost : ca.pack.localeCompare(cb.pack);
    });
    uniqueIds.forEach(id => {
      const c = Cards.byId[id];
      if (builder.typeFilter !== 'ALL' && c.type !== builder.typeFilter) return;
      if (builder.packFilter !== 'ALL' && c.pack !== builder.packFilter) return;
      const avail = owned[id] - (used[id] || 0);
      const cardDom = UI.cardEl(c, { cls: 'pickable' + (avail <= 0 ? ' depleted' : '') });
      const badge = el('div', 'count-badge', 'x' + avail);
      cardDom.appendChild(badge);
      cardDom.onclick = () => addCard(id, avail);
      grid.appendChild(cardDom);
    });
    colPane.appendChild(grid);

    /* ------ deck pane ------ */
    const deckPane = el('div', 'deck-pane');
    if (builder.tab === 'starter'){
      deckPane.appendChild(el('div', 'pane-title', 'STARTING EIGHT — placed on the table at battle start (click to remove)'));
      const g = el('div', 'card-grid');
      prof.starter.forEach((id, i) => {
        const cardDom = UI.cardEl(Cards.byId[id], { cls: 'pickable picked' });
        cardDom.onclick = () => { prof.starter.splice(i, 1); save(); showBuilder(); };
        g.appendChild(cardDom);
      });
      deckPane.appendChild(g);
    } else {
      deckPane.appendChild(el('div', 'pane-title', 'MAIN DECK — your 32 draw cards (click to remove)'));
      const btnRow = el('div', 'filter-row');
      const auto = el('button', 'btn small', 'AUTO-FILL');
      auto.onclick = () => { autoFillMain(); save(); showBuilder(); };
      const clear = el('button', 'btn small danger', 'CLEAR');
      clear.onclick = () => { prof.deck = []; save(); showBuilder(); };
      btnRow.appendChild(auto); btnRow.appendChild(clear);
      deckPane.appendChild(btnRow);
      const g = el('div', 'card-grid');
      const agg = {};
      prof.deck.forEach(id => agg[id] = (agg[id] || 0) + 1);
      Object.keys(agg).forEach(id => {
        const cardDom = UI.cardEl(Cards.byId[id], { cls: 'pickable picked' });
        cardDom.appendChild(el('div', 'count-badge', 'x' + agg[id]));
        cardDom.onclick = () => { prof.deck.splice(prof.deck.indexOf(id), 1); save(); showBuilder(); };
        g.appendChild(cardDom);
      });
      deckPane.appendChild(g);
    }

    wrap.appendChild(colPane); wrap.appendChild(deckPane);
    scr.appendChild(wrap);
    app.appendChild(scr);
  }

  function addCard(id, avail){
    if (avail <= 0){ UI.toast('No copies left — every copy is already in your decks.'); return; }
    const c = Cards.byId[id];
    if (builder.tab === 'starter'){
      const s = prof.starter.map(x => Cards.byId[x]);
      const count = s.filter(x => x.type === c.type).length;
      if (count >= 4){ UI.toast(`Your starting eight already has 4 ${c.type === 'A' ? 'attack' : 'support'} cards.`); return; }
      prof.starter.push(id);
    } else {
      if (prof.deck.length >= 32){ UI.toast('Main deck is full (32). Remove something first.'); return; }
      prof.deck.push(id);
    }
    save(); showBuilder();
  }

  function autoFillMain(){
    const owned = ownedCounts(), used = usedCounts();
    const avail = [];
    Object.keys(owned).forEach(id => {
      for (let i = 0; i < owned[id] - (used[id] || 0); i++) avail.push(id);
    });
    avail.sort((a, b) => Cards.power(Cards.byId[b]) - Cards.power(Cards.byId[a]));
    while (prof.deck.length < 32 && avail.length) prof.deck.push(avail.shift());
  }

  function ensureBattleReady(){
    if (deckIsValid()) return true;
    autoBuildDecks(prof);
    save();
    UI.toast('Your deck was incomplete — it has been auto-completed.');
    return deckIsValid();
  }

  /* ============================================================
     CARD ROULETTE — packs
     ============================================================ */
  function showRoulette(){
    const app = clearApp();
    const scr = el('div', 'screen');
    scr.appendChild(backBtn(showHub));

    const chips = el('div', '');
    chips.style.cssText = 'position:absolute;top:18px;right:18px;';
    chips.appendChild(tokenChip());
    scr.appendChild(chips);

    scr.appendChild(el('div', 'screen-title', 'CARD ROULETTE'));
    scr.appendChild(el('div', 'screen-sub', `every pack holds 40 souls — ${PACK_COST} ⬤ buys you 8 of them, at random`));

    const row = el('div', 'pack-row');
    Cards.PACKS.forEach(p => {
      const crate = el('div', 'pack-crate');
      const art = Object.assign({}, p.crate, { bg: p.bg });
      crate.appendChild(Sprites.makeCanvas(art, 'crate-' + p.key));
      crate.appendChild(el('div', 'p-name', p.name));
      crate.appendChild(el('div', 'p-blurb', p.blurb));
      crate.appendChild(el('div', 'p-cost', `⬤ ${PACK_COST} tokens`));
      crate.onclick = () => buyPack(p);
      row.appendChild(crate);
    });
    scr.appendChild(row);
    app.appendChild(scr);
  }

  function buyPack(pack){
    if (prof.tokens < PACK_COST){
      UI.toast(`Not enough tokens — win battles to earn more. (You have ${prof.tokens}, need ${PACK_COST}.)`);
      return;
    }
    prof.tokens -= PACK_COST;
    const pulls = [];
    for (let i = 0; i < 8; i++) pulls.push(pack.cards[Math.floor(Math.random() * pack.cards.length)]);
    pulls.forEach(c => prof.collection.push(c.id));
    save();
    spinAnimation(pack, pulls);
  }

  function spinAnimation(pack, pulls){
    const app = clearApp();
    const scr = el('div', 'screen');
    scr.appendChild(el('div', 'screen-title', pack.name.toUpperCase()));
    scr.appendChild(el('div', 'screen-sub', 'the wheel turns…'));

    const wrapEl = el('div', 'roulette-strip-wrap');
    wrapEl.appendChild(el('div', 'roulette-marker'));
    const strip = el('div', 'roulette-strip');
    const stripCards = [];
    for (let i = 0; i < 34; i++) stripCards.push(pack.cards[Math.floor(Math.random() * pack.cards.length)]);
    stripCards[28] = pulls[0]; // the marker lands here
    stripCards.forEach(c => strip.appendChild(UI.cardEl(c, {})));
    wrapEl.appendChild(strip);
    scr.appendChild(wrapEl);
    app.appendChild(scr);

    // spin: 148px per card (136 + 12 gap); land card 28 under the centre marker
    const target = 28 * 148 - (820 / 2 - 68);
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';
    requestAnimationFrame(() => {
      strip.style.transition = 'transform 2.6s cubic-bezier(.12,.75,.18,1)';
      strip.style.transform = `translateX(${-target}px)`;
    });
    setTimeout(() => revealPulls(pack, pulls), 3100);
  }

  function revealPulls(pack, pulls){
    const app = clearApp();
    const scr = el('div', 'screen');
    scr.appendChild(el('div', 'screen-title', 'YOUR SPOILS'));
    scr.appendChild(el('div', 'screen-sub', `8 cards join your collection (${prof.collection.length} total) — click each to reveal`));

    const zone = el('div', 'reveal-zone');
    let unrevealed = pulls.length;
    pulls.forEach((c, i) => {
      const holder = el('div', 'flip-holder');
      holder.style.animationDelay = (i * .1) + 's';
      const back = el('div', 'face back');
      back.appendChild(el('div', 'card-back'));
      const front = el('div', 'face front');
      front.appendChild(UI.cardEl(c, {}));
      holder.appendChild(back); holder.appendChild(front);
      holder.onclick = () => {
        if (holder.classList.contains('flipped')) return;
        holder.classList.add('flipped');
        if (--unrevealed === 0) done.classList.remove('disabled');
      };
      // auto-reveal slowly if the player is patient
      setTimeout(() => holder.onclick(), 2600 + i * 420);
      zone.appendChild(holder);
    });
    scr.appendChild(zone);

    const col = el('div', 'menu-col');
    col.style.marginTop = '30px';
    const done = el('button', 'btn blue', 'SPIN AGAIN');
    done.onclick = showRoulette;
    const toDeck = el('button', 'btn', 'TO DECK BUILDER');
    toDeck.onclick = showBuilder;
    col.appendChild(done); col.appendChild(toDeck);
    scr.appendChild(col);
    app.appendChild(scr);
  }

  /* ============================================================
     DIFFICULTY SELECT
     ============================================================ */
  function showDifficulty(){
    const app = clearApp();
    const scr = el('div', 'screen');
    scr.appendChild(backBtn(showHub));
    scr.appendChild(el('div', 'screen-title', 'CHOOSE YOUR OPPONENT'));
    scr.appendChild(el('div', 'screen-sub', 'the dark takes many shapes'));

    const row = el('div', 'diff-row');
    Battle.DIFFS.forEach((d, i) => {
      const c = el('div', 'diff-card');
      c.dataset.d = i;
      c.appendChild(el('div', 'd-name', d.name));
      c.appendChild(el('div', 'd-desc', d.desc));
      c.appendChild(el('div', 'd-reward', `victory: +${d.reward} ⬤`));
      c.onclick = () => {
        if (!ensureBattleReady()){ UI.toast('Could not assemble a legal deck.'); return; }
        Battle.start(i);
      };
      row.appendChild(c);
    });
    scr.appendChild(row);
    app.appendChild(scr);
  }

  /* ============================================================
     ambient particles — drifting violet/blue embers
     ============================================================ */
  function startAmbient(){
    const cv = document.getElementById('fx');
    const ctx = cv.getContext('2d');
    let W, H;
    const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
    addEventListener('resize', resize); resize();
    const P = [];
    for (let i = 0; i < 70; i++){
      P.push({
        x: Math.random() * 2000, y: Math.random() * 1200,
        r: .6 + Math.random() * 1.8,
        vy: -(.08 + Math.random() * .3), vx: (Math.random() - .5) * .12,
        c: Math.random() < .6 ? '139,92,246' : '76,201,240',
        ph: Math.random() * Math.PI * 2,
      });
    }
    (function tick(t){
      ctx.clearRect(0, 0, W, H);
      for (const p of P){
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10){ p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        const a = .12 + .22 * (0.5 + 0.5 * Math.sin(t * .001 + p.ph));
        ctx.fillStyle = `rgba(${p.c},${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(${p.c},${a * .25})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, 7); ctx.fill();
      }
      requestAnimationFrame(tick);
    })(0);
  }

  /* ---------- boot ---------- */
  function init(){
    load();
    startAmbient();
    showMenu();
  }
  document.addEventListener('DOMContentLoaded', init);

  return { profile: () => prof, save, showHub, showMenu, showBuilder, showRoulette, showDifficulty };
})();
