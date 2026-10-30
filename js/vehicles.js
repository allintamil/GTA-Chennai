'use strict';
// ===================================================================
//  VEHICLES – physics, sprites, traffic + pursuit AI
// ===================================================================
const VDEF = {
  auto:   { name: 'Auto Rickshaw', l: 40, w: 26, max: 265, accel: 330, brake: 620, drag: 0.5, grip: 5.5, turn: 3.0, hp: 420, mass: 0.7, colors: ['#fbc02d', '#fdd835', '#ffb300'], horn: 1.3 },
  cab:    { name: 'Classic Cab', l: 62, w: 30, max: 340, accel: 340, brake: 640, drag: 0.4, grip: 4.8, turn: 2.4, hp: 800, mass: 1.1, colors: ['#1c1c1c'], horn: 1.0 },
  hatch:  { name: 'City Hatchback', l: 54, w: 28, max: 375, accel: 400, brake: 700, drag: 0.4, grip: 5.2, turn: 2.6, hp: 700, mass: 1.0, colors: ['#f2f2f2', '#c0c4c9', '#c62828', '#1565c0', '#ffd54f', '#2e7d32', '#6d4c41'], horn: 1.1 },
  suv:    { name: 'Rowdy SUV', l: 66, w: 33, max: 415, accel: 430, brake: 700, drag: 0.4, grip: 4.6, turn: 2.2, hp: 1400, mass: 1.6, colors: ['#15171a', '#f2f2f2', '#37474f'], horn: 0.8 },
  police: { name: 'Police Jeep', l: 62, w: 31, max: 445, accel: 470, brake: 760, drag: 0.4, grip: 5.2, turn: 2.5, hp: 1000, mass: 1.3, colors: ['#f4f4f4'], horn: 1.0 },
  bus:    { name: 'MTC Bus', l: 132, w: 38, max: 230, accel: 190, brake: 420, drag: 0.35, grip: 3.6, turn: 1.35, hp: 3000, mass: 5, colors: ['#1e5fa8', '#c62828', '#2e7d32'], horn: 0.55 },
  bike:   { name: 'Thunder Bullet', l: 38, w: 15, max: 455, accel: 560, brake: 760, drag: 0.4, grip: 6.5, turn: 3.4, hp: 300, mass: 0.35, colors: ['#37474f', '#b71c1c', '#1a237e', '#33691e'], horn: 1.6 },
  lorry:  { name: 'Lorry', l: 112, w: 40, max: 215, accel: 170, brake: 400, drag: 0.35, grip: 3.4, turn: 1.25, hp: 3500, mass: 6, colors: ['#ef6c00', '#2e7d32', '#1565c0', '#c62828'], horn: 0.5 },
};
for (const k in VDEF) {
  const d = VDEF[k]; d.r = d.w / 2 * 0.92; const n = Math.max(2, Math.round(d.l / (d.w * 0.9)));
  d.offs = []; for (let i = 0; i < n; i++) d.offs.push(-(d.l / 2 - d.r) + (d.l - 2 * d.r) * i / (n - 1));
}
const TRAFFIC_MIX = [['hatch', 28], ['auto', 25], ['bike', 16], ['cab', 9], ['bus', 7], ['suv', 6], ['lorry', 5], ['police', 4]];
function pickTrafficType() {
  let r = Math.random() * 100; for (const [t, w] of TRAFFIC_MIX) { if ((r -= w) < 0) return t; } return 'hatch';
}

