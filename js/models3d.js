'use strict';
// ===================================================================
//  3D MODELS – everything is built from primitives (no asset files)
//  units: 1 world px = 0.1 m   |   model +X = forward, +Y = up, +Z = right
// ===================================================================
const U = 0.1;
const BOXG = new THREE.BoxGeometry(1, 1, 1), CYLG = new THREE.CylinderGeometry(1, 1, 1, 18), SPHG = new THREE.SphereGeometry(1, 16, 12), CONEG = new THREE.ConeGeometry(1, 1, 16);
const _mc = new Map();
function stdMat(col, o) { o = o || {}; const k = 's' + col + (o.r || '') + (o.m || '') + (o.e || ''); let m = _mc.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color: col, roughness: o.r === undefined ? 0.5 : o.r, metalness: o.m === undefined ? 0.1 : o.m, emissive: o.e || 0x000000 }); _mc.set(k, m); } return m; }
function lamMat(col) { const k = 'l' + col; let m = _mc.get(k); if (!m) { m = new THREE.MeshLambertMaterial({ color: col }); _mc.set(k, m); } return m; }
function basicMat(col) { const k = 'b' + col; let m = _mc.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color: col }); _mc.set(k, m); } return m; }
const paintMat = col => stdMat(col, { r: 0.38, m: 0.5 });
const GLASS = stdMat(0x0d1823, { r: 0.08, m: 0.85 }), TIRE = lamMat(0x141414), RIM = stdMat(0xbfc5ca, { r: 0.3, m: 0.9 }), BLACK = lamMat(0x1a1a1a), CHROME = stdMat(0xd0d6dc, { r: 0.2, m: 0.95 });

function bx(parent, w, h, d, x, y, z, material, shadow) {
  const m = new THREE.Mesh(BOXG, material); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = shadow !== false; parent.add(m); return m;
}
function cyl(parent, r, len, x, y, z, material, rx, rz) {
  const m = new THREE.Mesh(CYLG, material); m.scale.set(r, len, r); m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (rz) m.rotation.z = rz; m.castShadow = true; parent.add(m); return m;
}
function sph(parent, r, x, y, z, material, sy) { const m = new THREE.Mesh(SPHG, material); m.scale.set(r, r * (sy || 1), r); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
const _eg = new Map();
function extrudeProfile(key, pts, L, W, inset) {
  const k = key + '|' + L + '|' + W; let g = _eg.get(k); if (g) return g;
  const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0] * L, p[1])));
  g = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -W / 2); g.computeVertexNormals(); _eg.set(k, g); return g;
}
function extrudeMesh(parent, key, pts, L, W, material) { const m = new THREE.Mesh(extrudeProfile(key, pts, L, W), material); m.castShadow = true; parent.add(m); return m; }
function wheelAssembly(parent, r, wd, x, z, steer, list, steerList) {
  const sg = new THREE.Group(); sg.position.set(x, 0, z); parent.add(sg);
  const piv = new THREE.Group(); piv.position.set(0, r, 0); sg.add(piv);
  const t = new THREE.Mesh(CYLG, TIRE); t.scale.set(r, wd, r); t.rotation.x = Math.PI / 2; t.castShadow = true; piv.add(t);
  const rim = new THREE.Mesh(CYLG, RIM); rim.scale.set(r * 0.58, wd + 0.02, r * 0.58); rim.rotation.x = Math.PI / 2; piv.add(rim);
  const nut = new THREE.Mesh(BOXG, BLACK); nut.scale.set(r * 1.0, 0.03, wd + 0.03); piv.add(nut);
  list.push({ piv, r }); if (steer) steerList.push(sg);
}

// car profiles, x in fractions of length, y in metres
const PROF = {
  hatch:  { low: [[-.5, .3], [.5, .3], [.5, .66], [.30, .78], [-.34, .78], [-.5, .74]], cab: [[.30, .78], [.14, 1.26], [-.30, 1.26], [-.44, .78]], roof: [[.13, 1.26], [-.29, 1.26], [-.29, 1.33], [.13, 1.33]] },
  cab:    { low: [[-.5, .3], [.5, .3], [.5, .64], [.30, .76], [-.36, .76], [-.5, .72]], cab: [[.22, .76], [.08, 1.24], [-.20, 1.24], [-.34, .76]], roof: [[.07, 1.24], [-.19, 1.24], [-.19, 1.31], [.07, 1.31]] },
  suv:    { low: [[-.5, .34], [.5, .34], [.5, .96], [.34, 1.02], [-.5, 1.02]], cab: [[.30, 1.02], [.22, 1.68], [-.48, 1.68], [-.5, 1.02]], roof: [[.21, 1.68], [-.49, 1.68], [-.49, 1.75], [.21, 1.75]] },
  police: { low: [[-.5, .34], [.5, .34], [.5, .88], [.34, .96], [-.5, .96]], cab: [[.28, .96], [.2, 1.58], [-.46, 1.58], [-.5, .96]], roof: [[.19, 1.58], [-.45, 1.58], [-.45, 1.65], [.19, 1.65]] },
};

