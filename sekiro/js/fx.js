/* Shinobi Protocol — fx.js
   Sparks, puffs, rings, lightning, sword trails, damage numbers,
   hit-stop and screen shake. */
(function () {
  'use strict';
  const S = window.S, U = S.U;
  const FX = (S.FX = {});

  let scene = null;
  const tmpV = new THREE.Vector3();

  /* ---------------- spark streaks (LineSegments pool) ---------------- */
  const MAX_SPARKS = 900;
  const sparks = [];
  let sparkGeo, sparkPos, sparkCol, sparkMesh;

  /* ---------------- soft puffs (Sprite pool) ---------------- */
  const MAX_PUFFS = 90;
  const puffs = [];

  /* ---------------- rings ---------------- */
  const MAX_RINGS = 10;
  const rings = [];

  /* ---------------- lightning bolts ---------------- */
  const MAX_BOLTS = 10;
  const bolts = [];

  /* ---------------- damage numbers ---------------- */
  const MAX_NUMS = 26;
  const nums = [];

  function radialTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  FX.init = function (sc) {
    scene = sc;

    // sparks
    sparkGeo = new THREE.BufferGeometry();
    sparkPos = new Float32Array(MAX_SPARKS * 6);
    sparkCol = new Float32Array(MAX_SPARKS * 6);
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    sparkMesh = new THREE.LineSegments(sparkGeo, new THREE.LineBasicMaterial({
      vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    sparkMesh.frustumCulled = false;
    scene.add(sparkMesh);
    for (let i = 0; i < MAX_SPARKS; i++) sparks.push({ live: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, c: new THREE.Color(), g: 22, drag: 1 });

    // puffs
    const puffTex = radialTexture();
    for (let i = 0; i < MAX_PUFFS; i++) {
      const m = new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      scene.add(sp);
      puffs.push({ live: false, sp, v: new THREE.Vector3(), life: 0, max: 1, grow: 1, alpha: 0.8, normalBlend: false });
    }

    // rings
    for (let i = 0; i < MAX_RINGS; i++) {
      const geo = new THREE.RingGeometry(0.85, 1, 40);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      rings.push({ live: false, mesh, life: 0, max: 1, from: 0.3, to: 4 });
    }

    // bolts
    for (let i = 0; i < MAX_BOLTS; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(geo, mat);
      line.visible = false; line.frustumCulled = false;
      scene.add(line);
      bolts.push({ live: false, line, life: 0, max: 0.15 });
    }

    // damage numbers
    for (let i = 0; i < MAX_NUMS; i++) {
      const c = document.createElement('canvas');
      c.width = 160; c.height = 80;
      const tex = new THREE.CanvasTexture(c);
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.scale.set(1.1, 0.55, 1);
      sp.visible = false;
      scene.add(sp);
      nums.push({ live: false, sp, c, tex, life: 0, max: 0.9, v: new THREE.Vector3() });
    }
  };

  /* ---------------- emitters ---------------- */
  FX.spark = function (pos, n, color, opts) {
    opts = opts || {};
    const speed = opts.speed || 7, up = opts.up || 2.5;
    const col = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const s = sparks.find((x) => !x.live);
      if (!s) return;
      s.live = true;
      s.p.copy(pos);
      const a = Math.random() * Math.PI * 2, e = U.rand(-0.5, 1.0);
      s.v.set(Math.cos(a) * Math.cos(e), Math.sin(e) * 1.2 + up / speed, Math.sin(a) * Math.cos(e)).multiplyScalar(speed * U.rand(0.35, 1.25));
      if (opts.dir) s.v.addScaledVector(opts.dir, speed * 0.6);
      s.max = s.life = U.rand(0.2, opts.life || 0.55);
      s.c.copy(col);
      if (Math.random() < 0.3) s.c.offsetHSL(0, 0, 0.25);
      s.g = opts.gravity !== undefined ? opts.gravity : 22;
      s.drag = opts.drag || 1.5;
    }
  };

  FX.puff = function (pos, n, color, opts) {
    opts = opts || {};
    for (let k = 0; k < n; k++) {
      const p = puffs.find((x) => !x.live);
      if (!p) return;
      p.live = true;
      p.sp.visible = true;
      p.sp.position.copy(pos);
      p.sp.position.x += U.rand(-0.2, 0.2) * (opts.spread || 1);
      p.sp.position.y += U.rand(-0.1, 0.25) * (opts.spread || 1);
      p.sp.position.z += U.rand(-0.2, 0.2) * (opts.spread || 1);
      const a = Math.random() * Math.PI * 2;
      p.v.set(Math.cos(a), U.rand(0.4, 1.4), Math.sin(a)).multiplyScalar(opts.speed || 1);
      if (opts.dir) p.v.addScaledVector(opts.dir, (opts.speed || 1) * 1.5);
      p.max = p.life = U.rand(0.3, opts.life || 0.6);
      p.grow = opts.grow || 2;
      p.alpha = opts.alpha || 0.55;
      const sc = (opts.size || 0.5) * U.rand(0.7, 1.3);
      p.sp.scale.set(sc, sc, 1);
      p.sp.material.color.set(color);
      p.sp.material.blending = opts.smoke ? THREE.NormalBlending : THREE.AdditiveBlending;
    }
  };

  FX.ring = function (pos, color, opts) {
    opts = opts || {};
    const r = rings.find((x) => !x.live);
    if (!r) return;
    r.live = true;
    r.mesh.visible = true;
    r.mesh.position.copy(pos);
    r.mesh.position.y = Math.max(0.05, opts.y !== undefined ? opts.y : 0.05);
    r.from = opts.from || 0.3;
    r.to = opts.to || 4.5;
    r.max = r.life = opts.life || 0.45;
    r.mesh.material.color.set(color);
    r.mesh.material.opacity = 0.9;
  };

  FX.bolt = function (from, to, color) {
    const b = bolts.find((x) => !x.live);
    if (!b) return;
    b.live = true;
    b.line.visible = true;
    b.max = b.life = 0.16;
    b.line.material.color.set(color || 0xbfe8ff);
    b.line.material.opacity = 1;
    const attr = b.line.geometry.getAttribute('position');
    const N = 14;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const x = U.lerp(from.x, to.x, t) + (i > 0 && i < N - 1 ? U.rand(-0.35, 0.35) : 0);
      const y = U.lerp(from.y, to.y, t) + (i > 0 && i < N - 1 ? U.rand(-0.35, 0.35) : 0);
      const z = U.lerp(from.z, to.z, t) + (i > 0 && i < N - 1 ? U.rand(-0.35, 0.35) : 0);
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
  };

  FX.number = function (pos, text, color) {
    const n = nums.find((x) => !x.live);
    if (!n) return;
    n.live = true;
    const g = n.c.getContext('2d');
    g.clearRect(0, 0, 160, 80);
    g.font = '900 44px "Segoe UI", Arial';
    g.textAlign = 'center';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.85)';
    g.strokeText(text, 80, 56);
    g.fillStyle = color || '#ffdd77';
    g.fillText(text, 80, 56);
    n.tex.needsUpdate = true;
    n.sp.visible = true;
    n.sp.material.opacity = 1;
    n.sp.position.copy(pos);
    n.sp.position.x += U.rand(-0.25, 0.25);
    n.max = n.life = 0.9;
    n.v.set(U.rand(-0.3, 0.3), 2.2, 0);
  };

  /* ---------------- composite effects ---------------- */
  FX.parrySparks = function (pos) {
    FX.spark(pos, 42, 0xffcc33, { speed: 10, life: 0.5 });
    FX.spark(pos, 16, 0xfff0aa, { speed: 14, life: 0.3 });
    FX.puff(pos, 3, 0xffdd66, { size: 0.7, grow: 3.5, life: 0.25, alpha: 0.9, speed: 0.3 });
  };
  FX.blockSparks = function (pos) {
    FX.spark(pos, 12, 0xc8c8d4, { speed: 6, life: 0.35 });
    FX.puff(pos, 1, 0xaaaabb, { size: 0.4, grow: 2, life: 0.2, alpha: 0.5 });
  };
  FX.hitSparks = function (pos, big) {
    FX.spark(pos, big ? 30 : 16, 0xff4433, { speed: big ? 9 : 6, life: 0.45 });
    FX.puff(pos, big ? 4 : 2, 0xcc2211, { size: big ? 0.7 : 0.45, grow: 2.4, life: 0.3, alpha: 0.7 });
  };
  FX.dust = function (pos, n) {
    FX.puff(pos, n || 4, 0x8a7f6a, { size: 0.5, grow: 2.5, life: 0.5, alpha: 0.25, speed: 0.8, smoke: true });
  };
  FX.slam = function (pos, color) {
    FX.ring(pos, color || 0xccbb99, { to: 5, life: 0.5 });
    FX.dust(pos, 10);
    FX.spark(pos, 20, color || 0xbbaa77, { speed: 8, up: 5 });
  };
  FX.deathBurst = function (pos, color) {
    FX.spark(pos, 40, color || 0xff3322, { speed: 8, life: 0.7 });
    FX.puff(pos, 8, 0x332222, { size: 0.8, grow: 2.5, life: 0.8, alpha: 0.6, smoke: true });
  };

  /* ---------------- sword trail ---------------- */
  const TRAIL_LEN = 16;
  FX.Trail = class Trail {
    constructor(color) {
      this.pts = []; // {a:Vector3, b:Vector3}
      this.active = 0; // countdown while emitting
      const geo = new THREE.BufferGeometry();
      this.posArr = new Float32Array((TRAIL_LEN - 1) * 6 * 3);
      this.alphaGeoCols = new Float32Array((TRAIL_LEN - 1) * 6 * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(this.alphaGeoCols, 3));
      this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      this.mesh.frustumCulled = false;
      this.color = new THREE.Color(color || 0xfff2cc);
      scene.add(this.mesh);
    }
    emit(dur) { this.active = Math.max(this.active, dur); }
    update(dt, tipObj, baseObj) {
      if (this.active > 0 && tipObj) {
        const a = new THREE.Vector3(), b = new THREE.Vector3();
        tipObj.getWorldPosition(a);
        baseObj.getWorldPosition(b);
        this.pts.unshift({ a, b });
        this.active -= dt;
      } else if (this.pts.length) {
        this.pts.pop(); // decay from the tail
        if (this.pts.length) this.pts.pop();
      }
      while (this.pts.length > TRAIL_LEN) this.pts.pop();
      // rebuild strip
      const n = Math.min(this.pts.length, TRAIL_LEN) - 1;
      let vi = 0;
      for (let i = 0; i < (TRAIL_LEN - 1); i++) {
        if (i < n) {
          const p0 = this.pts[i], p1 = this.pts[i + 1];
          const f0 = 1 - i / TRAIL_LEN, f1 = 1 - (i + 1) / TRAIL_LEN;
          const quad = [p0.a, p0.b, p1.a, p1.a, p0.b, p1.b];
          const fade = [f0, f0, f1, f1, f0, f1];
          for (let q = 0; q < 6; q++) {
            this.posArr[vi] = quad[q].x; this.posArr[vi + 1] = quad[q].y; this.posArr[vi + 2] = quad[q].z;
            const f = fade[q] * fade[q];
            this.alphaGeoCols[vi] = this.color.r * f;
            this.alphaGeoCols[vi + 1] = this.color.g * f;
            this.alphaGeoCols[vi + 2] = this.color.b * f;
            vi += 3;
          }
        } else {
          for (let q = 0; q < 18; q++) this.posArr[vi + q] = 0;
          for (let q = 0; q < 18; q++) this.alphaGeoCols[vi + q] = 0;
          vi += 18;
        }
      }
      this.mesh.geometry.getAttribute('position').needsUpdate = true;
      this.mesh.geometry.getAttribute('color').needsUpdate = true;
    }
  };

  /* ---------------- hit-stop & shake ---------------- */
  let stopT = 0, stopScale = 1;
  let shakeAmp = 0;
  FX.hitstop = function (dur, scale) { stopT = Math.max(stopT, dur); stopScale = scale; };
  FX.shake = function (amp) { shakeAmp = Math.max(shakeAmp, amp); };
  // returns scaled dt; call once per frame with real dt
  FX.scaleTime = function (realDt) {
    let dt = realDt;
    if (stopT > 0) { stopT -= realDt; dt = realDt * stopScale; }
    shakeAmp = Math.max(0, shakeAmp - realDt * 2.2);
    return dt;
  };
  FX.shakeOffset = function (out) {
    out.set(U.rand(-1, 1), U.rand(-1, 1), U.rand(-1, 1)).multiplyScalar(shakeAmp * 0.12);
    return out;
  };

  /* ---------------- per-frame update ---------------- */
  FX.update = function (dt) {
    // sparks
    let vi = 0;
    for (const s of sparks) {
      if (s.live) {
        s.life -= dt;
        if (s.life <= 0) s.live = false;
        else {
          s.v.y -= s.g * dt;
          s.v.multiplyScalar(Math.max(0, 1 - s.drag * dt));
          s.p.addScaledVector(s.v, dt);
          if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.4; s.v.x *= 0.7; s.v.z *= 0.7; }
        }
      }
      const f = s.live ? U.clamp(s.life / s.max, 0, 1) : 0;
      const tail = 0.035;
      sparkPos[vi] = s.p.x; sparkPos[vi + 1] = s.p.y; sparkPos[vi + 2] = s.p.z;
      sparkPos[vi + 3] = s.p.x - s.v.x * tail; sparkPos[vi + 4] = s.p.y - s.v.y * tail; sparkPos[vi + 5] = s.p.z - s.v.z * tail;
      sparkCol[vi] = s.c.r * f; sparkCol[vi + 1] = s.c.g * f; sparkCol[vi + 2] = s.c.b * f;
      sparkCol[vi + 3] = s.c.r * f * 0.3; sparkCol[vi + 4] = s.c.g * f * 0.3; sparkCol[vi + 5] = s.c.b * f * 0.3;
      vi += 6;
    }
    sparkGeo.getAttribute('position').needsUpdate = true;
    sparkGeo.getAttribute('color').needsUpdate = true;

    // puffs
    for (const p of puffs) {
      if (!p.live) continue;
      p.life -= dt;
      if (p.life <= 0) { p.live = false; p.sp.visible = false; continue; }
      const f = p.life / p.max;
      p.sp.position.addScaledVector(p.v, dt);
      const g = 1 + p.grow * dt;
      p.sp.scale.x *= g; p.sp.scale.y *= g;
      p.sp.material.opacity = p.alpha * f;
    }

    // rings
    for (const r of rings) {
      if (!r.live) continue;
      r.life -= dt;
      if (r.life <= 0) { r.live = false; r.mesh.visible = false; continue; }
      const f = 1 - r.life / r.max;
      const sc = U.lerp(r.from, r.to, U.ease.out(f));
      r.mesh.scale.set(sc, sc, 1);
      r.mesh.material.opacity = 0.9 * (1 - f);
    }

    // bolts
    for (const b of bolts) {
      if (!b.live) continue;
      b.life -= dt;
      if (b.life <= 0) { b.live = false; b.line.visible = false; continue; }
      b.line.material.opacity = b.life / b.max;
    }

    // numbers
    for (const n of nums) {
      if (!n.live) continue;
      n.life -= dt;
      if (n.life <= 0) { n.live = false; n.sp.visible = false; continue; }
      const f = n.life / n.max;
      n.v.y -= 2.5 * dt;
      n.sp.position.addScaledVector(n.v, dt);
      n.sp.material.opacity = Math.min(1, f * 2);
    }
  };
})();