// ---------------------------------------------------------------- sprites
const spriteCache = new Map();
function vehSprite(type, col, shirt, wreck) {
  const key = type + '|' + col + '|' + (shirt || '') + (wreck ? 'W' : '');
  let sp = spriteCache.get(key); if (sp) return sp;
  const d = VDEF[type], S = 2, cw = (d.l + 14) * S, ch = (d.w + 14) * S;
  sp = document.createElement('canvas'); sp.width = cw; sp.height = ch;
  const c = sp.getContext('2d'); c.scale(S, S); c.translate((d.l + 14) / 2, (d.w + 14) / 2);
  const bc = wreck ? '#2a2724' : col;
  ({ auto: drawAuto, bike: drawBike, bus: drawBus, lorry: drawLorry })[type] ? ({ auto: drawAuto, bike: drawBike, bus: drawBus, lorry: drawLorry })[type](c, d, bc, shirt, wreck) : drawCar(c, d, type, bc, wreck);
  if (wreck) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-d.l / 2, -d.w / 2, d.l, d.w); }
  spriteCache.set(key, sp); return sp;
}
function wheelAt(c, x, y, w, h) { c.fillStyle = '#0d0d0d'; c.fillRect(x - w / 2, y - h / 2, w, h); }
function drawCar(c, d, type, col, wreck) {
  const l = d.l, w = d.w, hl = l / 2, hw = w / 2;
  c.fillStyle = 'rgba(0,0,0,.28)'; rrect(c, -hl + 3, -hw + 4, l, w - 1, 7); c.fill();
  for (const sy of [-1, 1]) for (const fx of [-0.3, 0.3]) wheelAt(c, fx * l, sy * (hw - 0.5), l * 0.17, 5);
  c.fillStyle = col; rrect(c, -hl, -hw + 1.5, l, w - 3, type === 'suv' ? 6 : 8); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.stroke();
  const roof = type === 'cab' ? '#f9c32b' : type === 'police' ? '#f4f4f4' : shade(col.length === 7 ? col : '#888888', 14);
  // hood / trunk shading
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(hl * 0.45, -hw + 3, hl * 0.5, w - 6);
  // glass
  const gl = '#16222e';
  c.fillStyle = gl; c.beginPath(); c.moveTo(l * 0.22, -hw + 2.5); c.lineTo(l * 0.13, -hw + 4.5); c.lineTo(l * 0.13, hw - 4.5); c.lineTo(l * 0.22, hw - 2.5); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-l * 0.14, -hw + 4.5); c.lineTo(-l * 0.24, -hw + 3); c.lineTo(-l * 0.24, hw - 3); c.lineTo(-l * 0.14, hw - 4.5); c.closePath(); c.fill();
  c.fillStyle = roof; rrect(c, -l * 0.14, -hw + 3, l * 0.27, w - 6, 3); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.stroke();
  if (type === 'cab') { c.fillStyle = '#111'; c.fillRect(-4, -4, 8, 8); c.fillStyle = '#ffeb3b'; c.fillRect(-3, -3, 6, 6); }
  if (type === 'police') {
    c.fillStyle = '#1e56c8'; c.fillRect(-hl + 4, -hw + 1.5, l - 8, 4); c.fillRect(-hl + 4, hw - 5.5, l - 8, 4); c.fillRect(hl * 0.45, -2, hl * 0.45, 4);
    c.fillStyle = '#e53935'; c.fillRect(-4, -9, 8, 5); c.fillStyle = '#1e88e5'; c.fillRect(-4, 4, 8, 5);
  }
  if (type === 'suv') { c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.4; c.strokeRect(-l * 0.13, -hw + 5, l * 0.25, w - 10); }
  // mirrors
  c.fillStyle = shade(col.length === 7 ? col : '#888888', -30); c.fillRect(l * 0.2, -hw - 1.5, 3, 3); c.fillRect(l * 0.2, hw - 1.5, 3, 3);
  // lights
  c.fillStyle = '#fffbd0'; c.fillRect(hl - 3, -hw + 2.5, 3, 5); c.fillRect(hl - 3, hw - 7.5, 3, 5);
  c.fillStyle = '#ff2a1a'; c.fillRect(-hl, -hw + 2.5, 2.5, 5); c.fillRect(-hl, hw - 7.5, 2.5, 5);
}
function drawAuto(c, d, col, shirt, wreck) {
  const l = d.l, w = d.w, hl = l / 2, hw = w / 2;
  c.fillStyle = 'rgba(0,0,0,.28)'; rrect(c, -hl + 3, -hw + 4, l - 2, w - 2, 7); c.fill();
  wheelAt(c, hl * 0.62, 0, 8, 4.5); wheelAt(c, -hl * 0.45, -hw + 1, 8, 4.5); wheelAt(c, -hl * 0.45, hw - 1, 8, 4.5);
  c.fillStyle = wreck ? col : '#1f2a24'; rrect(c, -hl + 1, -hw + 2, l - 4, w - 4, 6); c.fill();
  c.fillStyle = col; rrect(c, -hl, -hw + 1, l * 0.68, w - 2, 7); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.moveTo(-hl + 4, -hw + 5); c.lineTo(hl * 0.36, -hw + 5); c.moveTo(-hl + 4, hw - 5); c.lineTo(hl * 0.36, hw - 5); c.stroke();
  c.fillStyle = '#16222e'; c.fillRect(hl * 0.36, -hw + 4, 3, w - 8);
  c.fillStyle = '#1f2a24'; c.beginPath(); c.moveTo(hl * 0.4, -hw + 5); c.lineTo(hl - 1, -3); c.lineTo(hl - 1, 3); c.lineTo(hl * 0.4, hw - 5); c.fill();
  c.strokeStyle = '#999'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hl * 0.42, -hw + 2); c.lineTo(hl * 0.4, hw - 2); c.stroke();
  c.fillStyle = '#fffbd0'; c.beginPath(); c.arc(hl - 1.5, 0, 2.3, 0, TAU); c.fill();
  c.fillStyle = '#ff2a1a'; c.fillRect(-hl, -hw + 3, 2, 4); c.fillRect(-hl, hw - 7, 2, 4);
  c.fillStyle = '#c62828'; c.fillRect(-hl + 4, -2, 9, 4);
}
function drawBike(c, d, col, shirt, wreck) {
  const l = d.l, hl = l / 2;
  c.fillStyle = 'rgba(0,0,0,.28)'; rrect(c, -hl + 2, -3, l, 11, 5); c.fill();
  wheelAt(c, hl * 0.72, 0, 9, 3.5); wheelAt(c, -hl * 0.72, 0, 9, 3.5);
  c.fillStyle = '#222'; rrect(c, -hl * 0.65, -2.6, l * 0.62, 5.2, 2.5); c.fill();
  c.fillStyle = col; c.beginPath(); c.ellipse(hl * 0.12, 0, 6.5, 4.4, 0, 0, TAU); c.fill();
  c.strokeStyle = '#ccc'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hl * 0.3, -6.8); c.lineTo(hl * 0.3, 6.8); c.stroke();
  c.fillStyle = '#fffbd0'; c.beginPath(); c.arc(hl - 1.5, 0, 2, 0, TAU); c.fill();
  c.fillStyle = '#ff2a1a'; c.fillRect(-hl, -1.2, 2, 2.4);
  if (shirt) { // rider
    c.fillStyle = shirt; c.beginPath(); c.ellipse(-hl * 0.08, 0, 4.2, 7.2, 0, 0, TAU); c.fill();
    c.fillStyle = '#8d5524'; c.beginPath(); c.arc(hl * 0.04, -7, 1.9, 0, TAU); c.arc(hl * 0.04, 7, 1.9, 0, TAU); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(hl * 0.02, 0, 4.4, 0, TAU); c.fill(); c.fillStyle = '#e53935'; c.fillRect(hl * 0.02 - 1, -4, 2, 8);
  }
}
function drawBus(c, d, col, shirt, wreck) {
  const l = d.l, w = d.w, hl = l / 2, hw = w / 2;
  c.fillStyle = 'rgba(0,0,0,.3)'; rrect(c, -hl + 4, -hw + 5, l, w - 1, 6); c.fill();
  for (const sy of [-1, 1]) for (const fx of [-0.36, -0.26, 0.32]) wheelAt(c, fx * l, sy * (hw - 0.3), 14, 5);
  c.fillStyle = '#f1f3f4'; rrect(c, -hl, -hw + 1.5, l, w - 3, 6); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.stroke();
  c.fillStyle = col; c.fillRect(-hl + 2, -hw + 2.5, l - 4, 5); c.fillRect(-hl + 2, hw - 7.5, l - 4, 5);
  c.fillStyle = '#dfe3e6'; for (let k = -2; k <= 2; k++) { rrect(c, k * l * 0.15 - 8, -5, 16, 10, 2); c.fill(); }
  c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 1; for (let k = -2; k <= 2; k++) c.strokeRect(k * l * 0.15 - 8, -5, 16, 10);
  c.fillStyle = '#16222e'; c.fillRect(hl - 7, -hw + 3, 5, w - 6);
  c.fillStyle = col; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.save(); c.translate(hl - 18, 0); c.rotate(Math.PI / 2); c.fillText(['29C', '21G', '5E', '27B', '119'][Math.floor(hash2(Math.round(l + w), col.charCodeAt(1)) * 5)], 0, 0); c.restore();
  c.fillStyle = '#fffbd0'; c.fillRect(hl - 2.5, -hw + 3, 2.5, 5); c.fillRect(hl - 2.5, hw - 8, 2.5, 5);
  c.fillStyle = '#ff2a1a'; c.fillRect(-hl, -hw + 3, 2.5, 5); c.fillRect(-hl, hw - 8, 2.5, 5);
}
function drawLorry(c, d, col, shirt, wreck) {
  const l = d.l, w = d.w, hl = l / 2, hw = w / 2;
  c.fillStyle = 'rgba(0,0,0,.3)'; rrect(c, -hl + 4, -hw + 5, l, w - 1, 5); c.fill();
  for (const sy of [-1, 1]) for (const fx of [-0.36, -0.24, 0.3]) wheelAt(c, fx * l, sy * (hw - 0.3), 13, 5);
  c.fillStyle = '#8a6a3a'; c.fillRect(-hl, -hw + 1.5, l * 0.72, w - 3);
  c.fillStyle = '#6d4f28'; c.strokeStyle = '#4b3418'; c.lineWidth = 1.2; c.strokeRect(-hl + 1, -hw + 2.5, l * 0.72 - 2, w - 5);
  c.fillStyle = '#2f6b3a'; c.fillRect(-hl + 4, -hw + 6, l * 0.62, w - 12);
  c.fillStyle = col; rrect(c, hl - l * 0.27, -hw + 1.5, l * 0.27, w - 3, 5); c.fill(); c.stroke();
  c.fillStyle = '#16222e'; c.fillRect(hl - 8, -hw + 4, 5, w - 8);
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(hl - l * 0.25, -hw + 3, l * 0.16, w - 6);
  c.fillStyle = '#fff'; c.font = 'bold 7.5px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HORN OK PLEASE', -hl + 4 + l * 0.31, 0);
  c.fillStyle = col; for (let k = 0; k < 6; k++) c.fillRect(-hl + 6 + k * 10, -hw + 3, 5, 2.5);
  c.fillStyle = '#fffbd0'; c.fillRect(hl - 2.5, -hw + 3, 2.5, 5); c.fillRect(hl - 2.5, hw - 8, 2.5, 5);
  c.fillStyle = '#ff2a1a'; c.fillRect(-hl, -hw + 3, 2.5, 5); c.fillRect(-hl, hw - 8, 2.5, 5);
}

