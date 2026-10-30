'use strict';
// ===================================================================
//  RENDER 3D – Three.js scene built from the 2D simulation
//  sim (x,y) px  ->  three (x, 0, z) metres   (1 px = 0.1 m)
// ===================================================================
const cam = { x: 0, y: 0, w: 1280, h: 720, yaw: 0, pitch: 0.34, dist: 5, fov: 62, lastLook: -10, zoom: 0.5, sx: 0, sz: 0 };
let renderer, scene, camera3, sunLight, hemi, canvas, ctx, ovCanvas, envMap;
let frameNo = 0, shadowSnap = 0;
const ents = { veh: new Map(), ped: new Map(), pick: new Map(), marker: new Map(), bomb: [] };
const bh3d = new Float32Array(COLS * ROWS);          // building height per tile (m) for camera clipping
const chunks3 = new Map();
const TEX = {};
const sharedMats = {};
const _v3 = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _qt = new THREE.Quaternion(), _s3 = new THREE.Vector3(), _col = new THREE.Color();

// ------------------------------------------------------------------ helpers shared with the HUD / sim
function daylight() { const h = G.dayMin / 60; return h < 5 ? 0 : h < 7 ? (h - 5) / 2 : h < 17.5 ? 1 : h < 19.5 ? 1 - (h - 17.5) / 2 : 0; }
function nightAlpha() { return clamp((1 - daylight()) * 0.8 + G.rain * 0.12, 0, 0.88); }
function activeBlips() {
  const out = [];
  if (Missions.active) for (const b of Missions.active.blips) out.push(b);
  if (Fare.on && Fare.blip) out.push(Fare.blip);
  return out;
}
function worldToScreen(x, y, h) {
  _v3.set(x * U, h || 0, y * U).project(camera3);
  return { x: (_v3.x * 0.5 + 0.5) * cam.w, y: (-_v3.y * 0.5 + 0.5) * cam.h, vis: _v3.z < 1 && _v3.z > -1, z: _v3.z };
}
function onScreen(x, y, m) {
  _v3.set(x * U, 1, y * U).project(camera3);
  if (_v3.z > 1) return false;
  const k = 1 + (m || 0) / 500; return Math.abs(_v3.x) < k && Math.abs(_v3.y) < k;
}
function heightM(b) {
  const h = b.hgt;
  switch (b.kind) {
    case 'tin': return 3; case 'house': return h * 0.55; case 'cont': return h > 11 ? 5.4 : 2.7; case 'wh': return 9; case 'stall': return 2.6;
    case 'central': return 14; case 'hospital': return 22; case 'police': return 15; case 'fortwall': return 6; case 'stand': return 12; case 'templewall': return 5;
    case 'gopuram': return 8; case 'shrine': return 10; case 'colonial': return 9; case 'terminal': return 11; case 'garage': return 6; case 'light': return 36;
    default: return h * 1.0;
  }
}

// ------------------------------------------------------------------ textures
function canvasTex(c, rep) { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
function makeTextures() {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // window atlas 4x4 cells (3 m x 3.2 m each)
  const a = mk(512, 512), e = mk(512, 512), g = a.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 512); ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 512);
  for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
    const ox = cx * 128, oy = cy * 128, r = hash2(cx * 7 + 3, cy * 13 + 1);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(ox, oy + 122, 128, 6);            // floor slab
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(ox, oy, 128, 4);
    g.fillStyle = '#4b4b4b'; g.fillRect(ox + 26, oy + 24, 76, 78);                 // frame
    const gr = g.createLinearGradient(0, oy + 28, 0, oy + 98); gr.addColorStop(0, '#6f93b3'); gr.addColorStop(1, '#223a52');
    g.fillStyle = gr; g.fillRect(ox + 31, oy + 29, 66, 68);
    g.fillStyle = '#4b4b4b'; g.fillRect(ox + 62, oy + 29, 4, 68); g.fillRect(ox + 31, oy + 60, 66, 3);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(ox + 34, oy + 32); g.lineTo(ox + 52, oy + 32); g.lineTo(ox + 36, oy + 62); g.fill();
    if (r < 0.3) { g.fillStyle = '#d8d8d8'; g.fillRect(ox + 36, oy + 100, 56, 14); g.fillStyle = '#8c8c8c'; g.fillRect(ox + 40, oy + 104, 48, 3); }  // AC unit
    if (r > 0.75) { g.fillStyle = 'rgba(40,40,40,.85)'; g.fillRect(ox + 20, oy + 96, 88, 6); }                                                       // balcony rail
    if (hash2(cx * 5 + 9, cy * 3 + 4) < 0.4) { ge.fillStyle = hash2(cx, cy + 20) < 0.5 ? '#ffd68a' : '#bfe6ff'; ge.fillRect(ox + 31, oy + 29, 66, 68); }
  }
  TEX.win = canvasTex(a, true); TEX.winE = canvasTex(e, true);
  const gl = mk(128, 128), gg = gl.getContext('2d'), gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
  TEX.glow = canvasTex(gl, false);
  const w = mk(256, 256), gw = w.getContext('2d');
  for (let i = 0; i < 90; i++) { const x = Math.random() * 256, y = Math.random() * 256, l = rand(10, 40); gw.fillStyle = 'rgba(255,255,255,' + rand(0.06, 0.3) + ')'; for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { gw.beginPath(); gw.ellipse(x + dx, y + dy, l, rand(1.2, 2.6), 0, 0, TAU); gw.fill(); } }
  TEX.wave = canvasTex(w, true);
  const f = mk(64, 40), gf = f.getContext('2d'); gf.fillStyle = '#ff9933'; gf.fillRect(0, 0, 64, 13); gf.fillStyle = '#fff'; gf.fillRect(0, 13, 64, 14); gf.fillStyle = '#138808'; gf.fillRect(0, 27, 64, 13); gf.strokeStyle = '#1a237e'; gf.beginPath(); gf.arc(32, 20, 5, 0, TAU); gf.stroke(); TEX.flag = canvasTex(f, false);
}
const signCache = new Map();
function signMaterial(text, col, wm) {
  const key = text + col + Math.round(wm); let m = signCache.get(key); if (m) return m;
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = col || '#b71c1c'; g.fillRect(0, 0, 512, 64); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.strokeRect(3, 3, 506, 58);
  g.fillStyle = '#fff'; g.font = 'bold 34px ' + TAMIL_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 34, 480);
  m = new THREE.MeshBasicMaterial({ map: canvasTex(c, false), color: 0xdddddd }); signCache.set(key, m); return m;
}

