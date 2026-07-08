/* Shinobi Protocol — powers.js
   Four shinobi arts, redesigned around MOTION. Every ability moves you:
     FIRE      — forward aggression: leaping ignited slashes, dash chains.
     ICE       — flowing glides, spins and defensive zoning.
     WIND      — verticality: launchers, pass-throughs, becoming the storm.
     LIGHTNING — instantaneous: teleport strikes and chain blinks.
   No two elements share a move shape. */
(function () {
  'use strict';
  const S = window.S, U = S.U, FX = S.FX, C = S.combat;
  const P = (S.powers = {});

  /* ---------- timed effect scheduler ---------- */
  const timers = [];
  const effects = [];
  P.schedule = (delay, fn) => timers.push({ t: delay, fn });
  P.addEffect = (e) => effects.push(e);
  P.update = function (dt) {
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i].t -= dt;
      if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      if (!effects[i].update(dt)) effects.splice(i, 1);
    }
  };

  const tmp = new THREE.Vector3();
  function fwd(player) {
    return new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  }

  // damaging ground field that ticks for a while
  function groundField(center, radius, dur, tickDmg, fx, status) {
    let t = 0, tick = 0;
    P.addEffect({
      update(dt) {
        t += dt; tick -= dt;
        fx(center, t);
        if (tick <= 0) {
          tick = 0.45;
          C.aoe(S.world.player, center, radius, {
            dmg: tickDmg, posture: 6, noNumber: t > 0.5, status,
          });
        }
        return t < dur;
      },
    });
  }

  /* ================= FIRE — RELENTLESS ADVANCE ================= */
  const fire = {
    id: 'fire', name: 'FIRE ARTS', color: '#ff7733', colorHex: 0xff7733, em: '🔥',
    desc: 'Never stop moving forward. Every art carries you INTO them, blade burning.',
    abilities: {
      r: {
        name: 'Blazing Crescent', icon: '🔥', cd: 5, instant: true,
        desc: 'MOVE — a flowing dash-leap with the blade ablaze, crashing down in a burning crescent. 24 dmg.',
        exec(player) {
          S.sfx.play('fire');
          player.trail.color.set(0xff8833);
          const touched = new Set();
          player.meteorLeap({
            up: 7.5, fwd: 7.5, anim: 'airAtk', animSpeed: 0.85,
            trailFx(p) {
              FX.flameBurst(p.chestPos(), 1, { size: 0.5, noFlash: true });
              p.trail.emit(0.1);
              C.meleeSweep(p, { reach: 1.6, arc: Math.PI, hitSet: touched, atk: { dmg: 12, posture: 12 } });
            },
            onLand(pos) {
              S.sfx.play('hitBig');
              FX.shake(0.4);
              FX.flameBurst(pos.clone().setY(0.4), 8, { size: 0.7, speed: 1.5 });
              FX.burstRing(pos.clone().setY(0.8), 0xff8833, { to: 3.4, life: 0.3 });
              FX.ring(pos, 0xff5522, { to: 3.2, life: 0.4 });
              C.aoe(player, pos, 3, { dmg: 24, posture: 24, kb: 5 });
              player.trail.color.set(0xfff2cc);
            },
          });
        },
      },
      t: {
        name: 'Flame Waltz', icon: '💃', cd: 9, instant: true,
        desc: 'MOVE — dance through up to 3 enemies, one burning slash each. 15 dmg per step, i-frames throughout.',
        exec(player) {
          const targets = player.nearestEnemies(9).slice(0, 3);
          if (!targets.length) {
            // nobody to dance with — a single burning lunge
            player.powerDash({ dist: 7, dur: 0.2, iframes: 0.25, fx: 'fire', dmg: 15, posture: 14 });
            return;
          }
          player.iframes = Math.max(player.iframes, 0.3 + targets.length * 0.24);
          targets.forEach((t, i) => {
            P.schedule(0.05 + i * 0.24, () => {
              if (!t.alive || !player.alive) return;
              S.sfx.play('fire');
              const from = player.pos.clone();
              const dir = tmp.subVectors(t.pos, player.pos).setY(0).normalize().clone();
              const dest = t.pos.clone().addScaledVector(dir, -1.3);
              // scorched line where you passed
              for (let k = 1; k <= 3; k++) {
                FX.flameBurst(from.clone().lerp(dest, k / 3).setY(0.5), 2, { size: 0.5, noFlash: k > 1 });
              }
              player.blinkTo(dest, Math.atan2(dir.x, dir.z));
              player.anim.play(S.clips[i % 2 ? 'kat2' : 'kat1'], { speed: 1.6, startT: 0.14 });
              player.trail.emit(0.16);
              C.resolveAttack(player, t, { dmg: 15, posture: 16, point: t.chestPos() });
              FX.flameBurst(t.chestPos(), 4, { size: 0.6 });
            });
          });
        },
      },
      c: {
        name: 'Cinder Trail', icon: '💨', cd: 6, instant: true, mobility: true,
        desc: 'MOBILITY — blaze forward, leaving a wall of fire that burns for 2.5s.',
        exec(player) {
          S.sfx.play('fire');
          const patches = [];
          player.powerDash({
            dist: 8, dur: 0.22, iframes: 0.24, fx: 'fire', dmg: 10,
            onStep(p) {
              if (!patches.length || U.distXZ(patches[patches.length - 1], p.pos) > 1.1) {
                patches.push(p.pos.clone().setY(0));
              }
            },
            onEnd() {
              for (const pt of patches) {
                groundField(pt, 1.1, 2.5, 5, (c, t) => {
                  if (Math.random() < 0.5) FX.flameBurst(c.clone().setY(0.2), 1, { size: 0.45, noFlash: true });
                });
              }
            },
          });
        },
      },
      g: {
        name: 'Vesuvius', icon: '🌋', cd: 15, instant: true,
        desc: 'MOVE — rocket skyward, then come down as an eruption: 40 dmg, and the ground burns for 4s.',
        exec(player) {
          S.sfx.play('fire');
          FX.flameBurst(player.pos.clone().setY(0.3), 8, { size: 0.8, speed: 2 });
          player.meteorLeap({
            up: 13, fwd: 2.5, anim: 'airAtk', animSpeed: 0.5,
            trailFx(p) { FX.flameBurst(p.chestPos(), 1, { size: 0.6, noFlash: true }); },
            onLand(pos) {
              S.sfx.play('hitBig');
              FX.shake(0.8);
              FX.hitstop(0.07, 0.12);
              FX.slam(pos, 0xff7733);
              FX.ring(pos, 0xff5522, { to: 6, life: 0.6 });
              FX.flare(pos.clone().setY(1.2), 0xffcc66, 4.5, 0.35);
              FX.flash(pos, 0xff6622, 7, 16, 0.4);
              // pillar of fire
              for (let h = 0; h < 6; h++) {
                FX.flameBurst(pos.clone().setY(0.4 + h * 0.8), 4, { size: 0.9, speed: 1.2, noFlash: h > 0 });
              }
              FX.shards(pos.clone().setY(0.3), 0x553322, 10, { speed: 8, size: 1.5 });
              C.aoe(player, pos, 4.5, { dmg: 40, posture: 40, kb: 10 });
              groundField(pos.clone(), 3.2, 4, 6, (c) => {
                if (Math.random() < 0.7) {
                  const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
                  FX.flameBurst(new THREE.Vector3(c.x + Math.cos(a) * r, 0.2, c.z + Math.sin(a) * r), 1,
                    { size: 0.5, noFlash: true });
                }
              });
            },
          });
        },
      },
    },
  };

  /* ================= ICE — THE FLOWING GLACIER ================= */
  const ice = {
    id: 'ice', name: 'ICE ARTS', color: '#7fd4ff', colorHex: 0x7fd4ff, em: '❄️',
    desc: 'Glide, spin, wall them off. Ice flows — and then it stops you dead.',
    abilities: {
      r: {
        name: 'Frozen Lunge', icon: '🧊', cd: 5, instant: true,
        desc: 'MOVE — glide in on a ribbon of ice and ram the point home. 18 dmg, freezes 1s.',
        exec(player) {
          S.sfx.play('ice');
          player.powerDash({
            dist: 6.5, dur: 0.24, iframes: 0.2, fx: 'ice',
            onEnd(p) {
              p.anim.play(S.clips[p.weaponType === 'spear' ? 'sp1' : 'kat1'], { speed: 1.5, startT: 0.12 });
              p.trail.emit(0.15);
              S.sfx.play('ice');
              const hits = C.meleeSweep(p, {
                reach: 2.6, arc: 1.0,
                atk: { dmg: 18, posture: 18, status: { name: 'freeze', dur: 1.0 } },
              });
              for (const h of hits) FX.shards(h.target.chestPos(), 0xcfeeff, 6, { speed: 5 });
              FX.burstRing(p.chestPos(), 0xbfeaff, { to: 2, life: 0.25 });
            },
          });
        },
      },
      t: {
        name: 'Crystal Pirouette', icon: '🌀', cd: 9, instant: true,
        desc: 'MOVE — a steerable spinning glide (hold WASD). Everything you brush past is chilled, and the finale freezes solid.',
        exec(player) {
          S.sfx.play('ice');
          let tick = 0;
          const hitSet = new Set();
          player.startScript({
            dur: 0.9, iframes: 0.5, steer: 7.5, spin: 16, anim: 'castSpin', animSpeed: 1.3,
            update(p, dt, t) {
              tick -= dt;
              FX.puff(p.pos.clone().setY(0.3), 1, 0xcfeeff, { size: 0.5, grow: 1.5, life: 0.5, alpha: 0.45 });
              FX.spark(p.chestPos(), 2, 0xdff4ff, { speed: 3, gravity: 1, life: 0.4 });
              if (tick <= 0) {
                tick = 0.2;
                C.meleeSweep(p, {
                  reach: 2.2, arc: Math.PI, hitSet,
                  atk: { dmg: 7, posture: 8, status: { name: 'slow', dur: 2 } },
                });
                hitSet.clear();
              }
            },
            onEnd(p) {
              S.sfx.play('ice');
              FX.ring(p.pos, 0x9fe0ff, { to: 3.6, life: 0.5 });
              FX.burstRing(p.chestPos(), 0xbfeaff, { to: 4, life: 0.35 });
              FX.flare(p.chestPos(), 0xdff4ff, 2.6, 0.25);
              FX.shards(p.pos.clone().setY(0.6), 0xcfeeff, 10, { speed: 6 });
              C.aoe(p, p.pos, 3.2, { dmg: 12, posture: 16, status: { name: 'freeze', dur: 1.3 } });
            },
          });
        },
      },
      c: {
        name: 'Frost Glide', icon: '⛸️', cd: 5, instant: true, mobility: true,
        desc: 'MOBILITY — glide far and fast on a ribbon of ice.',
        exec(player) {
          S.sfx.play('ice');
          player.powerDash({ dist: 11, dur: 0.34, iframes: 0.2, fx: 'ice' });
        },
      },
      g: {
        name: "Winter's Rampart", icon: '🏔️', cd: 13, instant: true,
        desc: 'MOVE — backflip away while a rampart of ice spikes erupts where you stood. Launches, then chills the ground.',
        exec(player) {
          S.sfx.play('ice');
          const origin = player.pos.clone();
          const face = fwd(player).clone();
          // backflip out
          player.meteorLeap({ up: 8.5, fwd: -7, anim: 'dashB', animSpeed: 0.55 });
          FX.puff(origin.clone().setY(0.3), 6, 0xdff4ff, { size: 0.6, grow: 2, life: 0.5, alpha: 0.5 });
          // spike wall across where you stood
          const scene = S.world.scene;
          const side = new THREE.Vector3(face.z, 0, -face.x);
          for (let i = -2; i <= 2; i++) {
            P.schedule(0.06 + Math.abs(i) * 0.05, () => {
              const p = origin.clone().addScaledVector(side, i * 1.15);
              p.y = 0;
              S.sfx.play('ice');
              const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.5, 2.2, 6),
                new THREE.MeshStandardMaterial({ color: 0xaee4ff, roughness: 0.18, transparent: true, opacity: 0.92 })
              );
              spike.position.copy(p); spike.position.y = -2;
              spike.castShadow = true;
              scene.add(spike);
              FX.spark(p.clone().setY(0.5), 10, 0xbfeaff, { speed: 5, up: 5 });
              FX.shards(p.clone().setY(0.4), 0xcfeeff, 4, { speed: 4 });
              C.aoe(S.world.player, p, 1.4, { dmg: 16, posture: 20, kb: 6 });
              P.addEffect({
                t: 0,
                update(dt) {
                  this.t += dt;
                  if (this.t < 0.14) spike.position.y = U.lerp(-2, 1.1, this.t / 0.14) - 1.1;
                  else if (this.t > 2.2) {
                    spike.position.y -= dt * 2.5;
                    spike.material.opacity -= dt * 1.5;
                    if (spike.material.opacity <= 0) { scene.remove(spike); return false; }
                  }
                  return true;
                },
              });
            });
          }
          groundField(origin, 2.6, 3, 3, (c) => {
            if (Math.random() < 0.4) FX.puff(c.clone().setY(0.15), 1, 0xdff4ff, { size: 0.5, grow: 1.5, life: 0.6, alpha: 0.3 });
          }, { name: 'slow', dur: 1 });
        },
      },
    },
  };

  /* ================= WIND — MASTER OF THE SKY ================= */
  const wind = {
    id: 'wind', name: 'WIND ARTS', color: '#b8f0c8', colorHex: 0xb8f0c8, em: '🌪️',
    desc: 'The ground is a suggestion. Launch, pass through, become the storm.',
    abilities: {
      r: {
        name: 'Sky Dancer', icon: '🕊️', cd: 5, instant: true, air: true,
        desc: 'MOVE — a rising spiral slash that launches YOU upward. Works midair. Chain into air attacks.',
        exec(player) {
          S.sfx.play('wind');
          player.vel.y = 10;
          player.grounded = false;
          player.iframes = Math.max(player.iframes, 0.25);
          player.anim.play(S.clips.castSpin, { speed: 1.6 });
          player.trail.emit(0.25);
          FX.burstRing(player.chestPos(), 0xd0ffe0, { to: 3, life: 0.3 });
          FX.spark(player.pos.clone().setY(0.8), 18, 0xc8ffd8, { speed: 5, gravity: 0, drag: 0.8 });
          // spiral streaks rising with you
          let t = 0;
          P.addEffect({
            update(dt) {
              t += dt;
              const a = t * 20;
              FX.puff(new THREE.Vector3(
                player.pos.x + Math.cos(a) * 0.7, player.pos.y + 0.5 + t * 2,
                player.pos.z + Math.sin(a) * 0.7), 1, 0xd8ffe8,
                { size: 0.4, grow: 1.5, life: 0.3, alpha: 0.5 });
              return t < 0.5;
            },
          });
          C.aoe(player, player.pos, 2.6, { dmg: 13, posture: 16, kb: 3 });
        },
      },
      t: {
        name: 'Swallow Dive', icon: '🦅', cd: 8, instant: true, air: true,
        desc: 'MOVE — turn to wind and pass straight THROUGH them (untouchable), cutting everything, ending behind with your blade turned.',
        exec(player) {
          S.sfx.play('wind');
          FX.burstRing(player.chestPos(), 0xd0ffe0, { from: 0.8, to: 0.2, life: 0.2 });
          player.powerDash({
            dist: 9.5, dur: 0.26, iframes: 0.4, fx: 'wind', dmg: 15, posture: 18,
            onEnd(p) {
              // land facing back the way you came, blade out
              p.yaw += Math.PI;
              p.anim.play(S.clips[p.weaponType === 'spear' ? 'sp1' : 'kat2'], { speed: 1.5, startT: 0.14 });
              p.trail.emit(0.15);
              FX.burstRing(p.chestPos(), 0xc8ffd8, { to: 2.4, life: 0.25 });
              S.sfx.play('whoosh');
            },
          });
        },
      },
      c: {
        name: 'Gale Vault', icon: '🌤️', cd: 4, instant: true, mobility: true,
        desc: 'MOBILITY — a huge wind-borne leap. Works midair as a double jump.',
        exec(player) {
          S.sfx.play('wind');
          player.galeVault();
        },
      },
      g: {
        name: 'Maelstrom', icon: '🌪️', cd: 15, instant: true,
        desc: 'MOVE — BECOME the tornado for 1.6s: steer with WASD, dragging in and shredding everything you touch.',
        exec(player) {
          S.sfx.play('wind');
          let tick = 0;
          player.startScript({
            dur: 1.6, iframes: 1.7, steer: 8.5, spin: 22, anim: 'castSpin', animSpeed: 0.9,
            update(p, dt, t) {
              tick -= dt;
              for (let i = 0; i < 3; i++) {
                const h = Math.random() * 2.6;
                const a = t * 14 + h * 4 + i * 2;
                FX.puff(new THREE.Vector3(
                  p.pos.x + Math.cos(a) * (0.5 + h * 0.4), p.pos.y + h,
                  p.pos.z + Math.sin(a) * (0.5 + h * 0.4)), 1, 0xd0ffe0,
                  { size: 0.55, grow: 1.2, life: 0.3, alpha: 0.45 });
              }
              FX.spark(p.chestPos(), 2, 0xc8ffd8, { speed: 5, gravity: 0, drag: 0.6, life: 0.3 });
              if (Math.random() < 0.3) FX.dust(new THREE.Vector3(p.pos.x, 0.1, p.pos.z), 1);
              if (tick <= 0) {
                tick = 0.28;
                // drag them into the funnel and shred
                for (const e of C.enemiesOf('player')) {
                  const d = U.distXZ(p.pos, e.pos);
                  if (d > 3.2) continue;
                  tmp.subVectors(p.pos, e.pos).setY(0).normalize();
                  if (e.applyKnockback) e.applyKnockback(tmp, 6);
                  C.resolveAttack(p, e, { dmg: 8, posture: 12, point: e.chestPos(), noNumber: t > 0.5 });
                }
              }
            },
            onEnd(p) {
              S.sfx.play('wind');
              FX.ring(p.pos, 0xd0ffe0, { to: 5, life: 0.5 });
              FX.burstRing(p.chestPos(), 0xc8ffd8, { to: 4.5, life: 0.35 });
              for (const e of C.enemiesOf('player')) {
                if (U.distXZ(p.pos, e.pos) > 4) continue;
                tmp.subVectors(e.pos, p.pos).setY(0).normalize();
                if (e.applyKnockback) e.applyKnockback(tmp, 11);
              }
            },
          });
        },
      },
    },
  };

  /* ================= LIGHTNING — THE INSTANT ================= */
  const lightning = {
    id: 'lightning', name: 'LIGHTNING ARTS', color: '#ffe97a', colorHex: 0xffe97a, em: '⚡',
    desc: 'Distance is a rumor. Be there before the thunder arrives.',
    abilities: {
      r: {
        name: 'Thunder Pierce', icon: '⚡', cd: 5, instant: true,
        desc: 'MOVE — flash THROUGH the nearest enemy ahead, reappearing behind them mid-slash. 20 dmg + stun.',
        exec(player) {
          S.sfx.play('bolt');
          const t = player.nearestEnemies(10, 1.0)[0];
          if (!t) {
            player.flashStep(5);
            return;
          }
          const from = player.chestPos();
          const dir = tmp.subVectors(t.pos, player.pos).setY(0).normalize().clone();
          const dest = t.pos.clone().addScaledVector(dir, 1.4);
          player.blinkTo(dest, Math.atan2(dir.x, dir.z), 0xffe97a);
          FX.bolt(from, t.chestPos(), 0xfff2a0);
          FX.bolt(t.chestPos(), player.chestPos(), 0xfff2a0);
          player.anim.play(S.clips[player.weaponType === 'spear' ? 'sp1' : 'kat1'], { speed: 1.7, startT: 0.14 });
          player.trail.emit(0.14);
          C.resolveAttack(player, t, { dmg: 20, posture: 22, point: t.chestPos(), status: { name: 'stun', dur: 0.7 } });
          FX.flare(t.chestPos(), 0xfff2a0, 2, 0.2);
        },
      },
      t: {
        name: 'Storm Circuit', icon: '🔗', cd: 10, instant: true,
        desc: 'MOVE — become the current: chain-blink through up to 4 enemies, striking each. You end wherever the storm does.',
        exec(player) {
          const targets = player.nearestEnemies(12).slice(0, 4);
          if (!targets.length) { player.flashStep(6); return; }
          player.iframes = Math.max(player.iframes, 0.2 + targets.length * 0.16);
          targets.forEach((t, i) => {
            P.schedule(0.04 + i * 0.16, () => {
              if (!t.alive || !player.alive) return;
              S.sfx.play('bolt');
              const from = player.chestPos();
              const dir = tmp.subVectors(t.pos, player.pos).setY(0).normalize().clone();
              const dest = t.pos.clone().addScaledVector(dir, -1.2);
              player.blinkTo(dest, Math.atan2(dir.x, dir.z), 0xffe97a);
              FX.bolt(from, player.chestPos(), 0xfff2a0);
              player.anim.play(S.clips[i % 2 ? 'kat2' : 'kat1'], { speed: 1.8, startT: 0.15 });
              player.trail.emit(0.12);
              C.resolveAttack(player, t, { dmg: 13, posture: 14, point: t.chestPos(), status: { name: 'stun', dur: 0.4 } });
            });
          });
        },
      },
      c: {
        name: 'Flash Step', icon: '🌩️', cd: 4, instant: true, mobility: true,
        desc: 'MOBILITY — become lightning; blink 9m instantly.',
        exec(player) {
          S.sfx.play('bolt');
          player.flashStep(9);
        },
      },
      g: {
        name: "Heaven's Wrath", icon: '🌩', cd: 16, instant: true,
        desc: 'MOVE — ascend on a thunderhead: bolts execute everything below while you hang, then you crash down as one yourself.',
        exec(player) {
          S.sfx.play('bolt');
          FX.boltStrike(player.pos.clone().setY(9), player.pos.clone().setY(0.3), 0xfff2a0);
          let boltT = 0;
          player.meteorLeap({
            up: 12, fwd: 0.5, anim: 'castUp', animSpeed: 0.5,
            trailFx(p) {
              FX.spark(p.chestPos(), 2, 0xffe97a, { speed: 3, gravity: 0, life: 0.3 });
              boltT -= 1 / 60;
              if (boltT <= 0 && p.vel.y < 6) {
                boltT = 0.22;
                S.sfx.play('bolt');
                const foes = C.enemiesOf('player').filter((e) => U.distXZ(p.pos, e.pos) < 10);
                const target = foes.length ? U.pick(foes).pos.clone().setY(0.2)
                  : p.pos.clone().add(new THREE.Vector3(U.rand(-6, 6), 0, U.rand(-6, 6))).setY(0.2);
                FX.boltStrike(target.clone().setY(10), target, 0xfff2a0);
                C.aoe(p, target, 1.8, { dmg: 14, posture: 15, status: { name: 'stun', dur: 0.4 } });
              }
            },
            onLand(pos) {
              S.sfx.play('bolt');
              FX.shake(0.7);
              FX.hitstop(0.06, 0.12);
              FX.boltStrike(pos.clone().setY(11), pos.clone().setY(0.3), 0xffffff);
              FX.ring(pos, 0xffe97a, { to: 5, life: 0.5 });
              FX.burstRing(pos.clone().setY(1), 0xfff2a0, { to: 5.5, life: 0.4 });
              FX.flash(pos, 0xffe97a, 8, 16, 0.35);
              C.aoe(player, pos, 4, { dmg: 25, posture: 28, status: { name: 'stun', dur: 1.0 } });
            },
          });
        },
      },
    },
  };

  P.kits = { fire, ice, wind, lightning };
  P.list = ['fire', 'ice', 'wind', 'lightning'];
})();