// ---------------------------------------------------------------- creation
let vidCounter = 0;
function makeVehicle(type, x, y, a, o) {
  o = o || {}; const d = VDEF[type];
  const v = {
    id: ++vidCounter, type, def: d, x, y, a, vx: 0, vy: 0, l: d.l, w: d.w, hp: d.hp, maxhp: d.hp,
    col: o.col || pick(d.colors), throttle: 0, steer: 0, steerS: 0, hb: false, driver: null, ai: null,
    wreck: false, burn: 0, fireT: 0, hornT: 0, siren: false, remove: false, age: 0, lastHit: null, shirt: o.shirt || pick(['#c62828', '#1565c0', '#2e7d32', '#6a1b9a', '#f9a825', '#37474f']),
    mission: false, impact: 0, stuckT: 0, revT: 0, free: false,
  };
  vehicles.push(v); return v;
}
function vehCircles(v, out) {
  const c = Math.cos(v.a), s = Math.sin(v.a); out.length = 0;
  for (const o of v.def.offs) out.push({ x: v.x + c * o, y: v.y + s * o, r: v.def.r });
  return out;
}

// ---------------------------------------------------------------- physics
function stepVehicle(v, dt) {
  const d = v.def; let thr = v.throttle, st = v.steer;
  if (v.wreck) { thr = 0; st = 0; v.hb = true; }
  else if (!v.driver) { thr = 0; st = 0; v.hb = true; }
  v.steerS += (st - v.steerS) * Math.min(1, dt * 9);
  const c = Math.cos(v.a), s = Math.sin(v.a);
  let vf = v.vx * c + v.vy * s, vl = -v.vx * s + v.vy * c;
  const tt = tileAtPx(v.x, v.y);
  let surf = 1; if (tt === T.SAND) surf = 0.62; else if (tt === T.GRASS || tt === T.DIRT) surf = 0.78; else if (tt === T.SIDEWALK || tt === T.PLAZA) surf = 0.93;
  const maxF = d.max * surf * (v.boost || 1), maxR = d.max * 0.32 * surf;
  if (thr > 0) { if (vf < 0) vf += d.brake * thr * dt; else vf += d.accel * thr * dt * clamp(1 - vf / maxF, 0, 1); }
  else if (thr < 0) { if (vf > 0) vf -= d.brake * -thr * dt; else vf -= d.accel * 0.6 * -thr * dt * clamp(1 + vf / maxR, 0, 1); }
  vf *= Math.exp(-d.drag * dt * (thr === 0 ? 1.4 : 0.4));
  if (surf < 1) vf *= Math.exp(-(1 - surf) * 2.2 * dt);
  if (vf > maxF) vf -= (vf - maxF) * 3 * dt;
  if (v.hb) vf *= Math.exp(-1.7 * dt);
  const grip = d.grip * (1 - 0.35 * G.rain) * (v.hb ? 0.16 : 1) * (surf < 0.9 ? 0.8 : 1);
  vl *= Math.exp(-grip * dt);
  const sp = Math.abs(vf);
  let sf = clamp(sp / 70, 0, 1) * (1 - 0.55 * clamp(sp / d.max, 0, 1));
  if (v.hb) sf = clamp(sp / 70, 0, 1) * 1.3;
  v.a += v.steerS * d.turn * sf * (vf >= -2 ? 1 : -1) * dt;
  v.vx = c * vf - s * vl; v.vy = s * vf + c * vl;
  v.x += v.vx * dt; v.y += v.vy * dt;
  v.slip = Math.abs(vl); v.fwdSpeed = vf;
  v.age += dt;
  // skid marks + smoke
  if ((v.slip > 95 || (v.hb && sp > 120)) && !v.wreck && Math.random() < dt * 40) {
    for (const sy of [-1, 1]) part('skid', v.x - c * v.l * 0.3 - s * sy * v.w * 0.4, v.y - s * v.l * 0.3 + c * sy * v.w * 0.4, 0, 0, 7, 2.2, '#111', { a: v.a, drag: 1 });
  }
  collideTiles(v);
  if (v.hornT > 0) v.hornT -= dt;
  // damage state effects
  const frac = v.hp / v.maxhp;
  if (!v.wreck) {
    if (frac < 0.38 && Math.random() < dt * 14) part('smoke', v.x + c * v.l * 0.35, v.y + s * v.l * 0.35, rand(-12, 12), rand(-12, 12), rand(.9, 1.6), 5, frac < .2 ? '#222' : '#aaa', { grow: 14, drag: 0.96 });
    if (frac < 0.16) {
      if (Math.random() < dt * 24) part('fire', v.x + c * v.l * 0.3 + rand(-6, 6), v.y + s * v.l * 0.3 + rand(-6, 6), rand(-15, 15), rand(-15, 15), rand(.3, .6), 7, '#ff9a1a', { grow: -6 });
      v.fireT += dt; if (v.fireT > 7) damageVeh(v, 99999, v.lastHit);
    }
  } else {
    v.burn -= dt;
    if (v.burn > 0 && Math.random() < dt * 30) part('fire', v.x + rand(-v.l / 3, v.l / 3), v.y + rand(-v.w / 3, v.w / 3), rand(-10, 10), rand(-20, -5), rand(.4, .8), rand(6, 11), '#ff7a1a', { grow: -8 });
    if (Math.random() < dt * 8) part('smoke', v.x + rand(-10, 10), v.y + rand(-10, 10), rand(-8, 8), rand(-18, -6), rand(1.4, 2.4), 8, '#222', { grow: 14, drag: 0.97 });
  }
}

