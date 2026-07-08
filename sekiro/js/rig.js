/* Shinobi Protocol — rig.js
   Character builders. Every rig shares one bone naming scheme so the animator
   can drive any of them:
     root, spine, chest, neck,
     shL, elL, wrL, shR, elR, wrR,
     hipL, kneeL, ankL, hipR, kneeR, ankR
   All rigs stand with feet at local y=0, facing +Z. */
(function () {
  'use strict';
  const S = window.S;
  const Rig = (S.Rig = {});

  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color, roughness: rough === undefined ? 0.6 : rough, metalness: metal || 0.05,
    });
  }

  function box(w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    return m;
  }

  function ball(r, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    return m;
  }

  function grp(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  /* ---------------- humanoid (player / zombie / swordsman) ---------------- */
  // cfg: { s, skin, joint, accent, eyes, zombie }
  Rig.buildHumanoid = function (cfg) {
    const s = cfg.s || 1;
    const M = mat(cfg.skin);
    const MJ = mat(cfg.joint, 0.5);
    const MA = mat(cfg.accent);

    const group = new THREE.Group();
    group.scale.setScalar(s);

    const bones = {};
    const root = (bones.root = grp(group, 0, 0.95, 0));
    root.userData.baseY = 0.95;

    // pelvis + lower torso (segmented, like the reference mannequin)
    root.add(box(0.30, 0.15, 0.21, M, 0, -0.02, 0));
    root.add(box(0.24, 0.06, 0.17, MA, 0, -0.115, 0));

    // spine → mid torso segments
    const spine = (bones.spine = grp(root, 0, 0.09, 0));
    spine.add(box(0.26, 0.09, 0.19, M, 0, 0.045, 0));
    spine.add(box(0.28, 0.10, 0.20, M, 0, 0.15, 0));

    // chest → upper chest plate, wide
    const chest = (bones.chest = grp(spine, 0, 0.22, 0));
    chest.add(box(0.40, 0.24, 0.23, M, 0, 0.115, 0));
    chest.add(box(0.34, 0.05, 0.245, MA, 0, 0.20, 0));   // collar plate
    chest.add(box(0.30, 0.10, 0.05, MA, 0, 0.10, 0.10)); // chest inset

    // neck + head
    const neck = (bones.neck = grp(chest, 0, 0.25, 0));
    neck.add(box(0.10, 0.08, 0.10, MJ, 0, 0.02, 0));
    const head = box(0.27, 0.26, 0.26, M, 0, 0.185, 0);
    neck.add(head);
    if (cfg.eyes) {
      const ME = mat(cfg.eyes, 0.3, 0.2);
      const e1 = box(0.05, 0.04, 0.02, ME, -0.06, 0.20, 0.13);
      const e2 = box(0.05, 0.04, 0.02, ME, 0.06, 0.20, 0.13);
      e1.material.emissive = new THREE.Color(cfg.eyes); e1.material.emissiveIntensity = 0.7;
      e2.material = e1.material;
      neck.add(e1); neck.add(e2);
    } else {
      neck.add(box(0.20, 0.05, 0.02, MJ, 0, 0.21, 0.13)); // visor strip
    }

    // arms
    function arm(side) {
      const sx = side === 'R' ? -1 : 1;
      const sh = grp(chest, sx * 0.27, 0.17, 0);
      sh.add(ball(0.075, MJ, 0, 0, 0));
      sh.add(box(0.13, 0.30, 0.145, M, 0, -0.20, 0));
      const el = grp(sh, 0, -0.37, 0);
      el.add(ball(0.06, MJ, 0, 0, 0));
      el.add(box(0.11, 0.27, 0.125, M, 0, -0.165, 0));
      const wr = grp(el, 0, -0.33, 0);
      wr.add(box(0.085, 0.06, 0.10, MJ, 0, -0.01, 0));
      wr.add(box(0.10, 0.13, 0.12, M, 0, -0.10, 0));
      bones['sh' + side] = sh;
      bones['el' + side] = el;
      bones['wr' + side] = wr;
      return { sh, el, wr };
    }
    arm('L'); arm('R');

    // legs
    function leg(side) {
      const sx = side === 'R' ? -1 : 1;
      const hip = grp(root, sx * 0.115, -0.07, 0);
      hip.add(ball(0.075, MJ, 0, 0, 0));
      hip.add(box(0.16, 0.34, 0.18, M, 0, -0.22, 0));
      const knee = grp(hip, 0, -0.42, 0);
      knee.add(ball(0.06, MJ, 0, 0, 0));
      knee.add(box(0.135, 0.32, 0.155, M, 0, -0.20, 0));
      const ank = grp(knee, 0, -0.43, 0);
      ank.add(box(0.14, 0.09, 0.30, MA, 0, -0.045, 0.06));
      ank.add(box(0.13, 0.05, 0.10, M, 0, -0.02, -0.04));
      bones['hip' + side] = hip;
      bones['knee' + side] = knee;
      bones['ank' + side] = ank;
      return { hip, knee, ank };
    }
    leg('L'); leg('R');

    // zombie decoration: crooked, rotting
    if (cfg.zombie) {
      head.rotation.z = 0.12;
      chest.children[1].visible = false;
      root.add(box(0.18, 0.08, 0.22, MA, 0.06, 0.02, 0.02)); // torn rag
    }

    const rig = {
      group, bones,
      // limb subtrees for dismemberment
      limbs: {
        head: bones.neck, armL: bones.shL, armR: bones.shR,
        legL: bones.hipL, legR: bones.hipR,
      },
      handR: bones.wrR, handL: bones.wrL,
      height: 1.8 * s,
    };
    return rig;
  };

  /* ---------------- ogre ---------------- */
  Rig.buildOgre = function () {
    const skin = mat(0x7d6f4e, 0.85);
    const dark = mat(0x4a4030, 0.85);
    const cloth = mat(0x3a2f26, 0.95);

    const group = new THREE.Group();
    const bones = {};
    const H = 1.55; // pelvis height — total ~3.1m tall
    const root = (bones.root = grp(group, 0, H, 0));
    root.userData.baseY = H;

    // massive gut + pelvis
    root.add(box(0.85, 0.45, 0.70, skin, 0, 0.05, 0.05));
    root.add(box(0.70, 0.30, 0.55, cloth, 0, -0.28, 0));

    const spine = (bones.spine = grp(root, 0, 0.28, 0));
    spine.add(box(0.95, 0.40, 0.72, skin, 0, 0.18, -0.02));

    const chest = (bones.chest = grp(spine, 0, 0.42, 0));
    chest.add(box(1.15, 0.55, 0.80, skin, 0, 0.22, -0.05));
    chest.add(box(0.9, 0.18, 0.82, dark, 0, 0.48, -0.05)); // hunched shoulder mass

    const neck = (bones.neck = grp(chest, 0, 0.52, 0.18));
    const headM = box(0.42, 0.38, 0.42, skin, 0, 0.16, 0.06);
    neck.add(headM);
    // ugly face: brow, tusks, eyes
    neck.add(box(0.44, 0.10, 0.10, dark, 0, 0.28, 0.24));
    neck.add(box(0.07, 0.14, 0.06, mat(0xd8cfb0, 0.4), -0.13, 0.02, 0.26));
    neck.add(box(0.07, 0.14, 0.06, mat(0xd8cfb0, 0.4), 0.13, 0.02, 0.26));
    const eyeM = mat(0xff5522, 0.3);
    eyeM.emissive = new THREE.Color(0xff3300); eyeM.emissiveIntensity = 0.8;
    neck.add(box(0.07, 0.05, 0.03, eyeM, -0.10, 0.20, 0.27));
    neck.add(box(0.07, 0.05, 0.03, eyeM, 0.10, 0.20, 0.27));

    function arm(side) {
      const sx = side === 'R' ? -1 : 1;
      const sh = grp(chest, sx * 0.68, 0.38, -0.02);
      sh.add(ball(0.24, skin, 0, 0, 0));
      sh.add(box(0.36, 0.62, 0.38, skin, 0, -0.35, 0));
      const el = grp(sh, 0, -0.70, 0);
      el.add(ball(0.17, dark, 0, 0, 0));
      el.add(box(0.32, 0.60, 0.34, skin, 0, -0.34, 0));
      const wr = grp(el, 0, -0.70, 0);
      wr.add(box(0.42, 0.40, 0.44, dark, 0, -0.20, 0)); // huge fist
      bones['sh' + side] = sh;
      bones['el' + side] = el;
      bones['wr' + side] = wr;
    }
    arm('L'); arm('R');

    function leg(side) {
      const sx = side === 'R' ? -1 : 1;
      const hip = grp(root, sx * 0.34, -0.32, 0);
      hip.add(box(0.40, 0.55, 0.44, cloth, 0, -0.25, 0));
      const knee = grp(hip, 0, -0.58, 0);
      knee.add(box(0.34, 0.55, 0.36, skin, 0, -0.28, 0));
      const ank = grp(knee, 0, -0.62, 0);
      ank.add(box(0.38, 0.14, 0.58, dark, 0, -0.07, 0.10));
      bones['hip' + side] = hip;
      bones['knee' + side] = knee;
      bones['ank' + side] = ank;
    }
    leg('L'); leg('R');

    return { group, bones, handR: bones.wrR, handL: bones.wrL, height: 3.1, ogre: true };
  };

  /* ---------------- weapons ----------------
     Local space: grip at origin, blade extends +Y.
     Returned: { group, tip, base, reach, type } */
  const bladeMat = mat(0xcfd6de, 0.25, 0.85);
  const darkMetal = mat(0x3c4048, 0.4, 0.7);
  const gripMat = mat(0x2a1f18, 0.9);
  const goldMat = mat(0x9a7b30, 0.4, 0.6);

  Rig.makeWeapon = function (type) {
    const g = new THREE.Group();
    let tipY = 1, baseY = 0.1, reach = 2.4;
    if (type === 'katana') {
      g.add(box(0.035, 0.28, 0.05, gripMat, 0, -0.10, 0));
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 12), goldMat);
      guard.position.y = 0.05; g.add(guard);
      // slightly curved blade — three segments
      const b1 = box(0.016, 0.36, 0.045, bladeMat, 0, 0.24, 0);
      const b2 = box(0.015, 0.36, 0.042, bladeMat, 0, 0.58, 0.012); b2.rotation.x = -0.05;
      const b3 = box(0.013, 0.30, 0.038, bladeMat, 0, 0.90, 0.035); b3.rotation.x = -0.10;
      g.add(b1); g.add(b2); g.add(b3);
      tipY = 1.05; baseY = 0.08; reach = 2.5;
    } else if (type === 'greatsword') {
      g.add(box(0.05, 0.40, 0.07, gripMat, 0, -0.14, 0));
      g.add(box(0.34, 0.05, 0.09, darkMetal, 0, 0.07, 0));
      g.add(box(0.09, 1.15, 0.028, bladeMat, 0, 0.68, 0));
      g.add(box(0.045, 1.15, 0.034, darkMetal, 0, 0.68, 0)); // fuller
      const pt = box(0.09, 0.16, 0.028, bladeMat, 0, 1.32, 0);
      pt.scale.set(1, 1, 1); g.add(pt);
      tipY = 1.40; baseY = 0.10; reach = 2.8;
    } else { // spear
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 2.3, 8), gripMat);
      shaft.position.y = 0.45; shaft.castShadow = true; g.add(shaft);
      g.add(box(0.05, 0.04, 0.05, goldMat, 0, 1.58, 0));
      const bl = box(0.05, 0.34, 0.018, bladeMat, 0, 1.78, 0);
      g.add(bl);
      tipY = 1.95; baseY = 0.9; reach = 3.4;
    }
    g.traverse((o) => { o.castShadow = true; });
    const tip = new THREE.Object3D(); tip.position.y = tipY; g.add(tip);
    const base = new THREE.Object3D(); base.position.y = baseY; g.add(base);
    return { group: g, tip, base, reach, type };
  };

  // Attach weapon to a rig's right hand with a natural carry angle.
  Rig.equipWeapon = function (rig, type) {
    if (rig.weaponMount) {
      rig.handR.remove(rig.weaponMount);
      rig.weaponMount = null; rig.weapon = null;
    }
    if (!type) return null;
    const w = Rig.makeWeapon(type);
    const mount = new THREE.Group();
    mount.position.set(0, -0.10, 0.03);
    mount.rotation.x = 1.45; // blade forward when arm hangs
    mount.add(w.group);
    rig.handR.add(mount);
    rig.weaponMount = mount;
    rig.weapon = w;
    return w;
  };

  /* ---------------- bow (held in the left hand) ---------------- */
  Rig.makeBow = function () {
    const g = new THREE.Group();
    const wood = mat(0x3a2a1c, 0.8);
    const seg = (y, rx) => {
      const b = box(0.035, 0.42, 0.05, wood, 0, y, 0);
      b.rotation.x = rx;
      return b;
    };
    g.add(box(0.045, 0.22, 0.06, mat(0x241a10, 0.9), 0, 0, 0)); // grip
    g.add(seg(0.28, -0.28));
    g.add(seg(-0.28, 0.28));
    const tip1 = box(0.03, 0.18, 0.04, wood, 0, 0.52, -0.1); tip1.rotation.x = -0.55; g.add(tip1);
    const tip2 = box(0.03, 0.18, 0.04, wood, 0, -0.52, 0.1); tip2.rotation.x = 0.55; g.add(tip2);
    const stringGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.58, -0.14), new THREE.Vector3(0, 0, -0.1), new THREE.Vector3(0, -0.58, 0.14),
    ]);
    g.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xd8d0c0 })));
    g.traverse((o) => { o.castShadow = true; });
    return g;
  };

  Rig.equipBow = function (rig) {
    const mount = new THREE.Group();
    mount.position.set(0, -0.10, 0.02);
    mount.rotation.set(0.25, 0, 0.15);
    mount.add(Rig.makeBow());
    rig.handL.add(mount);
    rig.bowMount = mount;
    return mount;
  };

  /* ---------------- cloak (hood + mantle + cape + robe flaps) ---------------- */
  Rig.addCloak = function (rig, cloakColor, trimColor) {
    const MC = mat(cloakColor, 0.92);
    const MT = mat(trimColor, 0.55, 0.3);
    const b = rig.bones;
    // hood — shell around and above the head, open at the face
    b.neck.add(box(0.36, 0.16, 0.36, MC, 0, 0.34, -0.02));
    b.neck.add(box(0.36, 0.26, 0.10, MC, 0, 0.17, -0.16));
    b.neck.add(box(0.05, 0.28, 0.30, MC, -0.165, 0.16, -0.02));
    b.neck.add(box(0.05, 0.28, 0.30, MC, 0.165, 0.16, -0.02));
    const brim = box(0.36, 0.05, 0.34, MC, 0, 0.30, 0.05);
    brim.rotation.x = 0.18;
    b.neck.add(brim);
    // shoulder mantle with trim
    b.chest.add(box(0.52, 0.12, 0.30, MC, 0, 0.22, -0.01));
    b.chest.add(box(0.54, 0.03, 0.32, MT, 0, 0.155, -0.01));
    // back cape
    const cape = box(0.44, 0.88, 0.045, MC, 0, -0.42, 0);
    const capePivot = new THREE.Group();
    capePivot.position.set(0, 0.18, -0.14);
    capePivot.rotation.x = -0.16;
    capePivot.add(cape);
    b.chest.add(capePivot);
    // robe flaps from the waist
    const flap = (x, z, ry, w) => {
      const f = box(w, 0.62, 0.04, MC, 0, -0.31, 0);
      const p = new THREE.Group();
      p.position.set(x, -0.08, z);
      p.rotation.y = ry;
      p.rotation.x = z > 0 ? 0.14 : -0.14;
      p.add(f);
      b.root.add(p);
      return p;
    };
    flap(0, 0.13, 0, 0.30);
    flap(0, -0.13, 0, 0.34);
    flap(-0.17, 0, Math.PI / 2, 0.26);
    flap(0.17, 0, Math.PI / 2, 0.26);
    // gold waist sash
    b.root.add(box(0.32, 0.06, 0.23, MT, 0, -0.10, 0));
  };

  /* ---------------- palettes ---------------- */
  Rig.presets = {
    player: { s: 1, skin: 0xb9babd, joint: 0x7e7f83, accent: 0x8f9095 },
    zombie: { s: 0.98, skin: 0x71855a, joint: 0x4a5238, accent: 0x3d4032, eyes: 0xbb2211, zombie: true },
    swordsman: { s: 1.02, skin: 0x4c5361, joint: 0x2e323b, accent: 0x8a2f2a, eyes: 0xffc040 },
    boss: { s: 1.08, skin: 0x3b3548, joint: 0x232030, accent: 0x2a2438, eyes: 0x6ee4ff },
  };
})();