// ------------------------------------------------------------------ init
function initRender() {
  canvas = document.getElementById('game'); ovCanvas = document.getElementById('hud'); ctx = ovCanvas.getContext('2d');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x8cc4ee); scene.fog = new THREE.Fog(0x8cc4ee, 70, 190);
  camera3 = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 700); scene.add(camera3);
  hemi = new THREE.HemisphereLight(0xbfe0ff, 0x6b6a5a, 0.8); scene.add(hemi);
  sunLight = new THREE.DirectionalLight(0xfff1d6, 1.0); sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048); const sc = sunLight.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 450;
  sunLight.shadow.bias = -0.0006; sunLight.shadow.normalBias = 0.06; scene.add(sunLight); scene.add(sunLight.target);
  makeTextures(); makeEnvironment(); makeSharedObjects();
  for (const b of world.buildings) { const h = heightM(b); for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) bh3d[y * COLS + x] = h; }
  buildBackdrop();
  resize(); window.addEventListener('resize', resize);
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); ovCanvas.width = w; ovCanvas.height = h; cam.w = w; cam.h = h;
  camera3.aspect = w / h; camera3.updateProjectionMatrix();
}
function makeEnvironment() {
  // tiny gradient sky for reflections on paint & glass
  const es = new THREE.Scene(), c = document.createElement('canvas'); c.width = 8; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#6aa8e8'); gr.addColorStop(0.5, '#e8f1fa'); gr.addColorStop(0.55, '#8a8f95'); gr.addColorStop(1, '#3b3d40'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  const sp = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.BackSide })); es.add(sp);
  const pm = new THREE.PMREMGenerator(renderer); envMap = pm.fromScene(es).texture; scene.environment = envMap; pm.dispose();
}
function makeSharedObjects() {
  sharedMats.wall = new THREE.MeshStandardMaterial({ map: TEX.win, emissiveMap: TEX.winE, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, roughness: 0.9, metalness: 0 });
  sharedMats.glow = new THREE.PointsMaterial({ map: TEX.glow, size: 5, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffc47a, opacity: 0 });
  sharedMats.pool = new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffb860, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  sharedMats.water = new THREE.MeshBasicMaterial({ map: TEX.wave, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  sharedMats.canopy = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  sharedMats.trunk = lamMat(0x5d4037); sharedMats.pole = stdMat(0x3a3f45, { r: 0.6, m: 0.5 });
  // particles
  const vs = 'attribute float size; attribute vec4 pcolor; varying vec4 vC; uniform float scale; void main(){ vC=pcolor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(size*scale/(-mv.z),256.0); gl_Position=projectionMatrix*mv; }';
  const fs = 'varying vec4 vC; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.15,d); gl_FragColor=vec4(vC.rgb,vC.a*a); if(gl_FragColor.a<0.01) discard; }';
  const mkP = (blend) => {
    const geo = new THREE.BufferGeometry(); const N = 900;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('pcolor', new THREE.BufferAttribute(new Float32Array(N * 4), 4)); geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: blend, uniforms: { scale: { value: 400 } } });
    const p = new THREE.Points(geo, m); p.frustumCulled = false; scene.add(p); return p;
  };
  sharedMats.smoke = mkP(THREE.NormalBlending); sharedMats.fire = mkP(THREE.AdditiveBlending);
  // skid marks
  const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
  sharedMats.skid = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 400); sharedMats.skid.frustumCulled = false; sharedMats.skid.count = 0; scene.add(sharedMats.skid);
  // bullets
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(1200 * 6), 3));
  sharedMats.bullets = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0xffe9a0 })); sharedMats.bullets.frustumCulled = false; scene.add(sharedMats.bullets);
  // explosions
  sharedMats.expl = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(SPHG, new THREE.MeshBasicMaterial({ color: 0xffa63a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); m.visible = false; scene.add(m); sharedMats.expl.push(m); }
  sharedMats.explLight = new THREE.PointLight(0xff9a3a, 0, 60, 2); scene.add(sharedMats.explLight);
  sharedMats.muzzle = new THREE.PointLight(0xffe0a0, 0, 18, 2); scene.add(sharedMats.muzzle);
  sharedMats.headL = [new THREE.SpotLight(0xfff0c8, 0, 60, 0.5, 0.6, 1.2), new THREE.SpotLight(0xfff0c8, 0, 60, 0.5, 0.6, 1.2)]; for (const s of sharedMats.headL) { scene.add(s); scene.add(s.target); }
  // rain
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(700 * 6), 3));
  sharedMats.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfd0e0, transparent: true, opacity: 0.35 })); sharedMats.rain.frustumCulled = false; scene.add(sharedMats.rain);
  sharedMats.rainP = Array.from({ length: 700 }, () => ({ x: rand(-30, 30), y: rand(0, 25), z: rand(-30, 30) }));
  // traffic light heads
  sharedMats.tl = { mats: [new THREE.MeshBasicMaterial({ color: 0xff3b30 }), new THREE.MeshBasicMaterial({ color: 0xffcc00 }), new THREE.MeshBasicMaterial({ color: 0x34c759 })], off: new THREE.MeshBasicMaterial({ color: 0x2a2a2a }), pool: [] };
  // flying airport plane
  sharedMats.plane = buildPlane(0xffffff, 0x1565c0); scene.add(sharedMats.plane);
}
function buildBackdrop() {
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x2f3438, roughness: 1 })); gnd.rotation.x = -Math.PI / 2; gnd.position.set(COLS * TS * U / 2, -0.4, ROWS * TS * U / 2); gnd.receiveShadow = true; scene.add(gnd);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x165a8f, roughness: 0.3, metalness: 0.2 })); sea.rotation.x = -Math.PI / 2; sea.position.set(COLS * TS * U + 1990 - 70, -0.2, ROWS * TS * U / 2); scene.add(sea);
  const wm = lamMat(0x7a766e);
  const W = COLS * TS * U, Hh = ROWS * TS * U;
  for (const [x, z, w, d] of [[W / 2, 0.4, W, 0.8], [W / 2, Hh - 0.4, W, 0.8], [0.4, Hh / 2, 0.8, Hh]]) { const m = new THREE.Mesh(BOXG, wm); m.scale.set(w, 3, d); m.position.set(x, 1.5, z); m.castShadow = true; scene.add(m); }
}

// ------------------------------------------------------------------ chunk geometry
function newBuf() { return { pos: [], nor: [], uv: [], col: [], idx: [] }; }
function pushQuad(B, v, n, uvs, col) {
  const i = B.pos.length / 3;
  for (let k = 0; k < 4; k++) { B.pos.push(v[k][0], v[k][1], v[k][2]); B.nor.push(n[0], n[1], n[2]); B.uv.push(uvs[k][0], uvs[k][1]); if (col) B.col.push(col.r, col.g, col.b); }
  B.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
}
function pushWalls(B, x0, z0, x1, z1, h, col, off) {
  const us = 1 / 12, vs = 1 / 12.8, ou = off;
  const L = (a, b) => (b - a) * us;
  pushQuad(B, [[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]], [0, 0, 1], [[ou, 0], [ou + L(x0, x1), 0], [ou + L(x0, x1), h * vs], [ou, h * vs]], col);
  pushQuad(B, [[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]], [0, 0, -1], [[ou, 0], [ou + L(x0, x1), 0], [ou + L(x0, x1), h * vs], [ou, h * vs]], col);
  pushQuad(B, [[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]], [1, 0, 0], [[ou, 0], [ou + L(z0, z1), 0], [ou + L(z0, z1), h * vs], [ou, h * vs]], col);
  pushQuad(B, [[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]], [-1, 0, 0], [[ou, 0], [ou + L(z0, z1), 0], [ou + L(z0, z1), h * vs], [ou, h * vs]], col);
}
function bufToGeo(B, withCol) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
  if (withCol) g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
  g.setIndex(B.idx); return g;
}
function instanced(geo, mat, mats, colors) {
  const m = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((mm, i) => m.setMatrixAt(i, mm));
  if (colors) { colors.forEach((c, i) => m.setColorAt(i, c)); }
  m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; m.castShadow = true; return m;
}
function compose(x, y, z, sx, sy, sz, ry) { _qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0); _v3.set(x, y, z); _s3.set(sx, sy, sz); return new THREE.Matrix4().compose(_v3, _qt, _s3); }
const _treeCan = new THREE.IcosahedronGeometry(1, 1), _poleG = new THREE.CylinderGeometry(0.07, 0.1, 6.4, 8), _headG = new THREE.BoxGeometry(1, 0.12, 0.32), _poolG = (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })();

