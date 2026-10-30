'use strict';
// ===================================================================
//  CORE  –  shared game state, spatial grids, particles, popups
// ===================================================================
const G = {
  t: 0, dayMin: 8 * 60 + 20, rain: 0, rainTarget: 0, rainT: 90,
  cash: 500, wanted: 0, heat: 0, unseenT: 0, copSeen: false,
  shake: 0, paused: false, mode: 'title', stats: { kills: 0, missions: 0, hits: 0 },
  slowmo: 0, flash: 0,
};
const vehicles = [], peds = [], bullets = [], parts = [], pickups = [], popups = [], explosions = [];

class Grid {
  constructor(cs) { this.cs = cs; this.m = new Map(); }
  clear() { this.m.clear(); }
  add(o) {
    const k = (Math.floor(o.x / this.cs) + 2) * 4096 + (Math.floor(o.y / this.cs) + 2);
    let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(o);
  }
  query(x, y, r, out) {
    out.length = 0; const cs = this.cs;
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs), y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = this.m.get((cx + 2) * 4096 + (cy + 2)); if (a) for (let i = 0; i < a.length; i++) out.push(a[i]);
    }
    return out;
  }
}
const vgrid = new Grid(160), pgrid = new Grid(80);

function part(kind, x, y, vx, vy, life, size, col, o) {
  if (parts.length > 700) return;
  parts.push(Object.assign({ kind, x, y, vx, vy, life, max: life, size, col, drag: 0.9, grow: 0, a: 0, g: 0 }, o || {}));
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; p.size += p.grow * dt;
  }
}
function popup(text, x, y, col) { popups.push({ text, x, y, t: 0, col: col || '#fff' }); }

// subtitles / radio chatter
const Sub = {
  q: [], cur: null, t: 0,
  say(who, text, dur) { this.q.push({ who, text, dur: dur || Math.max(2.2, text.length * 0.055) }); },
  clear() { this.q.length = 0; this.cur = null; },
  update(dt) {
    if (this.cur) { this.t -= dt; if (this.t <= 0) this.cur = null; }
    if (!this.cur && this.q.length) { this.cur = this.q.shift(); this.t = this.cur.dur; }
  },
};
// big on-screen messages ("MISSION PASSED", "WASTED"...)
const Banner = {
  q: [], cur: null, t: 0,
  show(text, sub, col, dur) { this.q.push({ text, sub, col: col || '#ffd54a', dur: dur || 3 }); },
  update(dt) {
    if (this.cur) { this.t -= dt; if (this.t <= 0) this.cur = null; }
    if (!this.cur && this.q.length) { this.cur = this.q.shift(); this.t = this.cur.dur; }
  },
};

const FLAVOUR = {
  scared: ['Aiyo!', 'Ayyayyo!', 'Amma!', 'Kaapathunga!', 'Ayyo, run!', 'Enna idhu?!'],
  angry: ['Dei!', 'Poda!', 'Paathu poda!', 'Kanna theriyaadha?', 'Enna da?!', 'Yaarunu theriyumaa?'],
  idle: ['Machi!', 'Semma heat', 'Filter coffee?', 'Enna ma?', 'Bus eppo varum?', 'Traffic ah...', 'Vanakkam!', 'Super!', 'Mazhai varum pola'],
  honk: ['Poda!', 'Vazhi vidu!', 'Horn OK Please', 'Naan late!'],
};
