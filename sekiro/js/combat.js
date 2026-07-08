/* Shinobi Protocol — combat.js
   The Sekiro rules, in one place.

   Every actor (player + enemies) exposes:
     team, alive, pos (feet Vector3), yaw,
     hp, hpMax, posture, postureMax,
     guarding, parryT (>0 = inside active parry window), iframes,
     vulnerable (posture broken — takes bonus damage),
     chestPos(), addPosture(n), takeDamage(amount, attacker, atk),
     onParrySuccess(attacker, point)  — you deflected someone
     onDeflected(defender)            — your swing got deflected
     onBlocked(defender)              — your swing hit a guard
     applyKnockback(dir, power)
     applyStatus(name, dur)           — slow / freeze / stun

   Attack descriptor (atk):
     dmg          — HP damage on clean hit
     posture      — posture damage to a blocking defender
     selfPosture  — posture the ATTACKER takes when parried
     unblockable  — perilous: ignores guard AND parry
     kb           — knockback m/s
     point        — impact position (Vector3), optional
     element      — fx tint, status  — {name, dur}
     mult         — damage multiplier (finishers, air attacks)
     noNumber     — suppress the floating damage number */
(function () {
  'use strict';
  const S = window.S, U = S.U, FX = S.FX;
  const C = (S.combat = {});

  C.actors = []; // main.js keeps this in sync

  C.enemiesOf = function (team) {
    return C.actors.filter((a) => a.alive && a.team !== team);
  };

  // Defender can only guard what it can see (~200° front cone).
  function facing(defender, attackerPos) {
    const toAtk = Math.atan2(attackerPos.x - defender.pos.x, attackerPos.z - defender.pos.z);
    return Math.abs(U.angDiff(defender.yaw, toAtk)) < 1.75;
  }

  C.resolveAttack = function (attacker, defender, atk) {
    if (!defender.alive || defender.iframes > 0) return 'miss';
    const point = atk.point || defender.chestPos();
    const mult = atk.mult || 1;

    // ---- PARRY: the small window ----
    if (!atk.unblockable && defender.parryT > 0 && facing(defender, attacker.pos)) {
      FX.parrySparks(point);
      FX.hitstop(0.09, 0.05);
      FX.shake(0.35);
      S.sfx.play('parry');
      const selfP = atk.selfPosture !== undefined ? atk.selfPosture : atk.dmg * 1.4;
      attacker.addPosture(selfP);
      defender.addPosture(3); // deflecting still jolts your arms a little
      if (defender.onParrySuccess) defender.onParrySuccess(attacker, point);
      if (attacker.onDeflected) attacker.onDeflected(defender);
      return 'parried';
    }

    // ---- BLOCK: held guard soaks HP, eats posture ----
    if (!atk.unblockable && defender.guarding && facing(defender, attacker.pos)) {
      FX.blockSparks(point);
      FX.hitstop(0.04, 0.25);
      S.sfx.play('block');
      defender.addPosture(atk.posture * mult);
      if (defender.onBlockedHit) defender.onBlockedHit(attacker, point);
      if (attacker.onBlocked) attacker.onBlocked(defender);
      if (atk.kb && defender.applyKnockback) {
        tmpDir.subVectors(defender.pos, attacker.pos).setY(0).normalize();
        defender.applyKnockback(tmpDir, atk.kb * 0.5);
      }
      return 'blocked';
    }

    // ---- CLEAN HIT ----
    let dmg = atk.dmg * mult;
    let big = false;
    if (defender.vulnerable) { dmg *= 2.2; big = true; } // broken posture = wide open
    FX.hitSparks(point, big || dmg >= 22);
    FX.hitstop(big ? 0.07 : 0.035, 0.2);
    if (big) FX.shake(0.3);
    S.sfx.play(big || dmg >= 22 ? 'hitBig' : 'hit');
    if (!atk.noNumber) FX.number(point, Math.round(dmg), big ? '#ff8844' : '#ffdd77');
    defender.addPosture((atk.posture || atk.dmg) * 0.45 * mult);
    if (atk.kb && defender.applyKnockback) {
      tmpDir.subVectors(defender.pos, attacker.pos).setY(0).normalize();
      defender.applyKnockback(tmpDir, atk.kb);
    }
    if (atk.status && defender.applyStatus) defender.applyStatus(atk.status.name, atk.status.dur);
    defender.takeDamage(dmg, attacker, atk);
    return 'hit';
  };

  const tmpDir = new THREE.Vector3();

  /* ---- melee arc test: hit everything of the other team in reach ----
     source: attacker, opts: {reach, arc (rad half-angle), heightMax, atk, hitSet} */
  C.meleeSweep = function (attacker, opts) {
    const results = [];
    for (const t of C.enemiesOf(attacker.team)) {
      if (opts.hitSet && opts.hitSet.has(t)) continue;
      const d = U.distXZ(attacker.pos, t.pos);
      const bodyR = t.radius || 0.5;
      if (d > opts.reach + bodyR) continue;
      const yawTo = U.yawTo(attacker.pos, t.pos);
      if (Math.abs(U.angDiff(attacker.yaw, yawTo)) > (opts.arc || 1.1)) continue;
      if (opts.heightMax !== undefined && Math.abs(t.pos.y - attacker.pos.y) > opts.heightMax) continue;
      const res = C.resolveAttack(attacker, t, opts.atk);
      if (opts.hitSet) opts.hitSet.add(t);
      results.push({ target: t, res });
    }
    return results;
  };

  /* ---- AoE: everything of opposing team within radius ---- */
  C.aoe = function (source, center, radius, atk) {
    const results = [];
    for (const t of C.enemiesOf(source.team)) {
      if (U.distXZ(center, t.pos) > radius + (t.radius || 0.5)) continue;
      const a = Object.assign({}, atk, { point: t.chestPos() });
      results.push({ target: t, res: C.resolveAttack(source, t, a) });
    }
    return results;
  };

  /* ---------------- projectiles ---------------- */
  const projectiles = [];
  let projScene = null;
  C.initProjectiles = function (scene) { projScene = scene; };

  const projGeos = {
    orb: () => new THREE.SphereGeometry(0.14, 10, 8),
    shard: () => new THREE.ConeGeometry(0.09, 0.5, 6),
    blade: () => new THREE.BoxGeometry(0.7, 0.06, 0.25),
  };

  /* opts: {pos, dir, speed, dmg, posture, team, source, color, kind, life,
            gravity, pierce, radius, status, kb, onExpire, spinAxis, emit} */
  C.spawnProjectile = function (opts) {
    const geo = (projGeos[opts.kind] || projGeos.orb)();
    const mat = new THREE.MeshBasicMaterial({ color: opts.color, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(opts.pos);
    if (opts.kind === 'shard') mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), opts.dir);
    projScene.add(mesh);
    const light = new THREE.PointLight(opts.color, 0.9, 5);
    mesh.add(light);
    projectiles.push({
      mesh, light,
      vel: opts.dir.clone().multiplyScalar(opts.speed),
      source: opts.source, team: opts.team,
      dmg: opts.dmg, posture: opts.posture || opts.dmg,
      radius: opts.radius || 0.45,
      life: opts.life || 2.2,
      gravity: opts.gravity || 0,
      pierce: !!opts.pierce,
      status: opts.status, kb: opts.kb || 0,
      color: opts.color, emit: opts.emit,
      onExpire: opts.onExpire,
      hit: new Set(),
      spin: opts.spinAxis,
      t: 0,
    });
  };

  C.updateProjectiles = function (dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.t += dt;
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spin) p.mesh.rotation.y += 12 * dt;
      if (p.emit && Math.random() < 0.7) {
        FX.puff(p.mesh.position, 1, p.color, { size: 0.3, grow: 1.5, life: 0.3, alpha: 0.5, speed: 0.2 });
      }
      let dead = p.life <= 0 || p.mesh.position.y < 0;

      if (!dead) {
        for (const t of C.enemiesOf(p.team)) {
          if (p.hit.has(t)) continue;
          const c = t.chestPos();
          const d = p.mesh.position.distanceTo(c);
          if (d < p.radius + (t.radius || 0.5)) {
            p.hit.add(t);
            C.resolveAttack(p.source, t, {
              dmg: p.dmg, posture: p.posture, point: p.mesh.position.clone(),
              status: p.status, kb: p.kb, element: true,
            });
            FX.spark(p.mesh.position, 14, p.color, { speed: 6 });
            if (!p.pierce) { dead = true; break; }
          }
        }
      }
      if (dead) {
        if (p.onExpire) p.onExpire(p.mesh.position.clone());
        FX.puff(p.mesh.position, 3, p.color, { size: 0.4, grow: 2.5, life: 0.25, alpha: 0.7 });
        p.mesh.remove(p.light);
        projScene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        projectiles.splice(i, 1);
      }
    }
  };
})();
