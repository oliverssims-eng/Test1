/* Shinobi Protocol — player.js
   Third-person Sekiro-style controller.
   M1 attack · M2 tap parry / hold block · Space dash (i-frames) · F jump ·
   E interact · R/T/C/G shinobi arts · M loadout. */
(function () {
  'use strict';
  const S = window.S, U = S.U, FX = S.FX, C = S.combat, Rig = S.Rig, CL = S.clips;

  const WEAPONS = (S.WEAPONS = {
    katana: {
      name: 'Katana', em: '🗡️',
      desc: 'Fast, flowing three-cut combo. The duelist\'s answer — lives and dies on the deflect.',
      combo: ['kat1', 'kat2', 'kat3'], dmg: [12, 12, 17], posture: [10, 10, 16],
      selfPosture: 12, reach: 2.35, arc: 1.15, kb: 1.5,
    },
    greatsword: {
      name: 'Great Sword', em: '⚔️',
      desc: 'Two colossal swings. Slow — but blocks crumble and posture shatters beneath it.',
      combo: ['gs1', 'gs2'], dmg: [26, 32], posture: [26, 34],
      selfPosture: 20, reach: 2.75, arc: 1.3, kb: 5,
    },
    spear: {
      name: 'Spear', em: '🔱',
      desc: 'Longest reach on the field. Couched at the hip — snap thrust, stepping thrust, then a lunging skewer.',
      combo: ['sp1', 'sp2', 'sp3'], dmg: [14, 15, 19], posture: [12, 12, 18],
      selfPosture: 14, reach: 3.35, arc: 0.8, kb: 2.5,
    },
  });

  const GRAV = 24, WALK = 3.6, SPRINT = 6.6;
  const ARENA_R = 42;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();

  S.Player = class Player {
    constructor(scene, camera) {
      this.scene = scene;
      this.camera = camera;
      this.team = 'player';
      this.name = 'WOLF UNIT-01';
      this.radius = 0.45;

      this.rig = Rig.buildHumanoid(Rig.presets.player);
      scene.add(this.rig.group);
      this.pos = this.rig.group.position;
      this.vel = new THREE.Vector3();
      this.yaw = 0;
      this.grounded = true;
      this.alive = true;

      this.anim = new S.Animator(this.rig);
      this.anim.onEvent = (n, d) => this.onAnimEvent(n, d);

      this.hpMax = 120; this.hp = 120; this.hpGhost = 120;
      this.postureMax = 100; this.posture = 0; this.postureHitT = 0;
      this.vulnerable = false;

      this.state = 'free';
      this.iframes = 0;
      this.parryT = 0; this.parryLockout = 0;
      this.guardHeld = false; this.guarding = false;
      this.staggerT = 0;

      this.comboIdx = 0; this.buffered = false;
      this.attackActive = false; this.hitSet = null; this.activeData = null;

      this.dashCD = 0; this.dashT = 0; this.dashVel = new THREE.Vector3();
      this.pdash = null; // power dash state
      this.meteorOnLand = null;

      this.camYaw = Math.PI; this.camPitch = 0.14;
      this.camPos = new THREE.Vector3(0, 3, -6);

      this.power = 'fire';
      this.cds = { r: 0, t: 0, c: 0, g: 0 };
      this.pendingAbility = null;

      this.trail = new FX.Trail(0xfff2cc);
      this.setWeapon('katana');

      this._m1 = false; this._m2down = false; this._m2up = false;
      window.addEventListener('mousedown', (e) => {
        if (!S.input.locked) return;
        if (e.button === 0) this._m1 = true;
        if (e.button === 2) this._m2down = true;
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 2) { this._m2up = true; }
      });

      this.anim.snap();
    }

    /* ---------------- gear ---------------- */
    setWeapon(type) {
      this.weaponType = type;
      this.stats = WEAPONS[type];
      Rig.equipWeapon(this.rig, type);
      this.anim.stance = S.stances[type];
      this.comboIdx = 0;
    }
    setPower(id) { this.power = id; this.cds = { r: 0, t: 0, c: 0, g: 0 }; }

    chestPos() { return tmp3.set(this.pos.x, this.pos.y + 1.3, this.pos.z).clone(); }
    aimDir() {
      const p = U.clamp(this.camPitch * 0.6, -0.5, 0.5);
      return new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(p), Math.sin(p), Math.cos(this.camYaw) * Math.cos(p));
    }

    get canAct() { return this.alive && (this.state === 'free' || this.state === 'guard'); }

    /* ---------------- combat interface ---------------- */
    addPosture(n) {
      if (!this.alive) return;
      this.posture = Math.min(this.postureMax, this.posture + n);
      this.postureHitT = 1.2;
      if (this.posture >= this.postureMax && this.state !== 'stagger') this.breakPosture();
    }

    breakPosture() {
      this.state = 'stagger';
      this.staggerT = 1.5;
      this.vulnerable = true;
      this.guarding = false; this.anim.overlay = null;
      this.attackActive = false;
      this.anim.play(CL.postureBreak, { speed: 1.1 });
      S.sfx.play('stagger');
    }

    takeDamage(dmg, attacker, atk) {
      if (!this.alive) return;
      this.hp -= dmg;
      this.postureHitT = 1.2;
      if (S.hud) S.hud.damageFlash();
      if (this.hp <= 0) { this.die(); return; }
      if (this.state !== 'stagger' && this.state !== 'dash') {
        if (this.state === 'attack' || this.state === 'cast') this.state = 'free';
        this.attackActive = false;
        this.anim.play(CL.flinch);
      }
    }

    onParrySuccess(attacker) {
      this.anim.play(CL.parrySuccess);
      this.parryT = 0; // window spent
      this.parryLockout = 0.1;
    }
    onBlockedHit() { this.anim.play(CL.blockHit); }
    onDeflected() {
      this.state = 'deflected';
      this.attackActive = false;
      this.buffered = false;
      this.anim.play(CL.deflected);
    }
    onBlocked() { /* enemy soaked it on guard — no extra reaction */ }

    applyKnockback(dir, p) {
      this.vel.x += dir.x * p; this.vel.z += dir.z * p; this.vel.y += p * 0.2;
      if (p > 4) this.grounded = false;
    }
    applyStatus() { /* the shinobi shrugs off elements */ }

    die() {
      this.alive = false;
      this.state = 'dead';
      this.hp = 0;
      this.guarding = false; this.anim.overlay = null;
      this.attackActive = false;
      this.anim.play(CL.death);
      S.sfx.play('deathblow');
      if (S.hud) S.hud.playerDied();
    }

    respawn(pos) {
      this.alive = true;
      this.state = 'free';
      this.hp = this.hpMax; this.hpGhost = this.hpMax;
      this.posture = 0; this.vulnerable = false;
      this.pos.set(pos.x, 0, pos.z);
      this.vel.set(0, 0, 0);
      this.rig.bones.root.rotation.set(0, 0, 0);
      this.anim.stop();
      this.anim.snap();
    }

    /* ---------------- actions ---------------- */
    startAttack(idx) {
      const combo = this.stats.combo;
      this.comboIdx = idx % combo.length;
      this.state = 'attack';
      this.buffered = false;
      this.attackActive = false;
      this.anim.play(CL[combo[this.comboIdx]]);
    }

    airAttack() {
      this.state = 'attack';
      this.airAtk = true;
      this.anim.play(this.weaponType === 'spear' ? CL.airThrust : CL.airAtk);
    }

    tryDash() {
      if (this.dashCD > 0 || !this.grounded) return;
      if (!(this.canAct || (this.state === 'attack' && this.anim.clipFrac > 0.62))) return;
      const wish = this.moveWish(tmp);
      let dir, clipName;
      if (wish.lengthSq() < 0.01) {
        dir = tmp2.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).clone(); // backstep
        clipName = 'dashB';
      } else {
        dir = wish.clone().normalize();
        const rel = U.angDiff(this.yaw, Math.atan2(dir.x, dir.z));
        if (Math.abs(rel) < 0.8) clipName = 'dashF';
        else if (Math.abs(rel) > 2.35) clipName = 'dashB';
        else clipName = rel > 0 ? 'dashL' : 'dashR';
      }
      this.state = 'dash';
      this.attackActive = false;
      this.dashT = 0.26;
      this.dashCD = 0.55;
      this.iframes = Math.max(this.iframes, 0.15); // the tiny gift
      this.dashVel.copy(dir).multiplyScalar(clipName === 'dashB' ? 11.5 : 13.5);
      this.anim.play(CL[clipName]);
      S.sfx.play('dash');
      FX.dust(this.pos, 3);
    }

    powerDash(opts) {
      const wish = this.moveWish(tmp);
      const dir = wish.lengthSq() > 0.01 ? wish.clone().normalize()
        : tmp2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).clone();
      this.state = 'dash';
      this.dashT = opts.dur;
      this.dashCD = Math.max(this.dashCD, 0.3);
      this.iframes = Math.max(this.iframes, opts.iframes || 0);
      this.dashVel.copy(dir).multiplyScalar(opts.dist / opts.dur);
      this.pdash = {
        fx: opts.fx, dmg: opts.dmg || 0, posture: opts.posture,
        status: opts.status, onStep: opts.onStep, onEnd: opts.onEnd, hitSet: new Set(),
      };
      this.yaw = Math.atan2(dir.x, dir.z);
      this.anim.play(CL[opts.anim || 'dashF']);
    }

    // Generic leap-attack: airborne arc under `meteor` state, callback on landing.
    // opts: { up, fwd, anim, animSpeed, onLand, trailFx(player) }
    meteorLeap(opts) {
      this.state = 'meteor';
      this.grounded = false;
      this.vel.y = opts.up !== undefined ? opts.up : 10.5;
      const f = opts.fwd !== undefined ? opts.fwd : 5.5;
      tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.vel.x = tmp.x * f; this.vel.z = tmp.z * f;
      this.meteorOnLand = opts.onLand;
      this.leapTrail = opts.trailFx || null;
      this.anim.play(CL[opts.anim || 'airAtk'], { speed: opts.animSpeed || 0.6 });
    }

    // Scripted motion: the ability drives velocity/effects each frame.
    // opts: { dur, iframes, anim, animSpeed, steer (m/s WASD control), spin (rad/s),
    //         update(player, dt, t), onEnd(player) }
    startScript(opts) {
      this.state = 'script';
      this.scriptT = 0;
      this.script = opts;
      this.attackActive = false;
      this.guarding = false; this.anim.overlay = null;
      if (opts.iframes) this.iframes = Math.max(this.iframes, opts.iframes);
      if (opts.anim) this.anim.play(CL[opts.anim], { speed: opts.animSpeed || 1 });
    }

    blinkTo(pos, yaw, color) {
      const from = this.chestPos();
      this.pos.x = U.clamp(pos.x, -ARENA_R, ARENA_R);
      this.pos.z = U.clamp(pos.z, -ARENA_R, ARENA_R);
      if (yaw !== undefined) { this.yaw = yaw; this.camYawNudge = true; }
      const to = this.chestPos();
      if (color) {
        FX.flare(from, color, 1.4, 0.15);
        FX.flare(to, color, 1.8, 0.2);
        FX.spark(to, 12, color, { speed: 5 });
      }
      this.iframes = Math.max(this.iframes, 0.25);
    }

    // nearest living enemies, sorted by distance; arc (optional) limits to a front cone
    nearestEnemies(maxDist, arc) {
      return C.enemiesOf('player')
        .filter((e) => {
          const d = U.distXZ(this.pos, e.pos);
          if (d > maxDist) return false;
          if (arc !== undefined && Math.abs(U.angDiff(this.yaw, U.yawTo(this.pos, e.pos))) > arc) return false;
          return true;
        })
        .sort((a, b) => U.distXZ(this.pos, a.pos) - U.distXZ(this.pos, b.pos));
    }

    galeVault() {
      const wish = this.moveWish(tmp);
      this.vel.y = 9.5;
      if (wish.lengthSq() > 0.01) {
        const dir = wish.clone().normalize();
        this.vel.x = dir.x * 7.5; this.vel.z = dir.z * 7.5;
        this.yaw = Math.atan2(dir.x, dir.z);
      }
      this.grounded = false;
      this.iframes = Math.max(this.iframes, 0.15);
      FX.ring(this.pos, 0xd0ffe0, { to: 2.5, life: 0.4 });
      FX.puff(this.pos, 8, 0xd0ffe0, { size: 0.5, grow: 2, life: 0.4, alpha: 0.5 });
    }

    flashStep(dist) {
      const wish = this.moveWish(tmp);
      const dir = wish.lengthSq() > 0.01 ? wish.clone().normalize()
        : tmp2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).clone();
      const from = this.chestPos();
      FX.flare(from, 0xffe97a, 2, 0.2);
      FX.spark(from, 20, 0xffe97a, { speed: 6 });
      FX.flash(from, 0xffe97a, 3, 8, 0.15);
      this.pos.x = U.clamp(this.pos.x + dir.x * dist, -ARENA_R, ARENA_R);
      this.pos.z = U.clamp(this.pos.z + dir.z * dist, -ARENA_R, ARENA_R);
      this.iframes = Math.max(this.iframes, 0.3);
      const to = this.chestPos();
      FX.bolt(from, to, 0xfff2a0);
      // crackling afterimages along the path
      for (let i = 1; i <= 3; i++) {
        const p = from.clone().lerp(to, i / 4);
        FX.spark(p, 5, 0xfff2a0, { speed: 3, gravity: 0, life: 0.3 });
      }
      FX.flare(to, 0xffffff, 1.4, 0.12);
      FX.flare(to, 0xffe97a, 2.4, 0.22);
      FX.burstRing(to, 0xfff2a0, { to: 2, life: 0.25 });
      FX.flash(to, 0xffe97a, 4, 10, 0.2);
      FX.spark(to, 20, 0xffe97a, { speed: 6 });
      this.yaw = Math.atan2(dir.x, dir.z);
    }

    castAbility(key) {
      if (this.cds[key] > 0) return;
      const kit = S.powers.kits[this.power];
      const ab = kit.abilities[key];
      if (!ab) return;
      if (ab.instant) {
        // air-flagged arts fire even midair (gale vault IS the double jump)
        if (!(this.canAct || (!this.grounded && (ab.mobility || ab.air) && this.state !== 'dead'))) return;
        this.cds[key] = ab.cd;
        ab.exec(this);
      } else {
        if (!this.canAct || !this.grounded) return;
        this.cds[key] = ab.cd;
        this.state = 'cast';
        this.pendingAbility = ab;
        this.guarding = false; this.anim.overlay = null;
        this.anim.play(CL[ab.clip]);
      }
    }

    playInteract() {
      if (!this.canAct) return false;
      this.state = 'interact';
      this.guarding = false; this.anim.overlay = null;
      this.anim.play(CL.interact);
      return true;
    }

    /* ---------------- anim events ---------------- */
    onAnimEvent(name, data) {
      switch (name) {
        case 'hitOn':
          this.attackActive = true;
          this.hitSet = new Set();
          this.activeData = data || {};
          break;
        case 'hitOff': this.attackActive = false; break;
        case 'move':
          tmp.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          this.vel.x += tmp.x * data.f; this.vel.z += tmp.z * data.f;
          break;
        case 'trail': this.trail.emit(data); break;
        case 'sfx': S.sfx.play(data); break;
        case 'shake': FX.shake(data); break;
        case 'cast':
          if (this.pendingAbility) { this.pendingAbility.exec(this); this.pendingAbility = null; }
          break;
        case 'end': this.onClipEnd(data); break;
      }
    }

    onClipEnd(clipName) {
      const combo = this.stats.combo;
      if (this.state === 'attack') {
        this.airAtk = false;
        if (this.buffered && this.grounded) {
          this.startAttack(this.comboIdx + 1);
        } else {
          this.state = 'free';
          this.comboIdx = 0;
        }
      } else if (this.state === 'cast' || this.state === 'deflected' || this.state === 'interact') {
        this.state = 'free';
      } else if (clipName === 'parry') {
        // held past the parry frames → it becomes a block
        if (this.guardHeld && this.state === 'free') this.setGuard(true);
      }
      if (this.state === 'stagger' && clipName === 'postureBreak') {
        // handled by staggerT
      }
    }

    setGuard(on) {
      this.guarding = on && this.alive;
      this.anim.overlay = this.guarding ? S.overlays.guard : null;
    }

    /* ---------------- helpers ---------------- */
    moveWish(out) {
      const k = S.input.keys;
      let x = 0, z = 0;
      if (k['w']) z += 1;
      if (k['s']) z -= 1;
      if (k['a']) x += 1;
      if (k['d']) x -= 1;
      out.set(
        x * Math.cos(this.camYaw) + z * Math.sin(this.camYaw), 0,
        -x * Math.sin(this.camYaw) + z * Math.cos(this.camYaw)
      );
      if (out.lengthSq() > 1) out.normalize();
      return out;
    }

    findLockTarget() {
      let best = null, bestScore = Infinity;
      for (const e of C.enemiesOf('player')) {
        const d = U.distXZ(this.pos, e.pos);
        if (d > 11) continue;
        const a = Math.abs(U.angDiff(this.camYaw, U.yawTo(this.pos, e.pos)));
        if (a > 1.2) continue;
        const score = d + a * 4;
        if (score < bestScore) { bestScore = score; best = e; }
      }
      return best;
    }

    /* ---------------- main update ---------------- */
    update(dt, paused) {
      const inp = S.input;

      // timers
      this.iframes = Math.max(0, this.iframes - dt);
      this.parryT = Math.max(0, this.parryT - dt);
      this.parryLockout = Math.max(0, this.parryLockout - dt);
      this.dashCD = Math.max(0, this.dashCD - dt);
      this.postureHitT = Math.max(0, this.postureHitT - dt);
      for (const k in this.cds) this.cds[k] = Math.max(0, this.cds[k] - dt);

      // posture recovery (blocking speeds it up, Sekiro-style)
      if (this.postureHitT <= 0 && this.state !== 'stagger') {
        const regen = this.guarding ? 24 : 14;
        this.posture = Math.max(0, this.posture - regen * dt);
      }

      if (this.state === 'stagger') {
        this.staggerT -= dt;
        if (this.staggerT <= 0) {
          this.state = 'free';
          this.vulnerable = false;
          this.posture = this.postureMax * 0.2;
        }
      }

      /* ---------- input ---------- */
      if (!paused && this.alive && inp.locked) {
        // mouse2: tap = parry, hold = block
        if (this._m2down) {
          this._m2down = false;
          this.guardHeld = true;
          if (this.canAct && this.parryLockout <= 0 && this.grounded) {
            this.parryT = 0.16;
            this.parryLockout = 0.42;
            this.anim.play(CL.parry);
          }
        }
        if (this._m2up) {
          this._m2up = false;
          this.guardHeld = false;
          this.setGuard(false);
        }
        // if parry frames expired and button still held → block
        if (this.guardHeld && !this.guarding && this.canAct && this.parryT <= 0 && !this.anim.playing) {
          this.setGuard(true);
        }
        if (this.guarding && !this.canAct) this.setGuard(false);

        // mouse1: attack (buffer during a swing for combos)
        if (this._m1) {
          this._m1 = false;
          if (this.state === 'attack' && this.anim.clipFrac > 0.42) {
            this.buffered = true;
          } else if (this.canAct) {
            this.setGuard(false);
            if (!this.grounded) this.airAttack();
            else this.startAttack(this.buffered ? this.comboIdx + 1 : 0);
          }
        } else if (this._m1) this._m1 = false;

        if (inp.consume(' ')) this.tryDash();
        if (inp.consume('f') && this.grounded && this.canAct) {
          this.vel.y = 8.6;
          this.grounded = false;
          S.sfx.play('jump');
          FX.dust(this.pos, 2);
        }
        if (inp.consume('r')) this.castAbility('r');
        if (inp.consume('t')) this.castAbility('t');
        if (inp.consume('c')) this.castAbility('c');
        if (inp.consume('g')) this.castAbility('g');
      } else {
        this._m1 = false; this._m2down = false;
        if (this._m2up) { this._m2up = false; this.guardHeld = false; this.setGuard(false); }
      }

      /* ---------- camera orbit ---------- */
      if (inp.locked && !paused) {
        this.camYaw -= inp.mouse.dx * 0.0021;
        this.camPitch = U.clamp(this.camPitch + inp.mouse.dy * 0.0019, -0.5, 1.05);
      }
      inp.mouse.dx = 0; inp.mouse.dy = 0;

      /* ---------- movement ---------- */
      const lock = this.findLockTarget();
      let hspeed = 0;
      if (this.state === 'dash') {
        this.dashT -= dt;
        this.vel.x = this.dashVel.x; this.vel.z = this.dashVel.z;
        if (this.pdash) {
          if (this.pdash.fx === 'fire') {
            FX.flameBurst(this.pos.clone().setY(0.5), 2, { size: 0.5, noFlash: true });
            if (Math.random() < 0.4) FX.flash(this.chestPos(), 0xff6622, 2, 6, 0.12);
          } else if (this.pdash.fx === 'ice') {
            FX.puff(this.pos.clone().setY(0.25), 2, 0xcfeeff, { size: 0.45, grow: 1.4, life: 0.55, alpha: 0.5 });
            FX.spark(this.pos.clone().setY(0.3), 2, 0xdff4ff, { speed: 2, gravity: 2, life: 0.5 });
            if (Math.random() < 0.3) FX.shards(this.pos.clone().setY(0.15), 0xcfeeff, 1, { speed: 2, size: 0.6, life: 0.5 });
          } else if (this.pdash.fx === 'wind') {
            FX.spark(this.chestPos(), 3, 0xc8ffd8, { speed: 3, gravity: 0, drag: 0.5, life: 0.4 });
            FX.puff(this.pos.clone().setY(0.9), 1, 0xd8ffe8, { size: 0.4, grow: 1.8, life: 0.3, alpha: 0.4 });
          }
          if (this.pdash.dmg) {
            C.meleeSweep(this, {
              reach: 1.5, arc: Math.PI, hitSet: this.pdash.hitSet,
              atk: { dmg: this.pdash.dmg, posture: this.pdash.posture || 10, status: this.pdash.status },
            });
          }
          if (this.pdash.onStep) this.pdash.onStep(this, dt);
        }
        if (this.dashT <= 0) {
          this.state = 'free';
          const pd = this.pdash;
          this.pdash = null;
          this.vel.x *= 0.3; this.vel.z *= 0.3;
          if (pd && pd.onEnd) pd.onEnd(this);
        }
      } else if (this.state === 'script' && this.script) {
        this.scriptT += dt;
        const sc = this.script;
        if (sc.steer) {
          const wish = this.moveWish(tmp);
          this.vel.x = U.dampTo(this.vel.x, wish.x * sc.steer, 10, dt);
          this.vel.z = U.dampTo(this.vel.z, wish.z * sc.steer, 10, dt);
        }
        if (sc.spin) this.yaw += sc.spin * dt;
        if (sc.update) sc.update(this, dt, this.scriptT);
        if (this.scriptT >= sc.dur) {
          this.state = 'free';
          this.script = null;
          if (sc.onEnd) sc.onEnd(this);
        }
      } else if (this.alive && (this.state === 'free' || this.state === 'guard' || this.state === 'meteor' || (this.state === 'attack' && !this.grounded))) {
        const wish = this.moveWish(tmp);
        const inAir = !this.grounded;
        // hold shift to sprint — works in every direction
        const sprinting = S.input.keys['shift'] && !this.guarding;
        const speedCap = this.guarding ? WALK * 0.75 : sprinting ? SPRINT : WALK;
        const target = paused ? tmp2.set(0, 0, 0) : tmp2.copy(wish).multiplyScalar(speedCap);
        // leap attacks are ballistic — keep their launch momentum in the air
        const rate = this.state === 'meteor' ? 0.4 : inAir ? 6 : (wish.lengthSq() > 0.01 ? 7.5 : 5);
        this.vel.x = U.dampTo(this.vel.x, target.x, rate, dt);
        this.vel.z = U.dampTo(this.vel.z, target.z, rate, dt);
      } else {
        // attacking / casting / staggered on the ground — bleed momentum
        this.vel.x = U.dampTo(this.vel.x, 0, 8, dt);
        this.vel.z = U.dampTo(this.vel.z, 0, 8, dt);
      }

      // leap trail fx
      if (this.state === 'meteor' && !this.grounded && this.leapTrail) this.leapTrail(this);

      // gravity
      if (!this.grounded) {
        const floaty = this.state === 'attack' && this.airAtk;
        this.vel.y -= GRAV * (floaty ? 0.45 : 1) * dt;
        if (floaty) this.vel.y = Math.max(this.vel.y, -4);
      }
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.y += this.vel.y * dt;
      this.pos.x = U.clamp(this.pos.x, -ARENA_R, ARENA_R);
      this.pos.z = U.clamp(this.pos.z, -ARENA_R, ARENA_R);

      if (this.pos.y <= 0) {
        const wasAir = !this.grounded;
        this.pos.y = 0;
        this.vel.y = 0;
        this.grounded = true;
        if (wasAir) {
          S.sfx.play('land');
          FX.dust(this.pos, 3);
          if (this.state === 'meteor') {
            const fn = this.meteorOnLand; this.meteorOnLand = null;
            this.state = 'free';
            if (fn) fn(this.pos.clone());
          }
        }
      } else if (this.pos.y > 0.01) this.grounded = false;

      hspeed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);

      /* ---------- facing ---------- */
      let targetYaw = this.yaw;
      const spinning = this.state === 'script' && this.script && this.script.spin;
      const engaged = this.state === 'attack' || this.state === 'cast' || this.guarding || this.parryT > 0;
      if (spinning) targetYaw = this.yaw; // the script owns the spin
      else if (engaged && lock) targetYaw = U.yawTo(this.pos, lock.pos);
      else if (engaged) targetYaw = this.camYaw;
      else if (S.settings.shiftLock && this.alive && this.state !== 'dash') targetYaw = this.camYaw;
      else if (hspeed > 0.6) targetYaw = Math.atan2(this.vel.x, this.vel.z);
      else if (this.guarding) targetYaw = this.camYaw;
      const yawRate = this.state === 'attack' && this.anim.clipFrac < 0.4 ? 14
        : (engaged ? 12 : S.settings.shiftLock ? 16 : 11);
      this.yaw = U.dampAngle(this.yaw, targetYaw, yawRate, dt);
      this.rig.group.rotation.y = this.yaw;

      /* ---------- active melee frames ---------- */
      if (this.attackActive && this.alive) {
        const d = this.activeData || {};
        const st = this.stats;
        const i = Math.min(this.comboIdx, st.dmg.length - 1);
        C.meleeSweep(this, {
          reach: st.reach + (d.thrust ? 0.4 : 0),
          arc: d.arcWide ? 1.6 : st.arc,
          heightMax: d.air ? 3.0 : 2.2,
          hitSet: this.hitSet,
          atk: {
            dmg: st.dmg[i], posture: st.posture[i], selfPosture: st.selfPosture,
            kb: st.kb, mult: d.mult || 1,
          },
        });
      }

      /* ---------- animation ---------- */
      const lo = this.anim.loco;
      lo.grounded = this.grounded;
      lo.vy = this.vel.y;
      lo.speed01 = U.clamp(hspeed / SPRINT, 0, 1);
      lo.phase += hspeed * dt * 2.4;
      lo.lean = U.clamp(U.angDiff(this.yaw, targetYaw) * 0.4, -0.25, 0.25);
      this.anim.update(dt);

      // hp ghost trail
      this.hpGhost = Math.max(this.hp, U.dampTo(this.hpGhost, this.hp, 3, dt));

      /* ---------- weapon trail ---------- */
      if (this.rig.weapon) this.trail.update(dt, this.rig.weapon.tip, this.rig.weapon.base);

      /* ---------- camera ---------- */
      const cp = this.camPitch;
      tmp.set(Math.sin(this.camYaw) * Math.cos(cp), Math.sin(cp), Math.cos(this.camYaw) * Math.cos(cp));
      const eye = tmp2.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
      if (S.settings.shiftLock) {
        // over-the-shoulder offset
        eye.x += -Math.cos(this.camYaw) * 0.75;
        eye.z += Math.sin(this.camYaw) * 0.75;
      }
      const desired = tmp3.copy(eye).addScaledVector(tmp, -4.4);
      desired.y = Math.max(0.35, desired.y);
      this.camPos.x = U.dampTo(this.camPos.x, desired.x, 30, dt);
      this.camPos.y = U.dampTo(this.camPos.y, desired.y, 30, dt);
      this.camPos.z = U.dampTo(this.camPos.z, desired.z, 30, dt);
      this.camera.position.copy(this.camPos).add(FX.shakeOffset(tmp));
      const look = eye.addScaledVector(tmp.set(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)), 1.2);
      this.camera.lookAt(look);
    }
  };
})();