function buildVehicleModel(v) {
  const d = v.def, L = d.l * U, W = d.w * U * 0.8, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const info = { wheels: [], steer: [], tail: null, head: null, siren: null, lean: body, beam: null, rider: null, wreck: v.wreck, col: v.col };
  const col = v.wreck ? 0x242220 : new THREE.Color(v.col).getHex();
  const paint = v.wreck ? lamMat(0x1e1c1a) : paintMat(col);
  info.tail = new THREE.MeshStandardMaterial({ color: 0x600000, emissive: 0xff1a0a, emissiveIntensity: 0.5 });
  info.head = new THREE.MeshStandardMaterial({ color: 0xfffbe0, emissive: 0xfff2b8, emissiveIntensity: 0.4 });
  const lights = (x, hy, hw, ty) => { // x = half length
    for (const s of [-1, 1]) { bx(body, 0.1, 0.16, 0.34, x, hy, s * hw, info.head, false); bx(body, 0.1, 0.16, 0.3, -x, ty, s * hw, info.tail, false); }
  };
  switch (v.type) {
    case 'hatch': case 'cab': case 'suv': case 'police': {
      const P = PROF[v.type], wr = v.type === 'suv' || v.type === 'police' ? 0.4 : 0.34;
      extrudeMesh(body, v.type + 'L', P.low, L, W, paint);
      extrudeMesh(body, v.type + 'C', P.cab, L, W * 0.97, v.wreck ? lamMat(0x101010) : GLASS);
      const roofCol = v.type === 'cab' ? paintMat(0xf6c21a) : paint;
      extrudeMesh(body, v.type + 'R', P.roof, L, W * 0.96, v.wreck ? paint : roofCol);
      for (const s of [-1, 1]) { for (const fx of [-0.31, 0.31]) wheelAssembly(g, wr, 0.24, fx * L, s * (W / 2 - 0.02), fx > 0, info.wheels, info.steer); }
      lights(L / 2, v.type === 'suv' || v.type === 'police' ? 0.72 : 0.62, W * 0.34, v.type === 'suv' || v.type === 'police' ? 0.8 : 0.66);
      bx(body, 0.12, 0.2, W * 0.92, L / 2 - 0.02, 0.4, 0, BLACK, false); bx(body, 0.12, 0.2, W * 0.92, -L / 2 + 0.02, 0.4, 0, BLACK, false);
      bx(body, 0.04, 0.12, 0.5, L / 2 - 0.01, 0.58, 0, CHROME, false);
      if (v.type === 'cab') { bx(body, 0.34, 0.22, 0.7, -0.05 * L, 1.45, 0, stdMat(0xf6c21a, { r: 0.5 })); const t2 = bx(body, 0.36, 0.1, 0.72, -0.05 * L, 1.36, 0, BLACK, false); }
      if (v.type === 'police' && !v.wreck) {
        bx(body, L * 0.92, 0.1, W * 1.0, 0, 0.62, 0, paintMat(0x1e56c8), false);
        const rm = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1010, emissiveIntensity: 1 }), bm = new THREE.MeshStandardMaterial({ color: 0x000040, emissive: 0x1030ff, emissiveIntensity: 1 });
        bx(body, 0.3, 0.14, 0.6, -0.1 * L, 1.74, -0.4, rm, false); bx(body, 0.3, 0.14, 0.6, -0.1 * L, 1.74, 0.4, bm, false);
        info.siren = { r: rm, b: bm };
      }
      if (v.type === 'suv') for (const s of [-1, 1]) bx(body, L * 0.55, 0.04, 0.05, -0.18 * L, 1.8, s * W * 0.4, CHROME, false);
      break;
    }
    case 'auto': {
      const roof = v.wreck ? lamMat(0x242220) : paintMat(col), blk = v.wreck ? lamMat(0x1e1c1a) : stdMat(0x1c241f, { r: 0.5, m: 0.3 });
      bx(body, L * 0.62, 0.5, W * 0.82, -L * 0.1, 0.62, 0, blk);          // lower body
      bx(body, L * 0.2, 0.3, W * 0.5, L * 0.32, 0.62, 0, blk);             // nose
      bx(body, L * 0.7, 0.09, W * 1.0, -L * 0.12, 1.72, 0, roof);          // canopy
      for (const s of [-1, 1]) for (const fx of [-0.42, 0.16]) bx(body, 0.06, 1.0, 0.06, fx * L - L * 0.04, 1.2, s * W * 0.46, BLACK, false);
      bx(body, 0.05, 0.7, W * 0.9, L * 0.2, 1.3, 0, GLASS);                // windshield
      bx(body, 0.5, 0.2, W * 0.62, -L * 0.28, 0.98, 0, stdMat(0x5b3a29, { r: 0.9 }), false); // seat
      bx(body, 0.5, 0.45, W * 0.62, -L * 0.42, 1.18, 0, stdMat(0x5b3a29, { r: 0.9 }), false);
      bx(body, 0.1, 0.14, 0.14, L * 0.42, 0.75, 0, info.head, false);
      for (const s of [-1, 1]) bx(body, 0.08, 0.12, 0.18, -L * 0.42, 0.7, s * W * 0.34, info.tail, false);
      wheelAssembly(g, 0.28, 0.14, L * 0.36, 0, true, info.wheels, info.steer);
      for (const s of [-1, 1]) wheelAssembly(g, 0.28, 0.16, -L * 0.28, s * W * 0.44, false, info.wheels, info.steer);
      bx(body, 0.05, 0.05, W * 0.8, L * 0.2, 1.05, 0, CHROME, false);
      break;
    }
    case 'bike': {
      const tank = v.wreck ? lamMat(0x1e1c1a) : paintMat(col);
      wheelAssembly(g, 0.34, 0.12, L * 0.34, 0, true, info.wheels, info.steer); wheelAssembly(g, 0.34, 0.14, -L * 0.34, 0, false, info.wheels, info.steer);
      bx(body, L * 0.52, 0.12, 0.2, 0, 0.58, 0, stdMat(0x222222, { r: 0.4, m: 0.7 }));
      bx(body, 0.5, 0.24, 0.3, L * 0.1, 0.84, 0, tank);
      bx(body, 0.6, 0.12, 0.3, -L * 0.14, 0.8, 0, BLACK);
      bx(body, 0.06, 0.06, 0.62, L * 0.28, 1.12, 0, CHROME);
      cyl(body, 0.03, 0.42, L * 0.3, 0.9, 0, CHROME, 0, 0.35);
      bx(body, 0.1, 0.16, 0.16, L * 0.36, 1.0, 0, info.head, false);
      bx(body, 0.08, 0.1, 0.18, -L * 0.45, 0.8, 0, info.tail, false);
      cyl(body, 0.05, 0.4, -L * 0.42, 0.45, 0.12, CHROME, Math.PI / 2, 0.0);
      info.rider = buildRider(v.shirt); body.add(info.rider); info.rider.position.set(-L * 0.12, 0.85, 0);
      break;
    }
    case 'bus': {
      const wh = v.wreck ? lamMat(0x242220) : stdMat(0xf1f3f4, { r: 0.45, m: 0.2 });
      const stripe = v.wreck ? lamMat(0x1e1c1a) : paintMat(col);
      bx(body, L, 2.9, W, 0, 0.35 + 1.45, 0, wh);
      bx(body, L * 0.99, 0.5, W * 1.01, 0, 0.7, 0, stripe, false);
      bx(body, L * 0.96, 0.95, W * 1.005, 0.0, 2.15, 0, GLASS, false);
      bx(body, L * 0.99, 0.12, W * 1.01, 0, 2.7, 0, stripe, false);
      bx(body, 0.1, 1.4, W * 0.92, L / 2 + 0.01, 2.0, 0, GLASS, false);
      bx(body, 0.1, 0.3, W * 0.5, L / 2 + 0.02, 3.05, 0, basicMat(0xffb300), false);
      for (const k of [-0.3, 0.1, 0.35]) bx(body, 1.2, 0.18, W * 0.5, k * L, 3.32, 0, lamMat(0xcfd8dc), false);
      for (const s of [-1, 1]) { bx(body, 0.1, 0.22, 0.4, L / 2, 0.85, s * W * 0.36, info.head, false); bx(body, 0.1, 0.22, 0.4, -L / 2, 0.85, s * W * 0.36, info.tail, false); }
      for (const s of [-1, 1]) for (const fx of [-0.36, -0.26, 0.3]) wheelAssembly(g, 0.5, 0.3, fx * L, s * (W / 2 - 0.1), fx > 0.2, info.wheels, info.steer);
      break;
    }
    case 'lorry': {
      const cabc = v.wreck ? lamMat(0x1e1c1a) : paintMat(col);
      bx(body, L * 0.27, 2.0, W, L * 0.36, 1.6, 0, cabc);
      bx(body, 0.1, 0.9, W * 0.86, L * 0.495, 2.1, 0, GLASS, false);
      bx(body, L * 0.72, 0.25, W, -L * 0.14, 0.95, 0, lamMat(0x3d2f1c));
      for (const s of [-1, 1]) bx(body, L * 0.72, 0.9, 0.1, -L * 0.14, 1.55, s * (W / 2 - 0.05), stdMat(0x8a6a3a, { r: 0.9 }));
      bx(body, 0.1, 0.9, W, -L * 0.5 + 0.05, 1.55, 0, stdMat(0x8a6a3a, { r: 0.9 }));
      bx(body, L * 0.7, 0.9, W * 0.86, -L * 0.14, 1.9, 0, v.wreck ? lamMat(0x1e1c1a) : stdMat(0x2f6b3a, { r: 0.95 }));
      for (let k = 0; k < 7; k++) bx(body, 0.5, 0.12, W * 1.0, -L * 0.45 + k * 1.3, 1.1, 0, k % 2 ? paintMat(0xffd54f) : paintMat(0xe53935), false);
      for (const s of [-1, 1]) { bx(body, 0.1, 0.2, 0.4, L / 2, 0.85, s * W * 0.34, info.head, false); bx(body, 0.1, 0.2, 0.4, -L / 2, 0.9, s * W * 0.34, info.tail, false); }
      bx(body, 0.2, 0.3, W * 1.02, L / 2, 0.55, 0, CHROME);
      for (const s of [-1, 1]) for (const fx of [-0.36, -0.24, 0.3]) wheelAssembly(g, 0.5, 0.34, fx * L, s * (W / 2 - 0.1), fx > 0.2, info.wheels, info.steer);
      break;
    }
  }
  // headlight beam (cone) for night driving
  if (!v.wreck && v.type !== 'bus' && v.type !== 'lorry' || v.type === 'bus') {
    const bm = new THREE.Mesh(CONEG, new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false }));
    bm.scale.set(1.8, 16, 1.8); bm.rotation.z = Math.PI / 2; bm.position.set(L / 2 + 8, 0.75, 0); bm.visible = false; g.add(bm); info.beam = bm;
  }
  g.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  return { group: g, info };
}