function buildChunk3D(cx, cy) {
  const group = new THREE.Group(), ox = cx * CHP, oy = cy * CHP, k = cy * 64 + cx, own = [];
  const tex = new THREE.CanvasTexture(renderChunkFlat(cx, cy)); tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const gm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CHP * U, CHP * U), gm); ground.rotation.x = -Math.PI / 2; ground.position.set((ox + CHP / 2) * U, 0, (oy + CHP / 2) * U); ground.receiveShadow = true; group.add(ground);
  const cx0 = ox * U, cx1 = (ox + CHP) * U, cz0 = oy * U, cz1 = (oy + CHP) * U;
  // ---- buildings
  const WB = newBuf(), RB = newBuf(), extras = [], tanks = [];
  for (const b of (bucketB.get(k) || [])) {
    const hM = heightM(b), x0 = b.x * TS * U, x1 = (b.x + b.w) * TS * U, z0 = b.y * TS * U, z1 = (b.y + b.h) * TS * U;
    const ix0 = Math.max(x0, cx0), ix1 = Math.min(x1, cx1), iz0 = Math.max(z0, cz0), iz1 = Math.min(z1, cz1);
    if (ix1 <= ix0 || iz1 <= iz0) continue;
    const cols = buildingColors(b);
    if (b.kind !== 'light') {
      const u0 = (ix0 - cx0) / (CHP * U), u1 = (ix1 - cx0) / (CHP * U), v0 = 1 - (iz0 - cz0) / (CHP * U), v1 = 1 - (iz1 - cz0) / (CHP * U);
      pushQuad(RB, [[ix0, hM, iz0], [ix0, hM, iz1], [ix1, hM, iz1], [ix1, hM, iz0]], [0, 1, 0], [[u0, v0], [u0, v1], [u1, v1], [u1, v0]]);
    }
    if (Math.floor(b.x * TS / CHP) !== cx || Math.floor(b.y * TS / CHP) !== cy) continue;   // walls & props belong to one chunk
    const s = hash2(b.x, b.y), wm = (x1 - x0), dm = (z1 - z0);
    if (b.kind === 'light') { extras.push(() => lighthouse(group, (x0 + x1) / 2, (z0 + z1) / 2)); continue; }
    pushWalls(WB, x0, z0, x1, z1, hM, new THREE.Color(cols.wall), Math.floor(s * 4) * 0.25);
    if (b.sign && hM >= 8 && b.kind !== 'templewall') extras.push(() => { const sw = Math.min(wm - 0.4, 15), p = new THREE.Mesh(new THREE.PlaneGeometry(sw, 1.15), signMaterial(b.sign, b.signCol, sw)); p.position.set((x0 + x1) / 2, Math.min(3.8, hM - 1), z1 + 0.07); group.add(p); });
    if ((b.kind === 'house' || b.kind === 'apt' || b.kind === 'shop') && b.w * TS >= 60 && s < 0.55) tanks.push({ x: x0 + wm * (0.25 + s * 0.4), z: z0 + dm * 0.35, y: hM, c: s < 0.3 ? 0x1c2833 : 0x2e5a8f });
    if (b.kind === 'gopuram') extras.push(() => gopuram(group, (x0 + x1) / 2, (z0 + z1) / 2, wm, dm, hM));
    if (b.kind === 'shrine') extras.push(() => { for (let t = 0; t < 4; t++) { const w = wm * (0.9 - t * 0.18), m = bx(group, w, 1.6, dm * (0.9 - t * 0.18), (x0 + x1) / 2, hM + 0.8 + t * 1.6, (z0 + z1) / 2, stdMat([0xc9961a, 0xd4a017, 0xe3b52b, 0xf0c94a][t], { r: 0.4, m: 0.6 })); } sph(group, 0.5, (x0 + x1) / 2, hM + 7.2, (z0 + z1) / 2, stdMat(0xffd54f, { r: 0.2, m: 0.9 })); });
    if (b.kind === 'central') extras.push(() => centralTower(group, (x0 + x1) / 2, (z0 + z1) / 2, hM, z1));
    if (b.kind === 'stand') extras.push(() => { for (let q = 0; q < 2; q++) { const l = bx(group, Math.max(wm, 0.4), 0.2, Math.max(dm, 0.4), (x0 + x1) / 2, hM + 0.1 + q * 0.4, (z0 + z1) / 2, lamMat(q ? 0xffd600 : 0x2b4f9e), false); l.scale.x *= 1.0; } });
    if (b.kind === 'fortwall') extras.push(() => { const n = Math.floor(Math.max(wm, dm) / 1.6); for (let q = 0; q < n; q++) { const t = (q + 0.5) / n; bx(group, 0.8, 0.8, 0.8, wm > dm ? x0 + wm * t : (x0 + x1) / 2, hM + 0.4, wm > dm ? (z0 + z1) / 2 : z0 + dm * t, lamMat(0xcdbb94), true); } });
    if (b.kind === 'police') extras.push(() => { cyl(group, 0.07, 9, x0 + 1, hM + 4.5, z0 + 1, stdMat(0xdddddd, { m: 0.8 })); const f = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ color: 0x1e56c8, side: THREE.DoubleSide })); f.position.set(x0 + 2.1, hM + 8.2, z0 + 1); group.add(f); });
  }
  for (const f of extras) f();
  const walls = new THREE.Mesh(bufToGeo(WB, true), sharedMats.wall); walls.castShadow = true; walls.receiveShadow = true; if (WB.pos.length) group.add(walls);
  const roofs = new THREE.Mesh(bufToGeo(RB, false), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 })); roofs.castShadow = true; roofs.receiveShadow = true; if (RB.pos.length) group.add(roofs);
  for (const t of tanks) { const m = cyl(group, 0.9, 1.2, t.x, t.y + 0.6, t.z, lamMat(t.c)); cyl(group, 0.6, 0.15, t.x, t.y + 1.25, t.z, lamMat(0x9aa4ad)); }
  // ---- trees
  const ts = (bucketT.get(k) || []).filter(t => t.x >= ox && t.x < ox + CHP && t.y >= oy && t.y < oy + CHP);
  const trunkM = [], canM = [], canC = [], palmM = [];
  for (const t of ts) {
    const px = t.x * U, pz = t.y * U, r = t.r * U * 1.25;
    if (t.palm) { const th = 6 + hash2(Math.floor(t.x), Math.floor(t.y)) * 2.5; trunkM.push(compose(px, th / 2, pz, 0.18, th, 0.18)); palmM.push(compose(px, th + 0.2, pz, 1, 1, 1, hash2(Math.floor(t.x), 7) * TAU)); continue; }
    const th = t.solid ? 2.8 : 2.4; trunkM.push(compose(px, th / 2, pz, 0.14 + r * 0.05, th, 0.14 + r * 0.05)); canM.push(compose(px, th + r * 0.55, pz, r, r * 0.85, r, hash2(Math.floor(t.x), 3) * TAU));
    _col.set(t.c).offsetHSL((hash2(Math.floor(t.x), Math.floor(t.y)) - 0.5) * 0.03, 0, (hash2(3, Math.floor(t.y)) - 0.5) * 0.08); canC.push(_col.clone());
  }
  if (trunkM.length) group.add(instanced(CYLG, sharedMats.trunk, trunkM));
  if (canM.length) group.add(instanced(_treeCan, sharedMats.canopy, canM, canC));
  if (palmM.length) group.add(instanced(palmCrownGeo(), lamMat(0x2e8b3a), palmM));
  // ---- lamps
  const lamps = (bucketL.get(k) || []).filter(l => l.x >= ox && l.x < ox + CHP && l.y >= oy && l.y < oy + CHP);
  if (lamps.length) {
    group.add(instanced(_poleG, sharedMats.pole, lamps.map(l => compose(l.x * U, 3.2, l.y * U, 1, 1, 1))));
    group.add(instanced(_headG, sharedMats.pole, lamps.map(l => compose(l.x * U + 0.4, 6.45, l.y * U, 1.0, 1, 1))));
    const pool = new THREE.InstancedMesh(_poolG, sharedMats.pool, lamps.length); lamps.forEach((l, i) => pool.setMatrixAt(i, compose(l.x * U + 0.4, 0.07, l.y * U, 17, 1, 17))); pool.frustumCulled = false; group.add(pool);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(lamps.flatMap(l => [l.x * U + 0.4, 6.3, l.y * U]), 3)); const pts = new THREE.Points(pg, sharedMats.glow); pts.frustumCulled = false; group.add(pts);
  }
  // ---- decor props
  for (const d of (bucketD.get(k) || [])) { if (d.x < ox || d.x >= ox + CHP || d.y < oy || d.y >= oy + CHP) continue; decor3d(group, d); }
  // ---- water shimmer
  const WQ = newBuf();
  for (let ty = cy * CH; ty < Math.min(ROWS, (cy + 1) * CH); ty++) for (let tx = cx * CH; tx < Math.min(COLS, (cx + 1) * CH); tx++) {
    const t = tiles[ty * COLS + tx]; if (t !== T.WATER && t !== T.SHALLOW && !(t === T.WALL && tx >= 149)) continue;
    const x0 = tx * TS * U, z0 = ty * TS * U, x1 = x0 + TS * U, z1 = z0 + TS * U, s = 1 / 14;
    pushQuad(WQ, [[x0, 0.06, z0], [x0, 0.06, z1], [x1, 0.06, z1], [x1, 0.06, z0]], [0, 1, 0], [[x0 * s, z0 * s], [x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s]]);
  }
  if (WQ.pos.length) { const wm = new THREE.Mesh(bufToGeo(WQ, false), sharedMats.water); wm.renderOrder = 2; group.add(wm); }
  group.userData = { tex, gm, k };
  return { group, cx, cy, last: frameNo, tex };
}
function disposeChunk(e) {
  e.group.traverse(o => { if (o.geometry && !o.geometry.userData.shared && o.geometry !== BOXG && o.geometry !== CYLG && o.geometry !== SPHG && o.geometry !== CONEG && o.geometry !== _treeCan && o.geometry !== _poleG && o.geometry !== _headG && o.geometry !== _poolG) o.geometry.dispose(); if (o.material && o.material.map === e.tex) o.material.dispose(); });
  e.tex.dispose(); scene.remove(e.group);
}
let _palmGeo;
function palmCrownGeo() {
  if (_palmGeo) return _palmGeo;
  const B = newBuf(); // 7 drooping fronds as flat tapered quads
  for (let i = 0; i < 7; i++) {
    const a = i * TAU / 7, ca = Math.cos(a), sa = Math.sin(a), px = -sa, pz = ca, len = 3.2, w = 0.55;
    const P = (f, side, drop) => [ca * len * f + px * w * side * (1 - f * 0.7), -drop * f * f * 1.6, sa * len * f + pz * w * side * (1 - f * 0.7)];
    const base = B.pos.length / 3, pts = [P(0, -0.2, 0), P(0, 0.2, 0), P(0.5, 1, 0.6), P(0.5, -1, 0.6), P(1, 0, 1)];
    for (const q of [[0, 1, 2], [0, 2, 4], [0, 3, 4], [0, 3, 1]]) { }
    const idx = [[0, 1, 2], [0, 2, 3], [3, 2, 4]];
    for (const p of pts) { B.pos.push(...p); B.nor.push(0, 1, 0); B.uv.push(0, 0); }
    for (const t of idx) { B.idx.push(base + t[0], base + t[1], base + t[2], base + t[0], base + t[2], base + t[1]); }
  }
  _palmGeo = bufToGeo(B, false); _palmGeo.userData.shared = true; return _palmGeo;
}
function lighthouse(group, x, z) {
  const R = lamMat(0xb71c1c), Wt = lamMat(0xf5f5f5);
  for (let i = 0; i < 6; i++) { const r = 3.5 - i * 0.28; cyl(group, r, 6, x, 3 + i * 6, z, i % 2 ? Wt : R); }
  cyl(group, 3.0, 0.5, x, 36.3, z, lamMat(0x333333)); cyl(group, 1.5, 3, x, 38, z, stdMat(0xfff3b0, { e: 0xffe9a0, r: 0.2 }));
  const cone = new THREE.Mesh(CONEG, R); cone.scale.set(2.0, 2.4, 2.0); cone.position.set(x, 40.4, z); group.add(cone);
  sharedMats.lightBeam = sharedMats.lightBeam || null;
  const bm = new THREE.Mesh(CONEG, new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  bm.scale.set(4, 90, 4); bm.rotation.z = Math.PI / 2; const piv = new THREE.Group(); piv.position.set(x, 38, z); bm.position.set(45, 0, 0); piv.add(bm); group.add(piv); piv.userData.lh = true; piv.visible = false; sharedMats.lhPivs = (sharedMats.lhPivs || []).concat([piv]);
}
function gopuram(group, x, z, w, d, h0) {
  const cols = [0xe8537a, 0x26a69a, 0xffca28, 0x5c6bc0, 0xef6c00, 0xd81b60];
  for (let t = 0; t < 6; t++) { const f = 1 - t * 0.13, hh = 3.6 - t * 0.2; const m = bx(group, w * f, hh, d * f, x, h0 + t * 3.4 + hh / 2, z, stdMat(cols[t], { r: 0.6 })); bx(group, w * f * 1.04, 0.35, d * f * 1.04, x, h0 + t * 3.4 + hh + 0.1, z, lamMat(0xf5f0e1)); for (let q = 0; q < Math.floor(w * f / 1.4); q++) bx(group, 0.35, 0.7, 0.2, x - w * f / 2 + 0.8 + q * 1.4, h0 + t * 3.4 + hh * 0.5, z + d * f / 2 + 0.05, lamMat(0xfff3d0), false); }
  for (let q = -1; q <= 1; q++) sph(group, 0.35, x + q * 1.2, h0 + 6 * 3.4 + 0.5, z, stdMat(0xffd54f, { m: 0.9, r: 0.2 }));
}
function centralTower(group, x, z, h0, z1) {
  bx(group, 6.2, 8, 5.6, x, h0 + 4, z - 0.6, lamMat(0x9a4b3a)); bx(group, 6.8, 0.6, 6.2, x, h0 + 8.2, z - 0.6, lamMat(0xe9d9c7));
  const c = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshBasicMaterial({ color: 0xf3efe6 })); c.position.set(x, h0 + 5.3, z - 0.6 + 2.82); group.add(c);
  for (const [a, l, w] of [[0, 1.3, 0.12], [1.5, 1.0, 0.1]]) { const hand = bx(group, w, l, 0.05, x, h0 + 5.3 + l / 2 * Math.cos(a), z + 2.25, lamMat(0x222222), false); hand.rotation.z = -a; }
  const dome = new THREE.Mesh(SPHG, stdMat(0xb5523b, { r: 0.5 })); dome.scale.set(2.8, 2.2, 2.6); dome.position.set(x, h0 + 8.4, z - 0.6); group.add(dome); sph(group, 0.3, x, h0 + 10.8, z - 0.6, stdMat(0xffd54f, { m: 0.9, r: 0.2 }));
  for (const sx of [-1, 1]) { bx(group, 1.4, 4, 1.4, x + sx * 12, h0 + 2, z - 0.6, lamMat(0xa85a46)); const t = new THREE.Mesh(CONEG, stdMat(0xb5523b)); t.scale.set(1.2, 1.6, 1.2); t.position.set(x + sx * 12, h0 + 4.8, z - 0.6); group.add(t); }
}
function buildPlane(col, tail) {
  const g = new THREE.Group(), body = stdMat(col, { r: 0.3, m: 0.4 });
  cyl(g, 1.0, 17, 0, 1.6, 0, body, 0, Math.PI / 2); sph(g, 1.0, 8.4, 1.6, 0, body, 0.95); sph(g, 1.0, -8.2, 1.7, 0, body, 0.8);
  const w1 = bx(g, 3.2, 0.25, 8.5, -0.5, 1.4, 4.5, body); w1.rotation.y = 0.45; const w2 = bx(g, 3.2, 0.25, 8.5, -0.5, 1.4, -4.5, body); w2.rotation.y = -0.45;
  const f = bx(g, 3, 3.6, 0.25, -7.6, 3.6, 0, stdMat(tail, { r: 0.5 })); f.rotation.z = -0.3;
  const s1 = bx(g, 2, 0.2, 3, -8, 2, 1.6, body); const s2 = bx(g, 2, 0.2, 3, -8, 2, -1.6, body);
  for (const s of [-1, 1]) cyl(g, 0.5, 2.2, 0.5, 0.7, s * 3.4, stdMat(0x7a8590, { m: 0.8 }), 0, Math.PI / 2);
  const wnd = bx(g, 6, 0.3, 2.02, 2, 2.0, 0, GLASS, false); wnd.scale.set(6, 0.3, 2.02);
  return g;
}
function decor3d(group, d) {
  const x = d.x * U, z = d.y * U;
  switch (d.type) {
    case 'umbrella': cyl(group, 0.04, 2.4, x, 1.2, z, lamMat(0xdddddd)); { const c = new THREE.Mesh(CONEG, new THREE.MeshStandardMaterial({ color: new THREE.Color(d.col).getHex(), roughness: 0.8, side: THREE.DoubleSide })); c.scale.set(1.3, 0.55, 1.3); c.position.set(x, 2.5, z); c.castShadow = true; group.add(c); } break;
    case 'boat': { const h = bx(group, 5.4, 0.75, 1.6, x, 0.4, z, paintMat(new THREE.Color(d.col).getHex())); h.rotation.y = -d.a; const w = bx(group, 5.0, 0.12, 0.4, x, 0.8, z, lamMat(0xffffff), false); w.rotation.y = h.rotation.y; } break;
    case 'plane': { const p = buildPlane(new THREE.Color(d.col).getHex(), new THREE.Color(d.tail).getHex()); p.position.set(x, 0, z); group.add(p); } break;
    case 'flag': cyl(group, 0.09, 12, x, 6, z, stdMat(0xdddddd, { m: 0.8 })); { const f = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshBasicMaterial({ map: TEX.flag, side: THREE.DoubleSide })); f.position.set(x + 1.8, 10.8, z); group.add(f); } break;
    case 'crates': { const c = bx(group, 0.9, 0.9, 0.9, x, 0.45, z, lamMat(0xa1783a)); c.rotation.y = d.a; } break;
    case 'mandapam': for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(group, 0.18, 3.2, x + sx * 1.4, 1.6, z + sz * 1.4, lamMat(0xe9d9b0)); bx(group, 3.6, 0.3, 3.6, x, 3.3, z, lamMat(0xd4a017)); { const c = new THREE.Mesh(CONEG, stdMat(0xd4a017, { r: 0.4, m: 0.6 })); c.scale.set(2.4, 1.8, 2.4); c.rotation.y = Math.PI / 4; c.position.set(x, 4.4, z); group.add(c); } break;
  }
}

