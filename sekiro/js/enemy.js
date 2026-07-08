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

      this.bar = new Bar(this.rig.group, (this.rig.height || 1.8) + 0.35, cfg.barWidth);

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
    onDeflected() {
      // our swing was deflected — recoil, combo dropped
      this.attackActive = false;
      this.comboQueue = 0;
      this.state = 'combat';
      this.attackCD = Math.max(this.attackCD, U.rand(0.7, 1.3));
      this.anim.play(CL.deflected, { speed: this.cfg.big ? 0.7 : 1 });
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
      if (name === 'freeze') FX.spark(this.chestPos(), 12, 0x9fe0ff, { speed: 4 });
    }

    die() {
      this.alive = false;
      this.state = 'dead';
      this.hp = 0;
      this.attackActive = false;
      this.guarding = false;
      this.anim.overlay = null;
      this.deathT = 3.2;
      this.anim.play(CL.death, { speed: this.cfg.big ? 0.75 : 1 });
      S.sfx.play(this.cfg.big ? 'roar' : 'hitBig');
      FX.deathBurst(this.chestPos(), 0xdd3322);
      this.bar.remove();
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
        case 'slamFx': {
          tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const p = this.pos.clone().addScaledVector(tmp, 2.2);
          p.y = 0.05;
          FX.slam(p, 0xbbaa77);
          break;
        }
        case 'end': this.onClipEnd(data); break;
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
      this.anim.play(CL[a.clip], { speed: a.speed || 1 });
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
        this.bar.set(this.hp, this.hpMax, this.posture, this.postureMax, this.vulnerable);
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

      this.bar.set(this.hp, this.hpMax, this.posture, this.postureMax, this.vulnerable);
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
        { clip: 'zLunge', range: 2.4, reach: 1.75, arc: 1.1,
          atk: { dmg: 9, posture: 12, selfPosture: 10, kb: 2 } },
        { clip: 'zSwipe', range: 1.9, reach: 1.5, arc: 1.2,
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
    const atkFor = (i) => ({
      clip: W.combo[i], range: W.reach + 0.5, reach: W.reach - 0.15, arc: W.arc,
      speed: heavy ? 0.92 : 0.98,
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
                clip: 'oPunchL', reach: 2.9, arc: 1.25,
                atk: { dmg: 20, posture: 30, selfPosture: 28, kb: 6 },
              });
              og.startAttackClip({
                clip: 'oPunchR', reach: 2.9, arc: 1.25,
                atk: { dmg: 22, posture: 32, selfPosture: 30, kb: 7 },
              });
            } else if (roll < 0.75) {
              og.startAttackClip({
                clip: 'oSlam', reach: 3.3, arc: 1.4,
                atk: { dmg: 30, posture: 46, selfPosture: 34, kb: 9, mult: 1 },
              });
            } else {
              og.startAttackClip({
                clip: 'oPunchL', reach: 2.9, arc: 1.25,
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
})();