function collideTiles(v) {
  const c = Math.cos(v.a), s = Math.sin(v.a), r = v.def.r; let maxImp = 0;
  for (const off of v.def.offs) {
    for (let it = 0; it < 2; it++) {
      const px = v.x + c * off, py = v.y + s * off;
      const tx0 = Math.floor((px - r) / TS), tx1 = Math.floor((px + r) / TS), ty0 = Math.floor((py - r) / TS), ty1 = Math.floor((py + r) / TS);
      let any = false;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (!VEH_SOLID[tileAt(tx, ty)]) continue;
        const nx = clamp(px, tx * TS, (tx + 1) * TS), ny = clamp(py, ty * TS, (ty + 1) * TS);
        let dx = px - nx, dy = py - ny; const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        let dd = Math.sqrt(d2), pen;
        if (dd < 1e-3) { dx = px - (tx + 0.5) * TS; dy = py - (ty + 0.5) * TS; dd = Math.hypot(dx, dy) || 1; pen = r + TS / 2 - dd * 0.5; }
        else pen = r - dd;
        dx /= dd; dy /= dd;
        v.x += dx * pen; v.y += dy * pen; any = true;
        const vn = v.vx * dx + v.vy * dy;
        if (vn < 0) {
          v.vx -= 1.25 * vn * dx; v.vy -= 1.25 * vn * dy; maxImp = Math.max(maxImp, -vn);
          const torque = 0.00005 * off * (c * dy - s * dx) * -vn * 1.3;
          v.a += clamp(torque, -0.2, 0.2);
        }
      }
      if (!any) break;
    }
  }
  if (maxImp > 60) {
    v.impact = maxImp;
    if (maxImp > 130) {
      damageVeh(v, (maxImp - 130) * 0.9 * (v.def.mass > 2 ? 0.3 : 1), null);
      if (v.driver === player) { Snd.crash(maxImp / 350); G.shake = Math.max(G.shake, Math.min(10, maxImp / 40)); }
      else if (dist(v.x, v.y, cam.x, cam.y) < 700) Snd.crash(maxImp / 500 * 0.7);
      for (let k = 0; k < 4; k++) part('spark', v.x, v.y, rand(-80, 80), rand(-80, 80), rand(.15, .35), 1.6, '#ffd54a');
      if (v.type === 'bike' && v.driver === player && maxImp > 230) { ejectPlayer(maxImp * 0.07); }
    }
  }
}