// ------------------------------------------------------------------ dynamic entities
function inRange(x, y, r) { return dist(x, y, cam.x, cam.y) < r; }
function syncVehicles(dt) {
  const alive = new Set(), night = 1 - daylight();
  for (const v of vehicles) {
    if (!inRange(v.x, v.y, 2100)) continue;
    let e = ents.veh.get(v.id);
    if (e && (e.info.wreck !== v.wreck || e.info.col !== v.col)) { scene.remove(e.group); e = null; }
    if (!e) { e = buildVehicleModel(v); e.lastF = 0; e.lastT = 0; e.spin = 0; ents.veh.set(v.id, e); scene.add(e.group); }
    alive.add(v.id);
    const g = e.group, info = e.info, fwd = v.fwdSpeed || 0;
    g.position.set(v.x * U, 0, v.y * U); g.rotation.y = -v.a;
    const dF = clamp((fwd - e.lastF) / Math.max(dt, 0.001), -900, 900); e.lastF = fwd; e.lt = (e.lt || 0) + (dF - (e.lt || 0)) * Math.min(1, dt * 6);
    info.lean.rotation.z = clamp(e.lt * 0.00006, -0.04, 0.04) + (v.wreck ? 0.04 : 0);
    info.lean.rotation.x = clamp(-v.steerS * Math.abs(fwd) * 0.00014, -0.06, 0.06) + (v.wreck ? 0.05 : 0);
    const spin = fwd * U * dt;
    for (const w of info.wheels) w.piv.rotation.z -= spin / w.r;
    for (const s of info.steer) s.rotation.y = -v.steerS * 0.5;
    const braking = v.throttle < -0.2 && fwd > 12 || v.hb;
    info.tail.emissiveIntensity = (braking ? 2.2 : 0.4) + night * 0.6;
    info.head.emissiveIntensity = 0.3 + (v.driver ? night * 1.6 : 0);
    if (info.siren) { const ph = Math.floor(G.t * 7) % 2; const on = v.siren ? 1 : 0.1; info.siren.r.emissiveIntensity = ph ? 3 * on : 0.2; info.siren.b.emissiveIntensity = ph ? 0.2 : 3 * on; }
    if (info.beam) info.beam.visible = !!v.driver && night > 0.4 && !v.wreck;
    if (info.rider) info.rider.visible = !!v.driver && v.driver !== player || (v.driver === player);
  }
  for (const [id, e] of ents.veh) if (!alive.has(id)) { scene.remove(e.group); ents.veh.delete(id); }
}
function syncPeds(dt) {
  const alive = new Set();
  const list = player.veh || G.mode === 'title' ? peds : peds.concat([player]);
  for (const p of list) {
    if (p.veh || !inRange(p.x, p.y, 1800)) continue;
    let e = ents.ped.get(p.id || 'pl');
    if (!e) { e = buildPedModel(p); ents.ped.set(p.id || 'pl', e); scene.add(e.group); }
    alive.add(p.id || 'pl');
    const g = e.group, I = e.info;
    g.position.set(p.x * U, 0, p.y * U); g.rotation.y = -(p.a || 0);
    // weapon in hand
    const wk = (p.kind === 'player' || p.kind === 'cop' || p.kind === 'enemy') ? p.weapon : null, show = wk && wk !== 'fist' ? wk : null;
    if (I.weaponKey !== show) { if (I.weaponObj) I.weaponMount.remove(I.weaponObj); I.weaponObj = show ? weaponModel(show) : null; if (I.weaponObj) I.weaponMount.add(I.weaponObj); I.weaponKey = show; }
    if (p.dead) {
      const f = clamp(p.deadT / 0.45, 0, 1); g.rotation.z = 0; I.body.rotation.z = -f * Math.PI / 2; I.body.position.set(-0.1 * f, f * 0.18, 0); I.torso.rotation.z = 0; g.visible = p.deadT < 11 || Math.floor(G.t * 8) % 2 === 0;
      I.legL.rotation.z = I.legR.rotation.z = 0.1 * f; I.armL.rotation.z = 0.3; I.armR.rotation.z = -0.3;
      continue;
    }
    g.visible = true; I.body.rotation.z = 0; I.body.position.set(0, 0, 0);
    const spd = Math.hypot(p.vx || 0, p.vy || 0), moving = p.moving, ph = p.animT, sw = moving ? Math.sin(ph) : 0, run = (p.state === 'flee' || (p.kind === 'player' && Input.run)) ? 1.4 : 1;
    I.legL.rotation.z = sw * 0.7 * run; I.legR.rotation.z = -sw * 0.7 * run;
    I.armL.rotation.z = -sw * 0.55 * run; I.armR.rotation.z = sw * 0.55 * run;
    I.body.position.y = moving ? Math.abs(Math.cos(ph)) * 0.05 : 0; I.torso.rotation.z = moving ? 0.08 * run : 0; I.torso.rotation.x = moving ? Math.sin(ph) * 0.05 : 0;
    const aimed = show && !WEAPONS[show].melee && (p.kind === 'player' ? (Input.rmb || Input.fire || p.swing > 0 || p.cd > 0.12) : (p.alert || p.swing > 0 || (p.memT > 0)));
    if (aimed) { I.armR.rotation.z = Math.PI / 2 - 0.05; I.armL.rotation.z = show === 'pistol' ? 0.2 : Math.PI / 2 - 0.4; if (show !== 'pistol') I.armL.rotation.x = 0.0; }
    else I.armL.rotation.x = 0;
    if (p.swing > 0 && (!show || WEAPONS[show].melee)) { const f = 1 - clamp(p.swing / 0.22, 0, 1); I.armR.rotation.z = show === 'bat' ? 2.6 - f * 3.4 : Math.PI / 2 * Math.sin(f * Math.PI); }
    if (show === 'bat' && !(p.swing > 0)) I.armR.rotation.z = 0.5;
    if (p.state === 'idle' && !p.moving && p.kind === 'civ') { I.head.rotation.y = Math.sin(G.t * 0.7 + p.id) * 0.5; } else I.head.rotation.y = 0;
    if (p.hitT > 0) I.torso.rotation.z = -0.25;
    if (p.swim) { I.body.position.y = -0.5; }
  }
  for (const [id, e] of ents.ped) if (!alive.has(id)) { scene.remove(e.group); ents.ped.delete(id); }
}
function syncPickups() {
  const alive = new Set();
  pickups.forEach((pk, i) => {
    if (pk.hidden || !inRange(pk.x, pk.y, 1500)) return;
    let e = ents.pick.get(pk);
    if (!e) {
      const g = new THREE.Group();
      switch (pk.type) {
        case 'cash': bx(g, 0.5, 0.12, 0.28, 0, 0, 0, stdMat(0x2e7d32, { r: 0.6 })); bx(g, 0.3, 0.14, 0.18, 0, 0, 0, stdMat(0xa5d6a7, { r: 0.6 })); break;
        case 'health': sph(g, 0.3, 0, 0, 0, stdMat(0xfafafa, { r: 0.4 })); bx(g, 0.34, 0.1, 0.1, 0, 0.28, 0, basicMat(0xe53935)); bx(g, 0.1, 0.1, 0.34, 0, 0.28, 0, basicMat(0xe53935)); break;
        case 'armor': bx(g, 0.5, 0.55, 0.2, 0, 0, 0, stdMat(0x1e88e5, { r: 0.4, m: 0.4 })); break;
        case 'ammo': bx(g, 0.5, 0.3, 0.34, 0, 0, 0, lamMat(0x8d6e63)); bx(g, 0.4, 0.06, 0.2, 0, 0.17, 0, basicMat(0xffd54f)); break;
        default: bx(g, 0.7, 0.14, 0.18, 0, 0, 0, lamMat(0x263238)); bx(g, 0.16, 0.3, 0.16, -0.2, -0.2, 0, lamMat(0x263238));
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: pk.type === 'cash' ? 0x66ff88 : pk.type === 'health' ? 0xff6666 : pk.type === 'armor' ? 0x66aaff : 0xffd54f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })); glow.scale.set(2.2, 2.2, 1); g.add(glow);
      e = { group: g }; ents.pick.set(pk, e); scene.add(g);
    }
    alive.add(pk); e.group.position.set(pk.x * U, 0.9 + Math.sin(G.t * 3 + i) * 0.12, pk.y * U); e.group.rotation.y = G.t * 1.5;
  });
  for (const [k, e] of ents.pick) if (!alive.has(k)) { scene.remove(e.group); ents.pick.delete(k); }
}
function parseCol(c) { try { return new THREE.Color(c); } catch (e) { return new THREE.Color(0xffd54a); } }
function syncMarkers() {
  const list = [];
  for (const m of world.markers) list.push({ key: 'm' + m.id, x: m.x, y: m.y, r: m.r, col: m.col, tall: 16, big: false });
  const g = Missions.giverMarker(); if (g) list.push({ key: 'giver', x: g.x, y: g.y, r: g.r, col: g.col, tall: 34, big: true });
  activeBlips().forEach((b, i) => list.push({ key: 'b' + i, x: b.x, y: b.y, r: b.big ? 52 : 28, col: b.col, tall: b.big ? 60 : 36, big: true }));
  const alive = new Set();
  for (const m of list) {
    if (!inRange(m.x, m.y, 2300)) continue;
    let e = ents.marker.get(m.key);
    if (!e || e.col !== m.col) {
      if (e) scene.remove(e.group);
      const col = parseCol(m.col), grp = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.86, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.1;
      grp.add(beam, ring, disc); e = { group: grp, beam, ring, col: m.col }; ents.marker.set(m.key, e); scene.add(grp);
    }
    alive.add(m.key);
    const r = m.r * U * (1 + Math.sin(G.t * 3) * 0.05);
    e.group.position.set(m.x * U, 0, m.y * U); e.beam.scale.set(r * 0.5, m.tall, r * 0.5); e.beam.position.y = m.tall / 2; e.ring.scale.set(r, r, r); e.group.children[2].scale.set(r, r, r);
  }
  for (const [k, e] of ents.marker) if (!alive.has(k)) { scene.remove(e.group); ents.marker.delete(k); }
}
function syncBombs() {
  while (ents.bomb.length < bombs.length) { const m = sph(scene, 0.14, 0, 0, 0, lamMat(0x111111)); ents.bomb.push(m); }
  ents.bomb.forEach((m, i) => { const b = bombs[i]; m.visible = !!b; if (b) m.position.set(b.x * U, 0.2 + (b.h || 0) * 0.1, b.y * U); });
}
function updateEffects(dt) {
  // particles
  const sm = sharedMats.smoke, fi = sharedMats.fire; let ns = 0, nf = 0;
  const sp = sm.geometry.attributes, fp = fi.geometry.attributes, scale = cam.h * 0.5 / Math.tan(camera3.fov * Math.PI / 360);
  sm.material.uniforms.scale.value = scale; fi.material.uniforms.scale.value = scale;
  let skn = 0, flash = null; const skid = sharedMats.skid;
  for (const p of parts) {
    const f = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'skid') { if (skn < 400) { skid.setMatrixAt(skn++, compose(p.x * U, 0.09, p.y * U, 0.7, 1, 0.24 * Math.min(1, f * 3), -p.a)); } continue; }
    if (!inRange(p.x, p.y, 1500)) continue;
    const isSmoke = p.kind === 'smoke', A = isSmoke ? sp : fp, i = isSmoke ? ns++ : nf++; if (i > 880) continue;
    let y = 1, a = f, r = 1, g = 1, b = 1, sz = p.size * U * 2;
    if (isSmoke) { y = 1.2 + (1 - f) * 3.5; const c = _col.set(p.col); r = c.r; g = c.g; b = c.b; a = f * 0.55; }
    else if (p.kind === 'fire') { y = 0.9 + (1 - f) * 1.6; const c = _col.set(p.col); r = c.r; g = c.g; b = c.b; sz *= 1.5 * (0.4 + f * 0.6); a = f * 0.9; }
    else if (p.kind === 'spark') { y = 1 + (1 - f) * 0.2 - (1 - f) * (1 - f) * 0.8; const c = _col.set(p.col); r = c.r; g = c.g; b = c.b; sz = 0.14; a = f; }
    else if (p.kind === 'flash') { y = 1.3; r = 1; g = 0.9; b = 0.6; sz = 1.8; a = f; flash = p; }
    else { y = 0.15; sz = p.size * U * 2; a = f * 0.5; }
    A.position.setXYZ(i, p.x * U, y, p.y * U); A.pcolor.setXYZW(i, r, g, b, a); A.size.setX(i, Math.max(sz, 0.02));
  }
  sm.geometry.setDrawRange(0, ns); fi.geometry.setDrawRange(0, nf);
  for (const a of [sp, fp]) { a.position.needsUpdate = true; a.pcolor.needsUpdate = true; a.size.needsUpdate = true; }
  skid.count = skn; skid.instanceMatrix.needsUpdate = true;
  const ml = sharedMats.muzzle; if (flash) { ml.position.set(flash.x * U, 1.4, flash.y * U); ml.intensity = 2.5; } else ml.intensity = 0;
  // bullets
  const bp = sharedMats.bullets.geometry.attributes.position; let nb = 0;
  for (const b of bullets) { if (nb >= 1200) break; bp.setXYZ(nb * 2, (b.x - b.vx * 0.03) * U, 1.25, (b.y - b.vy * 0.03) * U); bp.setXYZ(nb * 2 + 1, b.x * U, 1.25, b.y * U); nb++; }
  sharedMats.bullets.geometry.setDrawRange(0, nb * 2); bp.needsUpdate = true;
  // explosions
  let best = null, bi = 0;
  sharedMats.expl.forEach((m, i) => {
    const e = explosions[i]; m.visible = !!e; if (!e) return; const f = e.t / e.max, r = e.r * U * (0.5 + f * 1.1);
    m.position.set(e.x * U, 1.4, e.y * U); m.scale.set(r, r * 0.8, r); m.material.opacity = (1 - f) * 0.8; if (!best || f < best.t / best.max) { best = e; }
  });
  sharedMats.explLight.intensity = best ? 6 * (1 - best.t / best.max) : 0; if (best) sharedMats.explLight.position.set(best.x * U, 4, best.y * U);
  // rain
  const rain = G.rain, rl = sharedMats.rain; rl.visible = rain > 0.03;
  if (rl.visible) {
    const pos = rl.geometry.attributes.position, n = Math.floor(700 * rain), P = sharedMats.rainP;
    for (let i = 0; i < 700; i++) {
      const q = P[i]; q.y -= dt * 28; if (q.y < 0) { q.y += 25; q.x = rand(-30, 30); q.z = rand(-30, 30); }
      if (i < n) { pos.setXYZ(i * 2, camera3.position.x + q.x, q.y, camera3.position.z + q.z); pos.setXYZ(i * 2 + 1, camera3.position.x + q.x - 0.15, q.y + 0.9, camera3.position.z + q.z - 0.05); } else { pos.setXYZ(i * 2, 0, -50, 0); pos.setXYZ(i * 2 + 1, 0, -50, 0); }
    }
    pos.needsUpdate = true; rl.material.opacity = 0.18 + rain * 0.25;
  }
}
// signal heads near the camera
function syncTrafficLights() {
  const tl = sharedMats.tl, near = [];
  const ci = Math.round((cam.x / TS - 2.5) / PER), cj = Math.round((cam.y / TS - 2.5) / PER);
  for (let j = Math.max(0, cj - 2); j <= Math.min(NJ - 1, cj + 2); j++) for (let i = Math.max(0, ci - 2); i <= Math.min(NI - 1, ci + 2); i++) near.push(j * NI + i);
  let idx = 0;
  for (const n of near) {
    const cx = nodeX(n % NI), cy = nodeY(Math.floor(n / NI));
    for (const [sx, sy, ax] of [[-1, -1, 0], [1, 1, 0], [-1, 1, 1], [1, -1, 1]]) {
      let h = tl.pool[idx];
      if (!h) {
        const g = new THREE.Group(); cyl(g, 0.08, 5, 0, 2.5, 0, sharedMats.pole); bx(g, 0.35, 1.0, 0.35, 0, 5.0, 0, BLACK);
        const lamps = [0, 1, 2].map(k => { const m = new THREE.Mesh(SPHG, tl.off); m.scale.set(0.12, 0.12, 0.12); m.position.set(0.0, 5.35 - k * 0.32, 0.19); g.add(m); const m2 = m.clone(); m2.position.z = -0.19; g.add(m2); return [m, m2]; });
        h = { g, lamps }; tl.pool.push(h); scene.add(g);
      }
      idx++;
      h.g.position.set((cx + sx * 76) * U, 0, (cy + sy * 76) * U); h.g.rotation.y = ax === 0 ? 0 : Math.PI / 2; h.g.visible = true;
      const s = signal(n, ax), on = s === 2 ? 0 : s === 1 ? 1 : 2;
      h.lamps.forEach((pair, k) => { const m = k === on ? tl.mats[k] : tl.off; pair[0].material = m; pair[1].material = m; });
    }
  }
  for (let i = idx; i < tl.pool.length; i++) tl.pool[i].g.visible = false;
}

