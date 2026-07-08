/* Shinobi Protocol — anim.js
   Procedural keyframe animator. Poses are {bone:[x,y,z]} euler targets plus a
   special "y" channel (root height offset). Bones a clip doesn't touch keep
   the procedural locomotion pose, so legs keep running under a sword swing.
   Everything is exponentially damped toward its target — no pops. */
(function () {
  'use strict';
  const S = window.S, U = S.U;

  const BONES = ['root','spine','chest','neck','shL','elL','wrL','shR','elR','wrR',
                 'hipL','kneeL','ankL','hipR','kneeR','ankR'];

  /* ---------- clip builder ----------
     keys: [ [t, pose, easeName], ... ]   pose may be sparse — missing bones
     are carried from the previous key (first key from the base zero pose).
     events: [ [t, name, data], ... ] */
  function clip(def) {
    const joints = new Set();
    def.keys.forEach((k) => Object.keys(k[1]).forEach((j) => j !== 'y' && joints.add(j)));
    const hasY = def.keys.some((k) => k[1].y !== undefined);
    // normalize: every key carries every joint
    let prev = {};
    joints.forEach((j) => (prev[j] = [0, 0, 0]));
    if (hasY) prev.y = 0;
    const keys = def.keys.map((k) => {
      const full = {};
      joints.forEach((j) => { full[j] = k[1][j] ? k[1][j].slice() : prev[j]; });
      if (hasY) full.y = k[1].y !== undefined ? k[1].y : prev.y;
      prev = full;
      return { t: k[0], pose: full, ease: U.ease[k[2] || 'inout'] };
    });
    return {
      name: def.name, dur: def.dur, keys, joints, hasY,
      events: (def.events || []).slice().sort((a, b) => a[0] - b[0]),
      loop: !!def.loop, rate: def.rate || 22,
    };
  }
  S.clip = clip;

  function samplePose(c, t, out) {
    const keys = c.keys;
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
    const k0 = keys[i], k1 = keys[Math.min(i + 1, keys.length - 1)];
    let u = k1.t > k0.t ? U.clamp((t - k0.t) / (k1.t - k0.t), 0, 1) : 1;
    u = k1.ease(u);
    c.joints.forEach((j) => {
      const a = k0.pose[j], b = k1.pose[j];
      out[j] = [U.lerp(a[0], b[0], u), U.lerp(a[1], b[1], u), U.lerp(a[2], b[2], u)];
    });
    if (c.hasY) out.y = U.lerp(k0.pose.y, k1.pose.y, u);
    return out;
  }

  /* ---------- locomotion pose ---------- */
  // loco: { speed01, phase, grounded, vy, lean, style }
  function locoPose(loco, time, out) {
    BONES.forEach((b) => (out[b] = ZERO));
    out.y = 0;
    const st = loco.style || 'normal';

    if (!loco.grounded) {
      // airborne — blend rising / falling
      const k = U.clamp(-loco.vy / 9, -1, 1); // -1 rising, +1 falling
      out.spine = [0.18 + 0.1 * k, 0, 0];
      out.chest = [0.10, 0, 0];
      out.neck = [-0.15 - 0.1 * k, 0, 0];
      out.hipL = [-0.9 + 0.55 * k, 0, 0.05];
      out.kneeL = [1.3 - 0.5 * k, 0, 0];
      out.hipR = [-0.25 + 0.35 * k, 0, -0.05];
      out.kneeR = [0.6 - 0.25 * k, 0, 0];
      out.ankL = [0.3, 0, 0]; out.ankR = [0.25, 0, 0];
      out.shL = [-0.5 - 0.3 * k, 0, 0.55];
      out.shR = [-0.3, 0, -0.5];
      out.elL = [-0.4, 0, 0]; out.elR = [-0.3, 0, 0];
      return out;
    }

    const sp = loco.speed01, ph = loco.phase;
    const sw = Math.sin(ph), cw = Math.cos(ph);

    if (st === 'zombie') {
      const a = 0.5 * Math.max(sp, 0.25);
      out.root = [0.12, 0.08 * sw, 0.05 * cw];
      out.spine = [0.34, 0.1 * sw, 0];
      out.chest = [0.22, 0, 0.06];
      out.neck = [-0.28, 0.25 * Math.sin(time * 0.7), 0.14];
      out.shL = [-1.15 + 0.12 * sw, 0, 0.12];
      out.shR = [-1.0 - 0.12 * sw, 0, -0.18];
      out.elL = [-0.35, 0, 0]; out.elR = [-0.5, 0, 0];
      out.wrL = [-0.3, 0, 0]; out.wrR = [-0.3, 0, 0];
      out.hipL = [a * sw - 0.05, 0, 0.03];
      out.hipR = [-a * sw - 0.05, 0, -0.03];
      out.kneeL = [Math.max(0, -a * 1.6 * cw) + 0.15, 0, 0];
      out.kneeR = [Math.max(0, a * 1.6 * cw) + 0.15, 0, 0];
      out.ankL = [0.05, 0, 0]; out.ankR = [0.05, 0, 0];
      out.y = -0.06 + 0.02 * Math.sin(2 * ph);
      return out;
    }

    if (st === 'ogre') {
      const a = 0.45 * Math.max(sp, 0.2);
      out.root = [0.08, 0.10 * sw, 0.10 * sw];
      out.spine = [0.18, 0.06 * sw, 0];
      out.chest = [0.12, 0.05 * sw, 0];
      out.neck = [-0.12, 0, 0];
      out.shL = [0.10 + 0.25 * a * sw, 0, 0.42];
      out.shR = [0.10 - 0.25 * a * sw, 0, -0.42];
      out.elL = [-0.55, 0, 0]; out.elR = [-0.55, 0, 0];
      out.hipL = [a * sw, 0, 0.06];
      out.hipR = [-a * sw, 0, -0.06];
      out.kneeL = [Math.max(0, -a * 1.5 * cw) + 0.1, 0, 0];
      out.kneeR = [Math.max(0, a * 1.5 * cw) + 0.1, 0, 0];
      out.y = -0.05 + 0.045 * Math.abs(cw) * sp;
      // idle breathing
      if (sp < 0.05) {
        const br = Math.sin(time * 1.6);
        out.chest = [0.12 + 0.03 * br, 0, 0];
        out.y = -0.04 + 0.015 * br;
      }
      return out;
    }

    // normal humanoid
    if (sp < 0.03) {
      // idle — breathing, slow weight shifts, loose stance
      const br = Math.sin(time * 1.9);
      const shift = Math.sin(time * 0.55); // lazy side-to-side weight
      out.root = [0.02, 0.03 * shift, 0.015 * shift];
      out.spine = [0.03 + 0.012 * br, 0.02 * shift, -0.01 * shift];
      out.chest = [0.03 + 0.02 * br, 0.03 * shift, 0];
      out.neck = [-0.04, -0.04 * shift + 0.03 * Math.sin(time * 0.31), 0];
      out.shL = [0.05, 0, 0.10 + 0.012 * br];
      out.shR = [0.05, 0, -0.10 - 0.012 * br];
      out.elL = [-0.12, 0, 0]; out.elR = [-0.12, 0, 0];
      out.hipL = [-0.03, 0.02, 0.02 + 0.015 * shift];
      out.hipR = [-0.03, -0.02, -0.02 + 0.015 * shift];
      out.kneeL = [0.06 + 0.02 * shift, 0, 0]; out.kneeR = [0.06 - 0.02 * shift, 0, 0];
      out.y = 0.006 * br;
      return out;
    }

    // walk / run cycle — big drive, counter-rotation, real bounce
    const A = 0.95 * sp;             // leg swing
    const bounce = Math.abs(cw);
    const run = U.clamp((sp - 0.45) / 0.55, 0, 1); // extra sprint flavor
    out.root = [0.07 * sp + 0.08 * run, 0.13 * sw * sp, loco.lean * 0.6 + 0.03 * sw * sp];
    out.spine = [0.13 * sp, -0.11 * sw * sp, loco.lean * 0.35];
    out.chest = [0.11 * sp + 0.08 * run, -0.18 * sw * sp, -0.02 * sw * sp];
    out.neck = [-0.12 * sp, 0.16 * sw * sp, 0];
    out.hipL = [A * sw, 0.03, 0.035 + 0.02 * cw * sp];
    out.hipR = [-A * sw, -0.03, -0.035 + 0.02 * cw * sp];
    out.kneeL = [Math.max(0.06, -A * 2.1 * cw), 0, 0];
    out.kneeR = [Math.max(0.06, A * 2.1 * cw), 0, 0];
    out.ankL = [-0.22 * sw * sp + 0.06, 0, 0];
    out.ankR = [0.22 * sw * sp + 0.06, 0, 0];
    out.shL = [-A * (0.9 + 0.35 * run) * sw, 0.05 * sw * sp, 0.10];
    out.shR = [A * (0.9 + 0.35 * run) * sw, 0.05 * sw * sp, -0.10];
    out.elL = [-0.4 * sp - Math.max(0, -sw) * (0.45 + 0.4 * run) * sp, 0, 0];
    out.elR = [-0.4 * sp - Math.max(0, sw) * (0.45 + 0.4 * run) * sp, 0, 0];
    out.wrL = [-0.15 * sp, 0, 0]; out.wrR = [-0.15 * sp, 0, 0];
    out.y = -0.025 * sp + (0.055 + 0.03 * run) * bounce * sp * sp;
    return out;
  }

  const ZERO = [0, 0, 0];

  /* ---------- Animator ---------- */
  S.Animator = class Animator {
    constructor(rig) {
      this.rig = rig;
      this.bones = rig.bones;
      this.time = Math.random() * 10;
      this.clip = null;
      this.clipT = 0;
      this.speed = 1;
      this.evIdx = 0;
      this.onEvent = null;
      this.stance = null;   // persistent pose merged over locomotion (weapon carry)
      this.overlay = null;  // guard / parry pose, merged over stance
      this.loco = { speed01: 0, phase: 0, grounded: true, vy: 0, lean: 0, style: 'normal' };
      this.baseRate = 12;
      this._pose = {};
      this._rootBase = rig.bones.root.userData.baseY || rig.bones.root.position.y;
    }

    play(c, opts) {
      opts = opts || {};
      this.clip = c;
      this.clipT = opts.startT || 0;
      this.speed = opts.speed || 1;
      this.evIdx = 0;
      // skip events before startT
      while (this.evIdx < c.events.length && c.events[this.evIdx][0] < this.clipT) this.evIdx++;
    }

    stop() { this.clip = null; }
    get playing() { return !!this.clip; }
    // fraction through current clip (1 when idle)
    get clipFrac() { return this.clip ? this.clipT / this.clip.dur : 1; }

    update(dt) {
      this.time += dt;
      const pose = this._pose;
      locoPose(this.loco, this.time, pose);

      // stance & overlay merge (over locomotion, under clips)
      if (this.stance) for (const j in this.stance) pose[j] = this.stance[j];
      if (this.overlay) for (const j in this.overlay) pose[j] = this.overlay[j];

      let rate = this.baseRate;
      if (this.clip) {
        const c = this.clip;
        this.clipT += dt * this.speed;
        while (this.evIdx < c.events.length && c.events[this.evIdx][0] <= this.clipT) {
          const ev = c.events[this.evIdx++];
          if (this.onEvent) this.onEvent(ev[1], ev[2]);
        }
        if (this.clipT >= c.dur) {
          if (c.loop) { this.clipT %= c.dur; this.evIdx = 0; }
          else { this.clip = null; if (this.onEvent) this.onEvent('end', c.name); }
        }
        if (this.clip) {
          const sampled = {};
          samplePose(c, this.clipT, sampled);
          for (const j in sampled) pose[j] = sampled[j];
          rate = c.rate;
        }
      }

      const k = U.damp(rate, dt);
      for (const name of BONES) {
        const b = this.bones[name];
        if (!b) continue;
        const t = pose[name] || ZERO;
        b.rotation.x += (t[0] - b.rotation.x) * k;
        b.rotation.y += (t[1] - b.rotation.y) * k;
        b.rotation.z += (t[2] - b.rotation.z) * k;
      }
      const root = this.bones.root;
      const ty = this._rootBase + (pose.y || 0);
      root.position.y += (ty - root.position.y) * k;
    }

    // hard-snap to current targets (used on spawn)
    snap() {
      const pose = this._pose;
      locoPose(this.loco, this.time, pose);
      if (this.stance) for (const j in this.stance) pose[j] = this.stance[j];
      for (const name of BONES) {
        const b = this.bones[name]; if (!b) continue;
        const t = pose[name] || ZERO;
        b.rotation.set(t[0], t[1], t[2]);
      }
    }
  };

  /* =====================================================================
     CLIP LIBRARY
     Conventions (bones point down -Y, character faces +Z):
       limb rotation.x  : negative = swings forward, positive = backward
       torso rotation.x : positive = lean forward
       chest rotation.y : negative = right(-X) shoulder pulls back
       arm  rotation.z  : moves arm toward +X (left side); negate for right arm
     ===================================================================== */
  const CL = (S.clips = {});

  /* ---------- enemy weight: stretch the windup, keep the strike fast ----------
     Rescales everything before the first hitOn by `factor`, shifts the rest,
     and drops a 'glint' event just before the strike as a read cue. */
  S.slowWindup = function (c, factor) {
    const hitEv = c.events.find((e) => e[1] === 'hitOn');
    if (!hitEv || factor === 1) return c;
    const tHit = hitEv[0];
    const shift = tHit * (factor - 1);
    const remap = (t) => (t <= tHit ? t * factor : t + shift);
    const out = {
      name: c.name + 'H', dur: c.dur + shift,
      keys: c.keys.map((k) => ({ t: remap(k.t), pose: k.pose, ease: k.ease })),
      joints: c.joints, hasY: c.hasY,
      events: c.events.map((e) => [remap(e[0]), e[1], e[2]]),
      loop: c.loop, rate: c.rate,
    };
    out.events.push([Math.max(0.05, tHit * factor - 0.22), 'glint', null]);
    out.events.sort((a, b) => a[0] - b[0]);
    return out;
  };

  /* ---------- weapon stances (persistent carry poses) ---------- */
  S.stances = {
    katana: {
      shR: [-0.35, 0, -0.22], elR: [-0.55, 0.2, 0], wrR: [-0.25, 0, 0],
      shL: [0.05, 0, 0.14], elL: [-0.25, 0, 0],
      chest: [0.05, 0.12, 0], spine: [0.03, 0.06, 0],
    },
    greatsword: { // rested on the right shoulder
      shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0],
      shL: [0.1, 0, 0.18], elL: [-0.3, 0, 0],
      chest: [0.02, 0.22, 0.05], spine: [0.02, 0.1, 0],
    },
    spear: { // couched at the hip: rear hand low, lead hand on the shaft, tip at the foe
      shR: [-0.42, 0.1, -0.28], elR: [-0.82, -0.15, 0], wrR: [-0.35, 0, 0],
      shL: [-0.95, 0.35, 0.18], elL: [-0.55, 0, 0], wrL: [-0.3, 0, 0],
      chest: [0.07, -0.42, 0.02], spine: [0.05, -0.18, 0], neck: [-0.05, 0.32, 0],
      hipL: [-0.12, 0.06, 0.03], hipR: [0.06, -0.06, -0.03],
      kneeL: [0.14, 0, 0], kneeR: [0.1, 0, 0],
    },
  };

  /* ---------- guard / parry overlays ---------- */
  S.overlays = {
    guard: {
      shR: [-1.35, 0.25, -0.35], elR: [-1.05, 0.5, 0], wrR: [-0.5, 0.3, 0.5],
      shL: [-0.85, 0, 0.45], elL: [-1.3, 0, 0],
      chest: [0.10, 0.35, 0], spine: [0.06, 0.15, 0], neck: [-0.1, -0.2, 0],
      hipL: [-0.12, 0.05, 0.04], hipR: [0.1, -0.05, -0.04],
      kneeL: [0.18, 0, 0], kneeR: [0.15, 0, 0],
    },
  };

  /* ---------- shared humanoid clips ---------- */
  CL.parry = clip({
    name: 'parry', dur: 0.34, rate: 30,
    keys: [
      [0, { shR: [-0.9, 0.1, -0.3], elR: [-0.8, 0.3, 0], wrR: [-0.4, 0, 0.2], chest: [0.06, 0.2, 0] }],
      [0.07, { shR: [-1.5, 0.35, -0.5], elR: [-1.15, 0.6, 0], wrR: [-0.6, 0.4, 0.7],
               shL: [-0.5, 0, 0.3], chest: [0.1, 0.42, 0], spine: [0.05, 0.18, 0] }, 'out'],
      [0.20, { shR: [-1.4, 0.3, -0.45], elR: [-1.1, 0.55, 0], wrR: [-0.55, 0.35, 0.6] }],
      [0.34, { shR: [-0.6, 0, -0.25], elR: [-0.5, 0.2, 0], wrR: [-0.3, 0, 0.1],
               shL: [0, 0, 0.12], chest: [0.05, 0.15, 0], spine: [0.03, 0.08, 0] }, 'inout'],
    ],
    events: [[0.0, 'sfx', 'whoosh']],
  });

  CL.parrySuccess = clip({ // recoil after a successful deflect — crisp ring back
    name: 'parrySuccess', dur: 0.30, rate: 30,
    keys: [
      [0, { shR: [-1.5, 0.35, -0.5], elR: [-1.15, 0.6, 0], wrR: [-0.6, 0.4, 0.7], chest: [0.1, 0.42, 0] }],
      [0.06, { shR: [-1.8, 0.5, -0.8], elR: [-0.9, 0.7, 0], wrR: [-0.8, 0.5, 0.9],
               chest: [0.04, 0.6, 0.06], spine: [0.02, 0.25, 0], neck: [-0.1, -0.15, 0] }, 'snap'],
      [0.30, { shR: [-0.9, 0.15, -0.35], elR: [-0.8, 0.35, 0], wrR: [-0.4, 0.1, 0.3],
               chest: [0.08, 0.25, 0], spine: [0.04, 0.1, 0], neck: [0, 0, 0] }],
    ],
  });

  /* dodges — quick whole-body lunges; movement handled by controller physics */
  function dashClip(name, pose1, pose2) {
    return clip({
      name, dur: 0.34, rate: 26,
      keys: [[0, pose1, 'out'], [0.12, pose2, 'out'], [0.34, {}, 'inout']],
    });
  }
  CL.dashF = dashClip('dashF',
    { spine: [0.3, 0, 0], chest: [0.35, 0, 0], neck: [-0.3, 0, 0], y: -0.12,
      hipL: [-0.9, 0, 0.05], kneeL: [1.1, 0, 0], hipR: [0.5, 0, -0.05], kneeR: [0.35, 0, 0],
      shL: [-0.7, 0, 0.4], shR: [0.6, 0, -0.4], elL: [-0.6, 0, 0], elR: [-0.3, 0, 0] },
    { spine: [0.42, 0, 0], chest: [0.4, 0, 0], neck: [-0.35, 0, 0], y: -0.18,
      hipL: [0.5, 0, 0.05], kneeL: [0.3, 0, 0], hipR: [-0.9, 0, -0.05], kneeR: [1.2, 0, 0],
      shL: [0.5, 0, 0.4], shR: [-0.6, 0, -0.4], elL: [-0.3, 0, 0], elR: [-0.5, 0, 0] });
  CL.dashB = dashClip('dashB',
    { spine: [-0.22, 0, 0], chest: [-0.18, 0, 0], neck: [0.15, 0, 0], y: -0.14,
      hipL: [-0.5, 0, 0.05], kneeL: [0.9, 0, 0], hipR: [0.35, 0, -0.05], kneeR: [0.5, 0, 0],
      shL: [-0.5, 0, 0.5], shR: [-0.5, 0, -0.5], elL: [-0.4, 0, 0], elR: [-0.4, 0, 0] },
    { spine: [-0.12, 0, 0], chest: [-0.08, 0, 0], y: -0.1,
      hipL: [0.2, 0, 0.05], kneeL: [0.35, 0, 0], hipR: [-0.35, 0, -0.05], kneeR: [0.6, 0, 0] });
  CL.dashL = dashClip('dashL', // toward +X
    { root: [0, 0, -0.28], spine: [0.12, 0, -0.3], chest: [0.1, 0, -0.25], neck: [0, 0, 0.3], y: -0.14,
      hipL: [-0.7, 0, 0.35], kneeL: [1.0, 0, 0], hipR: [0.2, 0, -0.4], kneeR: [0.6, 0, 0],
      shL: [-0.3, 0, 0.9], shR: [0.2, 0, -0.5], elL: [-0.4, 0, 0] },
    { root: [0, 0, -0.16], spine: [0.1, 0, -0.16], chest: [0.08, 0, -0.12], y: -0.1,
      hipL: [0.1, 0, 0.15], kneeL: [0.4, 0, 0], hipR: [-0.4, 0, -0.2], kneeR: [0.8, 0, 0] });
  CL.dashR = dashClip('dashR', // toward -X
    { root: [0, 0, 0.28], spine: [0.12, 0, 0.3], chest: [0.1, 0, 0.25], neck: [0, 0, -0.3], y: -0.14,
      hipR: [-0.7, 0, -0.35], kneeR: [1.0, 0, 0], hipL: [0.2, 0, 0.4], kneeL: [0.6, 0, 0],
      shR: [-0.3, 0, -0.9], shL: [0.2, 0, 0.5], elR: [-0.4, 0, 0] },
    { root: [0, 0, 0.16], spine: [0.1, 0, 0.16], chest: [0.08, 0, 0.12], y: -0.1,
      hipR: [0.1, 0, -0.15], kneeR: [0.4, 0, 0], hipL: [-0.4, 0, 0.2], kneeL: [0.8, 0, 0] });

  /* flinch — taking a hit */
  CL.flinch = clip({
    name: 'flinch', dur: 0.38, rate: 26,
    keys: [
      [0, {}],
      [0.06, { spine: [-0.3, 0.15, 0], chest: [-0.3, 0.2, 0.08], neck: [0.35, 0.2, 0.1],
               shL: [-0.6, 0, 0.5], shR: [-0.4, 0, -0.5], elL: [-0.7, 0, 0], elR: [-0.6, 0, 0],
               y: -0.05 }, 'snap'],
      [0.38, {}, 'inout'],
    ],
  });

  CL.blockHit = clip({ // guard shoved by an impact
    name: 'blockHit', dur: 0.3, rate: 28,
    keys: [
      [0, { shR: [-1.35, 0.25, -0.35], elR: [-1.05, 0.5, 0], chest: [0.1, 0.35, 0] }],
      [0.05, { shR: [-1.6, 0.3, -0.2], elR: [-1.35, 0.5, 0], chest: [-0.12, 0.4, 0],
               spine: [-0.1, 0.15, 0], neck: [0.2, 0, 0], y: -0.06 }, 'snap'],
      [0.3, { shR: [-1.35, 0.25, -0.35], elR: [-1.05, 0.5, 0], chest: [0.1, 0.35, 0],
              spine: [0.06, 0.15, 0], neck: [-0.1, 0, 0], y: 0 }],
    ],
  });

  CL.deflected = clip({ // your attack was parried — big recoil, weapon flung wide
    name: 'deflected', dur: 0.55, rate: 24,
    keys: [
      [0, {}],
      [0.08, { shR: [-2.2, -0.3, -1.1], elR: [-0.4, 0, 0], wrR: [-0.5, 0, 0],
               chest: [-0.2, -0.5, -0.1], spine: [-0.12, -0.2, 0], neck: [0.25, 0.3, 0],
               shL: [-0.8, 0, 0.7], y: -0.08 }, 'snap'],
      [0.28, { shR: [-1.8, -0.2, -0.9], chest: [-0.1, -0.35, -0.05] }],
      [0.55, {}, 'inout'],
    ],
  });

  /* posture broken — long stagger, wide open */
  CL.postureBreak = clip({
    name: 'postureBreak', dur: 1.5, rate: 18,
    keys: [
      [0, {}],
      [0.10, { spine: [-0.42, 0.1, 0.1], chest: [-0.38, 0.15, 0.1], neck: [0.45, 0.2, 0],
               shL: [-1.3, 0, 0.9], shR: [-1.1, 0, -0.9], elL: [-0.5, 0, 0], elR: [-0.5, 0, 0],
               hipL: [-0.3, 0, 0.1], hipR: [0.25, 0, -0.1], kneeL: [0.5, 0, 0], kneeR: [0.4, 0, 0],
               y: -0.1 }, 'snap'],
      [0.45, { spine: [-0.25, -0.1, -0.08], chest: [-0.2, -0.12, -0.06], neck: [0.3, -0.15, 0],
               shL: [-0.6, 0, 0.7], shR: [-0.5, 0, -0.7], y: -0.16,
               kneeL: [0.7, 0, 0], kneeR: [0.65, 0, 0], hipL: [-0.45, 0, 0.1], hipR: [-0.1, 0, -0.1] }],
      [1.0, { spine: [-0.15, 0.05, 0.05], chest: [-0.12, 0.06, 0.04], neck: [0.2, 0.1, 0], y: -0.13 }],
      [1.5, {}, 'inout'],
    ],
    events: [[0.0, 'sfx', 'stagger']],
  });

  CL.death = clip({
    name: 'death', dur: 1.1, rate: 14,
    keys: [
      [0, {}],
      [0.12, { spine: [-0.3, 0, 0.1], chest: [-0.3, 0, 0.1], neck: [0.4, 0, 0],
               shL: [-1.2, 0, 0.8], shR: [-1.0, 0, -0.8], y: -0.05 }, 'out'],
      [0.55, { root: [-1.35, 0, 0.08], spine: [-0.12, 0, 0], chest: [-0.1, 0, 0], neck: [0.3, 0, 0.1],
               shL: [-0.4, 0, 0.6], shR: [-0.3, 0, -0.7], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0],
               hipL: [0.15, 0, 0.06], hipR: [0.1, 0, -0.08], kneeL: [0.25, 0, 0], kneeR: [0.2, 0, 0],
               y: -0.72 }, 'in'],
      [0.75, { root: [-1.5, 0, 0.08], y: -0.80 }, 'out'],
      [1.1, { root: [-1.5, 0, 0.08], y: -0.80 }],
    ],
  });

  CL.interact = clip({
    name: 'interact', dur: 0.7, rate: 20,
    keys: [
      [0, {}],
      [0.2, { spine: [0.35, 0, 0], chest: [0.3, 0, 0], neck: [-0.2, 0, 0],
              shL: [-1.2, 0, 0.15], elL: [-0.3, 0, 0], y: -0.15,
              kneeL: [0.5, 0, 0], kneeR: [0.5, 0, 0], hipL: [-0.4, 0, 0.05], hipR: [-0.35, 0, -0.05] }, 'out'],
      [0.45, { spine: [0.32, 0, 0], y: -0.14 }],
      [0.7, {}, 'inout'],
    ],
  });

  /* ---------- KATANA ---------- */
  CL.kat1 = clip({ // wide horizontal slash — whole body coils then whips through
    name: 'kat1', dur: 0.56, rate: 26,
    keys: [
      [0, { shR: [-0.35, 0, -0.22], elR: [-0.55, 0.2, 0], wrR: [-0.25, 0, 0], chest: [0.05, 0.12, 0] }],
      [0.16, { root: [0.02, -0.38, 0.06], spine: [0.06, -0.36, 0.04], chest: [0.08, -0.78, 0.1],
               neck: [-0.05, 0.6, 0],
               shR: [-2.35, -0.3, -1.15], elR: [-0.8, 0.15, 0], wrR: [-1.0, 0, -0.5],
               shL: [-0.8, 0, 0.55], elL: [-0.95, 0, 0],
               hipR: [0.28, -0.1, -0.06], hipL: [-0.32, 0.1, 0.05],
               kneeL: [0.5, 0, 0], kneeR: [0.22, 0, 0], y: -0.07 }, 'out'],
      [0.29, { root: [0.02, 0.42, -0.05], spine: [0.14, 0.44, -0.04], chest: [0.2, 0.88, -0.1],
               neck: [-0.1, -0.6, 0],
               shR: [-1.35, 0.5, 0.9], elR: [-0.1, 0, 0], wrR: [-0.35, 0, 1.0],
               shL: [0.5, 0, 0.7], elL: [-0.35, 0, 0],
               hipR: [-0.45, 0.1, -0.05], hipL: [0.28, -0.08, 0.05],
               kneeR: [0.55, 0, 0], kneeL: [0.15, 0, 0], y: -0.11 }, 'snap'],
      [0.38, { root: [0.02, 0.46, -0.05], chest: [0.18, 0.98, -0.1], shR: [-1.15, 0.55, 1.05], y: -0.09 }],
      [0.56, { root: [0, 0.05, 0], spine: [0.04, 0.08, 0], chest: [0.05, 0.15, 0], neck: [0, 0, 0],
               shR: [-0.5, 0.1, -0.1], elR: [-0.5, 0.2, 0], wrR: [-0.3, 0, 0.1],
               shL: [0.05, 0, 0.14], elL: [-0.25, 0, 0],
               hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
               y: 0 }, 'inout'],
    ],
    events: [
      [0.14, 'sfx', 'whoosh'], [0.18, 'move', { f: 3.8 }],
      [0.21, 'hitOn', null], [0.36, 'hitOff', null], [0.19, 'trail', 0.22],
    ],
  });

  CL.kat2 = clip({ // return cut — rising diagonal, body unwinds the other way
    name: 'kat2', dur: 0.54, rate: 26,
    keys: [
      [0, { root: [0.02, 0.42, -0.05], shR: [-1.15, 0.55, 1.05], elR: [-0.2, 0, 0], wrR: [-0.4, 0, 0.9],
            chest: [0.18, 0.9, -0.1] }],
      [0.13, { root: [0.04, 0.5, -0.06], spine: [0.1, 0.42, -0.04], chest: [0.2, 0.95, -0.1],
               neck: [-0.08, -0.6, 0],
               shR: [-0.85, 0.6, 1.1], elR: [-0.5, 0, 0], wrR: [-0.1, 0, 1.2],
               shL: [0.45, 0, 0.6], kneeL: [0.35, 0, 0], kneeR: [0.5, 0, 0], y: -0.12 }, 'out'],
      [0.26, { root: [0, -0.45, 0.06], spine: [0.05, -0.4, 0.05], chest: [0.08, -0.85, 0.1],
               neck: [-0.02, 0.6, 0],
               shR: [-1.85, -0.4, -0.9], elR: [-0.2, 0, 0], wrR: [-0.8, 0, -0.8],
               shL: [-0.55, 0, 0.35], elL: [-0.7, 0, 0],
               hipR: [0.28, -0.1, -0.06], hipL: [-0.28, 0.1, 0.05],
               kneeL: [0.45, 0, 0], y: -0.08 }, 'snap'],
      [0.36, { root: [0, -0.5, 0.06], shR: [-2.0, -0.45, -1.0], chest: [0.06, -0.9, 0.1] }],
      [0.54, { root: [0, 0, 0], spine: [0.03, 0.06, 0], chest: [0.05, 0.12, 0], neck: [0, 0, 0],
               shR: [-0.45, 0, -0.2], elR: [-0.55, 0.2, 0], wrR: [-0.25, 0, 0],
               shL: [0.05, 0, 0.14], elL: [-0.25, 0, 0],
               hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
               y: 0 }, 'inout'],
    ],
    events: [
      [0.11, 'sfx', 'whoosh'], [0.15, 'move', { f: 3.8 }],
      [0.18, 'hitOn', null], [0.33, 'hitOff', null], [0.16, 'trail', 0.21],
    ],
  });

  CL.kat3 = clip({ // finisher — rise onto the toes, then bring heaven down
    name: 'kat3', dur: 0.66, rate: 26,
    keys: [
      [0, { shR: [-0.45, 0, -0.2], chest: [0.05, 0.12, 0] }],
      [0.19, { root: [-0.06, -0.12, 0], spine: [-0.14, -0.08, 0], chest: [-0.22, -0.18, 0],
               neck: [0.22, 0.1, 0],
               shR: [-3.05, 0, -0.45], elR: [-0.55, 0, 0], wrR: [-0.45, 0, 0],
               shL: [-1.9, 0, 0.5], elL: [-1.0, 0, 0],
               kneeL: [0.2, 0, 0], kneeR: [0.2, 0, 0], hipL: [-0.15, 0, 0.04], hipR: [-0.15, 0, -0.04],
               y: 0.06 }, 'out'],
      [0.33, { root: [0.08, 0.06, 0], spine: [0.32, 0, 0], chest: [0.55, 0.1, 0],
               neck: [-0.45, 0, 0],
               shR: [-0.65, 0, -0.1], elR: [-0.1, 0, 0], wrR: [-1.45, 0, 0],
               shL: [0.5, 0, 0.45], elL: [-0.3, 0, 0],
               hipL: [-0.7, 0, 0.05], kneeL: [1.0, 0, 0], hipR: [0.35, 0, -0.05], kneeR: [0.35, 0, 0],
               y: -0.17 }, 'snap'],
      [0.46, { shR: [-0.5, 0, -0.05], wrR: [-1.55, 0, 0], chest: [0.6, 0.1, 0], y: -0.19 }],
      [0.66, { root: [0, 0.02, 0], spine: [0.04, 0.06, 0], chest: [0.05, 0.12, 0], neck: [0, 0, 0],
               shR: [-0.4, 0, -0.2], elR: [-0.5, 0.2, 0], wrR: [-0.3, 0, 0],
               shL: [0.05, 0, 0.14], elL: [-0.25, 0, 0],
               hipL: [0, 0, 0.03], hipR: [0, 0, -0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
               y: 0 }, 'inout'],
    ],
    events: [
      [0.21, 'sfx', 'whooshBig'], [0.26, 'move', { f: 5.2 }],
      [0.29, 'hitOn', { mult: 1.35 }], [0.44, 'hitOff', null], [0.26, 'trail', 0.24],
    ],
  });

  /* ---------- GREATSWORD ---------- */
  CL.gs1 = clip({ // colossal cleave — the whole body torques into it, then over-spins
    name: 'gs1', dur: 1.0, rate: 22,
    keys: [
      [0, { shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0], chest: [0.02, 0.22, 0.05] }],
      [0.30, { root: [0.02, -0.5, 0.08], spine: [0.05, -0.42, 0.05], chest: [0.06, -0.95, 0.12],
               neck: [-0.02, 0.7, 0],
               shR: [-2.45, -0.35, -1.2], elR: [-0.4, 0, 0], wrR: [-0.5, 0, -0.5],
               shL: [-1.0, 0, 0.5], elL: [-1.05, 0, 0],
               hipR: [0.35, -0.12, -0.07], hipL: [-0.4, 0.12, 0.06],
               kneeL: [0.55, 0, 0], kneeR: [0.25, 0, 0], y: -0.12 }, 'inout'],
      [0.40, { root: [0.02, -0.55, 0.08], chest: [0.06, -1.0, 0.12], y: -0.14 }],
      [0.55, { root: [0.04, 0.6, -0.08], spine: [0.18, 0.5, -0.05], chest: [0.26, 1.0, -0.12],
               neck: [-0.12, -0.7, 0],
               shR: [-1.45, 0.55, 1.0], elR: [-0.05, 0, 0], wrR: [-0.55, 0, 0.85],
               shL: [0.6, 0, 0.75], elL: [-0.4, 0, 0],
               hipR: [-0.5, 0.12, -0.06], hipL: [0.35, -0.1, 0.05],
               kneeR: [0.6, 0, 0], kneeL: [0.2, 0, 0], y: -0.16 }, 'snap'],
      [0.70, { root: [0.04, 0.72, -0.08], chest: [0.24, 1.12, -0.12],
               shR: [-1.2, 0.6, 1.2], neck: [-0.1, -0.75, 0], y: -0.13 }],
      [1.0, { root: [0, 0.05, 0], spine: [0.02, 0.1, 0], chest: [0.02, 0.22, 0.05], neck: [0, 0, 0],
              shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0],
              shL: [0.1, 0, 0.18], elL: [-0.3, 0, 0],
              hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
              y: 0 }, 'inout'],
    ],
    events: [
      [0.33, 'sfx', 'whooshBig'], [0.46, 'move', { f: 4.4 }],
      [0.48, 'hitOn', null], [0.68, 'hitOff', null], [0.46, 'trail', 0.3],
    ],
  });

  CL.gs2 = clip({ // earth-splitter — arch back to the sky, then fold the world in half
    name: 'gs2', dur: 1.1, rate: 22,
    keys: [
      [0, { shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0], chest: [0.02, 0.22, 0.05] }],
      [0.34, { root: [-0.1, 0, 0], spine: [-0.24, 0, 0], chest: [-0.38, 0, 0], neck: [0.35, 0, 0],
               shR: [-3.2, 0, -0.3], elR: [-0.4, 0, 0], wrR: [-0.15, 0, 0],
               shL: [-2.8, 0, 0.35], elL: [-0.55, 0, 0],
               kneeL: [0.2, 0, 0], kneeR: [0.2, 0, 0], hipL: [-0.1, 0, 0.05], hipR: [-0.1, 0, -0.05],
               y: 0.05 }, 'inout'],
      [0.46, { root: [-0.12, 0, 0], chest: [-0.42, 0, 0], y: 0.07 }],
      [0.58, { root: [0.1, 0, 0], spine: [0.42, 0, 0], chest: [0.68, 0, 0], neck: [-0.5, 0, 0],
               shR: [-0.5, 0, -0.1], elR: [-0.05, 0, 0], wrR: [-1.5, 0, 0],
               shL: [-0.25, 0, 0.3], elL: [-0.3, 0, 0],
               hipL: [-0.75, 0, 0.05], kneeL: [1.05, 0, 0], hipR: [0.35, 0, -0.05], kneeR: [0.45, 0, 0],
               y: -0.26 }, 'snap'],
      [0.74, { wrR: [-1.6, 0, 0], chest: [0.72, 0, 0], y: -0.28 }],
      [1.1, { root: [0, 0, 0], spine: [0.02, 0.1, 0], chest: [0.02, 0.22, 0.05], neck: [0, 0, 0],
              shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0],
              shL: [0.1, 0, 0.18], elL: [-0.3, 0, 0],
              hipL: [0, 0, 0.03], hipR: [0, 0, -0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
              y: 0 }, 'inout'],
    ],
    events: [
      [0.38, 'sfx', 'whooshBig'], [0.52, 'move', { f: 3.8 }],
      [0.54, 'hitOn', { mult: 1.3 }], [0.72, 'hitOff', null], [0.52, 'trail', 0.32],
      [0.62, 'shake', 0.3],
    ],
  });

  /* ---------- SPEAR — couched grip, every attack is a thrust ----------
     The shaft rides the forearm line, so extending the rear arm IS the
     thrust; wrR.x levels the tip as the arm comes up to horizontal. */
  const SPEAR_BASE = {
    shR: [-0.42, 0.1, -0.28], elR: [-0.82, -0.15, 0], wrR: [-0.35, 0, 0],
    shL: [-0.95, 0.35, 0.18], elL: [-0.55, 0, 0], wrL: [-0.3, 0, 0],
    chest: [0.07, -0.42, 0.02], spine: [0.05, -0.18, 0], neck: [-0.05, 0.32, 0],
    hipL: [-0.12, 0.06, 0.03], hipR: [0.06, -0.06, -0.03],
    kneeL: [0.14, 0, 0], kneeR: [0.1, 0, 0], root: [0, 0, 0], y: 0,
  };

  CL.sp1 = clip({ // snap thrust — coil the hips, punch the point out
    name: 'sp1', dur: 0.5, rate: 27,
    keys: [
      [0, SPEAR_BASE],
      [0.13, { root: [0.02, -0.2, 0.03], spine: [0.05, -0.34, 0], chest: [0.06, -0.72, 0.04],
               neck: [-0.05, 0.55, 0],
               shR: [-0.12, 0.15, -0.4], elR: [-1.3, -0.2, 0], wrR: [0.08, 0, 0],
               shL: [-1.15, 0.45, 0.12], elL: [-0.3, 0, 0],
               hipR: [0.2, -0.08, -0.05], hipL: [-0.25, 0.08, 0.04],
               kneeL: [0.35, 0, 0], y: -0.07 }, 'out'],
      [0.25, { root: [0.03, 0.1, -0.03], spine: [0.12, 0.12, 0], chest: [0.16, 0.22, -0.04],
               neck: [-0.12, -0.3, 0],
               shR: [-1.3, 0, -0.5], elR: [-0.05, 0, 0], wrR: [-0.25, 0, 0],
               shL: [-0.25, 0, 0.65], elL: [-0.3, 0, 0],
               hipL: [-0.55, 0.05, 0.04], kneeL: [0.7, 0, 0], hipR: [0.4, -0.05, -0.04],
               y: -0.13 }, 'snap'],
      [0.33, { shR: [-1.35, 0, -0.52], chest: [0.17, 0.24, -0.04] }],
      [0.5, SPEAR_BASE, 'inout'],
    ],
    events: [
      [0.12, 'sfx', 'whoosh'], [0.18, 'move', { f: 3.6 }],
      [0.20, 'hitOn', { thrust: true }], [0.32, 'hitOff', null], [0.18, 'trail', 0.16],
    ],
  });

  CL.sp2 = clip({ // rising second thrust — steps through with the other foot
    name: 'sp2', dur: 0.54, rate: 26,
    keys: [
      [0, SPEAR_BASE],
      [0.15, { root: [0.03, -0.28, 0.04], spine: [0.08, -0.4, 0], chest: [0.1, -0.8, 0.06],
               neck: [-0.08, 0.6, 0],
               shR: [0.0, 0.2, -0.5], elR: [-1.45, -0.25, 0], wrR: [0, 0, 0],
               shL: [-1.2, 0.5, 0.1], elL: [-0.25, 0, 0],
               hipR: [-0.2, -0.08, -0.05], hipL: [0.15, 0.08, 0.04],
               kneeR: [0.45, 0, 0], y: -0.11 }, 'out'],
      [0.28, { root: [0.04, 0.1, -0.04], spine: [0.14, 0.12, 0], chest: [0.2, 0.22, -0.05],
               neck: [-0.15, -0.32, 0],
               shR: [-1.45, 0, -0.5], elR: [0, 0, 0], wrR: [-0.25, 0, 0],
               shL: [-0.2, 0, 0.7], elL: [-0.25, 0, 0],
               hipR: [-0.6, 0.05, -0.04], kneeR: [0.75, 0, 0], hipL: [0.4, -0.05, 0.04],
               y: -0.16 }, 'snap'],
      [0.37, { shR: [-1.5, 0, -0.52], chest: [0.21, 0.26, -0.05] }],
      [0.54, SPEAR_BASE, 'inout'],
    ],
    events: [
      [0.14, 'sfx', 'whoosh'], [0.21, 'move', { f: 4.0 }],
      [0.23, 'hitOn', { thrust: true }], [0.36, 'hitOff', null], [0.21, 'trail', 0.17],
    ],
  });

  CL.sp3 = clip({ // lunging skewer — full extension, body flat behind the point
    name: 'sp3', dur: 0.66, rate: 26,
    keys: [
      [0, SPEAR_BASE],
      [0.2, { root: [0.04, -0.32, 0.05], spine: [0.1, -0.42, 0], chest: [0.12, -0.85, 0.06],
              neck: [-0.1, 0.65, 0],
              shR: [-0.05, 0.2, -0.5], elR: [-1.5, -0.25, 0], wrR: [0, 0, 0],
              shL: [-1.25, 0.55, 0.1], elL: [-0.2, 0, 0],
              kneeL: [0.55, 0, 0], kneeR: [0.55, 0, 0], hipL: [-0.35, 0.08, 0.04], hipR: [-0.3, -0.08, -0.04],
              y: -0.2 }, 'out'],
      [0.33, { root: [0.06, 0.12, -0.05], spine: [0.28, 0.14, 0], chest: [0.5, 0.24, -0.06],
               neck: [-0.42, -0.32, 0],
               shR: [-1.55, 0, -0.5], elR: [0, 0, 0], wrR: [-0.3, 0, 0],
               shL: [-0.15, 0, 0.8], elL: [-0.2, 0, 0],
               hipL: [-0.75, 0.05, 0.04], kneeL: [0.85, 0, 0], hipR: [0.55, -0.05, -0.04], kneeR: [0.1, 0, 0],
               y: -0.22 }, 'snap'],
      [0.45, { shR: [-1.6, 0, -0.52], chest: [0.52, 0.26, -0.06], y: -0.24 }],
      [0.66, SPEAR_BASE, 'inout'],
    ],
    events: [
      [0.19, 'sfx', 'whooshBig'], [0.28, 'move', { f: 7.2 }],
      [0.30, 'hitOn', { thrust: true, mult: 1.25 }], [0.44, 'hitOff', null], [0.28, 'trail', 0.2],
    ],
  });

  /* ---------- air attacks ---------- */
  CL.airAtk = clip({ // swords: arch back midair, then guillotine down
    name: 'airAtk', dur: 0.52, rate: 28,
    keys: [
      [0, { shR: [-0.5, 0, -0.3], chest: [0.1, 0, 0] }],
      [0.10, { root: [-0.15, -0.15, 0], spine: [-0.2, -0.1, 0], chest: [-0.3, -0.2, 0], neck: [0.3, 0.15, 0],
               shR: [-3.0, 0, -0.5], elR: [-0.55, 0, 0], wrR: [-0.35, 0, 0],
               shL: [-1.5, 0, 0.6], elL: [-0.8, 0, 0],
               hipL: [-0.9, 0, 0.05], kneeL: [1.35, 0, 0], hipR: [-0.35, 0, -0.05], kneeR: [0.7, 0, 0] }, 'out'],
      [0.22, { root: [0.2, 0.1, 0], spine: [0.4, 0.05, 0], chest: [0.6, 0.12, 0], neck: [-0.45, 0, 0],
               shR: [-0.55, 0, -0.05], elR: [-0.05, 0, 0], wrR: [-1.5, 0, 0],
               shL: [0.55, 0, 0.5], elL: [-0.3, 0, 0],
               hipL: [-0.6, 0, 0.05], kneeL: [1.0, 0, 0], hipR: [0.25, 0, -0.05], kneeR: [0.45, 0, 0] }, 'snap'],
      [0.52, { root: [0.05, 0, 0], shR: [-0.5, 0, -0.2], elR: [-0.4, 0, 0], wrR: [-0.4, 0, 0],
               chest: [0.25, 0, 0], spine: [0.15, 0, 0], neck: [-0.12, 0, 0],
               hipL: [-0.45, 0, 0.05], kneeL: [0.75, 0, 0], hipR: [-0.2, 0, -0.05], kneeR: [0.5, 0, 0] }, 'inout'],
    ],
    events: [
      [0.08, 'sfx', 'whooshBig'],
      [0.14, 'hitOn', { mult: 1.2, air: true }], [0.36, 'hitOff', null], [0.12, 'trail', 0.26],
    ],
  });

  CL.airThrust = clip({ // spear: dive-bomb skewer, point leading the fall
    name: 'airThrust', dur: 0.52, rate: 28,
    keys: [
      [0, SPEAR_BASE],
      [0.10, { root: [-0.1, -0.2, 0], spine: [0.05, -0.5, 0], chest: [0.05, -0.85, 0.05], neck: [0, 0.6, 0],
               shR: [0.05, 0.2, -0.5], elR: [-1.5, -0.25, 0], wrR: [0, 0, 0],
               shL: [-1.2, 0.5, 0.12], elL: [-0.25, 0, 0],
               hipL: [-0.8, 0, 0.05], kneeL: [1.25, 0, 0], hipR: [-0.3, 0, -0.05], kneeR: [0.65, 0, 0] }, 'out'],
      [0.20, { root: [0.3, 0.1, -0.04], spine: [0.35, 0.14, 0], chest: [0.55, 0.24, -0.06], neck: [-0.5, -0.32, 0],
               shR: [-1.85, 0, -0.5], elR: [0, 0, 0], wrR: [0.5, 0, 0],
               shL: [-0.2, 0, 0.75], elL: [-0.2, 0, 0],
               hipL: [-0.55, 0, 0.05], kneeL: [0.9, 0, 0], hipR: [0.3, 0, -0.05], kneeR: [0.35, 0, 0] }, 'snap'],
      [0.52, SPEAR_BASE, 'inout'],
    ],
    events: [
      [0.08, 'sfx', 'whooshBig'],
      [0.12, 'hitOn', { mult: 1.2, air: true, thrust: true }], [0.36, 'hitOff', null], [0.11, 'trail', 0.24],
    ],
  });

  /* ---------- casts (left hand — weapon stays in right) ---------- */
  CL.castL = clip({
    name: 'castL', dur: 0.5, rate: 26,
    keys: [
      [0, {}],
      [0.12, { shL: [-0.6, 0, 0.6], elL: [-1.3, 0, 0], wrL: [-0.4, 0, 0],
               chest: [0.02, -0.3, 0], spine: [0, -0.15, 0] }, 'out'],
      [0.24, { shL: [-1.55, 0.15, 0.1], elL: [-0.1, 0, 0], wrL: [-0.5, 0, 0],
               chest: [0.15, 0.3, 0], spine: [0.1, 0.15, 0], neck: [-0.1, -0.15, 0],
               hipL: [0.15, 0, 0.04], hipR: [-0.2, 0, -0.04], y: -0.05 }, 'snap'],
      [0.5, {}, 'inout'],
    ],
    events: [[0.22, 'cast', null]],
  });

  CL.castUp = clip({
    name: 'castUp', dur: 0.6, rate: 24,
    keys: [
      [0, {}],
      [0.16, { shL: [-0.4, 0, 0.5], elL: [-1.5, 0, 0], chest: [0.25, -0.15, 0], spine: [0.15, 0, 0],
               kneeL: [0.4, 0, 0], kneeR: [0.4, 0, 0], y: -0.12 }, 'out'],
      [0.32, { shL: [-3.0, 0, 0.15], elL: [-0.2, 0, 0], wrL: [-0.3, 0, 0],
               chest: [-0.18, 0, 0], spine: [-0.1, 0, 0], neck: [0.25, 0, 0], y: 0.02 }, 'snap'],
      [0.6, {}, 'inout'],
    ],
    events: [[0.30, 'cast', null]],
  });

  CL.castSpin = clip({ // whole-body burst — nova style
    name: 'castSpin', dur: 0.7, rate: 24,
    keys: [
      [0, {}],
      [0.2, { shL: [-0.3, 0, 0.2], shR: [-0.3, 0, -0.2], elL: [-1.2, 0, 0], elR: [-1.2, 0, 0],
              chest: [0.3, 0, 0], spine: [0.2, 0, 0], neck: [-0.2, 0, 0],
              kneeL: [0.6, 0, 0], kneeR: [0.6, 0, 0], hipL: [-0.4, 0, 0.06], hipR: [-0.4, 0, -0.06],
              y: -0.2 }, 'out'],
      [0.38, { shL: [-1.4, 0, 1.2], shR: [-1.4, 0, -1.2], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0],
               chest: [-0.2, 0, 0], spine: [-0.12, 0, 0], neck: [0.25, 0, 0],
               kneeL: [0.1, 0, 0], kneeR: [0.1, 0, 0], hipL: [0, 0, 0.1], hipR: [0, 0, -0.1],
               y: 0.03 }, 'snap'],
      [0.7, {}, 'inout'],
    ],
    events: [[0.36, 'cast', null]],
  });

  /* ---------- ZOMBIE ---------- */
  CL.zLunge = clip({
    name: 'zLunge', dur: 1.05, rate: 18,
    keys: [
      [0, { shL: [-1.15, 0, 0.12], shR: [-1.0, 0, -0.18], spine: [0.34, 0, 0], chest: [0.22, 0, 0.06] }],
      [0.42, { shL: [-2.2, 0, 0.5], shR: [-2.0, 0, -0.5], elL: [-0.4, 0, 0], elR: [-0.4, 0, 0],
               spine: [-0.15, 0.1, 0], chest: [-0.2, 0.1, 0.05], neck: [0.35, -0.1, 0.1],
               kneeL: [0.3, 0, 0], kneeR: [0.3, 0, 0], y: -0.1 }, 'inout'],
      [0.58, { shL: [-1.2, 0, 0.15], shR: [-1.05, 0, -0.2], elL: [-0.6, 0, 0], elR: [-0.6, 0, 0],
               spine: [0.55, 0, 0], chest: [0.4, 0, 0], neck: [-0.35, 0, 0.1],
               hipL: [-0.5, 0, 0.05], kneeL: [0.7, 0, 0], hipR: [0.25, 0, -0.05], y: -0.12 }, 'snap'],
      [0.7, { spine: [0.5, 0, 0], chest: [0.38, 0, 0] }],
      [1.05, { shL: [-1.15, 0, 0.12], shR: [-1.0, 0, -0.18], elL: [-0.35, 0, 0], elR: [-0.5, 0, 0],
               spine: [0.34, 0, 0], chest: [0.22, 0, 0.06], neck: [-0.28, 0, 0.14],
               hipL: [0, 0, 0.03], hipR: [0, 0, -0.03], kneeL: [0.15, 0, 0], kneeR: [0.15, 0, 0],
               y: -0.06 }, 'inout'],
    ],
    events: [
      [0.40, 'sfx', 'groan'], [0.52, 'move', { f: 4.2 }],
      [0.55, 'hitOn', null], [0.72, 'hitOff', null],
    ],
  });

  CL.zSwipe = clip({
    name: 'zSwipe', dur: 0.9, rate: 18,
    keys: [
      [0, { shR: [-1.0, 0, -0.18], spine: [0.34, 0, 0] }],
      [0.36, { shR: [-1.9, -0.3, -0.9], elR: [-0.5, 0, 0], spine: [0.2, -0.4, 0],
               chest: [0.15, -0.35, 0.05], neck: [-0.2, 0.3, 0.1], y: -0.08 }, 'inout'],
      [0.52, { shR: [-1.2, 0.3, 0.5], elR: [-0.2, 0, 0], spine: [0.45, 0.4, 0],
               chest: [0.35, 0.4, 0], neck: [-0.3, -0.3, 0.1], y: -0.1 }, 'snap'],
      [0.9, { shR: [-1.0, 0, -0.18], elR: [-0.5, 0, 0], spine: [0.34, 0, 0],
              chest: [0.22, 0, 0.06], neck: [-0.28, 0, 0.14], y: -0.06 }, 'inout'],
    ],
    events: [
      [0.34, 'sfx', 'groan'], [0.48, 'move', { f: 2.0 }],
      [0.5, 'hitOn', null], [0.62, 'hitOff', null],
    ],
  });

  /* ---------- OGRE ---------- */
  CL.oPunchR = clip({ // huge haymaker — parryable
    name: 'oPunchR', dur: 1.5, rate: 16,
    keys: [
      [0, { shR: [0.1, 0, -0.42], elR: [-0.55, 0, 0], chest: [0.12, 0, 0] }],
      [0.55, { shR: [-1.6, -0.5, -1.5], elR: [-1.4, 0, 0], wrR: [0, 0, 0],
               shL: [-0.5, 0, 0.6], elL: [-0.7, 0, 0],
               chest: [0.05, -0.75, 0.1], spine: [0.04, -0.35, 0], neck: [0, 0.5, 0],
               hipR: [0.25, 0, -0.06], hipL: [-0.25, 0, 0.06], kneeL: [0.35, 0, 0],
               y: -0.08 }, 'inout'],
      [0.72, { shR: [-1.35, 0.5, 0.9], elR: [-0.25, 0, 0],
               shL: [0.4, 0, 0.6], elL: [-0.4, 0, 0],
               chest: [0.25, 0.8, -0.1], spine: [0.18, 0.4, 0], neck: [-0.1, -0.5, 0],
               hipR: [-0.45, 0, -0.06], hipL: [0.3, 0, 0.06], kneeR: [0.5, 0, 0],
               y: -0.14 }, 'snap'],
      [0.9, { shR: [-1.15, 0.55, 1.1], chest: [0.22, 0.75, -0.1] }],
      [1.5, { shR: [0.1, 0, -0.42], elR: [-0.55, 0, 0], shL: [0.1, 0, 0.42], elL: [-0.55, 0, 0],
              chest: [0.12, 0, 0], spine: [0.18, 0, 0], neck: [-0.12, 0, 0],
              hipR: [0, 0, -0.06], hipL: [0, 0, 0.06], kneeL: [0.1, 0, 0], kneeR: [0.1, 0, 0],
              y: 0 }, 'inout'],
    ],
    events: [
      [0.50, 'sfx', 'whooshBig'], [0.62, 'move', { f: 3.5 }],
      [0.66, 'hitOn', null], [0.86, 'hitOff', null],
    ],
  });

  CL.oPunchL = clip({ // follow-up backfist
    name: 'oPunchL', dur: 1.25, rate: 16,
    keys: [
      [0, { shL: [0.1, 0, 0.42], elL: [-0.55, 0, 0], chest: [0.12, 0, 0] }],
      [0.45, { shL: [-1.5, 0.5, 1.5], elL: [-1.3, 0, 0],
               shR: [-0.4, 0, -0.5], chest: [0.05, 0.7, -0.1], spine: [0.04, 0.32, 0], neck: [0, -0.45, 0],
               hipL: [0.25, 0, 0.06], hipR: [-0.25, 0, -0.06], y: -0.06 }, 'inout'],
      [0.60, { shL: [-1.3, -0.5, -0.8], elL: [-0.2, 0, 0],
               chest: [0.25, -0.75, 0.1], spine: [0.18, -0.36, 0], neck: [-0.1, 0.5, 0],
               hipL: [-0.4, 0, 0.06], hipR: [0.3, 0, -0.06], kneeL: [0.5, 0, 0], y: -0.12 }, 'snap'],
      [0.78, { shL: [-1.15, -0.55, -1.0], chest: [0.22, -0.7, 0.1] }],
      [1.25, { shL: [0.1, 0, 0.42], elL: [-0.55, 0, 0], shR: [0.1, 0, -0.42], elR: [-0.55, 0, 0],
               chest: [0.12, 0, 0], spine: [0.18, 0, 0], neck: [-0.12, 0, 0],
               hipL: [0, 0, 0.06], hipR: [0, 0, -0.06], kneeL: [0.1, 0, 0], y: 0 }, 'inout'],
    ],
    events: [
      [0.42, 'sfx', 'whooshBig'], [0.52, 'move', { f: 3.0 }],
      [0.55, 'hitOn', null], [0.74, 'hitOff', null],
    ],
  });

  CL.oSlam = clip({ // both fists overhead — huge, parryable, punishing
    name: 'oSlam', dur: 2.0, rate: 15,
    keys: [
      [0, { chest: [0.12, 0, 0] }],
      [0.7, { shL: [-2.9, 0, 0.5], shR: [-2.9, 0, -0.5], elL: [-0.6, 0, 0], elR: [-0.6, 0, 0],
              chest: [-0.35, 0, 0], spine: [-0.22, 0, 0], neck: [0.3, 0, 0],
              kneeL: [0.25, 0, 0], kneeR: [0.25, 0, 0], y: 0.06 }, 'inout'],
      [0.95, { shL: [-2.95, 0, 0.45], shR: [-2.95, 0, -0.45], y: 0.08 }],
      [1.12, { shL: [-0.5, 0, 0.3], shR: [-0.5, 0, -0.3], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0],
               wrL: [-0.5, 0, 0], wrR: [-0.5, 0, 0],
               chest: [0.6, 0, 0], spine: [0.42, 0, 0], neck: [-0.4, 0, 0],
               hipL: [-0.55, 0, 0.06], hipR: [-0.55, 0, -0.06], kneeL: [0.8, 0, 0], kneeR: [0.8, 0, 0],
               y: -0.3 }, 'snap'],
      [1.35, { chest: [0.62, 0, 0], y: -0.32 }],
      [2.0, { chest: [0.12, 0, 0], spine: [0.18, 0, 0], neck: [-0.12, 0, 0],
              shL: [0.1, 0, 0.42], shR: [0.1, 0, -0.42], elL: [-0.55, 0, 0], elR: [-0.55, 0, 0],
              wrL: [0, 0, 0], wrR: [0, 0, 0],
              hipL: [0, 0, 0.06], hipR: [0, 0, -0.06], kneeL: [0.1, 0, 0], kneeR: [0.1, 0, 0],
              y: 0 }, 'inout'],
    ],
    events: [
      [0.65, 'sfx', 'roar'], [1.0, 'sfx', 'whooshBig'], [1.05, 'move', { f: 2.5 }],
      [1.08, 'hitOn', { mult: 1.4 }], [1.3, 'hitOff', null], [1.16, 'shake', 0.5], [1.16, 'slamFx', null],
    ],
  });

  CL.oGrab = clip({ // perilous charge grab — cannot be blocked, dodge it
    name: 'oGrab', dur: 1.9, rate: 15,
    keys: [
      [0, { chest: [0.12, 0, 0] }],
      [0.55, { shL: [-1.4, 0, 1.1], shR: [-1.4, 0, -1.1], elL: [-0.8, 0, 0], elR: [-0.8, 0, 0],
               chest: [-0.25, 0, 0], spine: [-0.15, 0, 0], neck: [0.35, 0, 0], y: -0.05 }, 'inout'],
      [0.8, { shL: [-1.45, 0, 1.15], shR: [-1.45, 0, -1.15], y: -0.08 }],
      [1.0, { shL: [-1.5, 0, 0.25], shR: [-1.5, 0, -0.25], elL: [-0.9, 0, 0], elR: [-0.9, 0, 0],
              chest: [0.5, 0, 0], spine: [0.35, 0, 0], neck: [-0.3, 0, 0],
              hipL: [-0.6, 0, 0.06], kneeL: [0.8, 0, 0], hipR: [0.3, 0, -0.06],
              y: -0.18 }, 'snap'],
      [1.25, { chest: [0.52, 0, 0] }],
      [1.9, { chest: [0.12, 0, 0], spine: [0.18, 0, 0], neck: [-0.12, 0, 0],
              shL: [0.1, 0, 0.42], shR: [0.1, 0, -0.42], elL: [-0.55, 0, 0], elR: [-0.55, 0, 0],
              hipL: [0, 0, 0.06], hipR: [0, 0, -0.06], kneeL: [0.1, 0, 0], y: 0 }, 'inout'],
    ],
    events: [
      [0.5, 'peril', null], [0.55, 'sfx', 'roar'],
      [0.92, 'move', { f: 9.0 }], [0.98, 'hitOn', { grab: true }], [1.2, 'hitOff', null],
    ],
  });

  CL.oRoar = clip({
    name: 'oRoar', dur: 1.6, rate: 14,
    keys: [
      [0, { chest: [0.12, 0, 0] }],
      [0.4, { shL: [-0.6, 0, 0.9], shR: [-0.6, 0, -0.9], elL: [-1.0, 0, 0], elR: [-1.0, 0, 0],
              chest: [-0.3, 0, 0], spine: [-0.2, 0, 0], neck: [0.45, 0, 0], y: 0.04 }, 'inout'],
      [1.0, { neck: [0.5, 0.1, 0], chest: [-0.32, 0, 0] }],
      [1.6, { chest: [0.12, 0, 0], spine: [0.18, 0, 0], neck: [-0.12, 0, 0],
              shL: [0.1, 0, 0.42], shR: [0.1, 0, -0.42], elL: [-0.55, 0, 0], elR: [-0.55, 0, 0],
              y: 0 }, 'inout'],
    ],
    events: [[0.42, 'sfx', 'roar']],
  });
})();