const _ca = [], _cb = [];
function vehVsVeh(a, b) {
  const dd = Math.hypot(b.x - a.x, b.y - a.y);
  if (dd > (a.l + b.l) / 2 + 6) return;
  vehCircles(a, _ca); vehCircles(b, _cb);
  let best = null;
  for (const ca of _ca) for (const cb of _cb) {
    const dx = cb.x - ca.x, dy = cb.y - ca.y, d = Math.hypot(dx, dy) || 0.01, pen = ca.r + cb.r - d;
    if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: dx / d, ny: dy / d, x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2, ca, cb };
  }
  if (!best) return;
  const ma = a.def.mass * (a.wreck ? 1.5 : 1), mb = b.def.mass * (b.wreck ? 1.5 : 1), tot = ma + mb;
  const mvA = !(a.wreck && Math.hypot(a.vx, a.vy) < 5) ? mb / tot : 0.35;
  a.x -= best.nx * best.pen * (mb / tot); a.y -= best.ny * best.pen * (mb / tot);
  b.x += best.nx * best.pen * (ma / tot); b.y += best.ny * best.pen * (ma / tot);
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * best.nx + rvy * best.ny;
  if (vn < 0) {
    const j = -(1.35) * vn / (1 / ma + 1 / mb);
    a.vx -= j * best.nx / ma; a.vy -= j * best.ny / ma; b.vx += j * best.nx / mb; b.vy += j * best.ny / mb;
    const imp = -vn;
    // yaw nudge so cars spin off each other
    const ta = 0.00004 * ((best.ca.x - a.x) * best.ny - (best.ca.y - a.y) * best.nx) * imp * (mb / tot);
    const tb = 0.00004 * ((best.cb.x - b.x) * best.ny - (best.cb.y - b.y) * best.nx) * imp * (ma / tot);
    a.a += clamp(ta, -0.2, 0.2); b.a += clamp(tb, -0.2, 0.2);
    if (imp > 70) {
      damageVeh(a, (imp - 70) * 0.8 * Math.sqrt(mb / ma), b.driver === player ? player : b);
      damageVeh(b, (imp - 70) * 0.8 * Math.sqrt(ma / mb), a.driver === player ? player : a);
      for (let k = 0; k < 3; k++) part('spark', best.x, best.y, rand(-90, 90), rand(-90, 90), rand(.15, .3), 1.5, '#ffe082');
      if (a.driver === player || b.driver === player) { Snd.crash(imp / 300); G.shake = Math.max(G.shake, Math.min(9, imp / 45)); }
      else if (dist(a.x, a.y, cam.x, cam.y) < 700) Snd.crash(imp / 450 * 0.6);
      // NPC panic
      for (const v of [a, b]) if (v.ai && v.ai.mode === 'traffic') v.ai.angry = 3;
      if ((a.driver === player || b.driver === player) && (a.ai || b.ai)) { const other = a.driver === player ? b : a; if (other.ai && other.type === 'police') crime('hitcop', other.x, other.y); }
    }
  }
}

