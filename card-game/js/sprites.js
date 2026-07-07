/* ============================================================
   GRIMVEIL — procedural pixel-art sprite engine.
   Every card's artwork is painted on a 48x48 pixel grid and
   upscaled with nearest-neighbour, so the pixels stay fine and
   crisp rather than big and blocky.
   ============================================================ */
const Sprites = (() => {

  const SZ = 48;
  const OUTLINE = '#0d0716';

  /* ---------- rng ---------- */
  function hashStr(s){
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a){
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- palettes: [deep shade, base, light, accent] ---------- */
  const PALS = {
    rust:  ['#4a2015','#7a3b26','#b06a3b','#e8a15c'],
    bone:  ['#6e6a7a','#a8a4b4','#dcd8e4','#f5f2fa'],
    slate: ['#2c2f3e','#4a4f66','#7a80a0','#aeb6d8'],
    steel: ['#3a3f52','#6a7288','#9aa4bc','#cfd8ec'],
    venom: ['#1f4020','#3c7038','#6ab04c','#a8e063'],
    moss:  ['#2a3d24','#4a6440','#7a9668','#b4cc9a'],
    ember: ['#5a1a10','#a33b1a','#e07020','#ffc04a'],
    frost: ['#1c3a52','#2a6f97','#4cc9f0','#bdf0ff'],
    violet:['#2a1650','#4c2a8c','#8b5cf6','#c4b5fd'],
    gold:  ['#5a3d10','#a3781a','#e8b64c','#ffe9a0'],
    blood: ['#3c0f1c','#6e1a30','#b02a48','#e86a80'],
    sea:   ['#0e2e40','#1a5468','#2e8ea0','#7ad4d8'],
    rose:  ['#4a1a3a','#7a2a5c','#c04a8a','#f090c0'],
    shadow:['#14101f','#241c38','#403060','#6a5296'],
    sand:  ['#5a4426','#8a6a3a','#c09858','#ecd09a'],
    storm: ['#1a1c3a','#2e3268','#5058b0','#8a94ec'],
    flesh: ['#5a3a30','#8a5c48','#c08a68','#ecc098'],
    coal:  ['#101014','#26262e','#44444f','#6c6c7a'],
  };

  /* ---------- background themes: [top, mid, low, speckle] ---------- */
  const BGS = {
    grim:    ['#0d0716','#150b26','#1d1034','#5b3aa8'],
    cowboy:  ['#170d12','#241318','#33201a','#a3781a'],
    medieval:['#0c0d18','#141628','#1c2038','#5058b0'],
    zombie:  ['#0c1210','#14201a','#1a2c22','#4a6440'],
    beast:   ['#120d0a','#1e1410','#2a1c14','#7a3b26'],
    greek:   ['#0e0c1a','#181430','#242046','#a3781a'],
    misfit:  ['#140a16','#221028','#301838','#c04a8a'],
    carnival:['#150a0c','#241012','#361a14','#e07020'],
    sea:     ['#060e18','#0a1a28','#0e2a3a','#2e8ea0'],
    void:    ['#08060f','#0e0a1c','#140e2a','#4cc9f0'],
  };

  /* ---------- pixel layer + drawing helpers ---------- */
  function makeG(rng){
    const L = new Array(SZ * SZ).fill(null);
    const g = {
      L, rng,
      px(x, y, c){
        x |= 0; y |= 0;
        if (x < 0 || y < 0 || x >= SZ || y >= SZ) return;
        L[y * SZ + x] = c;
      },
      get(x, y){
        if (x < 0 || y < 0 || x >= SZ || y >= SZ) return null;
        return L[y * SZ + x];
      },
      rect(x, y, w, h, c){
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.px(x + i, y + j, c);
      },
      // mirrored across vertical centre (x=23.5)
      mpx(x, y, c){ g.px(x, y, c); g.px(47 - x, y, c); },
      mrect(x, y, w, h, c){ g.rect(x, y, w, h, c); g.rect(48 - x - w, y, w, h, c); },
      disc(cx, cy, rx, ry, c){
        ry = ry === undefined ? rx : ry;
        for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++){
          if ((x * x) / (rx * rx + .01) + (y * y) / (ry * ry + .01) <= 1.02) g.px(cx + x, cy + y, c);
        }
      },
      line(x0, y0, x1, y1, c){
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for(;;){
          g.px(x0, y0, c);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy){ err += dy; x0 += sx; }
          if (e2 <= dx){ err += dx; y0 += sy; }
        }
      },
      spray(x, y, w, h, c, density){
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
          if (rng() < density) g.px(x + i, y + j, c);
      },
      // shaded ellipse "ball": base colour with under-shade and top highlight
      ball(cx, cy, rx, ry, pal){
        g.disc(cx, cy, rx, ry, pal[1]);
        g.disc(cx, cy + Math.max(1, ry >> 1), rx, Math.max(1, ry >> 1), pal[0]);
        g.disc(cx - (rx >> 2), cy - (ry >> 2), Math.max(1, rx >> 1), Math.max(1, ry >> 1), pal[2]);
        g.spray(cx - rx, cy - ry, rx * 2, ry * 2, pal[1], .12);
      },
      // shaded box
      slab(x, y, w, h, pal){
        g.rect(x, y, w, h, pal[1]);
        g.rect(x, y + h - Math.max(1, h >> 2), w, Math.max(1, h >> 2), pal[0]);
        g.rect(x, y, Math.max(1, w >> 2), h, pal[2]);
        g.rect(x, y, w, 1, pal[2]);
      },
      eye(x, y, c){ g.px(x, y, c || '#ffdf6a'); },
      meye(x, y, c){ g.mpx(x, y, c || '#ffdf6a'); },
    };
    return g;
  }

  /* ---------- background ---------- */
  function paintBG(ctx, theme, rng, groundShadow){
    const B = BGS[theme] || BGS.grim;
    for (let y = 0; y < SZ; y++){
      const t = y / SZ;
      let c = t < .38 ? B[0] : t < .72 ? B[1] : B[2];
      // dithered band transitions
      if (Math.abs(t - .38) < .07 && ((y + (rng() * 3 | 0)) % 2)) c = t < .38 ? B[1] : B[0];
      if (Math.abs(t - .72) < .07 && ((y + (rng() * 3 | 0)) % 2)) c = t < .72 ? B[2] : B[1];
      for (let x = 0; x < SZ; x++){
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // speckles (dust / stars)
    for (let i = 0; i < 26; i++){
      const x = rng() * SZ | 0, y = rng() * 34 | 0;
      ctx.fillStyle = rng() < .3 ? B[3] : '#3a3050';
      ctx.globalAlpha = .25 + rng() * .5;
      ctx.fillRect(x, y, 1, 1);
      ctx.globalAlpha = 1;
    }
    // ground shadow ellipse
    if (groundShadow !== false){
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let x = -14; x <= 14; x++){
        const h = Math.round(2.4 * Math.sqrt(Math.max(0, 1 - (x * x) / 196)));
        for (let y = -h; y <= h; y++) ctx.fillRect(24 + x, 42 + y, 1, 1);
      }
    }
  }

  /* ============================================================
     PAINTERS — each draws a figure onto the transparent layer.
     o = { pal (resolved palette array), rng, ...options }
     ============================================================ */
  const PAINTERS = {

    /* quadruped side-view: dogs, wolves, boars, bears, lions, stags... */
    beast(g, o){
      const P = o.pal, big = o.bulk || 0;
      const by = 28 - big, rx = 10 + big * 2, ry = 6 + big;
      g.ball(24, by + 2, rx, ry, P);                    // body
      g.ball(34 + big, by - 5, 5 + (big ? 1 : 0), 4, P); // head
      g.rect(38 + big, by - 4, 4, 3, P[2]);              // muzzle
      g.px(41 + big, by - 3, '#1a0d0d');                 // nose
      g.eye(36 + big, by - 6, o.eyeC || '#ffdf6a');
      if (o.fangs){ g.px(39 + big, by - 1, '#fff'); g.px(41 + big, by - 1, '#fff'); }
      // ears / horns
      if (o.horns){ g.line(33 + big, by - 9, 30 + big, by - 13, P[3]); g.line(37 + big, by - 9, 40 + big, by - 13, P[3]); }
      else { g.rect(33 + big, by - 10, 2, 3, P[1]); g.rect(37 + big, by - 10, 2, 3, P[1]); }
      if (o.mane){ g.disc(30 + big, by - 4, 6, 6, P[0]); g.ball(34 + big, by - 5, 5, 4, P); g.eye(36 + big, by - 6, o.eyeC || '#ffdf6a'); }
      if (o.spikes) for (let i = -6; i <= 6; i += 3) g.line(24 + i, by - ry, 24 + i, by - ry - 3, P[3]);
      // legs
      const ly = by + ry;
      [-7, -3, 3, 7].forEach((dx, i) => {
        g.rect(24 + dx, ly, 2, 41 - ly - big, i % 2 ? P[0] : P[1]);
        g.rect(24 + dx, 40 - big, 3, 2, P[0]);
      });
      // tail
      if (o.tailUp) g.line(14 - big, by, 10 - big, by - 8, P[1]);
      else g.line(14 - big, by, 9 - big, by + 3, P[1]);
      if (o.spots) g.spray(16, by - 3, 16, 8, P[0], .18);
    },

    /* front-facing biped: humans, skeletons, zombies, demons... */
    humanoid(g, o){
      const P = o.pal;
      const skin = o.skin || PALS.flesh;
      // wings behind
      if (o.wings){
        g.line(14, 18, 5, 10, P[0]); g.line(14, 20, 4, 16, P[0]);
        g.line(33, 18, 42, 10, P[0]); g.line(33, 20, 43, 16, P[0]);
        g.disc(9, 15, 4, 5, P[0]); g.disc(38, 15, 4, 5, P[0]);
      }
      // legs
      g.rect(20, 31, 3, 9, P[0]); g.rect(25, 31, 3, 9, P[0]);
      g.rect(19, 39, 4, 2, P[1]); g.rect(25, 39, 4, 2, P[1]);
      // torso
      if (o.robe){
        for (let j = 0; j < 16; j++) g.rect(20 - (j >> 2), 18 + j, 8 + ((j >> 2) * 2), 1, j % 5 === 4 ? P[0] : P[1]);
        g.rect(18, 32, 12, 2, P[0]);
      } else {
        g.slab(19, 17, 10, 14, P);
        if (o.bones){ // ribcage
          for (let j = 0; j < 4; j++) g.rect(20, 19 + j * 3, 8, 1, skin[2]);
          g.rect(23, 18, 2, 12, skin[1]);
        }
        if (o.belt){ g.rect(19, 28, 10, 2, '#2a1a10'); g.px(24, 28, '#e8b64c'); g.px(24, 29, '#e8b64c'); }
        if (o.vest){ g.rect(19, 17, 3, 12, P[0]); g.rect(26, 17, 3, 12, P[0]); }
      }
      // arms
      g.rect(16, 18, 3, 10, o.robe ? P[1] : skin[1]);
      g.rect(29, 18, 3, 10, o.robe ? P[1] : skin[1]);
      if (o.bones){ g.rect(16, 18, 3, 10, skin[1]); g.rect(29, 18, 3, 10, skin[1]); }
      // head
      g.ball(24, 11, 5, 5, o.bones ? skin : skin);
      if (o.bones){ // skull face
        g.px(22, 10, '#100a14'); g.px(26, 10, '#100a14');
        g.rect(22, 14, 5, 1, '#100a14'); g.px(23, 13, skin[0]); g.px(25, 13, skin[0]);
        if (o.eyeGlow){ g.px(22, 10, o.eyeGlow); g.px(26, 10, o.eyeGlow); }
      } else {
        g.px(22, 10, o.eyeC || '#100a14'); g.px(26, 10, o.eyeC || '#100a14');
        g.px(24, 13, skin[0]);
      }
      if (o.beard){ g.rect(21, 14, 7, 3, o.beardC || '#c9c4d4'); g.rect(22, 17, 5, 2, o.beardC || '#c9c4d4'); }
      if (o.horns){ g.line(20, 6, 17, 2, '#e8dfc0'); g.line(28, 6, 31, 2, '#e8dfc0'); }
      if (o.tail){ g.line(30, 30, 36, 36, P[1]); g.px(37, 37, P[3]); }
      // hats
      const H = o.hat;
      if (H === 'cowboy'){ g.rect(16, 6, 17, 2, P[0]); g.rect(20, 2, 9, 4, P[0]); g.rect(20, 5, 9, 1, P[3]); }
      if (H === 'helm'){ g.disc(24, 9, 6, 5, PALS.steel[1]); g.rect(18, 9, 13, 2, PALS.steel[0]); g.rect(22, 10, 5, 1, '#100a14'); g.px(24, 3, P[3]); }
      if (H === 'hood'){ g.disc(24, 10, 6, 6, P[0]); g.rect(20, 9, 9, 4, '#100a14'); g.px(22, 10, o.eyeGlow || '#ffdf6a'); g.px(26, 10, o.eyeGlow || '#ffdf6a'); }
      if (H === 'crown'){ g.rect(20, 4, 9, 3, PALS.gold[2]); g.px(20, 3, PALS.gold[3]); g.px(24, 2, PALS.gold[3]); g.px(28, 3, PALS.gold[3]); }
      if (H === 'jester'){ g.line(20, 6, 15, 2, P[3]); g.line(24, 5, 24, 1, P[2]); g.line(28, 6, 33, 2, P[3]); g.px(15, 2, PALS.gold[2]); g.px(24, 1, PALS.gold[2]); g.px(33, 2, PALS.gold[2]); g.rect(19, 6, 11, 2, P[1]); }
      if (H === 'bandana'){ g.rect(19, 6, 10, 3, P[3]); g.rect(19, 12, 10, 3, P[3]); g.px(21, 13, P[1]); g.px(25, 13, P[1]); }
      if (H === 'wizard'){ g.rect(17, 7, 15, 2, P[1]); for (let j = 0; j < 7; j++) g.rect(21 + (j >> 1), 6 - j, 7 - j, 1, P[1]); g.px(24, -1 + 1, P[3]); }
      if (H === 'top'){ g.rect(18, 7, 13, 1, '#1a1420'); g.rect(20, 0, 9, 7, '#1a1420'); g.rect(20, 5, 9, 1, P[3]); }
      if (H === 'laurel'){ g.px(19, 8, PALS.venom[2]); g.px(20, 7, PALS.venom[2]); g.px(28, 7, PALS.venom[2]); g.px(29, 8, PALS.venom[2]); }
      if (H === 'plume'){ g.disc(24, 6, 5, 2, PALS.steel[1]); g.line(24, 4, 24, 0, P[3]); g.px(25, 1, P[3]); }
      // held items (right hand side of sprite)
      const W = o.weapon;
      if (W === 'sword'){ g.line(33, 26, 33, 8, PALS.steel[3]); g.rect(31, 25, 5, 1, PALS.gold[2]); g.px(33, 7, '#fff'); }
      if (W === 'axe'){ g.line(33, 28, 33, 10, '#6a4a2a'); g.disc(35, 11, 3, 3, PALS.steel[2]); g.rect(33, 8, 2, 7, PALS.steel[3]); }
      if (W === 'bow'){ for (let j = 0; j < 16; j++) g.px(34 + Math.round(2.6 * Math.sin(Math.PI * j / 15)), 10 + j, '#6a4a2a'); g.line(34, 10, 34, 25, '#cfd8ec'); }
      if (W === 'gun'){ g.rect(31, 22, 7, 2, PALS.steel[2]); g.rect(31, 24, 2, 3, '#6a4a2a'); g.px(38, 22, PALS.steel[3]); }
      if (W === 'rifle'){ g.line(30, 27, 40, 15, '#6a4a2a'); g.line(36, 19, 41, 14, PALS.steel[2]); }
      if (W === 'staff'){ g.line(34, 30, 34, 6, '#6a4a2a'); g.disc(34, 5, 2, 2, o.orbC || '#4cc9f0'); g.px(34, 5, '#eafcff'); }
      if (W === 'scythe'){ g.line(34, 30, 34, 6, '#6a4a2a'); g.rect(28, 5, 8, 2, PALS.steel[3]); g.px(27, 6, PALS.steel[3]); g.px(26, 7, PALS.steel[2]); }
      if (W === 'trident'){ g.line(34, 30, 34, 7, PALS.gold[2]); g.rect(32, 6, 5, 1, PALS.gold[3]); g.line(32, 6, 32, 3, PALS.gold[3]); g.line(34, 6, 34, 3, PALS.gold[3]); g.line(36, 6, 36, 3, PALS.gold[3]); }
      if (W === 'hammer'){ g.line(33, 28, 33, 10, '#6a4a2a'); g.slab(30, 7, 8, 5, PALS.steel); }
      if (W === 'whip'){ g.line(33, 24, 38, 18, '#6a4a2a'); g.line(38, 18, 43, 24, '#8a6a3a'); g.line(43, 24, 40, 30, '#8a6a3a'); }
      if (W === 'dagger'){ g.line(33, 24, 36, 18, PALS.steel[3]); g.px(33, 25, PALS.gold[2]); }
      if (W === 'lute'){ g.disc(35, 24, 3, 4, '#8a6a3a'); g.line(35, 20, 35, 12, '#6a4a2a'); g.px(35, 23, '#1a0d0d'); }
      if (W === 'torch'){ g.line(34, 26, 34, 14, '#6a4a2a'); g.disc(34, 11, 2, 3, '#e07020'); g.px(34, 9, '#ffc04a'); g.px(33, 12, '#ffc04a'); }
      if (W === 'book'){ g.slab(31, 20, 7, 5, PALS.violet); g.rect(34, 20, 1, 5, PALS.gold[3]); }
      if (o.shield){ g.disc(14, 22, 4, 5, PALS.steel[1]); g.disc(14, 22, 2, 3, PALS.steel[2]); g.px(14, 22, P[3]); }
      if (o.lantern){ g.rect(13, 22, 3, 4, PALS.gold[2]); g.px(14, 23, '#ffe9a0'); g.line(14, 20, 14, 21, PALS.steel[1]); }
    },

    serpent(g, o){
      const P = o.pal;
      // coiled base
      g.ball(24, 34, 11, 5, P);
      g.ball(24, 29, 8, 4, P);
      // neck rising
      for (let j = 0; j < 14; j++) g.rect(27 + Math.round(2 * Math.sin(j * .5)), 26 - j, 4, 1, j % 4 === 3 ? P[0] : P[1]);
      const hx = o.heads ? 24 : 29;
      const drawHead = (x, y) => {
        g.ball(x, y, 4, 3, P);
        g.eye(x + 2, y - 1, o.eyeC || '#ff4757');
        g.line(x + 4, y + 1, x + 6, y + 1, '#ff6b81'); // tongue
        if (o.hood){ g.disc(x - 1, y, 5, 4, P[0]); g.ball(x, y, 4, 3, P); g.eye(x + 2, y - 1, o.eyeC || '#ff4757'); }
      };
      if (o.heads && o.heads > 1){
        drawHead(20, 12); drawHead(29, 10); if (o.heads > 2) drawHead(24, 6);
        g.line(22, 24, 20, 15, P[1]); g.line(26, 24, 29, 13, P[1]);
      } else drawHead(hx, 11);
      if (o.rattle){ g.rect(12, 32, 3, 2, PALS.sand[3]); g.rect(10, 34, 3, 2, PALS.sand[2]); }
      g.spray(15, 30, 18, 8, P[2], .1);
    },

    spider(g, o){
      const P = o.pal;
      g.ball(24, 26, 8, 6, P);          // abdomen
      g.ball(24, 17, 5, 4, P);          // head
      g.meye(22, 16, o.eyeC || '#ff4757'); g.meye(21, 18, o.eyeC || '#ff4757');
      g.px(23, 20, '#fff'); g.px(25, 20, '#fff'); // fangs
      for (let i = 0; i < 4; i++){
        const y = 20 + i * 3;
        g.line(17, y, 8 - i, y - 4, P[0]); g.line(8 - i, y - 4, 6 - i, y + 4, P[1]);
        g.line(31, y, 40 + i, y - 4, P[0]); g.line(40 + i, y - 4, 42 + i, y + 4, P[1]);
      }
      if (o.mark) { g.px(24, 25, P[3]); g.px(24, 26, P[3]); g.px(23, 27, P[3]); g.px(25, 27, P[3]); }
    },

    /* birds & bats — o.bat for membrane wings */
    wing(g, o){
      const P = o.pal;
      g.ball(24, 24, 5, 6, P);          // body
      g.ball(24, 15, 4, 4, P);          // head
      g.meye(22, 14, o.eyeC || '#ffdf6a');
      if (o.bat){
        g.px(23, 17, '#fff'); g.px(25, 17, '#fff');
        for (let i = 0; i < 3; i++){ g.line(19, 20 + i, 6 + i * 2, 12 + i * 4, P[1]); g.line(29, 20 + i, 42 - i * 2, 12 + i * 4, P[1]); }
        g.line(6, 12, 8, 24, P[0]); g.line(42, 12, 40, 24, P[0]);
        g.line(20, 11, 22, 13, P[1]); g.line(28, 11, 26, 13, P[1]); // ears
      } else {
        g.rect(23, 17, 3, 2, o.beakC || '#e8a15c'); // beak
        for (let i = 0; i < 4; i++){ g.line(19, 20 + i, 5 + i, 14 + i * 3, i % 2 ? P[0] : P[1]); g.line(29, 20 + i, 43 - i, 14 + i * 3, i % 2 ? P[0] : P[1]); }
        g.line(22, 30, 22, 33, P[0]); g.line(26, 30, 26, 33, P[0]); // legs
        if (o.tail3){ g.line(24, 30, 20, 37, P[1]); g.line(24, 30, 24, 38, P[2]); g.line(24, 30, 28, 37, P[1]); }
      }
    },

    ghost(g, o){
      const P = o.pal;
      for (let j = 0; j < 22; j++){
        const w = Math.round(7 + 3 * Math.sin(j * .35));
        g.rect(24 - w, 12 + j, w * 2, 1, j % 6 === 5 ? P[0] : P[1]);
      }
      // wavy hem
      for (let x = 15; x <= 33; x += 3) g.rect(x, 33 + ((x / 3) % 2), 2, 2, P[1]);
      g.disc(24, 12, 8, 7, P[1]); g.disc(21, 9, 3, 3, P[2]);
      g.px(21, 12, '#0d0716'); g.px(27, 12, '#0d0716');
      g.px(21, 11, o.eyeC || '#4cc9f0'); g.px(27, 11, o.eyeC || '#4cc9f0');
      g.rect(23, 16, 3, 2, '#0d0716');
      if (o.chains){ g.line(14, 20, 8, 28, PALS.steel[1]); g.px(8, 29, PALS.steel[2]); g.px(7, 31, PALS.steel[2]); }
    },

    slime(g, o){
      const P = o.pal;
      g.ball(24, 30, 12, 9, P);
      g.disc(18, 25, 2, 2, P[3]); // shine
      g.px(20, 29, '#0d0716'); g.px(28, 29, '#0d0716');
      if (o.grin){ for (let x = 20; x <= 28; x++) g.px(x, 33, '#0d0716'); g.px(21, 34, '#fff'); g.px(27, 34, '#fff'); }
      else g.rect(22, 33, 5, 1, '#0d0716');
      // drips
      g.rect(14, 38, 2, 3, P[1]); g.rect(33, 37, 2, 4, P[1]); g.px(24, 40, P[1]);
      if (o.core){ g.disc(24, 28, 2, 2, o.core); }
      g.spray(14, 24, 20, 12, P[2], .08);
    },

    dragon(g, o){
      const P = o.pal;
      // wings
      for (let i = 0; i < 4; i++){ g.line(18, 22 + i, 4 + i * 2, 8 + i * 3, P[0]); g.line(30, 22 + i, 44 - i * 2, 8 + i * 3, P[0]); }
      g.line(4, 8, 8, 24, P[1]); g.line(44, 8, 40, 24, P[1]);
      g.ball(24, 28, 9, 7, P);          // body
      // neck + head
      g.rect(28, 16, 4, 8, P[1]);
      g.ball(31, 13, 5, 4, P);
      g.rect(35, 13, 4, 2, P[2]);       // snout
      g.eye(33, 11, o.eyeC || '#ffdf6a');
      g.line(28, 9, 26, 5, P[3]); g.line(32, 8, 33, 4, P[3]); // horns
      if (o.fire){ g.px(40, 13, '#ffc04a'); g.px(41, 12, '#e07020'); g.px(42, 14, '#ffc04a'); g.px(43, 12, '#ff6b3a'); }
      // belly plates
      for (let j = 0; j < 4; j++) g.rect(21, 25 + j * 3, 7, 1, P[3]);
      g.line(15, 30, 8, 36, P[1]); g.px(7, 37, P[3]);  // tail
      g.rect(19, 34, 3, 6, P[0]); g.rect(27, 34, 3, 6, P[0]); // legs
    },

    plant(g, o){
      const P = o.pal;
      g.rect(23, 26, 3, 14, PALS.moss[1]); // stem
      g.line(23, 32, 17, 28, PALS.moss[1]); g.disc(16, 27, 2, 1, PALS.moss[2]);
      g.line(25, 30, 31, 26, PALS.moss[1]); g.disc(32, 25, 2, 1, PALS.moss[2]);
      if (o.jaw){ // carnivorous head
        g.ball(24, 16, 8, 7, P);
        g.rect(17, 16, 15, 2, '#0d0716');
        for (let x = 18; x <= 30; x += 3){ g.px(x, 15, '#fff'); g.px(x + 1, 18, '#fff'); }
        g.px(20, 11, o.eyeC || '#ffdf6a');
      } else { // flower
        for (let a = 0; a < 8; a++){
          const x = 24 + Math.round(7 * Math.cos(a * Math.PI / 4)), y = 15 + Math.round(6 * Math.sin(a * Math.PI / 4));
          g.disc(x, y, 3, 2, P[2]);
        }
        g.disc(24, 15, 4, 4, P[3]); g.px(24, 15, P[0]);
      }
      g.spray(16, 36, 16, 4, PALS.moss[2], .25); // grass
    },

    golem(g, o){
      const P = o.pal;
      g.slab(16, 14, 17, 14, P);                 // torso
      g.slab(18, 5, 12, 8, P);                   // head
      g.px(21, 8, o.eyeC || '#4cc9f0'); g.px(26, 8, o.eyeC || '#4cc9f0');
      g.slab(10, 15, 5, 12, P); g.slab(34, 15, 5, 12, P);  // arms
      g.slab(12, 27, 5, 4, P); g.slab(32, 27, 5, 4, P);    // fists
      g.slab(18, 29, 5, 11, P); g.slab(26, 29, 5, 11, P);  // legs
      // cracks
      g.line(20, 17, 24, 22, P[0]); g.line(28, 15, 26, 20, P[0]);
      if (o.core){ g.disc(24, 20, 2, 2, o.core); g.px(24, 20, '#fff'); }
      if (o.mossy) g.spray(16, 14, 17, 8, PALS.moss[2], .15);
    },

    fish(g, o){
      const P = o.pal;
      g.ball(22, 24, 12, 7, P);
      // tail
      g.line(9, 20, 4, 16, P[1]); g.line(9, 24, 3, 24, P[1]); g.line(9, 28, 4, 32, P[1]);
      g.disc(6, 24, 2, 5, P[0]);
      g.eye(30, 21, '#fff'); g.px(31, 21, '#0d0716');
      if (o.teeth){ g.rect(28, 27, 7, 1, '#0d0716'); g.px(29, 26, '#fff'); g.px(31, 28, '#fff'); g.px(33, 26, '#fff'); }
      if (o.fin){ g.line(20, 16, 24, 10, P[2]); g.line(24, 10, 27, 17, P[2]); }
      if (o.angler){ g.line(28, 17, 32, 10, P[1]); g.disc(33, 9, 2, 2, '#ffe9a0'); g.px(33, 9, '#fff'); }
      g.spray(14, 20, 16, 8, P[2], .12);
      // bubbles
      g.px(38, 14, '#7ad4d8'); g.px(41, 10, '#7ad4d8'); g.px(39, 6, '#bdf0ff');
    },

    kraken(g, o){
      const P = o.pal;
      g.ball(24, 18, 9, 8, P);           // dome
      g.meye(20, 17, o.eyeC || '#ffdf6a');
      g.rect(21, 22, 7, 1, '#0d0716');
      for (let i = 0; i < 4; i++){
        const x0 = 17 + i * 5;
        for (let j = 0; j < 14; j++) g.px(x0 + Math.round(2.4 * Math.sin(j * .55 + i * 1.7)), 26 + j, j % 5 === 4 ? P[0] : P[1]);
      }
      g.px(14, 38, P[2]); g.px(34, 36, P[2]);
      g.spray(16, 12, 16, 8, P[2], .12);
    },

    eyeball(g, o){
      const P = o.pal;
      if (o.wings){
        for (let i = 0; i < 3; i++){ g.line(16, 20 + i, 6 + i * 2, 12 + i * 3, P[0]); g.line(32, 20 + i, 42 - i * 2, 12 + i * 3, P[0]); }
      }
      g.ball(24, 23, 9, 9, PALS.bone);
      g.disc(24, 23, 5, 5, P[2]);
      g.disc(24, 23, 2, 2, '#0d0716');
      g.px(22, 20, '#fff'); g.px(23, 20, '#fff');
      // veins
      g.line(17, 19, 20, 22, '#b02a48'); g.line(31, 27, 28, 25, '#b02a48');
      if (o.stalks){ for (let a = 0; a < 5; a++){ const x = 24 + Math.round(10 * Math.cos(.4 + a * 1.25)); const y = 22 + Math.round(10 * Math.sin(.4 + a * 1.25)); g.line(24 + ((x - 24) / 2 | 0), 23 + ((y - 23) / 2 | 0), x, y, P[1]); g.px(x, y, '#fff'); } }
      if (o.tail){ for (let j = 0; j < 9; j++) g.px(24 + Math.round(2 * Math.sin(j)), 32 + j, P[1]); }
    },

    mush(g, o){
      const P = o.pal;
      g.rect(21, 24, 7, 14, PALS.bone[2]);        // stalk
      g.rect(21, 30, 7, 2, PALS.bone[1]);
      g.ball(24, 19, 12, 7, P);                   // cap
      g.px(18, 16, P[3]); g.px(27, 14, P[3]); g.px(23, 18, P[3]); g.px(30, 18, P[3]); // spots
      g.px(23, 27, '#0d0716'); g.px(26, 27, '#0d0716'); // face
      g.rect(23, 30, 4, 1, '#0d0716');
      if (o.spores){ g.px(12, 10, P[3]); g.px(36, 8, P[3]); g.px(30, 5, P[2]); g.px(16, 6, P[2]); }
    },

    totem(g, o){
      const P = o.pal;
      const faces = o.faces || 3;
      for (let i = 0; i < faces; i++){
        const y = 38 - (i + 1) * 10;
        g.slab(17, y, 15, 10, P);
        g.px(21, y + 3, o.eyeC || '#ffdf6a'); g.px(27, y + 3, o.eyeC || '#ffdf6a');
        g.rect(22, y + 6, 5, 1, P[0]);
        g.px(16, y + 1, P[2]); g.px(32, y + 1, P[2]);
      }
      g.line(14, 12, 17, 14, P[3]); g.line(34, 12, 31, 14, P[3]); // top wings
      g.spray(17, 10, 15, 28, P[0], .08);
    },

    potion(g, o){
      const P = o.pal;
      g.rect(22, 8, 5, 4, '#8a6a3a');            // cork
      g.rect(21, 12, 7, 3, PALS.bone[1]);        // neck
      g.ball(24, 26, 10, 10, PALS.slate);        // glass
      g.disc(24, 28, 8, 7, P[2]);                 // liquid
      g.disc(24, 31, 8, 4, P[1]);
      g.px(20, 26, '#fff'); g.px(27, 24, P[3]); g.px(23, 22, P[3]); // bubbles
      g.disc(17, 20, 1, 2, '#ffffff88' && PALS.bone[3]);           // shine
    },

    crystal(g, o){
      const P = o.pal;
      const spikes = [[24, 8, 4, 34], [15, 16, 3, 26], [33, 14, 3, 28]];
      spikes.forEach(([cx, ty, w, by], i) => {
        for (let y = ty; y <= by; y++){
          const t = (y - ty) / (by - ty);
          const ww = Math.max(1, Math.round(w * (t < .8 ? t * 1.25 : 1)));
          g.rect(cx - ww, y, ww * 2, 1, y % 5 === 4 ? P[0] : P[1]);
          g.px(cx - ww, y, P[2]);
        }
        g.px(cx, ty, '#fff');
      });
      g.px(22, 16, P[3]); g.px(25, 22, P[3]);
      g.slab(14, 36, 21, 4, PALS.coal); // rock base
    },

    banner(g, o){
      const P = o.pal;
      g.rect(15, 6, 2, 34, '#6a4a2a');           // pole
      g.px(15, 5, PALS.gold[2]); g.px(16, 4, PALS.gold[3]);
      for (let j = 0; j < 18; j++) g.rect(17, 7 + j, 16 - (j > 13 ? (j - 13) * 3 : 0), 1, j % 6 === 5 ? P[0] : P[1]);
      // emblem
      g.disc(24, 13, 3, 3, P[3]); g.px(24, 13, P[0]);
      g.rect(17, 7, 16, 1, P[2]);
    },

    flame(g, o){
      const P = o.pal;
      // logs
      g.line(14, 38, 26, 34, '#4a2c14'); g.line(22, 34, 34, 38, '#4a2c14');
      // fire body
      for (let j = 0; j < 22; j++){
        const w = Math.round(6 * Math.sin(Math.PI * Math.min(1, j / 20)) + (j > 14 ? 2 : 0));
        const c = j < 6 ? P[3] : j < 13 ? P[2] : P[1];
        g.rect(24 - (w >> 1) + Math.round(1.6 * Math.sin(j * .8)), 34 - j, w, 1, c);
      }
      g.px(24, 10, '#fff');
      if (o.face){ g.px(21, 24, '#0d0716'); g.px(27, 24, '#0d0716'); g.rect(23, 28, 4, 1, '#0d0716'); }
      g.px(16, 18, P[3]); g.px(33, 14, P[3]); g.px(29, 8, P[2]); // sparks
    },

    cauldron(g, o){
      const P = o.pal;
      g.ball(24, 28, 11, 8, PALS.coal);
      g.rect(12, 22, 25, 3, PALS.coal[2]);        // rim
      g.rect(14, 23, 21, 1, P[2]);                // brew surface
      g.px(18, 22, P[3]); g.px(26, 21, P[3]); g.px(31, 22, P[2]); // bubbles above
      g.px(21, 18, P[2]); g.px(28, 16, P[3]);
      g.rect(13, 36, 4, 4, PALS.coal[1]); g.rect(32, 36, 4, 4, PALS.coal[1]); // feet
      g.px(24, 40, '#e07020'); g.px(21, 41, '#ffc04a'); g.px(27, 41, '#a33b1a'); // fire under
    },

    grave(g, o){
      const P = o.pal;
      g.slab(16, 14, 17, 24, PALS.slate);
      g.disc(24, 14, 8, 6, PALS.slate[1]); g.disc(21, 11, 3, 2, PALS.slate[2]);
      g.rect(20, 20, 9, 1, PALS.slate[0]); g.rect(20, 24, 9, 1, PALS.slate[0]); // inscription
      g.rect(22, 17, 5, 1, PALS.slate[0]);
      g.spray(12, 36, 25, 4, PALS.moss[1], .3);
      if (o.hand){ g.rect(34, 34, 2, 6, PALS.bone[2]); g.rect(32, 33, 2, 3, PALS.bone[2]); g.rect(37, 33, 2, 3, PALS.bone[2]); g.rect(34, 31, 2, 3, PALS.bone[3]); }
      if (o.wisp){ g.px(12, 16, P[3]); g.px(10, 12, P[2]); g.disc(11, 9, 1, 1, P[3]); }
    },

    moon(g, o){
      const P = o.pal;
      g.disc(24, 20, 11, 11, P[2]);
      g.disc(29, 17, 9, 9, null); // carve crescent by clearing
      for (let y = 8; y <= 29; y++) for (let x = 20; x <= 39; x++){
        const dx = x - 29, dy = y - 17;
        if (dx * dx + dy * dy <= 81 && g.get(x, y) === P[2]) g.L[y * SZ + x] = null;
      }
      g.px(19, 14, P[3]); g.px(17, 22, P[1]); g.px(21, 26, P[1]); // craters
      // clouds
      g.rect(8, 30, 12, 2, PALS.shadow[2]); g.rect(26, 33, 14, 2, PALS.shadow[2]);
      g.px(6, 8, '#fff'); g.px(40, 6, '#fff'); g.px(36, 26, P[3]);
    },

    cannon(g, o){
      const P = o.pal;
      // barrel angled up-right
      for (let i = 0; i < 16; i++) g.rect(14 + i, 28 - (i >> 1), 4, 5 - (i > 11 ? 1 : 0), i % 5 === 4 ? PALS.coal[0] : PALS.coal[1]);
      g.rect(28, 18, 3, 5, PALS.coal[2]);         // muzzle ring
      g.disc(18, 32, 6, 6, P[1]); g.disc(18, 32, 2, 2, P[0]); // wheel
      g.px(31, 17, '#ffc04a'); g.px(33, 15, '#e07020'); g.px(34, 13, '#ffc04a'); // fuse spark? muzzle
      g.px(12, 26, '#ffc04a'); // fuse
    },

    mask(g, o){
      const P = o.pal;
      g.ball(24, 20, 9, 11, P);
      g.rect(18, 17, 4, 2, '#0d0716'); g.rect(27, 17, 4, 2, '#0d0716'); // eyes
      if (o.sad){ g.line(20, 27, 24, 29, '#0d0716'); g.line(24, 29, 28, 27, '#0d0716'); }
      else { g.line(20, 27, 24, 25, '#0d0716'); g.line(24, 25, 28, 27, '#0d0716'); } // grin
      g.px(24, 22, P[0]);
      // ribbons
      g.line(15, 18, 8, 14, P[3]); g.line(33, 18, 40, 14, P[3]);
      g.px(19, 14, PALS.gold[2]); g.px(29, 14, PALS.gold[2]); // gilding
      g.line(24, 31, 24, 38, P[2]); // handle
    },

    tent(g, o){
      const P = o.pal;
      for (let j = 0; j < 22; j++){
        const w = Math.round(1 + j * .85);
        for (let x = -w; x <= w; x++)
          g.px(24 + x, 14 + j, ((x + 24) / 4 | 0) % 2 ? P[1] : P[3]);
      }
      g.rect(21, 28, 7, 8, '#0d0716');           // entrance
      g.line(24, 14, 24, 8, PALS.bone[2]); g.px(25, 9, P[3]); g.px(26, 10, P[3]); // flag
      g.px(24, 30, '#ffdf6a'); // glow inside
    },

    dice(g, o){
      const P = o.pal;
      g.slab(13, 18, 13, 13, PALS.bone);
      g.px(16, 21, '#0d0716'); g.px(22, 21, '#0d0716'); g.px(16, 27, '#0d0716'); g.px(22, 27, '#0d0716'); g.px(19, 24, '#0d0716');
      g.slab(26, 24, 11, 11, P);
      g.px(29, 27, '#fff'); g.px(33, 31, '#fff');
      // scattered cards
      g.rect(10, 33, 7, 9, PALS.bone[2]); g.rect(11, 34, 5, 7, P[2]);
    },

    scarecrow(g, o){
      const P = o.pal;
      g.rect(23, 10, 2, 30, '#6a4a2a');          // pole
      g.rect(12, 18, 24, 2, '#6a4a2a');          // arms
      g.slab(19, 20, 10, 12, P);                  // body
      g.spray(19, 30, 10, 3, PALS.sand[3], .5);   // straw hem
      g.spray(12, 17, 4, 3, PALS.sand[3], .5); g.spray(33, 17, 4, 3, PALS.sand[3], .5);
      g.ball(24, 12, 5, 5, PALS.sand);            // sack head
      g.px(22, 11, o.eyeC || '#e0455f'); g.px(26, 11, o.eyeC || '#e0455f');
      g.line(22, 14, 26, 14, '#0d0716');
      g.rect(18, 6, 13, 2, PALS.coal[1]); g.rect(21, 3, 7, 3, PALS.coal[1]); // hat
      // crow
      g.disc(34, 17, 2, 1, '#0d0716'); g.px(36, 16, '#e8a15c');
    },

    wisp(g, o){
      const P = o.pal;
      g.disc(24, 18, 5, 5, P[2]);
      g.disc(23, 17, 2, 2, '#ffffff' && P[3]);
      g.px(23, 17, '#fff');
      for (let j = 0; j < 12; j++) g.px(24 + Math.round(3.4 * Math.sin(j * .8)), 24 + j, j < 5 ? P[2] : P[1]); // trail
      g.px(16, 12, P[3]); g.px(32, 14, P[3]); g.px(29, 8, P[2]); g.px(18, 24, P[2]); // motes
    },

    jelly(g, o){
      const P = o.pal;
      g.ball(24, 16, 10, 7, P);
      g.rect(14, 16, 20, 2, P[0]);
      for (let i = 0; i < 5; i++){
        const x0 = 16 + i * 4;
        for (let j = 0; j < 16; j++) g.px(x0 + Math.round(2 * Math.sin(j * .6 + i)), 19 + j, j % 4 === 3 ? P[2] : P[1]);
      }
      g.px(21, 14, P[3]); g.px(27, 13, P[3]); // inner glow
      g.px(20, 15, '#0d0716'); g.px(28, 15, '#0d0716');
    },

    crab(g, o){
      const P = o.pal;
      g.ball(24, 27, 10, 6, P);
      g.meye(20, 21, '#fff'); g.mpx(20, 20, P[2]);
      g.px(20, 21, '#0d0716'); g.px(27, 21, '#0d0716');
      for (let i = 0; i < 3; i++){ g.line(15, 28 + i * 2, 9 - i, 33 + i * 2, P[1]); g.line(33, 28 + i * 2, 39 + i, 33 + i * 2, P[1]); }
      // claws
      g.disc(10, 22, 3, 2, P[2]); g.px(7, 21, P[0]);
      g.disc(38, 22, 3, 2, P[2]); g.px(41, 21, P[0]);
      g.line(13, 24, 16, 26, P[1]); g.line(35, 24, 32, 26, P[1]);
    },

    hand(g, o){
      const P = o.pal;
      // rising from ground
      g.rect(21, 22, 7, 16, P[1]);
      g.rect(21, 22, 2, 16, P[2]);
      for (let i = 0; i < 4; i++) g.rect(20 + i * 2, 14 + (i === 1 ? -3 : i === 2 ? -2 : 0), 2, 9, i % 2 ? P[1] : P[2]);
      g.rect(27, 20, 3, 5, P[2]); // thumb
      g.spray(14, 36, 20, 4, PALS.coal[2], .3);
      g.px(17, 34, PALS.moss[2]); g.px(32, 35, PALS.moss[2]);
      if (o.glow){ g.px(24, 12, o.glow); g.px(22, 9, o.glow); }
    },

    star(g, o){
      const P = o.pal;
      // 4-point void star
      for (let i = 0; i < 12; i++){
        g.px(24, 12 + i, P[2]); g.px(24, 24 + i > 35 ? 35 : 24 + i, P[2]);
        g.px(12 + i, 24, P[2]); g.px(25 + i > 36 ? 36 : 25 + i, 24, P[2]);
      }
      g.line(24, 10, 24, 38, P[2]); g.line(10, 24, 38, 24, P[2]);
      g.line(18, 18, 30, 30, P[1]); g.line(30, 18, 18, 30, P[1]);
      g.disc(24, 24, 3, 3, P[3]); g.px(24, 24, '#fff');
      g.px(12, 10, P[3]); g.px(38, 12, P[3]); g.px(35, 36, P[3]); g.px(10, 34, P[3]);
    },

    portal(g, o){
      const P = o.pal;
      for (let r = 11; r >= 3; r -= 2){
        for (let a = 0; a < 64; a++){
          const x = 24 + Math.round(r * Math.cos(a * .1 + r)), y = 22 + Math.round((r * .8) * Math.sin(a * .1 + r));
          g.px(x, y, r > 8 ? P[0] : r > 5 ? P[1] : P[2]);
        }
      }
      g.disc(24, 22, 3, 2, P[3]); g.px(24, 22, '#fff');
      g.slab(12, 36, 25, 4, PALS.coal);
      g.px(14, 30, P[2]); g.px(35, 28, P[2]); // stray sparks
    },

    tree(g, o){
      const P = o.pal;
      g.rect(22, 22, 4, 18, PALS.coal[1]);
      g.rect(22, 22, 1, 18, PALS.coal[2]);
      g.line(23, 26, 14, 18, PALS.coal[1]); g.line(14, 18, 10, 12, PALS.coal[1]);
      g.line(25, 24, 33, 15, PALS.coal[1]); g.line(33, 15, 38, 12, PALS.coal[1]);
      g.line(24, 22, 24, 12, PALS.coal[1]); g.line(24, 12, 20, 6, PALS.coal[1]);
      if (o.leaves){ g.disc(11, 11, 4, 3, P[1]); g.disc(37, 11, 4, 3, P[1]); g.disc(22, 6, 5, 3, P[1]); g.spray(8, 6, 32, 10, P[2], .12); }
      if (o.hanged){ g.line(33, 15, 33, 20, PALS.sand[1]); g.disc(33, 22, 1, 2, PALS.bone[2]); }
      if (o.face){ g.px(23, 26, o.eyeC || '#ffdf6a'); g.px(25, 26, o.eyeC || '#ffdf6a'); g.rect(23, 30, 3, 1, '#0d0716'); }
      g.spray(10, 38, 28, 3, PALS.coal[2], .25);
    },

    crate(g, o){
      const P = o.pal;
      g.slab(12, 16, 25, 20, P);
      g.rect(12, 22, 25, 2, PALS.gold[1]);        // band
      g.rect(22, 16, 2, 20, PALS.gold[1]);
      g.rect(12, 16, 25, 2, P[2]);
      g.px(23, 23, PALS.gold[3]);                 // lock
      // glow seam
      g.rect(13, 15, 23, 1, P[3]);
      g.px(16, 12, P[3]); g.px(31, 11, P[3]); g.px(24, 9, P[2]);
    },
  };

  /* ---------- outline + composite ---------- */
  function composite(ctx, g){
    const L = g.L;
    // dark outline around the figure
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++){
      if (L[y * SZ + x]) continue;
      if ((x > 0 && L[y * SZ + x - 1]) || (x < SZ - 1 && L[y * SZ + x + 1]) ||
          (y > 0 && L[(y - 1) * SZ + x]) || (y < SZ - 1 && L[(y + 1) * SZ + x])){
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++){
      const c = L[y * SZ + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  /* ---------- public API ---------- */
  // spec: { p:'painter', o:{...}, pal:'palName', bg:'theme' }
  function render(canvas, spec, seedStr){
    canvas.width = SZ; canvas.height = SZ;
    canvas.classList.add('px');
    const ctx = canvas.getContext('2d');
    const rng = mulberry32(hashStr(seedStr || spec.p));
    paintBG(ctx, spec.bg || 'grim', rng, spec.shadow);
    const painter = PAINTERS[spec.p] || PAINTERS.crystal;
    const g = makeG(rng);
    const pal = PALS[spec.pal] || PALS.violet;
    painter(g, Object.assign({ pal, rng }, spec.o || {}));
    composite(ctx, g);
  }

  function makeCanvas(spec, seedStr){
    const c = document.createElement('canvas');
    render(c, spec, seedStr);
    return c;
  }

  return { render, makeCanvas, PALS, hashStr, mulberry32 };
})();
