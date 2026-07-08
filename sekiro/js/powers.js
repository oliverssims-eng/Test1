/* Shinobi Protocol — powers.js
   Four shinobi arts. Each kit binds R / T / C / G; every kit has at least one
   dedicated mobility art. Cast abilities play a cast clip and fire on its
   'cast' event; instant abilities (mobility) trigger immediately. */
(function () {
  'use strict';
  const S = window.S, U = S.U, FX = S.FX, C = S.combat;
  const P = (S.powers = {});

  /* ---------- timed effect scheduler ---------- */
  const timers = [];   // {t, fn}
  const effects = [];  // objects with update(dt) → false when done
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

  function fwd(player, out) {
    out.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    return out;
  }
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function castOrigin(player) {
    return tmp2.set(player.pos.x, player.pos.y + 1.35, player.pos.z).clone();
  }

  /* ================= FIRE ================= */
  const fire = {
    id: 'fire', name: 'FIRE ARTS', color: '#ff7733', colorHex: 0xff7733, em: '🔥',
    desc: 'Raw destruction. Burn everything in front of you.',
    abilities: {
      r: {
        name: 'Fire Bolt', icon: '🔥', cd: 3, clip: 'castL',
        desc: 'Hurl a searing bolt of flame. 20 dmg.',
        exec(player) {
          S.sfx.play('fire');
          C.spawnProjectile({
            pos: castOrigin(player), dir: player.aimDir(), speed: 19, dmg: 20, posture: 16,
            team: player.team, source: player, color: 0xff7733, kind: 'orb', emit: true, life: 2.0,
          });
        },
      },
      t: {
        name: 'Flame Wave', icon: '🌊', cd: 8, clip: 'castSpin',
        desc: 'A fan of fire erupts before you. 16 dmg per tongue, knocks back.',
        exec(player) {
          S.sfx.play('fire');
          const f = fwd(player, tmp);
          FX.ring(player.pos, 0xff7733, { to: 3.5, life: 0.35 });
          for (let i = -2; i <= 2; i++) {
            const a = player.yaw + i * 0.24;
            C.spawnProjectile({
              pos: castOrigin(player),
              dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), speed: 13,
              dmg: 16, posture: 18, team: player.team, source: player,
              color: 0xff5522, kind: 'orb', emit: true, life: 0.45, pierce: true, kb: 5,
            });
          }
        },
      },
      c: {
        name: 'Cinder Dash', icon: '💨', cd: 5, instant: true, mobility: true,
        desc: 'MOBILITY — blaze forward through enemies, scorching them for 12.',
        exec(player) {
          S.sfx.play('fire');
          player.powerDash({ dist: 8, dur: 0.22, iframes: 0.24, fx: 'fire', dmg: 12 });
        },
      },
      g: {
        name: 'Meteor Fall', icon: '☄️', cd: 14, instant: true, mobility: true,
        desc: 'Leap skyward and crash down as a meteor. 40 dmg in a wide ring.',
        exec(player) {
          S.sfx.play('fire');
          player.meteorLeap({
            onLand(pos) {
              S.sfx.play('hitBig');
              FX.shake(0.6);
              FX.slam(pos, 0xff7733);
              FX.ring(pos, 0xff5522, { to: 5, life: 0.5 });
              FX.spark(pos, 40, 0xff7733, { speed: 10, up: 6 });
              C.aoe(player, pos, 4.2, { dmg: 40, posture: 40, kb: 9 });
            },
          });
        },
      },
    },
  };

  /* ================= ICE ================= */
  const ice = {
    id: 'ice', name: 'ICE ARTS', color: '#7fd4ff', colorHex: 0x7fd4ff, em: '❄️',
    desc: 'Control. Slow, freeze, shatter.',
    abilities: {
      r: {
        name: 'Ice Lance', icon: '🧊', cd: 3, clip: 'castL',
        desc: 'A frozen lance that pierces and chills. 16 dmg, slows 3s.',
        exec(player) {
          S.sfx.play('ice');
          C.spawnProjectile({
            pos: castOrigin(player), dir: player.aimDir(), speed: 24, dmg: 16, posture: 12,
            team: player.team, source: player, color: 0x9fe0ff, kind: 'shard', emit: true,
            status: { name: 'slow', dur: 3 }, life: 1.6,
          });
        },
      },
      t: {
        name: 'Frost Nova', icon: '❄️', cd: 10, clip: 'castSpin',
        desc: 'Everything near you is frozen solid for 1.6s. 15 dmg.',
        exec(player) {
          S.sfx.play('ice');
          FX.ring(player.pos, 0x9fe0ff, { to: 4, life: 0.5 });
          FX.spark(player.pos.clone().setY(1), 30, 0xbfeaff, { speed: 8 });
          C.aoe(player, player.pos, 3.8, { dmg: 15, posture: 20, status: { name: 'freeze', dur: 1.6 } });
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
        name: 'Glacial Spikes', icon: '🗻', cd: 12, clip: 'castL',
        desc: 'A line of ice spikes erupts forward. 14 dmg each, launches.',
        exec(player) {
          const scene = S.world.scene;
          const dir = fwd(player, tmp).clone();
          const start = player.pos.clone();
          for (let i = 0; i < 6; i++) {
            P.schedule(0.07 * i, () => {
              const p = start.clone().addScaledVector(dir, 1.5 + i * 1.35);
              p.y = 0;
              S.sfx.play('ice');
              const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.4, 1.6, 6),
                new THREE.MeshStandardMaterial({ color: 0xaee4ff, roughness: 0.2, transparent: true, opacity: 0.92 })
              );
              spike.position.copy(p); spike.position.y = -1.5;
              spike.castShadow = true;
              scene.add(spike);
              FX.spark(p, 10, 0xbfeaff, { speed: 5, up: 5 });
              FX.dust(p, 3);
              C.aoe(player, p, 1.3, { dmg: 14, posture: 18, kb: 4 });
              P.addEffect({
                t: 0,
                update(dt) {
                  this.t += dt;
                  if (this.t < 0.12) spike.position.y = U.lerp(-1.5, 0.8, this.t / 0.12) - 0.8;
                  else if (this.t > 0.8) {
                    spike.position.y -= dt * 2.5;
                    spike.material.opacity -= dt * 2;
                    if (spike.material.opacity <= 0) { scene.remove(spike); return false; }
                  }
                  return true;
                },
              });
            });
          }
        },
      },
    },
  };

  /* ================= WIND ================= */
  const wind = {
    id: 'wind', name: 'WIND ARTS', color: '#b8f0c8', colorHex: 0xb8f0c8, em: '🌪️',
    desc: 'Freedom. The sky is yours.',
    abilities: {
      r: {
        name: 'Wind Cutter', icon: '🌀', cd: 2.5, clip: 'castL',
        desc: 'A spinning blade of air that passes through foes. 13 dmg.',
        exec(player) {
          S.sfx.play('wind');
          C.spawnProjectile({
            pos: castOrigin(player), dir: player.aimDir(), speed: 21, dmg: 13, posture: 14,
            team: player.team, source: player, color: 0xd0ffe0, kind: 'blade', pierce: true,
            spinAxis: true, life: 1.4,
          });
        },
      },
      t: {
        name: 'Vacuum Pull', icon: '🌬️', cd: 9, clip: 'castSpin',
        desc: 'Drag every enemy within 7m toward you. 8 dmg.',
        exec(player) {
          S.sfx.play('wind');
          FX.ring(player.pos, 0xd0ffe0, { to: 7, life: 0.5 });
          for (const t of C.enemiesOf(player.team)) {
            if (U.distXZ(player.pos, t.pos) > 7) continue;
            tmp.subVectors(player.pos, t.pos).setY(0).normalize();
            if (t.applyKnockback) t.applyKnockback(tmp, 9);
            C.resolveAttack(player, t, { dmg: 8, posture: 10, point: t.chestPos() });
            FX.puff(t.chestPos(), 4, 0xd0ffe0, { size: 0.4, grow: 2, life: 0.3, alpha: 0.5 });
          }
        },
      },
      c: {
        name: 'Gale Vault', icon: '🕊️', cd: 4, instant: true, mobility: true,
        desc: 'MOBILITY — a huge wind-borne leap. Works midair as a double jump.',
        exec(player) {
          S.sfx.play('wind');
          player.galeVault();
        },
      },
      g: {
        name: 'Tempest', icon: '🌪️', cd: 13, clip: 'castUp',
        desc: 'Summon a tornado ahead that batters and lifts enemies for 2.5s.',
        exec(player) {
          S.sfx.play('wind');
          const dir = fwd(player, tmp).clone();
          const p = player.pos.clone().addScaledVector(dir, 3.2);
          p.y = 0;
          let t = 0, tick = 0;
          P.addEffect({
            update(dt) {
              t += dt; tick -= dt;
              for (let i = 0; i < 3; i++) {
                const h = Math.random() * 3;
                FX.puff(new THREE.Vector3(
                  p.x + Math.cos(t * 9 + h * 3) * (0.4 + h * 0.35), h,
                  p.z + Math.sin(t * 9 + h * 3) * (0.4 + h * 0.35)),
                  1, 0xd0ffe0, { size: 0.5, grow: 1, life: 0.3, alpha: 0.4 });
              }
              if (tick <= 0) {
                tick = 0.33;
                C.aoe(player, p, 2.2, { dmg: 6, posture: 14, kb: 3, noNumber: t > 0.4 });
              }
              return t < 2.5;
            },
          });
        },
      },
    },
  };

  /* ================= LIGHTNING ================= */
  const lightning = {
    id: 'lightning', name: 'LIGHTNING ARTS', color: '#ffe97a', colorHex: 0xffe97a, em: '⚡',
    desc: 'Speed and judgment from the sky.',
    abilities: {
      r: {
        name: 'Thunder Bolt', icon: '⚡', cd: 3, clip: 'castL',
        desc: 'Call a bolt onto the nearest enemy ahead. 18 dmg, brief stun.',
        exec(player) {
          S.sfx.play('bolt');
          let best = null, bd = 15;
          for (const t of C.enemiesOf(player.team)) {
            const d = U.distXZ(player.pos, t.pos);
            const a = Math.abs(U.angDiff(player.yaw, U.yawTo(player.pos, t.pos)));
            if (d < bd && a < 0.9) { bd = d; best = t; }
          }
          const target = best ? best.chestPos() : player.pos.clone().addScaledVector(fwd(player, tmp), 6).setY(1);
          FX.bolt(target.clone().setY(target.y + 9), target, 0xfff2a0);
          FX.spark(target, 20, 0xffe97a, { speed: 8 });
          if (best) C.resolveAttack(player, best, { dmg: 18, posture: 22, point: target, status: { name: 'stun', dur: 0.6 } });
        },
      },
      t: {
        name: 'Static Burst', icon: '💥', cd: 8, clip: 'castSpin',
        desc: 'Discharge around you — 12 dmg and a 1.2s stun.',
        exec(player) {
          S.sfx.play('bolt');
          const c = player.pos.clone().setY(1.2);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            FX.bolt(c, new THREE.Vector3(c.x + Math.cos(a) * 4, 0.3, c.z + Math.sin(a) * 4), 0xfff2a0);
          }
          FX.ring(player.pos, 0xffe97a, { to: 4.5, life: 0.4 });
          C.aoe(player, player.pos, 4.2, { dmg: 12, posture: 18, status: { name: 'stun', dur: 1.2 } });
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
        name: 'Judgment', icon: '🌩', cd: 15, clip: 'castUp',
        desc: 'For 2s the sky executes everything near you. 6 strikes, 15 dmg each.',
        exec(player) {
          for (let i = 0; i < 6; i++) {
            P.schedule(0.25 + i * 0.3, () => {
              S.sfx.play('bolt');
              const foes = C.enemiesOf(player.team).filter((t) => U.distXZ(player.pos, t.pos) < 9);
              let p;
              if (foes.length) p = U.pick(foes).pos.clone().setY(0.2);
              else p = player.pos.clone().add(new THREE.Vector3(U.rand(-5, 5), 0, U.rand(-5, 5)));
              FX.bolt(p.clone().setY(10), p, 0xfff2a0);
              FX.spark(p.clone().setY(0.4), 18, 0xffe97a, { speed: 8, up: 5 });
              FX.ring(p, 0xffe97a, { to: 2, life: 0.3 });
              C.aoe(player, p, 1.7, { dmg: 15, posture: 16, status: { name: 'stun', dur: 0.4 } });
            });
          }
        },
      },
    },
  };

  P.kits = { fire, ice, wind, lightning };
  P.list = ['fire', 'ice', 'wind', 'lightning'];
})();