function damageVeh(v, amt, src) {
  if (v.wreck || amt <= 0) return;
  if (src) v.lastHit = src;
  v.hp -= amt;
  if (v.hp <= 0) explodeVeh(v, src || v.lastHit);
}
function explodeVeh(v, src) {
  if (v.wreck) return;
  v.hp = 0; v.wreck = true; v.burn = 18; v.boost = 1;
  if (v.mission && typeof Missions !== 'undefined') Missions.vehDestroyed(v, src);
  explode(v.x, v.y, 70 + v.l * 0.5, 140, src, v);
  if (v.driver === player) { ejectPlayer(0); hurtPlayer(55, { kind: 'explosion' }); }
  v.driver = null; v.ai = null; v.siren = false;
  v.vx *= 0.3; v.vy *= 0.3;
  v.a += rand(-0.4, 0.4);
  if (src === player || (src && src.kind === 'player')) { crime('explode', v.x, v.y); G.stats.hits++; }
}

// ---------------------------------------------------------------- AI helpers
function signal(n, axis) { // 0 green 1 yellow 2 red   (axis 0 = east/west, 1 = north/south)
  const t = (G.t + n * 3.7) % 24;
  if (axis === 0) return t < 10 ? 0 : t < 12 ? 1 : 2;
  return t < 12 ? 2 : t < 22 ? 0 : 1;
}
const _near = [], _nearP = [];
function aheadObstacle(v, look, half) {
  const c = Math.cos(v.a), s = Math.sin(v.a); let best = null, bf = 1e9;
  vgrid.query(v.x + c * look * 0.5, v.y + s * look * 0.5, look * 0.5 + 70, _near);
  for (const o of _near) {
    if (o === v) continue;
    const dx = o.x - v.x, dy = o.y - v.y, f = dx * c + dy * s, l = -dx * s + dy * c;
    if (f > 0 && f < look + o.l / 2 + v.l / 2 && Math.abs(l) < half + o.w / 2 && f < bf) { bf = f; best = o; }
  }
  pgrid.query(v.x + c * look * 0.5, v.y + s * look * 0.5, look * 0.5 + 40, _nearP);
  for (const p of _nearP) {
    if (p.dead || p.veh) continue;
    const dx = p.x - v.x, dy = p.y - v.y, f = dx * c + dy * s, l = -dx * s + dy * c;
    if (f > 0 && f < look + v.l / 2 && Math.abs(l) < half + 6 && f < bf) { bf = f; best = p; }
  }
  return best ? { o: best, f: bf } : null;
}
function steerToward(v, tx, ty, strength) {
  const want = Math.atan2(ty - v.y, tx - v.x), diff = angDiff(v.a, want);
  v.steer = clamp(diff * (strength || 2.2), -1, 1); return diff;
}
function pickNextDir(n, dir) {
  const opts = [], w = [];
  for (const [off, wt] of [[0, 0.62], [1, 0.19], [3, 0.19]]) { const d = (dir + off) % 4; if (neighbor(n, d) >= 0) { opts.push(d); w.push(wt); } }
  if (!opts.length) { const d = (dir + 2) % 4; return neighbor(n, d) >= 0 ? d : dir; }
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < opts.length; i++) { if ((r -= w[i]) < 0) return opts[i]; }
  return opts[0];
}

