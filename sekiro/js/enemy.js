/* Shinobi Protocol — enemy.js
   Zombie (limbs come off, can't block), Swordsman (katana/greatsword/spear,
   guards and deflects), Ogre (huge, parry his fists or eat the floor). */
(function () {
  'use strict';
  const S = window.S, U = S.U, FX = S.FX, C = S.combat, Rig = S.Rig, CL = S.clips;
  const E = (S.Enemies = {});

  const GRAV = 24;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  /* ---------------- severed limb debris ---------------- */
  const debris = [];
  E.updateDebris = function (dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.t += dt;
      d.vel.y -= GRAV * 0.8 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      d.obj.rotation.x += d.ang.x * dt;
      d.obj.rotation.y += d.ang.y * dt;
      d.obj.rotation.z += d.ang.z * dt;
      if (d.obj.position.y < 0.12) {
        d.obj.position.y = 0.12;
        d.vel.y *= -0.3;
        d.vel.x *= 0.6; d.vel.z *= 0.6;
        d.ang.multiplyScalar(0.5);
      }
      if (d.t > 5) {
        d.obj.position.y -= dt * 0.35; // sink into the plate
        if (d.t > 6.2) {
          d.obj.parent && d.obj.parent.remove(d.obj);
          debris.splice(i, 1);
        }
      }
    }
  };

  /* ---------------- floating status bar ---------------- */
  class Bar {
    constructor(parentGroup, height, width) {
      this.c = document.createElement('canvas');
      this.c.width = 128; this.c.height = 30;
      this.tex = new THREE.CanvasTexture(this.c);
      const m = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false });
      this.sp = new THREE.Sprite(m);
      this.sp.scale.set(width || 1.25, 0.29, 1);
      this.sp.position.y = height;
      parentGroup.add(this.sp);
      this.lastKey = '';
    }
    set(hp, hpMax, po, poMax, vulnerable) {
      const key = `${Math.round(hp)}|${Math.round(po)}|${vulnerable}`;
      if (key === this.lastKey) return;
      this.lastKey = key;
      const g = this.c.getContext('2d');
      g.clearRect(0, 0, 128, 30);
      g.fillStyle = 'rgba(0,0,0,.62)';
      g.fillRect(0, 0, 128, 13);
      g.fillRect(0, 17, 128, 9);
      g.fillStyle = '#b6412c';
      g.fillRect(2, 2, 124 * U.clamp(hp / hpMax, 0, 1), 9);
      g.fillStyle = vulnerable ? '#ff5522' : '#e0a91e';
      const w = 124 * U.clamp(po / poMax, 0, 1);
      g.fillRect(64 - w / 2, 19, w, 5);
      this.tex.needsUpdate = true;
    }
    remove() { this.sp.parent && this.sp.parent.remove(this.sp); }
  }

  /* ---------------- base enemy ---------------- */
  class Enemy {
    constructor(scene, pos, cfg) {
      this.scene = scene;
      this.cfg = cfg;
      this.team = 'enemy';
      this.name = cfg.name;
      this.radius = cfg.radius || 0.5;

      this.rig = cfg.buildRig();
      this.rig.group.position.copy(pos);
      this.rig.group.position.y = 0;
      scene.add(this.rig.group);
      this.pos = this.rig.group.position;
      this.vel = new THREE.Vector3();
      this.yaw = U.rand(-Math.PI, Math.PI);
      this.rig.group.rotation.y = this.yaw;

      this.anim = new S.Animator(this.rig);
      this.anim.loco.style = cfg.style || 'normal';
      this.anim.onEvent = (n, d) => this.onAnimEvent(n, d);
      if (cfg.stance) this.anim.stance = cfg.stance;
      this.anim.snap();

      this.hpMax = cfg.hp; this.hp = cfg.hp;
      this.postureMax = cfg.posture; this.posture = 0;
      this.postureHitT = 0;
      this.vulnerable = false;
      this.alive = true;
      this.gone = false;

      this.guarding = false;
      this.parryT = 0;
      this.iframes = 0;

      this.state = 'spawn';
      this.spawnT = 0.8;
      this.stateT = 0;
      this.attackCD = U.rand(0.5, 1.4);
      this.thinkT = 0;
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;

      this.attackActive = false;
      this.hitSet = null;
      this.curAtk = null;
      this.deathT = 0;

      this.status = { slow: 0, freeze: 0, stun: 0 };

      this.bar = cfg.noBar ? null : new Bar(this.rig.group, (this.rig.height || 1.8) + 0.35, cfg.barWidth);

      // rise from the ground
      this.pos.y = -(this.rig.height || 1.8) * 0.9;
      this.iframes = 0.8;
      S.sfx.play('spawn');
      FX.dust(new THREE.Vector3(pos.x, 0.1, pos.z), 6);
    }

    get player() { return S.world.player; }
    chestPos() { return tmp2.set(this.pos.x, this.pos.y + (this.cfg.chestH || 1.25), this.pos.z).clone(); }

    /* ---------- combat interface ---------- */
    addPosture(n) {
      if (!this.alive) return;
      this.posture = Math.min(this.postureMax, this.posture + n);
      this.postureHitT = 1.4;
      if (this.posture >= this.postureMax && this.state !== 'stagger') this.breakPosture();
    }

    breakPosture() {
      this.state = 'stagger';
      this.stateT = this.cfg.staggerDur;
      this.vulnerable = true;
      this.guarding = false; this.parryT = 0;
      this.anim.overlay = null;
      this.attackActive = false;
      this.anim.play(CL.postureBreak, { speed: this.cfg.big ? 0.62 : 0.95 });
      S.sfx.play('stagger');
      FX.number(this.chestPos(), 'BREAK', '#ff7733');
      if (S.hud) S.hud.toast(this.name + ' — POSTURE BROKEN');
    }

    takeDamage(dmg, attacker, atk) {
      if (!this.alive) return;
      this.hp -= dmg;
      this.postureHitT = 1.4;
      if (this.cfg.onDamaged) this.cfg.onDamaged(this, dmg, atk);
      if (this.hp <= 0) { this.die(); return; }
      const busy = this.state === 'attack' && this.cfg.hyperarmor;
      if (!busy && this.state !== 'stagger' && Math.random() < (this.cfg.flinchChance !== undefined ? this.cfg.flinchChance : 0.8)) {
        this.attackActive = false;
        if (this.state === 'attack') this.state = 'combat';
        this.anim.play(CL.flinch);
      }
    }

    onParrySuccess(attacker, point) { /* enemy deflected the player */ }
    onDeflected(defender) {
      // our swing was deflected — the whole body whips back for a beat
      this.attackActive = false;
      this.comboQueue = 0;
      this.state = 'combat';
      this.attackCD = Math.max(this.attackCD, U.rand(0.8, 1.4));
      this.anim.play(CL.deflectBig, { speed: this.cfg.big ? 0.65 : 1.05 });
      // physically shoved off the clash
      if (defender && defender.pos) {
        tmp.subVectors(this.pos, defender.pos).setY(0).normalize();
        this.applyKnockback(tmp, 3.5);
      }
      FX.flare(this.chestPos(), 0xfff0c0, 1.2, 0.15);
      // parried mid-combo with posture running hot — visibly rattled longer
      if (this.posture > this.postureMax * 0.6) this.attackCD += 0.5;
    }
    onBlocked() { /* player blocked us — attack continues */ }
    onBlockedHit() { this.anim.play(CL.blockHit); }

    applyKnockback(dir, p) {
      const w = this.cfg.mass || 1;
      this.vel.x += (dir.x * p) / w;
      this.vel.z += (dir.z * p) / w;
    }
    applyStatus(name, dur) {
      if (this.status[name] !== undefined) this.status[name] = Math.max(this.status[name], dur);
      if (name === 'freeze') {
        FX.spark(this.chestPos(), 12, 0x9fe0ff, { speed: 4 });
        FX.shards(this.chestPos(), 0xcfeeff, 5, { speed: 4, size: 0.8 });
        // encase in a crystal shell
        if (!this._ice) {
          const h = this.rig.height || 1.8;
          const w = (this.radius || 0.5) * 2 + 0.35;
          this._ice = new THREE.Mesh(
            new THREE.BoxGeometry(w, h * 1.02, w),
            new THREE.MeshStandardMaterial({ color: 0xaadfff, transparent: true, opacity: 0.42, roughness: 0.12, metalness: 0.1 })
          );
          this._ice.position.y = h * 0.51;
          this.rig.group.add(this._ice);
        }
      }
    }

    thawIce() {
      if (!this._ice) return;
      const p = this.chestPos();
      FX.shards(p, 0xcfeeff, 9, { speed: 6, size: 1 });
      FX.spark(p, 14, 0xdff4ff, { speed: 5 });
      S.sfx.play('ice');
      this.rig.group.remove(this._ice);
      this._ice.geometry.dispose();
      this._ice.material.dispose();
      this._ice = null;
    }

    die() {
      this.alive = false;
      this.state = 'dead';
      this.hp = 0;
      this.attackActive = false;
      this.guarding = false;
      this.anim.overlay = null;
      this.deathT = 3.2;
      this.thawIce();
      this.anim.play(CL.death, { speed: this.cfg.big ? 0.75 : 1 });
      S.sfx.play(this.cfg.big ? 'roar' : 'hitBig');
      FX.deathBurst(this.chestPos(), 0xdd3322);
      if (this.bar) this.bar.remove();
      if (this.cfg.onDeath) this.cfg.onDeath(this);
      if (S.hud) S.hud.toast(this.name + ' — DEFEATED');
    }

    /* ---------- anim events ---------- */
    onAnimEvent(name, data) {
      switch (name) {
        case 'hitOn':
          if (!this.alive) break;
          this.attackActive = true;
          this.hitSet = new Set();
          this.activeData = data || {};
          break;
        case 'hitOff': this.attackActive = false; break;
        case 'move':
          if (!this.alive) break;
          tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          this.vel.x += tmp.x * data.f;
          this.vel.z += tmp.z * data.f;
          break;
        case 'sfx': S.sfx.play(data); break;
        case 'shake': FX.shake(data); break;
        case 'peril': if (S.hud) S.hud.peril(); break;
        case 'glint': {
          // the read cue: a cold flash on the weapon just before the strike lands
          let p;
          if (this.rig.weapon) {
            p = new THREE.Vector3();
            this.rig.weapon.tip.getWorldPosition(p);
          } else {
            p = this.chestPos();
            p.x += Math.sin(this.yaw) * 0.9;
            p.z += Math.cos(this.yaw) * 0.9;
          }
          FX.flare(p, 0xeef2ff, 1.0, 0.16);
          S.sfx.play('clash');
          break;
        }
        case 'slamFx': {
          tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const p = this.pos.clone().addScaledVector(tmp, 2.2);
          p.y = 0.05;
          FX.slam(p, 0xbbaa77);
          break;
        }
        case 'end': this.onClipEnd(data); break;
        default:
          if (this.cfg.onEvent) this.cfg.onEvent(this, name, data);
      }
    }

    onClipEnd(clipName) {
      if (!this.alive) return;
      if (this.state === 'attack') {
        this.attackActive = false;
        if (this.comboQueue > 0 && this.nextCombo) {
          this.comboQueue--;
          const nxt = this.nextCombo();
          if (nxt) { this.startAttackClip(nxt); return; }
        }
        this.state = 'combat';
        this.attackCD = U.rand(this.cfg.cdMin, this.cfg.cdMax);
      }
    }

    startAttackClip(a) {
      this.state = 'attack';
      this.curAtk = a;
      this.attackActive = false;
      // heavy telegraphed windups for enemies — stretched once, then cached
      if (!a._c) a._c = a.wind ? S.slowWindup(CL[a.clip], a.wind) : CL[a.clip];
      this.anim.play(a._c, { speed: a.speed || 1 });
    }

    /* ---------- shared update ---------- */
    update(dt) {
      if (this.gone) return;
      const p = this.player;

      // dead: play out, sink, flag for removal
      if (!this.alive) {
        this.deathT -= dt;
        this.vel.x = U.dampTo(this.vel.x, 0, 6, dt);
        this.vel.z = U.dampTo(this.vel.z, 0, 6, dt);
        this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
        if (this.deathT < 1.2) this.pos.y -= dt * 1.5;
        this.anim.update(dt);
        if (this.deathT <= 0) {
          this.scene.remove(this.rig.group);
          this.gone = true;
        }
        return;
      }

      // timers
      this.iframes = Math.max(0, this.iframes - dt);
      this.parryT = Math.max(0, this.parryT - dt);
      this.postureHitT = Math.max(0, this.postureHitT - dt);
      this.attackCD = Math.max(0, this.attackCD - dt);
      for (const k in this.status) this.status[k] = Math.max(0, this.status[k] - dt);

      if (this.postureHitT <= 0 && this.state !== 'stagger') {
        // low health = slower posture recovery, like the real thing
        const regen = (this.cfg.postureRegen || 9) * (0.4 + 0.6 * (this.hp / this.hpMax));
        this.posture = Math.max(0, this.posture - regen * dt);
      }

      // spawn rise
      if (this.state === 'spawn') {
        this.spawnT -= dt;
        this.pos.y = Math.min(0, this.pos.y + dt * ((this.rig.height || 1.8) * 1.4));
        FX.dust(new THREE.Vector3(this.pos.x, 0.1, this.pos.z), 1);
        if (this.spawnT <= 0) { this.pos.y = 0; this.state = 'combat'; }
        this.anim.update(dt);
        if (this.bar) this.bar.set(this.hp, this.hpMax, this.posture, this.postureMax, this.vulnerable);
        return;
      }

      const frozen = this.status.freeze > 0 || this.status.stun > 0;
      const speedMul = (this.status.slow > 0 ? 0.45 : 1) * (frozen ? 0 : 1);
      if (this.status.freeze > 0 && Math.random() < 0.15) {
        FX.puff(this.chestPos(), 1, 0x9fe0ff, { size: 0.35, grow: 1, life: 0.3, alpha: 0.5 });
      }
      if (this.status.stun > 0 && Math.random() < 0.2) {
        FX.spark(this.chestPos().setY(this.pos.y + (this.rig.height || 1.8)), 3, 0xffe97a, { speed: 2, gravity: 2 });
      }

      // thaw
      if (this._ice && this.status.freeze <= 0) this.thawIce();

      // stagger countdown
      if (this.state === 'stagger') {
        this.stateT -= dt;
        if (this.stateT <= 0) {
          this.state = 'combat';
          this.vulnerable = false;
          this.posture = this.postureMax * 0.3;
        }
      }

      // AI
      let wishSpeed = 0;
      if (!frozen && p && p.alive && (this.state === 'combat' || this.state === 'attack')) {
        wishSpeed = this.cfg.think(this, p, dt) || 0;
      }
      wishSpeed *= speedMul;

      // steering: move toward this.moveTarget if set
      if (wishSpeed > 0 && this.moveTarget) {
        tmp.subVectors(this.moveTarget, this.pos).setY(0);
        if (tmp.lengthSq() > 0.04) {
          tmp.normalize().multiplyScalar(wishSpeed);
          this.vel.x = U.dampTo(this.vel.x, tmp.x, 8, dt);
          this.vel.z = U.dampTo(this.vel.z, tmp.z, 8, dt);
        }
      } else {
        this.vel.x = U.dampTo(this.vel.x, 0, this.state === 'attack' ? 4 : 8, dt);
        this.vel.z = U.dampTo(this.vel.z, 0, this.state === 'attack' ? 4 : 8, dt);
      }

      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.x = U.clamp(this.pos.x, -42, 42);
      this.pos.z = U.clamp(this.pos.z, -42, 42);

      // face the player while fighting
      if (p && p.alive && !frozen && this.state !== 'stagger') {
        const desire = U.yawTo(this.pos, p.pos);
        const rate = this.state === 'attack' ? (this.anim.clipFrac < 0.45 ? 3.2 : 0.6) : 6;
        this.yaw = U.dampAngle(this.yaw, desire, rate, dt);
      }
      this.rig.group.rotation.y = this.yaw;

      // active melee frames
      if (this.attackActive && this.curAtk && !frozen) {
        C.meleeSweep(this, {
          reach: this.curAtk.reach,
          arc: this.curAtk.arc || 1.2,
          heightMax: 2.6,
          hitSet: this.hitSet,
          atk: this.curAtk.atk,
        });
      }

      // guard visual
      this.anim.overlay = this.guarding ? S.overlays.guard : null;

      // locomotion params
      const hsp = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
      const lo = this.anim.loco;
      lo.grounded = true;
      lo.speed01 = U.clamp(hsp / (this.cfg.runSpeed || 4), 0, 1);
      lo.phase += hsp * dt * (this.cfg.strideFreq || 2.4);
      this.anim.update(dt * (frozen ? 0.06 : this.status.slow > 0 ? 0.6 : 1));

      if (this.bar) this.bar.set(this.hp, this.hpMax, this.posture, this.postureMax, this.vulnerable);
    }
  }

  /* ================= ZOMBIE ================= */
  function severLimb(z, name) {
    const limb = z.rig.limbs[name];
    if (!limb || z.severed[name]) return false;
    z.severed[name] = true;
    limb.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
    limb.matrixWorld.decompose(wp, wq, ws);
    limb.parent.remove(limb);
    limb.position.copy(wp);
    limb.quaternion.copy(wq);
    limb.scale.copy(ws);
    z.scene.add(limb);
    debris.push({
      obj: limb, t: 0,
      vel: new THREE.Vector3(U.rand(-2, 2), U.rand(3, 5.5), U.rand(-2, 2)),
      ang: new THREE.Vector3(U.rand(-7, 7), U.rand(-7, 7), U.rand(-7, 7)),
    });
    FX.spark(wp, 16, 0x88aa33, { speed: 5 });
    FX.puff(wp, 3, 0x4a6633, { size: 0.35, grow: 2, life: 0.4, alpha: 0.7, smoke: true });
    if (name === 'legL' || name === 'legR') z.cfg.speedMul = (z.cfg.speedMul || 1) * 0.55;
    return true;
  }

  E.spawnZombie = function (scene, pos) {
    const cfg = {
      name: 'ZOMBIE', hp: 26, posture: 45, radius: 0.5, chestH: 1.2,
      staggerDur: 2.2, cdMin: 1.4, cdMax: 2.6, style: 'zombie',
      runSpeed: 1.8, strideFreq: 2.2, flinchChance: 0.9, postureRegen: 6,
      buildRig: () => Rig.buildHumanoid(Rig.presets.zombie),
      speedMul: 1,
      attacks: [
        { clip: 'zLunge', range: 2.4, reach: 1.75, arc: 1.1, wind: 1.35,
          atk: { dmg: 9, posture: 12, selfPosture: 10, kb: 2 } },
        { clip: 'zSwipe', range: 1.9, reach: 1.5, arc: 1.2, wind: 1.35,
          atk: { dmg: 7, posture: 10, selfPosture: 8, kb: 1 } },
      ],
      onDamaged(z, dmg) {
        // limbs come right off this thing
        const order = ['armL', 'armR', 'legR', 'legL'].filter((n) => !z.severed[n]);
        if (order.length) severLimb(z, U.pick(order));
        if (Math.random() < 0.4) S.sfx.play('groan');
      },
      onDeath(z) {
        if (!z.severed.head && Math.random() < 0.65) severLimb(z, 'head');
        S.sfx.play('groan');
      },
      think(z, p, dt) {
        const d = U.distXZ(z.pos, p.pos);
        if (z.state === 'attack') return 0;
        if (Math.random() < dt * 0.12) S.sfx.play('groan');
        const inRange = z.cfg.attacks.some((a) => d <= a.range);
        if (inRange && z.attackCD <= 0) {
          const options = z.cfg.attacks.filter((a) => d <= a.range);
          z.startAttackClip(U.pick(options));
          return 0;
        }
        z.moveTarget = p.pos;
        return 1.8 * (z.cfg.speedMul || 1);
      },
    };
    const z = new Enemy(scene, pos, cfg);
    z.severed = {};
    return z;
  };

  /* ================= SWORDSMAN ================= */
  E.spawnSwordsman = function (scene, pos) {
    const wtype = U.pick(['katana', 'greatsword', 'spear']);
    const W = S.WEAPONS[wtype];
    const heavy = wtype === 'greatsword';
    const atkCache = {};
    const atkFor = (i) => atkCache[i] || (atkCache[i] = {
      clip: W.combo[i], range: W.reach + 0.5, reach: W.reach - 0.15, arc: W.arc,
      speed: heavy ? 0.9 : 0.96,
      wind: i === 0 ? 1.65 : 1.35, // long telegraphed opener, tighter follow-ups
      atk: {
        dmg: Math.round(W.dmg[i] * 0.85), posture: Math.round(W.posture[i] * 1.1),
        selfPosture: 22 + i * 4, kb: W.kb,
      },
    });
    const cfg = {
      name: 'SWORDSMAN · ' + W.name.toUpperCase(), hp: 85, posture: 70,
      radius: 0.5, chestH: 1.3, staggerDur: 3.0, cdMin: 0.9, cdMax: 2.2,
      runSpeed: 4.2, flinchChance: 0.55, postureRegen: 9,
      stance: S.stances[wtype],
      buildRig: () => {
        const r = Rig.buildHumanoid(Rig.presets.swordsman);
        Rig.equipWeapon(r, wtype);
        return r;
      },
      think(sw, p, dt) {
        const d = U.distXZ(sw.pos, p.pos);
        if (sw.state === 'attack') return 0;

        // read the player's swing: sometimes guard, sometimes deflect
        if (p.state === 'attack' && !sw._readAtk && d < p.stats.reach + 1.6) {
          sw._readAtk = true;
          const roll = Math.random();
          if (roll < 0.22) sw.parryT = 0.5;
          else if (roll < 0.55) { sw.guarding = true; sw._guardT = U.rand(0.6, 1.2); }
        }
        if (p.state !== 'attack') sw._readAtk = false;
        if (sw.guarding) {
          sw._guardT -= dt;
          if (sw._guardT <= 0) sw.guarding = false;
        }

        if (d <= W.reach + 0.5 && sw.attackCD <= 0 && !sw.guarding) {
          sw.comboQueue = U.randInt(0, W.combo.length - 1);
          let idx = 0;
          sw.nextCombo = () => (idx + 1 < W.combo.length ? atkFor(++idx) : null);
          sw.startAttackClip(atkFor(0));
          return 0;
        }

        // spacing: rush in when far, circle when close
        if (d > W.reach + 1.8) {
          sw.moveTarget = p.pos;
          return 4.2;
        }
        if (Math.random() < dt * 0.5) sw.strafeDir *= -1;
        const ang = U.yawTo(p.pos, sw.pos) + sw.strafeDir * 0.55;
        const rr = W.reach + 0.9;
        sw.moveTarget = tmp.set(p.pos.x + Math.sin(ang) * rr, 0, p.pos.z + Math.cos(ang) * rr).clone();
        return 1.9;
      },
    };
    return new Enemy(scene, pos, cfg);
  };

  /* ================= OGRE ================= */
  E.spawnOgre = function (scene, pos) {
    const cfg = {
      name: 'STARVED OGRE', hp: 240, posture: 150, radius: 1.05, chestH: 2.1,
      staggerDur: 4.2, cdMin: 1.2, cdMax: 2.4, style: 'ogre', big: true,
      hyperarmor: true, flinchChance: 0.06, mass: 3.2, barWidth: 2.2,
      runSpeed: 2.6, strideFreq: 1.3, postureRegen: 12,
      buildRig: () => Rig.buildOgre(),
      attacks: null,
      think(og, p, dt) {
        const d = U.distXZ(og.pos, p.pos);
        if (og.state === 'attack') return 0;
        if (!og._roared) { og._roared = true; og.startAttackClip({ clip: 'oRoar', reach: 0, arc: 0, atk: { dmg: 0, posture: 0 } }); return 0; }

        if (og.attackCD <= 0) {
          if (d > 3.6 && d < 9 && Math.random() < 0.5) {
            // perilous charge grab — unblockable, dodge it
            og.startAttackClip({
              clip: 'oGrab', reach: 2.6, arc: 0.9,
              atk: { dmg: 34, posture: 50, selfPosture: 0, kb: 13, unblockable: true },
            });
            return 0;
          }
          if (d <= 3.8) {
            const roll = Math.random();
            if (roll < 0.42) {
              og.comboQueue = Math.random() < 0.5 ? 1 : 0;
              og.nextCombo = () => ({
                clip: 'oPunchL', reach: 2.9, arc: 1.25, wind: 1.2,
                atk: { dmg: 20, posture: 30, selfPosture: 28, kb: 6 },
              });
              og.startAttackClip({
                clip: 'oPunchR', reach: 2.9, arc: 1.25, wind: 1.2,
                atk: { dmg: 22, posture: 32, selfPosture: 30, kb: 7 },
              });
            } else if (roll < 0.75) {
              og.startAttackClip({
                clip: 'oSlam', reach: 3.3, arc: 1.4, wind: 1.15,
                atk: { dmg: 30, posture: 46, selfPosture: 34, kb: 9, mult: 1 },
              });
            } else {
              og.startAttackClip({
                clip: 'oPunchL', reach: 2.9, arc: 1.25, wind: 1.2,
                atk: { dmg: 20, posture: 30, selfPosture: 28, kb: 6 },
              });
            }
            return 0;
          }
        }
        og.moveTarget = p.pos;
        return d > 3 ? 2.6 : 1.2;
      },
    };
    return new Enemy(scene, pos, cfg);
  };

  /* ================= BOSS — THE VEILED LANCER ================= */
  /* Cloaked duelist: arrow volleys at range, long-spear pressure up close,
     a perilous gap-closing skewer, and a leaping spear slam. */

  CL.bBow = S.clip({ // draw, hold the aim, loose three
    name: 'bBow', dur: 1.7, rate: 20,
    keys: [
      [0, { shL: [-0.35, 0, 0.3], elL: [-0.75, 0, 0], chest: [0.06, 0.28, 0] }],
      [0.45, { shL: [-1.55, 0.1, 0.08], elL: [-0.12, 0, 0], wrL: [-0.2, 0, 0],
               shR: [-1.2, 0, -0.25], elR: [-2.0, 0.3, 0], wrR: [-0.3, 0, 0],
               chest: [0.04, 0.55, 0], spine: [0.02, 0.25, 0], neck: [-0.05, -0.4, 0],
               hipL: [0.12, 0, 0.04], hipR: [-0.2, 0, -0.04], kneeR: [0.25, 0, 0],
               y: -0.06 }, 'inout'],
      [0.95, { shR: [-1.25, 0, -0.3], elR: [-2.05, 0.3, 0] }],
      [1.05, { shR: [-1.05, 0, -0.7], elR: [-1.2, 0.2, 0], chest: [0.04, 0.5, 0] }, 'snap'],
      [1.35, { shR: [-1.05, 0, -0.75], elR: [-1.1, 0.2, 0] }],
      [1.7, { shL: [-0.35, 0, 0.3], elL: [-0.75, 0, 0], wrL: [0, 0, 0],
              shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0],
              chest: [0.06, 0.28, 0], spine: [0.04, 0.12, 0], neck: [0, 0, 0],
              hipL: [0, 0, 0.03], hipR: [0, 0, -0.03], kneeR: [0.06, 0, 0], y: 0 }, 'inout'],
    ],
    events: [
      [0.42, 'sfx', 'whoosh'],
      [1.0, 'shoot', 0], [1.12, 'shoot', 1], [1.24, 'shoot', 2],
    ],
  });

  CL.bLunge = S.clip({ // perilous skewer — coil low, then a missile
    name: 'bLunge', dur: 1.8, rate: 22,
    keys: [
      [0, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], chest: [0.06, 0.28, 0] }],
      [0.55, { shR: [-0.05, 0.2, -0.5], elR: [-1.5, -0.25, 0], wrR: [0, 0, 0],
               shL: [-1.2, 0.5, 0.12], elL: [-0.3, 0, 0],
               chest: [-0.02, -0.8, 0.05], spine: [-0.02, -0.36, 0], neck: [0.08, 0.6, 0],
               kneeL: [0.55, 0, 0], kneeR: [0.55, 0, 0], hipL: [-0.35, 0, 0.05], hipR: [-0.35, 0, -0.05],
               y: -0.2 }, 'inout'],
      [0.9, { shR: [0, 0.2, -0.55], y: -0.24 }],
      [1.05, { shR: [-1.55, 0, -0.5], elR: [0, 0, 0], wrR: [-0.25, 0, 0],
               shL: [-0.2, 0, 0.75], elL: [-0.25, 0, 0],
               chest: [0.35, 0.22, -0.05], spine: [0.28, 0.12, 0], neck: [-0.3, -0.32, 0],
               hipR: [-0.6, 0, -0.04], hipL: [0.4, 0, 0.04], kneeL: [0.7, 0, 0],
               y: -0.16 }, 'snap'],
      [1.25, { shR: [-1.6, 0, -0.52], chest: [0.37, 0.24, -0.05] }],
      [1.8, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0],
              shL: [-0.35, 0, 0.3], elL: [-0.75, 0, 0],
              chest: [0.06, 0.28, 0], spine: [0.04, 0.12, 0], neck: [0, 0, 0],
              hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
              y: 0 }, 'inout'],
    ],
    events: [
      [0.5, 'peril', null], [0.55, 'sfx', 'peril'],
      [0.98, 'sfx', 'whooshBig'], [0.99, 'move', { f: 11 }],
      [1.02, 'hitOn', null], [1.24, 'hitOff', null],
    ],
  });

  CL.bLeap = S.clip({ // vaulting spear slam
    name: 'bLeap', dur: 1.65, rate: 20,
    keys: [
      [0, { shR: [-0.55, 0, -0.15], chest: [0.06, 0.28, 0] }],
      [0.4, { kneeL: [0.7, 0, 0], kneeR: [0.7, 0, 0], hipL: [-0.5, 0, 0.05], hipR: [-0.5, 0, -0.05],
              chest: [0.3, 0.1, 0], spine: [0.2, 0, 0], shR: [-0.4, 0, -0.3],
              y: -0.26 }, 'inout'],
      [0.72, { shR: [0, 0.2, -0.5], elR: [-1.55, -0.25, 0], wrR: [0, 0, 0],
               shL: [-1.3, 0.5, 0.3], elL: [-0.4, 0, 0],
               chest: [-0.15, -0.6, 0], spine: [-0.1, -0.28, 0], neck: [0.2, 0.45, 0],
               hipL: [-0.9, 0, 0.05], kneeL: [1.3, 0, 0], hipR: [-0.35, 0, -0.05], kneeR: [0.7, 0, 0],
               y: 0.85 }, 'out'],
      [1.0, { shR: [-1.75, 0, -0.5], elR: [0, 0, 0], wrR: [0.55, 0, 0],
              shL: [0.3, 0, 0.5], elL: [-0.25, 0, 0],
              chest: [0.55, 0.2, -0.05], spine: [0.4, 0.1, 0], neck: [-0.4, -0.32, 0],
              hipL: [-0.55, 0, 0.05], kneeL: [0.85, 0, 0], hipR: [0.25, 0, -0.05], kneeR: [0.4, 0, 0],
              y: -0.24 }, 'snap'],
      [1.2, { chest: [0.54, 0, 0], y: -0.26 }],
      [1.65, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0],
               shL: [-0.35, 0, 0.3], elL: [-0.75, 0, 0],
               chest: [0.06, 0.28, 0], spine: [0.04, 0.12, 0], neck: [0, 0, 0],
               hipL: [0, 0, 0.03], hipR: [0, 0, -0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
               y: 0 }, 'inout'],
    ],
    events: [
      [0.66, 'sfx', 'jump'], [0.72, 'move', { f: 6.5 }],
      [0.94, 'sfx', 'whooshBig'],
      [0.97, 'hitOn', { mult: 1.2 }], [1.16, 'hitOff', null],
      [1.02, 'shake', 0.35], [1.02, 'slamFx', null],
    ],
  });

  E.spawnBoss = function (scene, pos) {
    const W = S.WEAPONS.spear;
    const atkCache = {};
    const spearAtk = (i) => atkCache[i] || (atkCache[i] = {
      clip: W.combo[i], range: W.reach + 0.5, reach: W.reach, arc: W.arc + 0.15,
      speed: 1.02, wind: i === 0 ? 1.45 : 1.25,
      atk: { dmg: 15 + i * 2, posture: 16 + i * 3, selfPosture: 26, kb: 3 },
    });
    const volley = { clip: 'bBow', range: 99, reach: 0, arc: 0.5, atk: { dmg: 0, posture: 0 } };
    const lunge = {
      clip: 'bLunge', range: 8, reach: 2.9, arc: 0.8,
      atk: { dmg: 26, posture: 40, selfPosture: 0, kb: 9, unblockable: true },
    };
    const leap = {
      clip: 'bLeap', range: 7, reach: 3.0, arc: 1.2,
      atk: { dmg: 22, posture: 34, selfPosture: 30, kb: 6, mult: 1 },
    };

    const cfg = {
      name: 'THE VEILED LANCER', hp: 380, posture: 170, boss: true, noBar: true,
      radius: 0.55, chestH: 1.45, staggerDur: 3.6, cdMin: 0.8, cdMax: 1.8,
      runSpeed: 4.6, flinchChance: 0.12, hyperarmor: true, mass: 1.3, postureRegen: 13,
      stance: S.stances.spear,
      buildRig: () => {
        const r = Rig.buildHumanoid(Rig.presets.boss);
        Rig.equipWeapon(r, 'spear');
        Rig.equipBow(r);
        Rig.addCloak(r, 0x272138, 0x9a7b30);
        return r;
      },
      onEvent(bs, name, data) {
        if (name === 'shoot') {
          const p = bs.player;
          if (!p || !p.alive) return;
          const origin = bs.chestPos();
          origin.x += Math.sin(bs.yaw) * 0.5;
          origin.z += Math.cos(bs.yaw) * 0.5;
          origin.y += 0.15;
          const target = p.chestPos();
          const dir = target.sub(origin).normalize();
          // slight spread on the 2nd and 3rd arrow
          if (data > 0) {
            const a = Math.atan2(dir.x, dir.z) + U.rand(-0.06, 0.06) * data;
            const horiz = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
            dir.set(Math.sin(a) * horiz, dir.y, Math.cos(a) * horiz);
          }
          S.sfx.play('whoosh');
          FX.flare(origin, 0xd8e8ff, 0.7, 0.12);
          C.spawnProjectile({
            pos: origin, dir, speed: 26, dmg: 12, posture: 14,
            team: bs.team, source: bs, color: 0xe8dfc0, kind: 'shard',
            radius: 0.38, life: 2.4, kb: 2,
          });
        }
      },
      onDeath(bs) {
        FX.flare(bs.chestPos(), 0x6ee4ff, 4, 0.5);
        FX.burstRing(bs.chestPos(), 0x6ee4ff, { to: 6, life: 0.5 });
        FX.flash(bs.chestPos(), 0x6ee4ff, 6, 16, 0.5);
        if (S.hud) S.hud.msg('忍殺', 'THE VEILED LANCER HAS FALLEN', 4);
      },
      think(bs, p, dt) {
        const d = U.distXZ(bs.pos, p.pos);
        if (bs.state === 'attack') return 0;

        // reads the player like the swordsman, but sharper
        if (p.state === 'attack' && !bs._readAtk && d < p.stats.reach + 1.6) {
          bs._readAtk = true;
          const roll = Math.random();
          if (roll < 0.3) bs.parryT = 0.5;
          else if (roll < 0.5) { bs.guarding = true; bs._guardT = U.rand(0.5, 0.9); }
        }
        if (p.state !== 'attack') bs._readAtk = false;
        if (bs.guarding) {
          bs._guardT -= dt;
          if (bs._guardT <= 0) bs.guarding = false;
        }

        if (bs.attackCD <= 0 && !bs.guarding) {
          const roll = Math.random();
          if (d > 8.5) {
            if (roll < 0.75) { bs.startAttackClip(volley); return 0; }
          } else if (d > 4) {
            if (roll < 0.4) { bs.startAttackClip(lunge); return 0; }
            if (roll < 0.68) { bs.startAttackClip(leap); return 0; }
            if (roll < 0.8) { bs.startAttackClip(volley); return 0; }
          } else {
            if (roll < 0.55) {
              bs.comboQueue = U.randInt(1, 2);
              let idx = 0;
              bs.nextCombo = () => (idx + 1 < W.combo.length ? spearAtk(++idx) : null);
              bs.startAttackClip(spearAtk(0));
              return 0;
            }
            if (roll < 0.72) { bs.startAttackClip(lunge); return 0; }
            if (roll < 0.88) {
              // disengage hop, then it wants the bow
              tmp.set(Math.sin(bs.yaw), 0, Math.cos(bs.yaw));
              bs.vel.x -= tmp.x * 9; bs.vel.z -= tmp.z * 9;
              bs.anim.play(CL.dashB);
              S.sfx.play('dash');
              bs.attackCD = 0.7;
              return 0;
            }
          }
        }

        // spacing: lurk at mid range, drift sideways
        if (d > 10) { bs.moveTarget = p.pos; return 4.6; }
        if (Math.random() < dt * 0.6) bs.strafeDir *= -1;
        const ang = U.yawTo(p.pos, bs.pos) + bs.strafeDir * 0.4;
        const rr = Math.max(4.5, Math.min(d, 8));
        bs.moveTarget = tmp.set(p.pos.x + Math.sin(ang) * rr, 0, p.pos.z + Math.cos(ang) * rr).clone();
        return 2.4;
      },
    };
    const b = new Enemy(scene, pos, cfg);
    b.spawnT = 1.2;
    b.iframes = 1.2;
    return b;
  };
})();