// ------------------------------------------------------------------ camera
function camClip(tx, ty, tz, cx, cy, cz) {
  const n = 14;
  for (let i = 1; i <= n; i++) {
    const f = i / n, x = tx + (cx - tx) * f, y = ty + (cy - ty) * f, z = tz + (cz - tz) * f;
    const tX = Math.floor(x * 10 / TS), tY = Math.floor(z * 10 / TS);
    if (tX < 0 || tY < 0 || tX >= COLS || tY >= ROWS) continue;
    const h = bh3d[tY * COLS + tX]; if (h > 0 && y < h + 0.3) return Math.max(0.12, (i - 1.5) / n);
  }
  return 1;
}
function updateCamera3D(dt) {
  const v = player.veh, pp = playerPos();
  if (G.mode === 'title') {
    const t = performance.now() / 1000; cam.yaw += dt * 0.03;
    const cxm = (4300 + Math.sin(t * 0.045) * 1100) * U, czm = (2350 + Math.cos(t * 0.031) * 450) * U;
    camera3.position.set(cxm - Math.cos(cam.yaw) * 40, 26, czm - Math.sin(cam.yaw) * 40); camera3.lookAt(cxm, 4, czm); cam.x = cxm / U; cam.y = czm / U;
    camera3.fov = 62; camera3.updateProjectionMatrix(); return;
  }
  const aiming = Input.rmb && !v && !player.dead;
  const speed = v ? Math.hypot(v.vx, v.vy) : 0;
  if (v && G.t - cam.lastLook > 1.2) { cam.yaw += angDiff(cam.yaw, v.a) * Math.min(1, dt * 2.2); cam.pitch += (0.3 - cam.pitch) * Math.min(1, dt * 1.5); }
  const tdist = v ? v.l * U * 0.5 + 7.6 + speed * U * 0.07 : (aiming ? 2.7 : 4.7);
  cam.dist += (tdist - cam.dist) * Math.min(1, dt * 4);
  let tx = pp.x * U, tz = pp.y * U, ty = v ? 1.5 + v.def.w * 0.02 : (aiming ? 1.55 : 1.45);
  if (aiming) { tx += -Math.sin(cam.yaw) * 0.55; tz += Math.cos(cam.yaw) * 0.55; }
  if (player.dead) ty = 0.8;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  let ex = tx - Math.cos(cam.yaw) * cp * cam.dist, ey = ty + sp * cam.dist, ez = tz - Math.sin(cam.yaw) * cp * cam.dist;
  const f = camClip(tx, ty, tz, ex, ey, ez); ex = tx + (ex - tx) * f; ey = ty + (ey - ty) * f; ez = tz + (ez - tz) * f; ey = Math.max(ey, 0.6);
  const sh = G.shake * 0.02; if (sh > 0.001) { ex += (Math.random() - 0.5) * sh; ey += (Math.random() - 0.5) * sh; ez += (Math.random() - 0.5) * sh; }
  camera3.position.set(ex, ey, ez);
  camera3.lookAt(tx + Math.cos(cam.yaw) * 8, ty - sp * 3 + (aiming ? 0.2 : 0.5), tz + Math.sin(cam.yaw) * 8);
  const tf = 60 + clamp(speed / 420, 0, 1) * 14 - (aiming ? 12 : 0); cam.fov += (tf - cam.fov) * Math.min(1, dt * 3);
  if (Math.abs(camera3.fov - cam.fov) > 0.05) { camera3.fov = cam.fov; camera3.updateProjectionMatrix(); }
  cam.x = pp.x; cam.y = pp.y;
}