function trafficAI(v, dt) {
  const ai = v.ai, d = v.def; ai.angry = Math.max(0, (ai.angry || 0) - dt);
  const np = nodePos(ai.n), lane = laneAxis(ai.dir);
  const fwdSp = v.fwdSpeed || 0;
  // distance remaining to the junction centre along our direction of travel
  const rem = ai.dir === 0 ? np.x - v.x : ai.dir === 2 ? v.x - np.x : ai.dir === 1 ? np.y - v.y : v.y - np.y;
  const turning = ai.nextDir !== ai.dir;
  const sw = turning ? (((ai.nextDir - ai.dir + 4) % 4) === 3 ? 82 : 26) : 40;
  if (rem < sw) {
    const nn = neighbor(ai.n, ai.nextDir);
    if (nn >= 0) { ai.dir = ai.nextDir; ai.n = nn; ai.nextDir = pickNextDir(ai.n, ai.dir); }
    else { ai.nextDir = pickNextDir(ai.n, ai.dir); ai.dir = ai.nextDir; ai.n = neighbor(ai.n, ai.dir) >= 0 ? neighbor(ai.n, ai.dir) : ai.n; }
  }
  const np2 = nodePos(ai.n), lane2 = laneAxis(ai.dir);
  const la = 70 + Math.abs(fwdSp) * 0.28;
  let tx, ty;
  if (ai.dir === 0 || ai.dir === 2) { ty = np2.y + lane2[1]; tx = v.x + DX[ai.dir] * la; }
  else { tx = np2.x + lane2[0]; ty = v.y + DY[ai.dir] * la; }
  steerToward(v, tx, ty, 2.4);
  // speed planning
  const cruise = d.max * ai.speedMul * (ai.angry > 0 ? 1.3 : 1);
  let target = cruise;
  const rem2 = ai.dir === 0 ? np2.x - v.x : ai.dir === 2 ? v.x - np2.x : ai.dir === 1 ? np2.y - v.y : v.y - np2.y;
  const nturn = ai.nextDir !== ai.dir;
  if (nturn && rem2 < 230) target = Math.min(target, 70 + rem2 * 0.45);
  const sg = signal(ai.n, ai.dir % 2);
  if (sg !== 0 && rem2 > 105 && rem2 < 300 && !(sg === 1 && rem2 < 150)) target = Math.min(target, Math.max(0, (rem2 - 135) * 1.6));
  // look ahead for obstacles
  const look = 45 + Math.abs(fwdSp) * 0.55;
  const ob = aheadObstacle(v, look, v.w / 2 + 5);
  let honk = false;
  if (ob) {
    const gap = ob.f - v.l / 2 - (ob.o.l ? ob.o.l / 2 : 8);
    target = Math.min(target, Math.max(0, gap * 1.2 - 8));
    ai.blockT = (ai.blockT || 0) + dt;
    if (ai.blockT > 1.2 && Math.random() < dt * 0.6) honk = true;
    if (ai.blockT > 6 && ob.o.l) { target = cruise * 0.35; } // impatient: nudge through
  } else ai.blockT = 0;
  if (honk) hornVeh(v);
  if (fwdSp < target - 6) v.throttle = clamp((target - fwdSp) / 60, 0.2, 1);
  else if (fwdSp > target + 12) v.throttle = clamp(-(fwdSp - target) / 90, -1, 0);
  else v.throttle = 0.12;
  v.hb = false;
  // stuck handling
  if (v.throttle > 0.25 && Math.abs(fwdSp) < 7 && !ob) { v.stuckT += dt; } else v.stuckT = Math.max(0, v.stuckT - dt);
  if (v.stuckT > 2.5) { v.revT = 1.1; v.stuckT = 0; }
  if (v.revT > 0) { v.revT -= dt; v.throttle = -0.8; v.steer = -v.steer; }
}

