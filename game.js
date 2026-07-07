'use strict';
/* Voxel Monk Fighter — third-person voxel brawler on an open plain.
   Plain three.js (global THREE from vendor/three.min.js), no other deps. */

// ---------------------------------------------------------------- utilities
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc4e8);
scene.fog = new THREE.Fog(0x8fc4e8, 45, 110);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// lights
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x5a7a45, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
sun.position.set(18, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.camera.far = 90;
scene.add(sun);

// ground: empty grassy plain
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6d924c';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const shade = 0.82 + Math.random() * 0.36;
    g.fillStyle = `rgb(${(0x6d * shade) | 0},${(0x92 * shade) | 0},${(0x4c * shade) | 0})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(48, 48);
  return tex;
}
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.MeshLambertMaterial({ map: makeGroundTexture() })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const ARENA_RADIUS = 42;

// ---------------------------------------------------------------- voxel fighter model
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/* Rig layout (character faces +Z):
   group (yaw, world position)
     pivot (pelvis pivot: y = 0.9 + rootY, rotation.x = body pitch, position.z = zoff)
       ...all body parts, built with pelvis at local y=0...
   Joint groups: torso, head, shL/shR (shoulders), elL/elR (elbows),
                 hipL/hipR, kneeL/kneeR. Rotation 0 = standing rest pose. */
function buildFighter(cfg) {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = 0.9;
  group.add(pivot);

  const J = {};

  // pelvis / robe skirt
  pivot.add(box(0.62, 0.34, 0.4, cfg.robeDark, 0, -0.06, 0));
  pivot.add(box(0.7, 0.3, 0.46, cfg.robeDark, 0, -0.34, 0)); // skirt hem

  // torso
  const torso = new THREE.Group();
  torso.position.y = 0.12;
  pivot.add(torso);
  J.torso = torso;
  torso.add(box(0.7, 0.62, 0.42, cfg.robe, 0, 0.31, 0));
  torso.add(box(0.74, 0.14, 0.46, cfg.sash, 0, 0.04, 0));           // belt
  const sash = box(0.16, 0.62, 0.05, cfg.sash, -0.14, 0.31, 0.21);  // shoulder sash
  sash.rotation.z = -22 * D2R;
  torso.add(sash);

  // head
  const head = new THREE.Group();
  head.position.y = 0.66;
  torso.add(head);
  J.head = head;
  head.add(box(0.3, 0.12, 0.28, cfg.skin, 0, 0.05, 0)); // neck
  head.add(box(0.52, 0.5, 0.5, cfg.skin, 0, 0.38, 0));  // bald voxel head
  head.add(box(0.09, 0.09, 0.03, 0x181818, -0.12, 0.44, 0.255)); // eyes
  head.add(box(0.09, 0.09, 0.03, 0x181818, 0.12, 0.44, 0.255));
  head.add(box(0.44, 0.07, 0.03, cfg.brow, 0, 0.53, 0.255));      // brow
  if (cfg.headband) head.add(box(0.56, 0.1, 0.54, cfg.headband, 0, 0.56, 0));

  // arms — pivot at shoulder, hang straight down at rest
  function arm(side) { // side: -1 left, +1 right
    const sh = new THREE.Group();
    sh.position.set(side * 0.46, 0.56, 0);
    torso.add(sh);
    sh.add(box(0.24, 0.4, 0.24, cfg.robe, 0, -0.16, 0)); // sleeve
    const el = new THREE.Group();
    el.position.y = -0.38;
    sh.add(el);
    el.add(box(0.2, 0.34, 0.2, cfg.skin, 0, -0.15, 0));  // forearm
    el.add(box(0.24, 0.22, 0.24, cfg.fist, 0, -0.4, 0)); // fist
    return { sh, el };
  }
  const aL = arm(-1), aR = arm(1);
  J.shL = aL.sh; J.elL = aL.el; J.shR = aR.sh; J.elR = aR.el;

  // legs — pivot at hip
  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.18, -0.1, 0);
    pivot.add(hip);
    hip.add(box(0.26, 0.4, 0.28, cfg.pants, 0, -0.18, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    knee.add(box(0.24, 0.36, 0.25, cfg.pants, 0, -0.16, 0));
    knee.add(box(0.26, 0.12, 0.4, cfg.shoe, 0, -0.4, 0.07)); // sandal
    return { hip, knee };
  }
  const lL = leg(-1), lR = leg(1);
  J.hipL = lL.hip; J.kneeL = lL.knee; J.hipR = lR.hip; J.kneeR = lR.knee;

  scene.add(group);
  return { group, pivot, J };
}

// ---------------------------------------------------------------- animation clips
/* Pose = { jointName:[xDeg,yDeg,zDeg], root:[dy, pitchDeg, dz] }.
   Keys list only what changes; missing joints hold their previous keyed
   value (0 at clip start), and everything eases with smoothstep. */
const ZERO3 = [0, 0, 0];

function normalizeClip(clip) {
  const joints = new Set();
  clip.keys.forEach(k => Object.keys(k.p).forEach(j => joints.add(j)));
  let prev = {};
  joints.forEach(j => (prev[j] = ZERO3));
  clip.keys.forEach(k => {
    joints.forEach(j => { if (!k.p[j]) k.p[j] = prev[j]; });
    prev = k.p;
  });
  return clip;
}

function sampleClip(clip, t) { // t in [0,1] -> pose object
  const keys = clip.keys;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t < t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const span = Math.max(b.t - a.t, 1e-6);
  const f = smooth(clamp((t - a.t) / span, 0, 1));
  const pose = {};
  for (const j in a.p) {
    const av = a.p[j], bv = b.p[j] || av;
    pose[j] = [lerp(av[0], bv[0], f), lerp(av[1], bv[1], f), lerp(av[2], bv[2], f)];
  }
  return pose;
}

const LYING = [-0.72, -92, -0.1]; // root pose flat on the back

const CLIPS = {
  // Left-hand jab: quick snap punch.
  jab: {
    dur: 0.42,
    keys: [
      { t: 0.0, p: {} },
      { t: 0.2, p: { shL: [-45, 0, -6], elL: [-105, 0, 0], torso: [0, 10, 0] } },
      { t: 0.42, p: { shL: [-96, 6, 0], elL: [-6, 0, 0], torso: [4, 20, 0], head: [0, -6, 0] } },
      { t: 0.58, p: { shL: [-88, 4, 0], elL: [-18, 0, 0], torso: [3, 16, 0] } },
      { t: 1.0, p: {} },
    ],
    hits: [{ t: 0.44, t1: 0.62, range: 2.0, arc: 70, dmg: 6, stun: 0.32, push: 0.5 }],
  },

  // Right-hand heavy straight: winds up, breaks blocks.
  heavy: {
    dur: 0.85,
    keys: [
      { t: 0.0, p: {} },
      { t: 0.32, p: { shR: [-28, 0, 26], elR: [-125, 0, 0], torso: [0, -32, 0], head: [0, 14, 0], root: [0, 0, -0.08] } },
      { t: 0.52, p: { shR: [-102, -6, 0], elR: [0, 0, 0], torso: [10, 30, 0], head: [0, -8, 0], root: [0, 0, 0.22], hipL: [-18, 0, 0], kneeL: [26, 0, 0], hipR: [14, 0, 0] } },
      { t: 0.68, p: { shR: [-95, -4, 0], elR: [-10, 0, 0], torso: [8, 26, 0] } },
      { t: 1.0, p: {} },
    ],
    hits: [{ t: 0.54, t1: 0.72, range: 2.15, arc: 65, dmg: 15, stun: 0.55, push: 1.4, breaksBlock: true }],
    lunge: { t0: 0.34, t1: 0.54, speed: 2.2 },
  },

  // Right-leg front kick.
  frontkick: {
    dur: 0.68,
    keys: [
      { t: 0.0, p: {} },
      { t: 0.3, p: { hipR: [-95, 0, 0], kneeR: [100, 0, 0], torso: [-8, -6, 0], shL: [-35, 0, -10], shR: [25, 0, 14], hipL: [8, 0, 0] } },
      { t: 0.46, p: { hipR: [-88, 0, 0], kneeR: [4, 0, 0], torso: [-14, -8, 0], root: [0.04, 0, 0.1] } },
      { t: 0.62, p: { hipR: [-65, 0, 0], kneeR: [70, 0, 0], torso: [-6, -4, 0] } },
      { t: 1.0, p: {} },
    ],
    hits: [{ t: 0.48, t1: 0.64, range: 2.3, arc: 60, dmg: 10, stun: 0.45, push: 2.2 }],
  },

  // Right-hand haymaker: huge wind-up hook from the opposite hand.
  haymaker: {
    dur: 0.95,
    keys: [
      { t: 0.0, p: {} },
      { t: 0.3, p: { torso: [0, -55, 0], shR: [-62, 0, 78], elR: [-45, 0, 0], head: [0, -18, 0], shL: [-30, 0, -12], root: [0, 0, -0.06] } },
      { t: 0.52, p: { torso: [8, 42, 0], shR: [-96, 0, -14], elR: [-24, 0, 0], head: [0, 10, 0], root: [0, 0, 0.16], hipL: [-14, 0, 0], kneeL: [20, 0, 0] } },
      { t: 0.7, p: { torso: [6, 34, 0], shR: [-84, 0, -22], elR: [-40, 0, 0] } },
      { t: 1.0, p: {} },
    ],
    hits: [{ t: 0.54, t1: 0.74, range: 2.2, arc: 95, dmg: 13, stun: 0.7, push: 1.6 }],
  },

  // Flying dropkick: launch feet-first, land flat on the floor. Chains into getup.
  dropkick: {
    dur: 1.15, uninterruptible: true, next: 'getup',
    keys: [
      { t: 0.0, p: {} },
      { t: 0.13, p: { hipL: [-45, 0, 0], hipR: [-45, 0, 0], kneeL: [75, 0, 0], kneeR: [75, 0, 0], torso: [18, 0, 0], shL: [35, 0, -14], shR: [35, 0, 14], root: [-0.28, 0, 0] } },
      { t: 0.3, p: { root: [0.55, -76, 0.1], hipL: [-8, 0, 0], hipR: [-8, 0, 0], kneeL: [4, 0, 0], kneeR: [4, 0, 0], torso: [-12, 0, 0], shL: [55, 0, -20], shR: [55, 0, 20], head: [35, 0, 0] } },
      { t: 0.46, p: { root: [0.48, -88, 0.18], hipL: [-6, 0, 0], hipR: [-6, 0, 0] } },
      { t: 0.64, p: { root: LYING, hipL: [-12, 0, 0], hipR: [-16, 0, 0], kneeL: [14, 0, 0], kneeR: [20, 0, 0], shL: [30, 0, -24], shR: [30, 0, 24], head: [12, 0, 0] } },
      { t: 1.0, p: { root: LYING, hipL: [-12, 0, 0], hipR: [-16, 0, 0], kneeL: [14, 0, 0], kneeR: [20, 0, 0], shL: [30, 0, -24], shR: [30, 0, 24] } },
    ],
    hits: [{ t: 0.28, t1: 0.58, range: 2.5, arc: 70, dmg: 17, stun: 0.6, push: 1.0, breaksBlock: true, knockdown: true }],
    lunge: { t0: 0.16, t1: 0.5, speed: 7.5 },
  },

  // Slow climb back to the feet after a dropkick — the committed part.
  getup: {
    dur: 1.45, uninterruptible: true,
    keys: [
      { t: 0.0, p: { root: LYING, hipL: [-12, 0, 0], hipR: [-16, 0, 0], kneeL: [14, 0, 0], kneeR: [20, 0, 0], shL: [30, 0, -24], shR: [30, 0, 24] } },
      { t: 0.3, p: { root: [-0.62, -62, -0.05], hipL: [-75, 0, 0], hipR: [-75, 0, 0], kneeL: [95, 0, 0], kneeR: [95, 0, 0], torso: [22, 0, 0], shL: [-30, 0, -20], shR: [-30, 0, 20] } },
      { t: 0.62, p: { root: [-0.38, -12, 0], hipL: [-72, 0, 0], hipR: [-72, 0, 0], kneeL: [105, 0, 0], kneeR: [105, 0, 0], torso: [30, 0, 0], head: [-18, 0, 0] } },
      { t: 0.85, p: { root: [-0.14, 0, 0], hipL: [-32, 0, 0], hipR: [-32, 0, 0], kneeL: [48, 0, 0], kneeR: [48, 0, 0], torso: [14, 0, 0] } },
      { t: 1.0, p: {} },
    ],
  },

  // Knocked flat on the back, then rise. Victim of a landed dropkick.
  knockdown: {
    dur: 2.5, uninterruptible: true, invuln: true,
    keys: [
      { t: 0.0, p: {} },
      { t: 0.08, p: { root: [0.06, -26, -0.12], shL: [-70, 0, -30], shR: [-70, 0, 30], torso: [-10, 0, 0], head: [-20, 0, 0] } },
      { t: 0.2, p: { root: [-0.72, -90, -0.4], shL: [25, 0, -40], shR: [25, 0, 40], hipL: [-14, 0, 0], hipR: [-18, 0, 0], kneeL: [18, 0, 0], kneeR: [24, 0, 0], torso: [0, 0, 0], head: [0, 0, 0] } },
      { t: 0.52, p: { root: [-0.72, -90, -0.4], shL: [25, 0, -40], shR: [25, 0, 40], hipL: [-14, 0, 0], hipR: [-18, 0, 0], kneeL: [18, 0, 0], kneeR: [24, 0, 0] } },
      { t: 0.68, p: { root: [-0.6, -58, -0.42], hipL: [-78, 0, 0], hipR: [-78, 0, 0], kneeL: [98, 0, 0], kneeR: [98, 0, 0], torso: [24, 0, 0], shL: [-32, 0, -18], shR: [-32, 0, 18] } },
      { t: 0.86, p: { root: [-0.3, -8, -0.42], hipL: [-64, 0, 0], hipR: [-64, 0, 0], kneeL: [92, 0, 0], kneeR: [92, 0, 0], torso: [24, 0, 0] } },
      { t: 1.0, p: { root: [0, 0, -0.42] } },
    ],
  },

  // Small hit reaction.
  flinch: {
    dur: 0.34,
    keys: [
      { t: 0.0, p: {} },
      { t: 0.35, p: { torso: [-16, 8, 0], head: [-22, 0, 0], root: [0, 0, -0.08], shL: [-30, 0, -14], shR: [-30, 0, 14] } },
      { t: 1.0, p: {} },
    ],
  },

  // Guard smashed open — long stagger, arms flung wide.
  blockbreak: {
    dur: 0.95,
    keys: [
      { t: 0.0, p: { shL: [-80, 0, -20], shR: [-80, 0, 20], elL: [-100, 0, 0], elR: [-100, 0, 0] } },
      { t: 0.25, p: { shL: [-40, 0, -85], shR: [-40, 0, 85], elL: [-10, 0, 0], elR: [-10, 0, 0], torso: [-20, 0, 0], head: [-18, 0, 0], root: [0, 0, -0.18] } },
      { t: 0.7, p: { shL: [-30, 0, -60], shR: [-30, 0, 60], torso: [-12, 0, 0], root: [0, 0, -0.18] } },
      { t: 1.0, p: {} },
    ],
  },

  // Final fall — stays down (clip freezes at its last key).
  ko: {
    dur: 1.1, uninterruptible: true, invuln: true, freeze: true,
    keys: [
      { t: 0.0, p: {} },
      { t: 0.15, p: { root: [0.08, -30, -0.1], shL: [-80, 0, -35], shR: [-80, 0, 35], head: [-24, 0, 0] } },
      { t: 0.4, p: { root: [-0.72, -92, -0.45], shL: [30, 0, -50], shR: [30, 0, 50], hipL: [-12, 0, 0], hipR: [-20, 0, 0], kneeL: [16, 0, 0], kneeR: [26, 0, 0], head: [0, 0, 0] } },
      { t: 1.0, p: { root: [-0.72, -92, -0.45], shL: [30, 0, -50], shR: [30, 0, 50], hipL: [-12, 0, 0], hipR: [-20, 0, 0], kneeL: [16, 0, 0], kneeR: [26, 0, 0] } },
    ],
  },
};
for (const k in CLIPS) normalizeClip(CLIPS[k]);

const BLOCK_POSE = {
  shL: [-78, 0, -18], shR: [-78, 0, 18], elL: [-105, 0, 0], elR: [-105, 0, 0],
  torso: [8, 0, 0], head: [-6, 0, 0],
  hipL: [-12, 0, 0], hipR: [-12, 0, 0], kneeL: [18, 0, 0], kneeR: [18, 0, 0],
  root: [-0.06, 0, 0],
};

// ---------------------------------------------------------------- audio (tiny procedural SFX)
let audioCtx = null;
function sfx(kind) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(audioCtx.destination);
  const P = {
    hit:   { f0: 160, f1: 55, dur: 0.12, vol: 0.35, type: 'square' },
    heavy: { f0: 120, f1: 38, dur: 0.22, vol: 0.5, type: 'square' },
    block: { f0: 480, f1: 300, dur: 0.07, vol: 0.22, type: 'triangle' },
    break: { f0: 700, f1: 90, dur: 0.3, vol: 0.45, type: 'sawtooth' },
    down:  { f0: 90, f1: 30, dur: 0.4, vol: 0.55, type: 'square' },
    whoosh:{ f0: 300, f1: 900, dur: 0.09, vol: 0.06, type: 'sine' },
  }[kind];
  osc.type = P.type;
  osc.frequency.setValueAtTime(P.f0, t);
  osc.frequency.exponentialRampToValueAtTime(P.f1, t + P.dur);
  gain.gain.setValueAtTime(P.vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + P.dur);
  osc.start(t); osc.stop(t + P.dur + 0.02);
}

// ---------------------------------------------------------------- hit particles
const particles = [];
function spawnHitSpark(pos, color) {
  for (let i = 0; i < 7; i++) {
    const m = box(0.09, 0.09, 0.09, color, pos.x, pos.y, pos.z);
    m.castShadow = false;
    scene.add(m);
    particles.push({
      mesh: m, life: 0.38,
      vel: new THREE.Vector3(rand(-2.5, 2.5), rand(1.5, 4.5), rand(-2.5, 2.5)),
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vel.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.multiplyScalar(Math.max(0, 1 - 4 * dt));
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- Fighter
const JOINT_NAMES = ['torso', 'head', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'kneeL', 'kneeR'];

class Fighter {
  constructor(cfg) {
    const built = buildFighter(cfg);
    this.group = built.group;
    this.pivot = built.pivot;
    this.J = built.J;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.hp = 100;
    this.dead = false;
    this.blocking = false;
    this.clip = null;
    this.clipName = null;
    this.clipTime = 0;
    this.hitsFired = [];
    this.knockVel = new THREE.Vector3();
    this.walkPhase = 0;
    this.moveSpeed = 0;
    this.applied = {}; // smoothed pose actually shown
    JOINT_NAMES.forEach(j => (this.applied[j] = [0, 0, 0]));
    this.applied.root = [0, 0, 0];
    this.opponent = null;
    this.onAttackStart = null; // callback(fighter, clipName) for AI reactions
  }

  get busy() { return !!this.clip; }
  get down() { return this.clip && (this.clip.invuln || this.clipName === 'getup' || this.clipName === 'dropkick'); }

  play(name) {
    this.clip = CLIPS[name];
    this.clipName = name;
    this.clipTime = 0;
    this.hitsFired = (this.clip.hits || []).map(() => false);
    this.blocking = false;
  }

  attack(name) {
    if (this.dead || this.busy) return false;
    this.play(name);
    sfx('whoosh');
    if (this.onAttackStart) this.onAttackStart(this, name);
    return true;
  }

  takeHit(hit, attacker) {
    if (this.dead || (this.clip && this.clip.invuln)) return;
    // facing check for block: only blocks what's in front
    const toAtk = new THREE.Vector3().subVectors(attacker.pos, this.pos);
    const facing = Math.cos(this.yaw) * toAtk.z + Math.sin(this.yaw) * toAtk.x > 0;
    if (this.blocking && facing && !hit.breaksBlock) {
      sfx('block');
      spawnHitSpark(this.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xffffff);
      this.knockVel.copy(toAtk.normalize().multiplyScalar(-hit.push * 0.5));
      this.knockVel.y = 0;
      return; // guarded!
    }
    const blocked = this.blocking && facing;
    let dmg = hit.dmg;
    if (blocked && hit.breaksBlock) dmg = Math.round(dmg * 0.7);
    this.hp = Math.max(0, this.hp - dmg);
    shake(hit.knockdown ? 0.5 : 0.22);

    const dir = toAtk.normalize().multiplyScalar(-1); dir.y = 0;
    this.knockVel.copy(dir.multiplyScalar(hit.push));

    if (this.hp <= 0) {
      this.dead = true;
      this.play('ko');
      sfx('down');
      spawnHitSpark(this.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xffdd44);
      return;
    }
    if (hit.knockdown) {
      this.play('knockdown');
      sfx('down');
    } else if (blocked && hit.breaksBlock) {
      this.play('blockbreak');
      sfx('break');
    } else if (!this.clip || !this.clip.uninterruptible) {
      this.play('flinch');
      sfx(hit.dmg >= 12 ? 'heavy' : 'hit');
    } else {
      sfx('hit'); // hurt but committed to an animation (e.g. getting up)
    }
    spawnHitSpark(this.pos.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xffdd44);
  }

  resolveHit(hit) { // returns true once the strike connects
    const t = this.opponent;
    if (!t || t.dead) return false;
    const to = new THREE.Vector3().subVectors(t.pos, this.pos);
    const dist = to.length();
    if (dist > hit.range) return false;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    to.y = 0; to.normalize();
    if (fwd.dot(to) < Math.cos(hit.arc * D2R)) return false;
    t.takeHit(hit, this);
    return true;
  }

  update(dt) {
    // clip playback + hit events + lunges
    if (this.clip) {
      this.clipTime += dt;
      const tn = this.clipTime / this.clip.dur;
      // active hit windows: keep testing until the strike connects or the window closes
      (this.clip.hits || []).forEach((h, i) => {
        if (this.hitsFired[i]) return;
        if (tn >= h.t && tn <= h.t1) {
          if (this.resolveHit(h)) this.hitsFired[i] = true;
        } else if (tn > h.t1) {
          this.hitsFired[i] = true; // whiffed
        }
      });
      if (this.clip.lunge) {
        const L = this.clip.lunge;
        const oppDist = this.opponent ? this.opponent.pos.distanceTo(this.pos) : 99;
        if (tn >= L.t0 && tn <= L.t1 && oppDist > 1.1) {
          this.pos.x += Math.sin(this.yaw) * L.speed * dt;
          this.pos.z += Math.cos(this.yaw) * L.speed * dt;
        }
      }
      if (tn >= 1) {
        if (this.clip.freeze) {
          this.clipTime = this.clip.dur; // hold last pose (KO)
        } else if (this.clip.next) {
          this.play(this.clip.next);
        } else {
          this.clip = null;
          this.clipName = null;
        }
      }
    }

    // knockback decay
    this.pos.addScaledVector(this.knockVel, dt);
    this.knockVel.multiplyScalar(Math.max(0, 1 - 7 * dt));

    // stay in the arena
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > ARENA_RADIUS) {
      this.pos.x *= ARENA_RADIUS / r;
      this.pos.z *= ARENA_RADIUS / r;
    }

    // ----- compose target pose
    let target;
    if (this.clip) {
      target = sampleClip(this.clip, clamp(this.clipTime / this.clip.dur, 0, 1));
    } else if (this.blocking) {
      target = BLOCK_POSE;
    } else {
      target = this.idlePose(dt);
    }

    // smooth toward target (kills pops between clips/states)
    const k = Math.min(1, 16 * dt);
    JOINT_NAMES.concat(['root']).forEach(j => {
      const tv = target[j] || ZERO3;
      const av = this.applied[j];
      av[0] = lerp(av[0], tv[0], k);
      av[1] = lerp(av[1], tv[1], k);
      av[2] = lerp(av[2], tv[2], k);
    });

    // apply to rig
    JOINT_NAMES.forEach(j => {
      const v = this.applied[j];
      this.J[j].rotation.set(v[0] * D2R, v[1] * D2R, v[2] * D2R);
    });
    const rt = this.applied.root;
    this.pivot.position.y = 0.9 + rt[0];
    this.pivot.rotation.x = rt[1] * D2R;
    this.pivot.position.z = rt[2];

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }

  idlePose(dt) {
    const t = performance.now() / 1000;
    const p = {};
    if (this.moveSpeed > 0.2) {
      this.walkPhase += this.moveSpeed * 3.1 * dt;
      const s = Math.sin(this.walkPhase), c = Math.cos(this.walkPhase);
      const amp = Math.min(1, this.moveSpeed / 4) * 34;
      p.hipL = [s * amp, 0, 0];
      p.hipR = [-s * amp, 0, 0];
      p.kneeL = [Math.max(0, -c) * amp * 1.1, 0, 0];
      p.kneeR = [Math.max(0, c) * amp * 1.1, 0, 0];
      p.shL = [-25 - s * 16, 0, -8];
      p.shR = [-25 + s * 16, 0, 8];
      p.elL = [-55, 0, 0]; p.elR = [-55, 0, 0];
      p.torso = [4, s * 4, 0];
      p.root = [Math.abs(Math.sin(this.walkPhase)) * 0.04, 0, 0];
    } else {
      // relaxed fighting stance with breathing
      const b = Math.sin(t * 2.2);
      p.shL = [-28 + b * 2, 0, -10]; p.shR = [-28 + b * 2, 0, 10];
      p.elL = [-62, 0, 0]; p.elR = [-62, 0, 0];
      p.torso = [3 + b * 1.5, 0, 0];
      p.head = [b * 1.2, 0, 0];
      p.hipL = [-4, 0, 0]; p.hipR = [-4, 0, 0];
      p.kneeL = [7, 0, 0]; p.kneeR = [7, 0, 0];
      p.root = [b * 0.012 - 0.02, 0, 0];
    }
    return p;
  }
}

// ---------------------------------------------------------------- create fighters
const player = new Fighter({
  robe: 0xe08a2e, robeDark: 0xb96e1f, sash: 0x7a3d12, pants: 0xc27722,
  skin: 0xd9a066, fist: 0xd9a066, shoe: 0x6b4a2b, brow: 0x4a3320,
});
const enemy = new Fighter({
  robe: 0x4a5f8a, robeDark: 0x36486b, sash: 0x22293d, pants: 0x3f5378,
  skin: 0xc9986a, fist: 0xc9986a, shoe: 0x2e2620, brow: 0x33261a,
  headband: 0xa32222,
});
player.opponent = enemy;
enemy.opponent = player;

// ---------------------------------------------------------------- input
const keys = {};
let camYaw = 0, camPitch = 0.22;
let locked = false;
const startOverlay = document.getElementById('start');

startOverlay.addEventListener('click', () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  startOverlay.style.display = locked ? 'none' : 'flex';
});
canvas.addEventListener('click', () => { if (!locked) canvas.requestPointerLock(); });

document.addEventListener('mousemove', e => {
  if (!locked) return;
  camYaw -= e.movementX * 0.0026;
  camPitch = clamp(camPitch + e.movementY * 0.0022, -0.15, 0.85);
});

document.addEventListener('mousedown', e => {
  if (!locked || gameOver) return;
  if (e.button === 0) player.attack('jab');
  if (e.button === 2) player.attack('heavy');
});
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (gameOver) {
    if (k === 'enter') restart();
    return;
  }
  if (!locked) return;
  if (k === 'r') player.attack('frontkick');
  if (k === 'g') player.attack('haymaker');
  if (k === 'z') player.attack('dropkick');
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// ---------------------------------------------------------------- camera shake
let shakeAmt = 0;
function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

// ---------------------------------------------------------------- AI
const ai = {
  thinkT: 0, atkCd: 1.2, blockT: 0, strafeDir: 1, strafeT: 0,
};

// AI peeks at incoming player attacks and sometimes raises its guard.
player.onAttackStart = (f, name) => {
  if (enemy.dead || enemy.busy) return;
  const d = enemy.pos.distanceTo(player.pos);
  if (d < 3 && Math.random() < 0.38) {
    ai.blockT = CLIPS[name].dur + 0.25;
  }
};

function updateAI(dt) {
  enemy.moveSpeed = 0;
  if (enemy.dead) return;

  // always face the player (unless mid-animation on the ground)
  const to = new THREE.Vector3().subVectors(player.pos, enemy.pos);
  const dist = to.length();
  if (!enemy.down) enemy.yaw = Math.atan2(to.x, to.z);

  if (enemy.busy) { ai.blockT = 0; return; }

  if (ai.blockT > 0) {
    ai.blockT -= dt;
    enemy.blocking = true;
    return;
  }
  enemy.blocking = false;

  ai.atkCd -= dt;
  ai.strafeT -= dt;
  if (ai.strafeT <= 0) { ai.strafeDir = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rand(1, 2.4); }

  const fwd = new THREE.Vector3(to.x, 0, to.z).normalize();
  const side = new THREE.Vector3(fwd.z, 0, -fwd.x);

  if (dist > 2.0) {
    // close distance, occasionally opening with a flying dropkick
    const spd = 2.9;
    enemy.pos.addScaledVector(fwd, spd * dt);
    enemy.pos.addScaledVector(side, ai.strafeDir * 0.7 * dt);
    enemy.moveSpeed = spd;
    if (dist > 2.8 && dist < 4.2 && ai.atkCd <= 0 && Math.random() < 0.006) {
      enemy.attack('dropkick');
      ai.atkCd = rand(3.5, 5);
    }
  } else {
    enemy.pos.addScaledVector(side, ai.strafeDir * 1.1 * dt);
    enemy.moveSpeed = 1.1;
    if (ai.atkCd <= 0) {
      const roll = Math.random();
      let move;
      if (player.blocking && roll < 0.45) move = 'heavy';       // crack the guard
      else if (roll < 0.38) move = 'jab';
      else if (roll < 0.58) move = 'frontkick';
      else if (roll < 0.78) move = 'heavy';
      else if (roll < 0.94) move = 'haymaker';
      else move = 'dropkick';
      enemy.attack(move);
      ai.atkCd = rand(1.1, 2.2);
    }
  }
}

// ---------------------------------------------------------------- player control
function updatePlayer(dt) {
  player.moveSpeed = 0;
  if (player.dead) { player.blocking = false; return; }

  // character keeps its back to the camera
  if (!player.down) player.yaw = camYaw;

  player.blocking = !player.busy && !!keys['f'];

  if (!player.busy) {
    let mx = 0, mz = 0;
    if (keys['w']) mz += 1;
    if (keys['s']) mz -= 1;
    if (keys['a']) mx -= 1;
    if (keys['d']) mx += 1;
    if (mx || mz) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const spd = player.blocking ? 1.4 : 4.2;
      const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
      player.pos.x += (mx * cy + mz * sy) * spd * dt;
      player.pos.z += (-mx * sy + mz * cy) * spd * dt;
      player.moveSpeed = spd;
    }
  }
}

// ---------------------------------------------------------------- HUD / rounds
const pbar = document.getElementById('pbar');
const ebar = document.getElementById('ebar');
const msg = document.getElementById('msg');
const submsg = document.getElementById('submsg');
let gameOver = false;

function updateHUD() {
  pbar.style.width = player.hp + '%';
  ebar.style.width = enemy.hp + '%';
  if (!gameOver && (player.dead || enemy.dead)) {
    gameOver = true;
    msg.textContent = enemy.dead ? 'VICTORY' : 'DEFEAT';
    msg.style.color = enemy.dead ? '#ffd75e' : '#ff6b57';
    submsg.textContent = 'Press Enter for the next round';
    msg.style.display = 'block';
    submsg.style.display = 'block';
  }
}

function resetFighter(f, x, z, yaw) {
  f.hp = 100; f.dead = false;
  f.clip = null; f.clipName = null;
  f.blocking = false;
  f.pos.set(x, 0, z);
  f.yaw = yaw;
  f.knockVel.set(0, 0, 0);
}

function restart() {
  resetFighter(player, 0, -4, 0);
  resetFighter(enemy, 0, 4, Math.PI);
  camYaw = 0; camPitch = 0.22;
  ai.atkCd = 1.5; ai.blockT = 0;
  gameOver = false;
  msg.style.display = 'none';
  submsg.style.display = 'none';
}
restart();

// ---------------------------------------------------------------- camera
function updateCamera(dt) {
  const d = 4.4, h = 1.7;
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const tx = player.pos.x - Math.sin(camYaw) * cp * d;
  const ty = player.pos.y + h + sp * d;
  const tz = player.pos.z - Math.cos(camYaw) * cp * d;
  const k = Math.min(1, 14 * dt);
  camera.position.x = lerp(camera.position.x, tx, k);
  camera.position.y = lerp(camera.position.y, ty, k);
  camera.position.z = lerp(camera.position.z, tz, k);
  if (shakeAmt > 0.002) {
    camera.position.x += rand(-1, 1) * shakeAmt * 0.15;
    camera.position.y += rand(-1, 1) * shakeAmt * 0.15;
    shakeAmt *= Math.max(0, 1 - 9 * dt);
  }
  camera.lookAt(player.pos.x, player.pos.y + 1.45, player.pos.z);
}
camera.position.set(0, 3, -9);

// ---------------------------------------------------------------- main loop
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  updatePlayer(dt);
  updateAI(dt);

  // keep the two fighters from standing inside each other
  const sep = new THREE.Vector3().subVectors(enemy.pos, player.pos);
  const sd = sep.length();
  if (sd > 0.001 && sd < 1.1 && !player.down && !enemy.down) {
    sep.normalize().multiplyScalar((1.1 - sd) * 0.5);
    enemy.pos.add(sep);
    player.pos.sub(sep);
  }

  player.update(dt);
  enemy.update(dt);
  updateParticles(dt);
  updateCamera(dt);
  updateHUD();

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// small debug/testing handle
window.__game = { player, enemy, setYaw: y => { camYaw = y; } };