// ------------------------------------------------------------------ lighting & sky
function updateLighting(dt) {
  const h = G.dayMin / 60, day = daylight(), rain = G.rain, night = 1 - day;
  const dayC = new THREE.Color(0x8cc4ee), duskC = new THREE.Color(0xff9a5a), nightC = new THREE.Color(0x070b20), rainC = new THREE.Color(0x76848f);
  const sky = nightC.clone().lerp(dayC, day); const warm = 1 - Math.abs(2 * day - 1); if (day > 0 && day < 1) sky.lerp(duskC, warm * 0.55);
  sky.lerp(rainC.clone().multiplyScalar(0.3 + 0.7 * day), rain * 0.65);
  scene.background.copy(sky); scene.fog.color.copy(sky); scene.fog.near = 60 - rain * 25; scene.fog.far = 200 - rain * 80 - night * 20;
  const el = Math.PI * (h - 6) / 12, below = el < 0 || el > Math.PI, e2 = below ? Math.abs(Math.sin(el)) : Math.sin(el);
  const az = 0.9, dir = new THREE.Vector3(Math.cos(az) * Math.cos(Math.max(0.25, Math.asin(Math.min(1, e2)))), Math.max(0.25, e2), Math.sin(az) * Math.cos(Math.max(0.25, Math.asin(Math.min(1, e2)))));
  const tgt = camera3.position; const snap = 1.5;
  const tx = Math.round(cam.x * U / snap) * snap, tz = Math.round(cam.y * U / snap) * snap;
  sunLight.target.position.set(tx, 0, tz); sunLight.position.set(tx + dir.x * 160, dir.y * 160, tz + dir.z * 160);
  const sunCol = new THREE.Color(0xfff1d6).lerp(new THREE.Color(0xffa860), warm * 0.8); const moon = new THREE.Color(0x7d93d6);
  sunLight.color.copy(day > 0.3 ? sunCol : moon); sunLight.intensity = (day * 0.62 + (1 - day) * 0.22) * (1 - rain * 0.5);
  hemi.intensity = 0.2 + 0.2 * day - rain * 0.08; hemi.color.copy(sky.clone().lerp(new THREE.Color(0xffffff), 0.35)); hemi.groundColor.set(day > 0.3 ? 0x6b6a5a : 0x1a1d2a);
  const env = 0.03 + 0.15 * day; _mc.forEach(m => { if (m.isMeshStandardMaterial) m.envMapIntensity = env; });
  sharedMats.wall.emissiveIntensity = night * 1.25; sharedMats.glow.opacity = clamp(night * 1.4, 0, 0.9); sharedMats.pool.opacity = clamp(night * 0.55, 0, 0.5);
  sharedMats.water.opacity = 0.35 + day * 0.45; sharedMats.water.map.offset.set((G.t * 0.012) % 1, (G.t * 0.007) % 1);
  for (const e of chunks3.values()) e.group.userData.gm.roughness = 0.92 - rain * 0.45;
  if (sharedMats.lhPivs) for (const p of sharedMats.lhPivs) { p.visible = night > 0.35; p.rotation.y = G.t * 0.9; }
  // headlights of the player's vehicle
  const v = player.veh, hl = sharedMats.headL;
  if (v && night > 0.3 && !v.wreck) {
    const c = Math.cos(v.a), s = Math.sin(v.a);
    hl.forEach((sp, i) => { const side = i ? 1 : -1, px = v.x * U + c * v.l * U * 0.45 - s * side * v.w * U * 0.28, pz = v.y * U + s * v.l * U * 0.45 + c * side * v.w * U * 0.28; sp.position.set(px, 0.8, pz); sp.target.position.set(px + c * 25, 0, pz + s * 25); sp.intensity = 1.8 * night; });
  } else hl.forEach(sp => sp.intensity = 0);
  // plane at the airport
  const T0 = (G.t % 80) / 80, pl = sharedMats.plane; const px = lerp(3 * TS, 38 * TS, T0) * U; const lift = Math.max(0, (T0 - 0.55)) * 90;
  pl.position.set(px, 0.15 + lift, 94.5 * TS * U); pl.rotation.z = lift > 0 ? 0.25 : 0; pl.visible = inRange(px / U, 94.5 * TS, 2200);
}