// ------------------------------------------------------------------ people
function buildRider(shirt) {
  const g = new THREE.Group(), sh = lamMat(new THREE.Color(shirt).getHex());
  bx(g, 0.3, 0.55, 0.42, -0.05, 0.55, 0, sh);
  sph(g, 0.14, 0.12, 1.0, 0, lamMat(0x111111));
  for (const s of [-1, 1]) { const a = bx(g, 0.5, 0.1, 0.1, 0.32, 0.62, s * 0.3, lamMat(0x8d5524)); a.rotation.z = -0.35; bx(g, 0.1, 0.1, 0.1, 0.0, 0.1, s * 0.2, lamMat(0x2a3550)).rotation.z = 0.0; }
  return g;
}
const WEAPON_MODELS = {};
function weaponModel(key) {
  if (WEAPON_MODELS[key]) return WEAPON_MODELS[key].clone();
  const g = new THREE.Group(), dk = lamMat(0x1b1b1b);
  switch (key) {
    case 'pistol': bx(g, 0.07, 0.34, 0.07, 0, -0.14, 0, dk); bx(g, 0.07, 0.1, 0.07, 0, -0.04, 0, dk); break;
    case 'smg': bx(g, 0.09, 0.5, 0.09, 0, -0.2, 0, dk); bx(g, 0.07, 0.22, 0.07, 0.0, -0.05, 0.0, dk); bx(g, 0.07, 0.1, 0.07, 0.1, -0.05, 0, dk); break;
    case 'shotgun': bx(g, 0.07, 0.8, 0.07, 0, -0.35, 0, dk); bx(g, 0.1, 0.3, 0.1, 0, -0.05, 0, lamMat(0x5a3a22)); break;
    case 'bat': bx(g, 0.08, 0.9, 0.08, 0, -0.45, 0, lamMat(0xd9b36b)); break;
    case 'nattu': sph(g, 0.1, 0, -0.1, 0, dk); break;
  }
  WEAPON_MODELS[key] = g; return g.clone();
}
function buildPedModel(p) {
  const g = new THREE.Group(), info = { weaponKey: null, weaponObj: null };
  const female = p.female, skin = lamMat(new THREE.Color(p.skin).getHex());
  let shirtCol = p.shirt, pantsCol = p.pants || '#2a2a2e';
  if (p.kind === 'player') { shirtCol = '#b3261e'; pantsCol = '#1d2b44'; }
  const shirt = lamMat(new THREE.Color(shirtCol).getHex()), pants = lamMat(new THREE.Color(pantsCol).getHex());
  const hairM = lamMat(new THREE.Color(p.hair || '#111').getHex());
  info.body = new THREE.Group(); g.add(info.body);
  // legs
  info.legL = new THREE.Group(); info.legR = new THREE.Group(); info.legL.position.set(0, 0.88, -0.12); info.legR.position.set(0, 0.88, 0.12);
  for (const lg of [info.legL, info.legR]) { bx(lg, 0.17, 0.88, 0.17, 0, -0.44, 0, female ? shirt : pants); if (!female) bx(lg, 0.24, 0.1, 0.19, 0.04, -0.86, 0, lamMat(0x1b1b1b), false); info.body.add(lg); }
  if (female) bx(info.body, 0.4, 0.78, 0.52, 0, 0.55, 0, shirt);   // saree drape
  // torso
  info.torso = new THREE.Group(); info.torso.position.set(0, 0.88, 0); info.body.add(info.torso);
  bx(info.torso, 0.27, 0.62, 0.48, 0, 0.32, 0, shirt);
  if (female) { const pallu = bx(info.torso, 0.29, 0.5, 0.09, 0.0, 0.34, 0.12, lamMat(new THREE.Color(shirtCol).offsetHSL(0, 0, 0.12).getHex())); pallu.rotation.x = 0.3; }
  if (p.kind === 'cop') { bx(info.torso, 0.29, 0.07, 0.5, 0, 0.0, 0, lamMat(0x3a2f18), false); bx(info.torso, 0.1, 0.1, 0.12, 0.15, 0.22, 0.14, lamMat(0x222), false); }
  if (p.kind === 'enemy') { bx(info.torso, 0.31, 0.12, 0.2, 0, 0.58, 0.2, lamMat(0xe65100), false); }
  // head
  info.head = new THREE.Group(); info.head.position.set(0, 0.76, 0); info.torso.add(info.head);
  sph(info.head, 0.115, 0.01, 0, 0, skin, 1.15);
  sph(info.head, 0.12, -0.02, 0.025, 0, hairM, 1.0).scale.set(0.12, 0.1, 0.12);
  if (female) { sph(info.head, 0.07, -0.13, -0.02, 0, hairM); for (const k of [-1, 0, 1]) sph(info.head, 0.025, -0.19, -0.01, k * 0.04, basicMat(0xffffff)); }
  if (p.kind === 'cop') { cyl(info.head, 0.13, 0.1, -0.0, 0.1, 0, lamMat(0x7a6a38)); bx(info.head, 0.14, 0.02, 0.2, 0.11, 0.07, lamMat(0x3b3112), false); }
  if (p.kind === 'enemy') bx(info.head, 0.25, 0.04, 0.26, 0.0, 0.07, lamMat(0xe65100), false);
  if (p.kind === 'player') { bx(info.head, 0.04, 0.05, 0.2, 0.1, 0.02, lamMat(0x050505), false); }
  // arms
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0, 0.55, s * 0.29); bx(arm, 0.11, 0.56, 0.11, 0, -0.27, 0, p.kind === 'player' ? shirt : female ? skin : shirt); bx(arm, 0.1, 0.12, 0.1, 0, -0.58, 0, skin, false);
    info.torso.add(arm); if (s > 0) info.armR = arm; else info.armL = arm;
  }
  info.weaponMount = new THREE.Group(); info.weaponMount.position.set(0, -0.55, 0); info.armR.add(info.weaponMount);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, info };
}