// follow the road graph to `targetNode` (police, rivals, fleeing targets)
function graphDrive(v, dt, ai, targetNode, opts) {
  opts = opts || {};
  if (ai.tn !== targetNode || !ai.dist) { ai.tn = targetNode; ai.dist = bfsDist(targetNode); }
  if (ai.n === undefined || ai.n < 0) {
    // first junction: whichever of the nearest junction and its neighbours is closest to the goal along the road graph
    const n0 = nearestNode(v.x, v.y); let best = n0, bs = ai.dist[n0] >= 0 ? ai.dist[n0] * 480 + dist(v.x, v.y, nodePos(n0).x, nodePos(n0).y) : 1e9;
    for (let k = 0; k < 4; k++) {
      const m = neighbor(n0, k); if (m < 0 || ai.dist[m] < 0) continue;
      const p = nodePos(m), s = ai.dist[m] * 480 + dist(v.x, v.y, p.x, p.y);
      if (s < bs) { bs = s; best = m; }
    }
    ai.n = best;
  }
  let np = nodePos(ai.n), dd = Math.hypot(v.x - np.x, v.y - np.y);
  const thr = 60;
  if (dd < thr && ai.n !== targetNode) {
    let best = -1, bd = 1e9;
    for (let k = 0; k < 4; k++) { const m = neighbor(ai.n, k); if (m >= 0 && ai.dist[m] >= 0 && ai.dist[m] + (Math.random() * 0.2) < bd) { bd = ai.dist[m]; best = m; } }
    if (best >= 0) { ai.prev = ai.n; ai.n = best; np = nodePos(ai.n); dd = Math.hypot(v.x - np.x, v.y - np.y); }
  }
  let tx = np.x, ty = np.y;
  if (ai.n === targetNode && opts.final) { tx = opts.final.x; ty = opts.final.y; }
  // pure pursuit toward the junction centre, lightly biased to the left lane
  const fwdSp = v.fwdSpeed || 0;
  const turnDiff = steerToward(v, tx, ty, 2.6);
  if (Math.abs(turnDiff) > 2.2 && fwdSp < 70 && !opts.noReverse) { // facing the wrong way: back up while swinging the nose round
    v.throttle = -0.8; v.steer = -Math.sign(turnDiff); v.hb = false; return dd;
  }
  // slow for corners
  let target = v.def.max * (opts.speed || 0.9);
  if (ai.prev !== undefined && ai.prev >= 0) {
    const pp = nodePos(ai.prev), a1 = Math.atan2(np.y - pp.y, np.x - pp.x);
    // next leg
    let nn = -1, bd = 1e9; for (let k = 0; k < 4; k++) { const m = neighbor(ai.n, k); if (m >= 0 && ai.dist[m] >= 0 && ai.dist[m] < bd) { bd = ai.dist[m]; nn = m; } }
    if (nn >= 0 && ai.n !== targetNode) { const p3 = nodePos(nn), a2 = Math.atan2(p3.y - np.y, p3.x - np.x); if (Math.abs(angDiff(a1, a2)) > 0.5 && dd < 260) target = Math.min(target, 90 + dd * 0.9); }
  }
  const ob = aheadObstacle(v, 40 + Math.abs(fwdSp) * 0.4, v.w / 2 + 3);
  if (ob && !opts.ram) target = Math.min(target, Math.max(0, (ob.f - v.l) * 1.5));
  if (fwdSp < target - 5) v.throttle = clamp((target - fwdSp) / 50, 0.3, 1); else if (fwdSp > target + 15) v.throttle = clamp(-(fwdSp - target) / 90, -1, 0); else v.throttle = 0.2;
  v.hb = false;
  if (v.throttle > 0.25 && Math.abs(fwdSp) < 7) v.stuckT += dt; else v.stuckT = Math.max(0, v.stuckT - dt);
  if (v.stuckT > 1.6) { v.revT = 0.9; v.stuckT = 0; }
  if (v.revT > 0) { v.revT -= dt; v.throttle = -0.9; v.steer = -v.steer; }
  return dd;
}

// charge straight at a point (used when close with a clear line)
function chargeAt(v, dt, tx, ty, speed) {
  steerToward(v, tx, ty, 3);
  const fwdSp = v.fwdSpeed || 0, target = v.def.max * (speed || 1);
  v.throttle = fwdSp < target ? 1 : 0.1; v.hb = false;
  if (Math.abs(fwdSp) < 8 && v.throttle > 0.2) v.stuckT += dt; else v.stuckT = Math.max(0, v.stuckT - dt);
  if (v.stuckT > 1.2) { v.revT = 0.8; v.stuckT = 0; }
  if (v.revT > 0) { v.revT -= dt; v.throttle = -0.9; v.steer = -v.steer; }
}

function hornVeh(v) {
  if (v.hornT > 0) return; v.hornT = 0.55;
  const d = dist(v.x, v.y, cam.x, cam.y);
  Snd.horn(v.def.horn * rand(0.95, 1.05), clamp(1 - d / 900, 0, 1));
}

// ---------------------------------------------------------------- spawning
function spawnTrafficAt(n, d, f, type) {
  const a = nodePos(n), nb = neighbor(n, d); if (nb < 0) return null;
  const b = nodePos(nb), lane = laneAxis(d);
  const x = a.x + (b.x - a.x) * f + lane[0], y = a.y + (b.y - a.y) * f + lane[1];
  if (tileAtPx(x, y) === T.WATER) return null;
  for (const o of vehicles) if (Math.abs(o.x - x) < 110 && Math.abs(o.y - y) < 110 && dist(o.x, o.y, x, y) < 100) return null;
  type = type || pickTrafficType();
  const v = makeVehicle(type, x, y, d * Math.PI / 2, {});
  const dx = DX[d], dy = DY[d];
  v.vx = dx * 60; v.vy = dy * 60;
  v.driver = { npc: true };
  v.ai = { mode: 'traffic', n: nb, dir: d, nextDir: 0, speedMul: rand(0.5, 0.75) };
  v.ai.nextDir = pickNextDir(nb, d);
  return v;
}
function nearestVehicle(x, y, r, filter) {
  let best = null, bd = r;
  for (const v of vehicles) { if (v.wreck || (filter && !filter(v))) continue; const d = dist(x, y, v.x, v.y) - v.l * 0.25; if (d < bd) { bd = d; best = v; } }
  return best;
}