// ------------------------------------------------------------------ overlay (labels, bubbles, crosshair)
function drawOverlay3D() {
  const w = cam.w, h = cam.h; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  if (G.mode === 'title' || G.mode === 'map') return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const list = world.markers.slice(); const g = Missions.giverMarker(); if (g) list.push(g);
  for (const m of list) {
    if (dist(m.x, m.y, cam.x, cam.y) > 520) continue; const s = worldToScreen(m.x, m.y, 5); if (!s.vis) continue;
    ctx.font = 'bold 22px ' + TAMIL_FONT; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = '#fff'; ctx.strokeText(m.icon || '?', s.x, s.y - 14); ctx.fillText(m.icon || '?', s.x, s.y - 14);
    ctx.font = 'bold 13px ' + TAMIL_FONT; ctx.strokeText(m.label, s.x, s.y + 6); ctx.fillText(m.label, s.x, s.y + 6);
  }
  for (const b of activeBlips()) {
    const s = worldToScreen(b.x, b.y, b.big ? 7 : 4); if (!s.vis || !b.label) continue; ctx.font = 'bold 13px ' + TAMIL_FONT; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = '#fff'; ctx.strokeText(b.label, s.x, s.y); ctx.fillText(b.label, s.x, s.y);
  }
  for (const p of peds) {
    if (p.dead || dist(p.x, p.y, cam.x, cam.y) > 420) continue;
    if (p.bubble) {
      const s = worldToScreen(p.x, p.y, 2.2); if (!s.vis) continue;
      ctx.font = 'bold 12px ' + TAMIL_FONT; const tw = ctx.measureText(p.bubble.text).width + 12;
      ctx.fillStyle = 'rgba(255,255,255,.94)'; rrect(ctx, s.x - tw / 2, s.y - 22, tw, 20, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 3); ctx.lineTo(s.x + 4, s.y - 3); ctx.lineTo(s.x, s.y + 4); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillText(p.bubble.text, s.x, s.y - 11);
    }
    if (p.kind === 'enemy' && p.alert) {
      const s = worldToScreen(p.x, p.y, 2.15); if (!s.vis) continue; const bw = p.isBoss ? 60 : 30;
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(s.x - bw / 2 - 1, s.y - 5, bw + 2, 6); ctx.fillStyle = p.isBoss ? '#ffd54a' : '#e53935'; ctx.fillRect(s.x - bw / 2, s.y - 4, bw * clamp(p.hp / p.maxhp, 0, 1), 4);
    }
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const q = popups[i]; q.t += 0.016; if (q.t > 1.8) { popups.splice(i, 1); continue; }
    const s = worldToScreen(q.x, q.y, 1.8 + q.t * 1.4); if (!s.vis) continue;
    ctx.globalAlpha = clamp(1.8 - q.t, 0, 1); ctx.font = 'bold 18px sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(q.text, s.x, s.y); ctx.fillStyle = q.col; ctx.fillText(q.text, s.x, s.y); ctx.globalAlpha = 1;
  }
  // crosshair
  if (G.mode === 'play' && !player.dead && (!player.veh || WEAPONS[player.weapon] && !WEAPONS[player.weapon].melee && player.weapon !== 'fist')) {
    const wp = WEAPONS[player.weapon], gun = wp && !wp.melee;
    if (gun || Input.rmb) { const cx = w / 2, cy = h / 2 - h * 0.02, r = Input.rmb ? 9 : 14; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(cx + dx * r, cy + dy * r); ctx.lineTo(cx + dx * (r + 7), cy + dy * (r + 7)); } ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1, cy - 1, 2, 2); }
  }
}

