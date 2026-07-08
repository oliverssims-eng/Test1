/* Shinobi Protocol — main.js
   Scene, baseplate, enemy spawn plates, chest, HUD, loadout menu, game loop. */
(function () {
  'use strict';
  const S = window.S, U = S.U, FX = S.FX, C = S.combat, E = S.Enemies;

  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb2c4);
  scene.fog = new THREE.Fog(0xa8b8c4, 34, 110);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 300);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------------- lights ---------------- */
  scene.add(new THREE.HemisphereLight(0xd8e2ee, 0x5a5545, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.05);
  sun.position.set(20, 32, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  /* ---------------- baseplate ---------------- */
  function plateTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#7d8577';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(40,44,38,.35)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,.05)';
    g.strokeRect(6, 6, 244, 244);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(23, 23);
    return t;
  }
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(92, 92),
    new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // rim so the edge of the world reads
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(92, 1.4, 92),
    new THREE.MeshStandardMaterial({ color: 0x565e52, roughness: 1 })
  );
  rim.position.y = -0.72;
  scene.add(rim);

  /* ---------------- FX / combat init ---------------- */
  FX.init(scene);
  C.initProjectiles(scene);

  /* ---------------- HUD ---------------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    php: $('php'), ghost: $('php-ghost'), posture: $('posture'), postureWrap: $('posture-wrap'),
    msg: $('msg'), submsg: $('submsg'), toast: $('toast'), peril: $('peril'),
    interact: $('interact'), death: $('death'), start: $('start'), menu: $('menu'),
    powname: $('powname'),
    abs: { r: $('ab-r'), t: $('ab-t'), c: $('ab-c'), g: $('ab-g') },
    bossbar: $('bossbar'), bossname: $('bossname'), bhp: $('bhp'), bpost: $('bpost'),
  };
  const dmgFlash = document.createElement('div');
  dmgFlash.style.cssText = 'position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 120px rgba(200,20,10,.85);opacity:0;transition:opacity .5s;';
  document.getElementById('hud').appendChild(dmgFlash);

  let msgT = 0, toastT = 0;
  const hud = (S.hud = {
    msg(text, sub, dur) {
      el.msg.textContent = text; el.msg.style.opacity = 1;
      el.submsg.textContent = sub || ''; el.submsg.style.opacity = sub ? 1 : 0;
      msgT = dur || 2.6;
    },
    toast(text) {
      el.toast.textContent = text; el.toast.style.opacity = 1;
      toastT = 2.2;
    },
    peril() {
      S.sfx.play('peril');
      el.peril.classList.remove('show');
      void el.peril.offsetWidth;
      el.peril.classList.add('show');
    },
    damageFlash() {
      dmgFlash.style.transition = 'none';
      dmgFlash.style.opacity = 1;
      requestAnimationFrame(() => { dmgFlash.style.transition = 'opacity .5s'; dmgFlash.style.opacity = 0; });
    },
    playerDied() {
      setTimeout(() => { el.death.classList.add('show'); el.death.style.display = 'block'; }, 900);
    },
    refreshAbilities(player) {
      const kit = S.powers.kits[player.power];
      el.powname.textContent = kit.name;
      el.powname.style.color = kit.color;
      for (const k of ['r', 't', 'c', 'g']) {
        const ab = kit.abilities[k];
        el.abs[k].querySelector('.ic').textContent = ab.icon;
        el.abs[k].querySelector('.nm').textContent = ab.name;
      }
    },
  });

  /* ---------------- player & world ---------------- */
  const player = new S.Player(scene, camera);
  const enemies = [];
  S.world = { scene, camera, player, enemies };
  C.actors.push(player);
  hud.refreshAbilities(player);

  /* ---------------- spawn plates ---------------- */
  function makeLabel(text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '700 34px "Segoe UI", Arial';
    g.textAlign = 'center';
    g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.8)';
    g.strokeText(text, 128, 44);
    g.fillStyle = color;
    g.fillText(text, 128, 44);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sp.scale.set(3, 0.75, 1);
    return sp;
  }

  const plates = [];
  function addPlate(x, z, color, label, spawnFn, opts) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.5, 0.1, 26),
      new THREE.MeshStandardMaterial({ color: 0x3a3f3a, roughness: 0.8 })
    );
    base.position.y = 0.05;
    base.receiveShadow = true;
    g.add(base);
    const btnMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.35 });
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.12, 26), btnMat);
    btn.position.y = 0.14;
    btn.castShadow = true;
    g.add(btn);
    const lab = makeLabel(label, '#' + new THREE.Color(color).getHexString());
    lab.position.y = 1.7;
    g.add(lab);
    scene.add(g);
    plates.push(Object.assign({ g, btn, btnMat, cd: 0, spawnFn, label, pressed: 0 }, opts || {}));
  }

  addPlate(-9, 9, 0x7ec850, 'ZOMBIE', (p) => E.spawnZombie(scene, p));
  addPlate(0, 13, 0x4f9fe8, 'SWORDSMAN', (p) => E.spawnSwordsman(scene, p));
  addPlate(9, 9, 0xd8452e, 'OGRE', (p) => E.spawnOgre(scene, p));
  addPlate(0, 20, 0xd8b545, 'BOSS', (p) => E.spawnBoss(scene, p), { boss: true });

  function updatePlates(dt) {
    for (const pl of plates) {
      pl.cd = Math.max(0, pl.cd - dt);
      pl.pressed = Math.max(0, pl.pressed - dt * 3);
      pl.btn.position.y = 0.14 - 0.07 * Math.min(1, pl.pressed);
      pl.btnMat.emissiveIntensity = pl.cd > 0 ? 0.08 : 0.35 + 0.15 * Math.sin(perfT * 3);
      if (pl.cd <= 0 && player.alive && U.distXZ(player.pos, pl.g.position) < 1.35 && player.pos.y < 0.4) {
        if (pl.boss && enemies.some((e) => e.alive && e.cfg.boss)) {
          hud.toast('THE LANCER ALREADY HUNTS YOU');
          pl.cd = 1.5;
          continue;
        }
        if (enemies.filter((e) => e.alive).length >= 8) {
          hud.toast('THE ARENA IS FULL');
          pl.cd = 1.2;
          continue;
        }
        pl.cd = pl.boss ? 4 : 2.5;
        pl.pressed = 1;
        S.sfx.play('step');
        // spawn away from the plate, toward the middle
        const dir = new THREE.Vector3(-pl.g.position.x, 0, -pl.g.position.z).normalize();
        const pos = pl.g.position.clone().addScaledVector(dir, pl.boss ? 7 : 4.5);
        pos.x += U.rand(-1.5, 1.5); pos.z += U.rand(-1.5, 1.5);
        const en = pl.spawnFn(pos);
        enemies.push(en);
        C.actors.push(en);
        if (pl.boss) hud.msg('THE VEILED LANCER', 'deflect the arrows — dodge the skewer', 3.5);
        else hud.toast(en.name + ' HAS APPEARED');
      }
    }
  }

  /* ---------------- chest ---------------- */
  const chest = (() => {
    const g = new THREE.Group();
    g.position.set(0, 0, -11);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xa8862e, roughness: 0.4, metalness: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.8), wood);
    base.position.y = 0.28; base.castShadow = true;
    g.add(base);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.55, -0.4);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.8), wood);
    lid.position.set(0, 0.11, 0.4); lid.castShadow = true;
    lidPivot.add(lid);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.06), trim);
    clasp.position.set(0, 0.08, 0.82);
    lidPivot.add(clasp);
    g.add(lidPivot);
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.08, 0.84), trim);
    band1.position.y = 0.3;
    g.add(band1);
    scene.add(g);
    return { g, lidPivot, open: false, rearmT: 0 };
  })();

  function updateChest(dt) {
    chest.rearmT = Math.max(0, chest.rearmT - dt);
    if (chest.open && chest.rearmT <= 0) chest.open = false;
    const target = chest.open ? -1.9 : 0;
    chest.lidPivot.rotation.x = U.dampTo(chest.lidPivot.rotation.x, target, 6, dt);

    const near = player.alive && U.distXZ(player.pos, chest.g.position) < 2.3;
    if (near && !chest.open) {
      el.interact.textContent = 'E — OPEN CHEST';
      el.interact.style.display = 'block';
      if (S.input.consume('e') && player.playInteract()) {
        chest.open = true;
        chest.rearmT = 25;
        S.sfx.play('chest');
        setTimeout(() => {
          S.sfx.play('heal');
          player.hp = player.hpMax;
          player.posture = 0;
          FX.spark(chest.g.position.clone().setY(0.8), 30, 0xffd76a, { speed: 5, up: 6, gravity: 8 });
          hud.toast('VITALITY RESTORED');
        }, 450);
      }
    } else {
      el.interact.style.display = 'none';
    }
  }

  /* ---------------- loadout menu ---------------- */
  let menuOpen = false;
  let started = false;

  function buildMenu() {
    const wrow = $('weapon-row');
    for (const [id, w] of Object.entries(S.WEAPONS)) {
      const card = document.createElement('div');
      card.className = 'card' + (player.weaponType === id ? ' sel' : '');
      card.dataset.w = id;
      card.innerHTML = `<div class="t"><span class="em">${w.em}</span>${w.name}</div><div class="d">${w.desc}</div>`;
      card.onclick = () => {
        player.setWeapon(id);
        wrow.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.w === id));
        S.sfx.play('clash');
      };
      wrow.appendChild(card);
    }
    const prow = $('power-row');
    for (const id of S.powers.list) {
      const kit = S.powers.kits[id];
      const card = document.createElement('div');
      card.className = 'card' + (player.power === id ? ' sel' : '');
      card.dataset.p = id;
      const abils = ['r', 't', 'c', 'g']
        .map((k) => `<b>${k.toUpperCase()}</b> ${kit.abilities[k].name} — ${kit.abilities[k].desc}`)
        .join('<br>');
      card.innerHTML = `<div class="t"><span class="em">${kit.em}</span>${kit.name}</div><div class="d">${kit.desc}<br><br>${abils}</div>`;
      card.style.width = '260px';
      card.onclick = () => {
        player.setPower(id);
        hud.refreshAbilities(player);
        prow.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.p === id));
        S.sfx.play('heal');
      };
      prow.appendChild(card);
    }
    const orow = $('opt-row');
    const slCard = document.createElement('div');
    slCard.className = 'card' + (S.settings.shiftLock ? ' sel' : '');
    const slBody = () =>
      `<div class="t"><span class="em">🎯</span>Shift Lock — ${S.settings.shiftLock ? 'ON' : 'OFF'}</div>` +
      '<div class="d">Camera-locked strafing. Your character always faces where the camera looks; ' +
      'A/D sidestep instead of turning. The camera sits over the shoulder.</div>';
    slCard.innerHTML = slBody();
    slCard.onclick = () => {
      S.settings.shiftLock = !S.settings.shiftLock;
      slCard.classList.toggle('sel', S.settings.shiftLock);
      slCard.innerHTML = slBody();
      S.sfx.play('clash');
    };
    orow.appendChild(slCard);

    $('menu-close').onclick = closeMenu;
  }

  function openMenu() {
    menuOpen = true;
    el.menu.style.display = 'block';
    document.exitPointerLock && document.exitPointerLock();
  }
  function closeMenu() {
    menuOpen = false;
    el.menu.style.display = 'none';
    lock();
  }

  buildMenu();

  /* ---------------- pointer lock ---------------- */
  function lock() {
    S.sfx.ensure();
    canvas.requestPointerLock && canvas.requestPointerLock();
  }
  document.addEventListener('pointerlockchange', () => {
    S.input.locked = document.pointerLockElement === canvas;
    if (!S.input.locked && started && !menuOpen && player.alive) {
      el.start.style.display = 'flex';
      el.start.querySelector('.click').textContent = '— CLICK TO RESUME —';
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (S.input.locked) {
      S.input.mouse.dx += e.movementX;
      S.input.mouse.dy += e.movementY;
    }
  });

  el.start.addEventListener('click', () => {
    started = true;
    el.start.style.display = 'none';
    lock();
    if (!el.start.dataset.done) {
      el.start.dataset.done = '1';
      hud.msg('SHINOBI PROTOCOL', 'step on a plate to summon a foe · M for loadout', 4);
    }
  });

  el.death.addEventListener('click', () => {
    el.death.classList.remove('show');
    el.death.style.display = 'none';
    player.respawn(new THREE.Vector3(0, 0, 0));
    lock();
  });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'm' && started) {
      if (menuOpen) closeMenu();
      else openMenu();
    }
    if (k === 'escape' && menuOpen) closeMenu();
  });

  /* ---------------- soft body separation ---------------- */
  function separate() {
    const all = [player, ...enemies.filter((e) => e.alive)];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const min = (a.radius || 0.5) + (b.radius || 0.5);
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          a.pos.x -= nx * push; a.pos.z -= nz * push;
          b.pos.x += nx * push; b.pos.z += nz * push;
        }
      }
    }
  }

  /* ---------------- HUD sync ---------------- */
  function syncHud(dt) {
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) { el.msg.style.opacity = 0; el.submsg.style.opacity = 0; } }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) el.toast.style.opacity = 0; }
    el.php.style.width = (100 * U.clamp(player.hp / player.hpMax, 0, 1)) + '%';
    el.ghost.style.width = (100 * U.clamp(player.hpGhost / player.hpMax, 0, 1)) + '%';
    el.posture.style.width = (100 * U.clamp(player.posture / player.postureMax, 0, 1)) + '%';
    el.postureWrap.classList.toggle('hot', player.posture > player.postureMax * 0.65);
    for (const k of ['r', 't', 'c', 'g']) {
      const cd = player.cds[k];
      el.abs[k].classList.toggle('oncd', cd > 0);
      if (cd > 0) el.abs[k].querySelector('.cd').textContent = Math.ceil(cd);
    }
    // boss bar
    const boss = enemies.find((e) => e.cfg.boss && e.alive);
    if (boss) {
      el.bossbar.style.display = 'block';
      el.bossname.textContent = boss.name;
      el.bhp.style.width = (100 * U.clamp(boss.hp / boss.hpMax, 0, 1)) + '%';
      el.bpost.style.width = (100 * U.clamp(boss.posture / boss.postureMax, 0, 1)) + '%';
      el.bossbar.classList.toggle('vuln', boss.vulnerable);
    } else {
      el.bossbar.style.display = 'none';
    }
  }

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  let perfT = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const realDt = U.clamp((now - last) / 1000, 0, 0.05);
    last = now;
    perfT += realDt;
    const paused = menuOpen || !started;
    const dt = paused ? 0 : FX.scaleTime(realDt);

    if (dt > 0) {
      player.update(dt, paused);
      for (const e of enemies) e.update(dt);
      // purge finished corpses
      for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].gone) {
          const idx = C.actors.indexOf(enemies[i]);
          if (idx >= 0) C.actors.splice(idx, 1);
          enemies.splice(i, 1);
        }
      }
      separate();
      updatePlates(dt);
      updateChest(dt);
      S.powers.update(dt);
      C.updateProjectiles(dt);
      E.updateDebris(dt);
      FX.update(dt);
      syncHud(realDt);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
