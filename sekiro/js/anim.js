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
      // idle — breathing, loose stance
      const br = Math.sin(time * 1.9);
      out.root = [0.02, 0, 0];
      out.spine = [0.03 + 0.012 * br, 0, 0];
      out.chest = [0.03 + 0.018 * br, 0, 0];
      out.neck = [-0.04, 0, 0];
      out.shL = [0.05, 0, 0.10 + 0.01 * br];
      out.shR = [0.05, 0, -0.10 - 0.01 * br];
      out.elL = [-0.12, 0, 0]; out.elR = [-0.12, 0, 0];
      out.hipL = [-0.03, 0.02, 0.02]; out.hipR = [-0.03, -0.02, -0.02];
      out.kneeL = [0.06, 0, 0]; out.kneeR = [0.06, 0, 0];
      out.y = 0.005 * br;
      return out;
    }

    // walk / run cycle
    const A = 0.72 * sp;             // leg swing
    const bounce = Math.abs(cw);
    out.root = [0.06 * sp, 0.08 * sw * sp, loco.lean * 0.5];
    out.spine = [0.10 * sp, -0.06 * sw * sp, loco.lean * 0.3];
    out.chest = [0.08 * sp, -0.10 * sw * sp, 0];
    out.neck = [-0.10 * sp, 0.10 * sw * sp, 0];
    out.hipL = [A * sw, 0.02, 0.03];
    out.hipR = [-A * sw, -0.02, -0.03];
    out.kneeL = [Math.max(0.05, -A * 1.9 * cw), 0, 0];
    out.kneeR = [Math.max(0.05, A * 1.9 * cw), 0, 0];
    out.ankL = [-0.15 * sw * sp + 0.05, 0, 0];
    out.ankR = [0.15 * sw * sp + 0.05, 0, 0];
    out.shL = [-A * 0.85 * sw, 0, 0.08];
    out.shR = [A * 0.85 * sw, 0, -0.08];
    out.elL = [-0.35 * sp - Math.max(0, -sw) * 0.3 * sp, 0, 0];
    out.elR = [-0.35 * sp - Math.max(0, sw) * 0.3 * sp, 0, 0];
    out.y = -0.02 * sp + 0.05 * bounce * sp * sp;
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
    spear: { // held low, two-handed lean
      shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0],
      shL: [-0.35, 0, 0.3], elL: [-0.75, 0, 0],
      chest: [0.06, 0.28, 0], spine: [0.04, 0.12, 0],
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
  CL.kat1 = clip({ // right-to-left horizontal slash
    name: 'kat1', dur: 0.52, rate: 26,
    keys: [
      [0, { shR: [-0.35, 0, -0.22], elR: [-0.55, 0.2, 0], wrR: [-0.25, 0, 0], chest: [0.05, 0.12, 0] }],
      [0.15, { shR: [-2.1, -0.2, -0.9], elR: [-0.7, 0.1, 0], wrR: [-0.9, 0, -0.4],
               shL: [-0.6, 0, 0.35], elL: [-0.8, 0, 0],
               chest: [0.06, -0.55, 0.05], spine: [0.05, -0.25, 0], neck: [-0.05, 0.35, 0],
               hipR: [0.18, -0.05, -0.05], hipL: [-0.18, 0.05, 0.04], y: -0.03 }, 'out'],
      [0.27, { shR: [-1.35, 0.45, 0.55], elR: [-0.15, 0, 0], wrR: [-0.4, 0, 0.9],
               shL: [0.3, 0, 0.5], elL: [-0.5, 0, 0],
               chest: [0.16, 0.6, -0.05], spine: [0.12, 0.3, 0], neck: [-0.1, -0.35, 0],
               hipR: [-0.28, -0.05, -0.05], hipL: [0.15, 0.05, 0.04], y: -0.07 }, 'snap'],
      [0.36, { shR: [-1.15, 0.5, 0.7], elR: [-0.2, 0, 0], chest: [0.15, 0.55, -0.05] }],
      [0.52, { shR: [-0.5, 0.1, -0.1], elR: [-0.5, 0.2, 0], wrR: [-0.3, 0, 0.1],
               shL: [0.05, 0, 0.14], elL: [-0.25, 0, 0],
               chest: [0.05, 0.15, 0], spine: [0.04, 0.08, 0], neck: [0, 0, 0],
               hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], y: 0 }, 'inout'],
    ],
    events: [
      [0.13, 'sfx', 'whoosh'], [0.17, 'move', { f: 3.2 }],
      [0.20, 'hitOn', null], [0.34, 'hitOff', null], [0.18, 'trail', 0.2],
    ],
  });

  CL.kat2 = clip({ // return slash, left-to-right rising
    name: 'kat2', dur: 0.50, rate: 26,
    keys: [
      [0, { shR: [-1.15, 0.5, 0.7], elR: [-0.2, 0, 0], wrR: [-0.4, 0, 0.9], chest: [0.15, 0.55, -0.05] }],
      [0.12, { shR: [-1.0, 0.55, 0.85], elR: [-0.35, 0, 0], wrR: [-0.2, 0, 1.1],
               shL: [0.3, 0, 0.5], chest: [0.18, 0.65, -0.06], spine: [0.12, 0.3, 0], y: -0.06 }, 'out'],
      [0.24, { shR: [-1.7, -0.35, -0.75], elR: [-0.25, 0, 0], wrR: [-0.8, 0, -0.7],
               shL: [-0.4, 0, 0.3], elL: [-0.6, 0, 0],
               chest: [0.1, -0.6, 0.06], spine: [0.06, -0.28, 0], neck: [-0.05, 0.35, 0],
               hipR: [0.2, -0.05, -0.05], hipL: [-0.2, 0.05, 0.04], y: -0.05 }, 'snap'],
      [0.34, { shR: [-1.8, -0.4, -0.85], chest: [0.08, -0.55, 0.06] }],
      [0.50, { shR: [-0.45, 0, -0.2], elR: [-0.55, 0.2, 0], wrR: [-0.25, 0, 0],
               shL: [0.05, 0, 0.14], chest: [0.05, 0.12, 0], spine: [0.03, 0.06, 0],
               neck: [0, 0, 0], hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], y: 0 }, 'inout'],
    ],
    events: [
      [0.10, 'sfx', 'whoosh'], [0.14, 'move', { f: 3.2 }],
      [0.17, 'hitOn', null], [0.31, 'hitOff', null], [0.15, 'trail', 0.19],
    ],
  });

  CL.kat3 = clip({ // finisher — leaping overhead cut
    name: 'kat3', dur: 0.62, rate: 26,
    keys: [
      [0, { shR: [-0.45, 0, -0.2], chest: [0.05, 0.12, 0] }],
      [0.18, { shR: [-2.9, 0, -0.35], elR: [-0.5, 0, 0], wrR: [-0.4, 0, 0],
               shL: [-1.6, 0, 0.4], elL: [-0.9, 0, 0],
               chest: [-0.12, -0.15, 0], spine: [-0.10, -0.05, 0], neck: [0.1, 0, 0],
               kneeL: [0.35, 0, 0], kneeR: [0.35, 0, 0], hipL: [-0.25, 0, 0.04], hipR: [-0.25, 0, -0.04],
               y: -0.10 }, 'out'],
      [0.32, { shR: [-0.7, 0, -0.15], elR: [-0.15, 0, 0], wrR: [-1.3, 0, 0],
               shL: [0.4, 0, 0.35], elL: [-0.3, 0, 0],
               chest: [0.45, 0.1, 0], spine: [0.3, 0, 0], neck: [-0.35, 0, 0],
               hipL: [-0.55, 0, 0.05], kneeL: [0.8, 0, 0], hipR: [0.3, 0, -0.05], kneeR: [0.3, 0, 0],
               y: -0.12 }, 'snap'],
      [0.44, { shR: [-0.55, 0, -0.1], wrR: [-1.4, 0, 0], chest: [0.5, 0.1, 0], y: -0.14 }],
      [0.62, { shR: [-0.4, 0, -0.2], elR: [-0.5, 0.2, 0], wrR: [-0.3, 0, 0],
               shL: [0.05, 0, 0.14], chest: [0.05, 0.12, 0], spine: [0.04, 0.06, 0],
               neck: [0, 0, 0], hipL: [0, 0, 0.03], hipR: [0, 0, -0.03],
               kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0], y: 0 }, 'inout'],
    ],
    events: [
      [0.20, 'sfx', 'whooshBig'], [0.24, 'move', { f: 4.5 }],
      [0.27, 'hitOn', { mult: 1.35 }], [0.42, 'hitOff', null], [0.24, 'trail', 0.22],
    ],
  });

  /* ---------- GREATSWORD ---------- */
  CL.gs1 = clip({ // colossal horizontal cleave off the shoulder
    name: 'gs1', dur: 0.95, rate: 22,
    keys: [
      [0, { shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0], chest: [0.02, 0.22, 0.05] }],
      [0.30, { shR: [-2.3, -0.3, -1.0], elR: [-0.35, 0, 0], wrR: [-0.5, 0, -0.5],
               shL: [-0.8, 0, 0.4], elL: [-0.9, 0, 0],
               chest: [0.05, -0.7, 0.08], spine: [0.04, -0.35, 0], neck: [0, 0.45, 0],
               hipR: [0.25, -0.08, -0.06], hipL: [-0.3, 0.08, 0.05], kneeL: [0.4, 0, 0],
               y: -0.08 }, 'inout'],
      [0.48, { shR: [-1.45, 0.5, 0.8], elR: [-0.1, 0, 0], wrR: [-0.55, 0, 0.8],
               shL: [0.5, 0, 0.6], elL: [-0.4, 0, 0],
               chest: [0.22, 0.75, -0.08], spine: [0.16, 0.4, 0], neck: [-0.1, -0.45, 0],
               hipR: [-0.4, -0.08, -0.06], hipL: [0.25, 0.08, 0.05], kneeR: [0.5, 0, 0],
               y: -0.12 }, 'snap'],
      [0.62, { shR: [-1.2, 0.55, 1.0], chest: [0.2, 0.7, -0.08], y: -0.1 }],
      [0.95, { shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0],
               shL: [0.1, 0, 0.18], elL: [-0.3, 0, 0],
               chest: [0.02, 0.22, 0.05], spine: [0.02, 0.1, 0], neck: [0, 0, 0],
               hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
               y: 0 }, 'inout'],
    ],
    events: [
      [0.30, 'sfx', 'whooshBig'], [0.40, 'move', { f: 3.8 }],
      [0.42, 'hitOn', null], [0.60, 'hitOff', null], [0.40, 'trail', 0.26],
    ],
  });

  CL.gs2 = clip({ // overhead earth-splitter
    name: 'gs2', dur: 1.05, rate: 22,
    keys: [
      [0, { shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0], chest: [0.02, 0.22, 0.05] }],
      [0.34, { shR: [-3.1, 0, -0.25], elR: [-0.35, 0, 0], wrR: [-0.15, 0, 0],
               shL: [-2.6, 0, 0.3], elL: [-0.5, 0, 0],
               chest: [-0.22, 0, 0], spine: [-0.15, 0, 0], neck: [0.2, 0, 0],
               kneeL: [0.3, 0, 0], kneeR: [0.3, 0, 0], hipL: [-0.2, 0, 0.04], hipR: [-0.2, 0, -0.04],
               y: -0.06 }, 'inout'],
      [0.52, { shR: [-0.55, 0, -0.12], elR: [-0.1, 0, 0], wrR: [-1.35, 0, 0],
               shL: [-0.3, 0, 0.25], elL: [-0.35, 0, 0],
               chest: [0.55, 0, 0], spine: [0.38, 0, 0], neck: [-0.4, 0, 0],
               hipL: [-0.6, 0, 0.05], kneeL: [0.9, 0, 0], hipR: [0.25, 0, -0.05], kneeR: [0.35, 0, 0],
               y: -0.18 }, 'snap'],
      [0.68, { wrR: [-1.45, 0, 0], chest: [0.58, 0, 0], y: -0.2 }],
      [1.05, { shR: [-2.5, 0, -0.35], elR: [-0.5, 0, 0], wrR: [0.5, 0, 0],
               shL: [0.1, 0, 0.18], elL: [-0.3, 0, 0],
               chest: [0.02, 0.22, 0.05], spine: [0.02, 0.1, 0], neck: [0, 0, 0],
               hipL: [0, 0, 0.03], hipR: [0, 0, -0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
               y: 0 }, 'inout'],
    ],
    events: [
      [0.36, 'sfx', 'whooshBig'], [0.46, 'move', { f: 3.5 }],
      [0.48, 'hitOn', { mult: 1.3 }], [0.66, 'hitOff', null], [0.46, 'trail', 0.3],
      [0.56, 'shake', 0.25],
    ],
  });

  /* ---------- SPEAR ---------- */
  CL.sp1 = clip({ // straight thrust
    name: 'sp1', dur: 0.48, rate: 27,
    keys: [
      [0, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0], chest: [0.06, 0.28, 0] }],
      [0.14, { shR: [-0.3, 0, -0.3], elR: [-1.0, 0, 0], wrR: [-0.5, 0, 0],
               shL: [-0.7, 0, 0.35], elL: [-1.1, 0, 0],
               chest: [0.02, 0.55, 0], spine: [0.02, 0.25, 0], neck: [0, -0.3, 0],
               hipR: [0.15, 0, -0.04], hipL: [-0.15, 0, 0.04], y: -0.04 }, 'out'],
      [0.25, { shR: [-1.35, 0, -0.05], elR: [-0.05, 0, 0], wrR: [-0.25, 0, 0],
               shL: [-0.4, 0, 0.6], elL: [-0.5, 0, 0],
               chest: [0.18, -0.25, 0], spine: [0.14, -0.12, 0], neck: [-0.15, 0.1, 0],
               hipR: [-0.35, 0, -0.04], hipL: [0.25, 0, 0.04], kneeL: [0.45, 0, 0],
               y: -0.09 }, 'snap'],
      [0.33, { shR: [-1.4, 0, -0.05], chest: [0.2, -0.3, 0] }],
      [0.48, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0],
               shL: [-0.35, 0, 0.3], elL: [-0.75, 0, 0],
               chest: [0.06, 0.28, 0], spine: [0.04, 0.12, 0], neck: [0, 0, 0],
               hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], kneeL: [0.06, 0, 0], y: 0 }, 'inout'],
    ],
    events: [
      [0.12, 'sfx', 'whoosh'], [0.17, 'move', { f: 3.4 }],
      [0.19, 'hitOn', { thrust: true }], [0.31, 'hitOff', null], [0.17, 'trail', 0.16],
    ],
  });

  CL.sp2 = clip({ // wide sweeping cut
    name: 'sp2', dur: 0.62, rate: 25,
    keys: [
      [0, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0], chest: [0.06, 0.28, 0] }],
      [0.2, { shR: [-1.2, -0.3, -0.7], elR: [-0.6, 0, 0], wrR: [-1.0, 0, -0.3],
              shL: [-0.6, 0, 0.4], elL: [-0.9, 0, 0],
              chest: [0.05, -0.55, 0.05], spine: [0.04, -0.25, 0], neck: [0, 0.35, 0],
              hipR: [0.2, 0, -0.05], hipL: [-0.2, 0, 0.04], y: -0.05 }, 'out'],
      [0.36, { shR: [-1.05, 0.4, 0.5], elR: [-0.15, 0, 0], wrR: [-0.7, 0, 0.6],
               shL: [0.3, 0, 0.55], elL: [-0.4, 0, 0],
               chest: [0.14, 0.6, -0.06], spine: [0.1, 0.3, 0], neck: [-0.05, -0.35, 0],
               hipR: [-0.3, 0, -0.05], hipL: [0.2, 0, 0.04], y: -0.08 }, 'snap'],
      [0.46, { shR: [-0.95, 0.45, 0.65], chest: [0.12, 0.55, -0.06] }],
      [0.62, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0],
               shL: [-0.35, 0, 0.3], elL: [-0.75, 0, 0],
               chest: [0.06, 0.28, 0], spine: [0.04, 0.12, 0], neck: [0, 0, 0],
               hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], y: 0 }, 'inout'],
    ],
    events: [
      [0.18, 'sfx', 'whooshBig'], [0.26, 'move', { f: 2.8 }],
      [0.28, 'hitOn', { arcWide: true }], [0.44, 'hitOff', null], [0.26, 'trail', 0.22],
    ],
  });

  CL.sp3 = clip({ // lunging skewer
    name: 'sp3', dur: 0.6, rate: 26,
    keys: [
      [0, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0], chest: [0.06, 0.28, 0] }],
      [0.2, { shR: [-0.2, 0, -0.35], elR: [-1.2, 0, 0], wrR: [-0.4, 0, 0],
              shL: [-0.8, 0, 0.4], elL: [-1.2, 0, 0],
              chest: [-0.05, 0.65, 0], spine: [-0.03, 0.3, 0], neck: [0.05, -0.35, 0],
              kneeL: [0.4, 0, 0], kneeR: [0.4, 0, 0], y: -0.1 }, 'out'],
      [0.32, { shR: [-1.5, 0, 0], elR: [0, 0, 0], wrR: [-0.15, 0, 0],
               shL: [-0.3, 0, 0.7], elL: [-0.4, 0, 0],
               chest: [0.3, -0.3, 0], spine: [0.22, -0.15, 0], neck: [-0.25, 0.15, 0],
               hipR: [-0.5, 0, -0.04], hipL: [0.35, 0, 0.04], kneeL: [0.6, 0, 0],
               y: -0.14 }, 'snap'],
      [0.42, { shR: [-1.55, 0, 0], chest: [0.32, -0.32, 0] }],
      [0.6, { shR: [-0.55, 0, -0.15], elR: [-0.45, 0, 0], wrR: [-0.6, 0, 0],
              shL: [-0.35, 0, 0.3], elL: [-0.75, 0, 0],
              chest: [0.06, 0.28, 0], spine: [0.04, 0.12, 0], neck: [0, 0, 0],
              hipR: [0, 0, -0.03], hipL: [0, 0, 0.03], kneeL: [0.06, 0, 0], kneeR: [0.06, 0, 0],
              y: 0 }, 'inout'],
    ],
    events: [
      [0.18, 'sfx', 'whooshBig'], [0.26, 'move', { f: 6.5 }],
      [0.28, 'hitOn', { thrust: true, mult: 1.25 }], [0.42, 'hitOff', null], [0.26, 'trail', 0.2],
    ],
  });

  /* ---------- air attack (all weapons) ---------- */
  CL.airAtk = clip({
    name: 'airAtk', dur: 0.5, rate: 28,
    keys: [
      [0, { shR: [-0.5, 0, -0.3], chest: [0.1, 0, 0] }],
      [0.10, { shR: [-2.8, 0, -0.4], elR: [-0.5, 0, 0], wrR: [-0.3, 0, 0],
               shL: [-1.2, 0, 0.5], elL: [-0.7, 0, 0],
               chest: [-0.15, -0.1, 0], spine: [-0.1, 0, 0], neck: [0.15, 0, 0],
               hipL: [-0.8, 0, 0.05], kneeL: [1.2, 0, 0], hipR: [-0.3, 0, -0.05], kneeR: [0.6, 0, 0] }, 'out'],
      [0.22, { shR: [-0.6, 0, -0.1], elR: [-0.1, 0, 0], wrR: [-1.35, 0, 0],
               shL: [0.4, 0, 0.4], elL: [-0.3, 0, 0],
               chest: [0.5, 0.1, 0], spine: [0.35, 0, 0], neck: [-0.35, 0, 0],
               hipL: [-0.5, 0, 0.05], kneeL: [0.9, 0, 0], hipR: [0.2, 0, -0.05], kneeR: [0.4, 0, 0] }, 'snap'],
      [0.5, { shR: [-0.5, 0, -0.2], elR: [-0.4, 0, 0], wrR: [-0.4, 0, 0],
              chest: [0.2, 0, 0], spine: [0.12, 0, 0], neck: [-0.1, 0, 0],
              hipL: [-0.4, 0, 0.05], kneeL: [0.7, 0, 0], hipR: [-0.2, 0, -0.05], kneeR: [0.5, 0, 0] }, 'inout'],
    ],
    events: [
      [0.08, 'sfx', 'whooshBig'],
      [0.14, 'hitOn', { mult: 1.2, air: true }], [0.34, 'hitOff', null], [0.12, 'trail', 0.24],
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