// ------------------------------------------------------------------ main render
let _chunkBudget = 0;
function manageChunks() {
  const pcx = Math.floor(cam.x / CHP), pcy = Math.floor(cam.y / CHP), R = 3; let built = 0;
  const want = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const cx = pcx + dx, cy = pcy + dy; if (cx < 0 || cy < 0 || cx >= CHX || cy >= CHY) continue;
    const dd = Math.hypot((cx + 0.5) * CHP - cam.x, (cy + 0.5) * CHP - cam.y); if (dd > 2050) continue; want.push([cx, cy, dd]);
  }
  want.sort((a, b) => a[2] - b[2]);
  for (const [cx, cy] of want) {
    const k = cy * 64 + cx; let e = chunks3.get(k);
    if (e) { e.last = frameNo; continue; }
    if (built >= _chunkBudget) continue;
    e = buildChunk3D(cx, cy); e.last = frameNo; chunks3.set(k, e); scene.add(e.group); built++;
  }
  for (const [k, e] of chunks3) if (frameNo - e.last > 90) { disposeChunk(e); chunks3.delete(k); }
}
function renderWorld() {
  frameNo++; _chunkBudget = frameNo < 3 ? 40 : 1;
  const dt = Math.min(0.05, Math.max(0.001, G.dtReal || 0.016));
  manageChunks(); updateLighting(dt);
  syncVehicles(dt); syncPeds(dt); syncPickups(); syncMarkers(); syncBombs(); updateEffects(dt); syncTrafficLights();
  renderer.render(scene, camera3);
  drawOverlay3D();
}
