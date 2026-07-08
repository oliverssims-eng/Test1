/* Shinobi Protocol — util.js
   Global namespace, math helpers, input state, synthesized SFX. */
(function () {
  'use strict';
  const S = (window.S = {});

  // player-facing options (toggled from the M menu)
  S.settings = { shiftLock: false };

  // ---------- math ----------
  const U = (S.U = {});
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // exponential damping factor (framerate independent smoothing)
  U.damp = (rate, dt) => 1 - Math.exp(-rate * dt);
  U.dampTo = (cur, tgt, rate, dt) => cur + (tgt - cur) * U.damp(rate, dt);
  // shortest signed difference between two angles
  U.angDiff = (a, b) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  U.dampAngle = (cur, tgt, rate, dt) => cur + U.angDiff(cur, tgt) * U.damp(rate, dt);
  U.lerpAngle = (a, b, t) => a + U.angDiff(a, b) * t;

  // easing
  U.ease = {
    linear: (t) => t,
    in: (t) => t * t,
    out: (t) => 1 - (1 - t) * (1 - t),
    inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    // very fast start, long settle — good for sword strikes
    snap: (t) => 1 - Math.pow(1 - t, 4),
  };

  // planar (xz) distance between two Vector3
  U.distXZ = (a, b) => {
    const dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  };
  // yaw (rotation about Y) pointing from a toward b
  U.yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

  // ---------- input ----------
  const input = (S.input = {
    keys: {},
    mouse: { dx: 0, dy: 0 },
    locked: false,
    pressed: {}, // one-frame edge triggers
    consume(k) { const v = input.pressed[k]; input.pressed[k] = false; return v; },
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    input.keys[k] = true;
    input.pressed[k] = true;
    if (k === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { input.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { input.keys = {}; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- SFX (synthesized, no assets) ----------
  const sfx = (S.sfx = {});
  let AC = null;
  let master = null;
  sfx.ensure = () => {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.5;
      master.connect(AC.destination);
    } catch (e) { AC = null; }
  };

  function noiseBuffer(len) {
    const b = AC.createBuffer(1, AC.sampleRate * len, AC.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function env(g, t0, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  function metallic(freqs, dur, vol, hp) {
    const t0 = AC.currentTime;
    const g = AC.createGain();
    env(g, t0, 0.004, vol, dur);
    let dest = g;
    if (hp) {
      const f = AC.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = hp;
      g.connect(f); f.connect(master); dest = g;
    } else g.connect(master);
    freqs.forEach((fr, i) => {
      const o = AC.createOscillator();
      o.type = i % 2 ? 'square' : 'triangle';
      o.frequency.value = fr * U.rand(0.98, 1.02);
      const og = AC.createGain(); og.gain.value = 1 / freqs.length;
      o.connect(og); og.connect(dest);
      o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }

  function noiseHit(dur, vol, band, q) {
    const t0 = AC.currentTime;
    const src = AC.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    const f = AC.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = band; f.Q.value = q || 1;
    const g = AC.createGain();
    env(g, t0, 0.003, vol, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  function thump(freq, dur, vol) {
    const t0 = AC.currentTime;
    const o = AC.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.35), t0 + dur);
    const g = AC.createGain();
    env(g, t0, 0.005, vol, dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  const bank = {
    parry:   () => { metallic([2100, 3150, 4400, 5600], 0.32, 0.55, 900); noiseHit(0.09, 0.3, 6000, 2); },
    block:   () => { metallic([900, 1500, 2400], 0.14, 0.3, 500); noiseHit(0.06, 0.2, 3500, 1.5); },
    clash:   () => { metallic([1400, 2300, 3600], 0.2, 0.4, 700); },
    hit:     () => { noiseHit(0.12, 0.5, 1200, 0.8); thump(140, 0.16, 0.5); },
    hitBig:  () => { noiseHit(0.2, 0.6, 700, 0.7); thump(90, 0.3, 0.8); },
    whoosh:  () => { noiseHit(0.16, 0.22, 2000, 0.5); },
    whooshBig:() => { noiseHit(0.3, 0.3, 900, 0.4); },
    dash:    () => { noiseHit(0.18, 0.25, 2600, 0.6); },
    jump:    () => { noiseHit(0.1, 0.12, 1800, 0.8); },
    land:    () => { thump(120, 0.12, 0.3); },
    stagger: () => { metallic([500, 760, 1150], 0.5, 0.5, 300); thump(70, 0.4, 0.7); },
    deathblow:() => { noiseHit(0.35, 0.7, 900, 0.5); thump(60, 0.5, 0.9); metallic([2800, 4100], 0.4, 0.4, 1200); },
    peril:   () => { metallic([320, 480], 0.35, 0.4, 0); },
    fire:    () => { noiseHit(0.4, 0.35, 500, 0.4); },
    ice:     () => { metallic([2600, 3900, 5200], 0.35, 0.3, 1500); },
    wind:    () => { noiseHit(0.5, 0.3, 1400, 0.3); },
    bolt:    () => { noiseHit(0.15, 0.5, 4000, 0.7); thump(200, 0.2, 0.4); metallic([5200, 6400], 0.2, 0.25, 2000); },
    heal:    () => { metallic([880, 1320, 1760], 0.6, 0.25, 0); },
    chest:   () => { thump(180, 0.2, 0.3); metallic([600, 900], 0.3, 0.2, 0); },
    groan:   () => { const t0=AC.currentTime; const o=AC.createOscillator(); o.type='sawtooth';
                     o.frequency.setValueAtTime(95,t0); o.frequency.linearRampToValueAtTime(65,t0+0.5);
                     const g=AC.createGain(); env(g,t0,0.05,0.18,0.55); o.connect(g); g.connect(master);
                     o.start(t0); o.stop(t0+0.65); },
    roar:    () => { const t0=AC.currentTime; const o=AC.createOscillator(); o.type='sawtooth';
                     o.frequency.setValueAtTime(70,t0); o.frequency.linearRampToValueAtTime(140,t0+0.25);
                     o.frequency.linearRampToValueAtTime(55,t0+0.8);
                     const g=AC.createGain(); env(g,t0,0.06,0.45,0.85);
                     const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=600;
                     o.connect(f); f.connect(g); g.connect(master);
                     o.start(t0); o.stop(t0+1); noiseHit(0.6,0.2,300,0.5); },
    spawn:   () => { metallic([440, 660, 880], 0.4, 0.2, 0); noiseHit(0.3, 0.15, 800, 0.6); },
    step:    () => { thump(220, 0.06, 0.08); },
  };

  sfx.play = (name) => {
    if (!AC) return;
    try { if (bank[name]) bank[name](); } catch (e) { /* audio hiccup — ignore */ }
  };
})();
