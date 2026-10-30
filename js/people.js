'use strict';
// ===================================================================
//  PEOPLE – player, pedestrians, gang members, police, weapons
// ===================================================================
const WEAPONS = {
  fist:    { name: 'Fists', melee: true, dmg: 13, range: 32, cd: 0.38 },
  bat:     { name: 'Cricket Bat', melee: true, dmg: 38, range: 48, cd: 0.62 },
  pistol:  { name: 'Pistol', dmg: 24, cd: 0.28, spread: 0.035, speed: 1600, life: 0.55, pel: 1, maxAmmo: 240, snd: 'pistol', price: 2500, pack: 36 },
  smg:     { name: 'SMG', dmg: 11, cd: 0.085, spread: 0.085, speed: 1600, life: 0.5, pel: 1, auto: true, maxAmmo: 600, snd: 'smg', price: 7000, pack: 120 },
  shotgun: { name: 'Shotgun', dmg: 12, cd: 0.8, spread: 0.2, speed: 1400, life: 0.3, pel: 8, maxAmmo: 90, snd: 'shotgun', price: 5200, pack: 16 },
  nattu:   { name: 'Nattu Vedi', thrown: true, cd: 0.7, maxAmmo: 30, price: 900, pack: 5 },
};
const WEAPON_ORDER = ['fist', 'bat', 'pistol', 'smg', 'shotgun', 'nattu'];
const SKINS = ['#8d5524', '#a0673a', '#c68642', '#e0ac69', '#6f4522', '#7a4a2a'];
const SHIRTS = ['#e9e9e9', '#3f6fb5', '#c0392b', '#2e8b57', '#d4a017', '#6a4c93', '#e67e22', '#37474f', '#ff8fa3', '#00897b', '#f5f0e1', '#8d6e63'];
const SAREES = ['#d81b60', '#fb8c00', '#00897b', '#5e35b1', '#c62828', '#1e88e5', '#fdd835', '#43a047', '#ec407a'];
const BUBBLE_COOL = 0.5;

const player = {
  kind: 'player', x: 0, y: 0, a: 0, vx: 0, vy: 0, kvx: 0, kvy: 0, hp: 100, maxhp: 100, armor: 0, r: 7, dead: false, veh: null,
  weapon: 'fist', owned: { fist: true, bat: true }, ammo: {}, cd: 0, animT: 0, shirt: '#b3261e', skin: '#a0673a', hair: '#0e0e0e', pants: '#1d2b44',
  moving: false, swing: 0, swim: false, id: 0, hitT: 0, arrestT: 0, enterCd: 0, bubble: null, deadA: 0, deadT: 0, lx: 0, ly: 0,
};
let pidCounter = 0;
const _q = [], _q2 = [], _q3 = [];

function makePed(kind, x, y, o) {
  o = o || {};
  const female = o.female !== undefined ? o.female : Math.random() < 0.45;
  const p = {
    id: ++pidCounter, kind, x, y, a: rand(0, TAU), hd: rand(0, TAU), vx: 0, vy: 0, kvx: 0, kvy: 0, hp: 50, maxhp: 50, r: 7, dead: false, deadT: 0, deadA: rand(0, TAU),
    female, skin: pick(SKINS), hair: Math.random() < 0.12 ? '#cfcfcf' : '#161212', shirt: female ? pick(SAREES) : pick(SHIRTS), pants: female ? null : pick(['#f2f2f2', '#2a2a2e', '#3b4a63', '#f2f2f2']),
    speed: rand(48, 74), state: 'walk', stT: rand(2, 12), animT: rand(0, 6), moving: false, crossing: false, onRoadT: 0, weapon: 'fist', ammo: 999, cd: rand(0, 1), swing: 0,
    bubble: null, bubbleCd: rand(2, 10), hitT: 0, veh: null, threat: null, remove: false, stuck: 0, lx: x, ly: y, detT: 0, detA: 0, mission: false, keep: false, alert: false,
  };
  if (kind === 'cop') { p.shirt = '#b8a56a'; p.pants = '#b8a56a'; p.female = false; p.hp = 80; p.maxhp = 80; p.weapon = 'pistol'; p.speed = 80; p.hair = '#111'; }
  if (kind === 'enemy') { p.shirt = o.shirt || '#7b1f1f'; p.pants = '#1c1c1c'; p.female = false; p.hp = o.hp || 70; p.maxhp = p.hp; p.weapon = o.weapon || 'fist'; p.speed = 85; p.aggro = o.aggro || 520; p.alert = !!o.alert; }
  Object.assign(p, o.props || {});
  peds.push(p); return p;
}

// ---------------------------------------------------------------- crime / wanted
let lastShootCrime = 0;
function witnessed(x, y) {
  for (const p of peds) {
    if (p.dead) continue;
    const d = dist(p.x, p.y, x, y);
    if (p.kind === 'civ' && d < 320 && lineClear(p.x, p.y, x, y)) return true;
    if (p.kind === 'cop' && d < 700 && lineClear(p.x, p.y, x, y)) return true;
  }
  for (const v of vehicles) if (v.type === 'police' && v.driver && v.ai && !v.wreck && dist(v.x, v.y, x, y) < 700) return true;
  return false;
}
function crime(type, x, y) {
  const pts = { assault: 0.8, killciv: 1.5, hitcop: 2, killcop: 3.5, carjack: 1, explode: 2.5, hitrun: 1.3, copcar: 2, shoot: 0.3 }[type] || 0.5;
  if (type === 'shoot') { if (G.t - lastShootCrime < 0.6) return; lastShootCrime = G.t; }
  if (type !== 'hitcop' && type !== 'killcop' && !witnessed(x, y)) return;
  addHeat(pts);
}
function addHeat(pts) {
  const before = G.wanted; G.heat = Math.min(22, G.heat + pts); G.unseenT = 0;
  updateWantedLevel();
  if (G.wanted > before) { Banner.show('WANTED', '★'.repeat(G.wanted), '#ff5252', 1.6); Sub.say('Police Radio', pick(['All units, suspect is armed and dangerous.', 'Control to all jeeps: rowdy sighted, go go go!', 'Inspector Singam: bring him in. Alive if possible.']), 3); }
}
function updateWantedLevel() {
  const h = G.heat; const w = h < 0.9 ? 0 : h < 3 ? 1 : h < 6 ? 2 : h < 10 ? 3 : h < 15 ? 4 : 5;
  G.wanted = w;
}
function clearWanted() { G.heat = 0; G.wanted = 0; G.unseenT = 0; }

// ---------------------------------------------------------------- damage
function hurtPlayer(amt, src) {
  if (player.dead || amt <= 0) return;
  if (player.armor > 0) { const a = Math.min(player.armor, amt * 0.75); player.armor -= a; amt -= a; }
  player.hp -= amt; G.flash = Math.min(0.5, G.flash + 0.2); player.hitT = 0.15;
  if (player.hp <= 0) playerDie(src);
}
function damagePed(p, amt, src) {
  if (p === player) { hurtPlayer(amt, src); return; }
  if (p.dead) return;
  p.hp -= amt; p.hitT = 0.15;
  const own = src && (src.owner || (src.veh && src.veh.driver) || src.kind === 'player' && player);
  const byPlayer = own === player || (src && src.owner === player);
  const sx = src && src.x !== undefined ? src.x : p.x - 10, sy = src && src.y !== undefined ? src.y : p.y;
  if (p.kind === 'civ') {
    if (p.hp > 0) { setFlee(p, byPlayer ? player.x : sx, byPlayer ? player.y : sy, 7); say(p, pick(FLAVOUR.scared)); }
    if (byPlayer && p.hp > 0) crime('assault', p.x, p.y);
  } else if (p.kind === 'cop') { p.alert = true; p.memT = 8; if (byPlayer) { crime('hitcop', p.x, p.y); } }
  else if (p.kind === 'enemy') { p.alert = true; }
  if (p.hp <= 0) killPed(p, src, byPlayer);
}
function killPed(p, src, byPlayer) {
  if (p.dead) return; p.dead = true; p.deadT = 0; p.hp = 0; p.veh = null; p.bubble = null;
  if (byPlayer) { G.stats.kills++; }
  if (p.kind === 'civ') { if (byPlayer) { crime(src && src.kind === 'veh' ? 'hitrun' : 'killciv', p.x, p.y); } if (Math.random() < 0.45) dropPickup('cash', p.x, p.y, randi(20, 140)); }
  else if (p.kind === 'cop') { if (byPlayer) crime('killcop', p.x, p.y); dropPickup('cash', p.x, p.y, randi(60, 220)); if (Math.random() < 0.5) dropPickup('ammo', p.x + 6, p.y, 12, 'pistol'); }
  else if (p.kind === 'enemy') { dropPickup('cash', p.x, p.y, randi(120, 420)); if (Math.random() < 0.3) dropPickup('health', p.x + 8, p.y, 20); }
  if (p.mission && typeof Missions !== 'undefined') Missions.pedKilled(p, src);
  p.kvx *= 1.2; p.kvy *= 1.2;
}
function say(p, text) { if (p.bubble && p.bubble.t > 0) return; p.bubble = { text, t: 1.8 }; }
function setFlee(p, tx, ty, t) { if (p.kind !== 'civ') return; p.state = 'flee'; p.threat = { x: tx, y: ty }; p.stT = t; p.crossing = true; }

function playerDie(src) {
  if (player.dead) return;
  player.dead = true; player.hp = 0; G.mode = 'wasted'; G.wastedT = 0; G.slowmo = 1;
  if (player.veh) { const v = player.veh; v.driver = null; v.throttle = 0; v.steer = 0; player.veh = null; }
  Snd.setRadio(false); Snd.fail();
  Banner.show('WASTED', 'தோல்வி', '#e53935', 3.2);
  if (typeof Missions !== 'undefined') Missions.playerDied();
}

// ---------------------------------------------------------------- explosions
function explode(x, y, r, dmg, src, srcVeh) {
  explosions.push({ x, y, r, t: 0, max: 0.9 });
  const d0 = dist(x, y, cam.x, cam.y);
  Snd.boom(clamp(1.1 - d0 / 1400, 0, 1)); G.shake = Math.max(G.shake, clamp(14 - d0 / 90, 0, 14));
  for (let i = 0; i < 16; i++) part('fire', x + rand(-r * .3, r * .3), y + rand(-r * .3, r * .3), rand(-90, 90), rand(-90, 90), rand(.4, .9), rand(10, 20), pick(['#ff7a1a', '#ffb02e', '#ffd54a', '#ff4d1a']), { grow: -8, drag: .93 });
  for (let i = 0; i < 12; i++) part('smoke', x + rand(-r * .4, r * .4), y + rand(-r * .4, r * .4), rand(-50, 50), rand(-70, -10), rand(1.2, 2.4), rand(10, 18), '#222', { grow: 22, drag: .96 });
  for (let i = 0; i < 14; i++) part('spark', x, y, rand(-260, 260), rand(-260, 260), rand(.3, .8), 1.8, '#ffd54a');
  const isPlayerSrc = src === player || (src && src.kind === 'player');
  const rr2 = r * 1.35;
  for (const p of peds.concat([player])) {
    if (p.dead || p.veh) continue;
    const d = dist(p.x, p.y, x, y); if (d > rr2) continue;
    const amt = dmg * (1 - d / rr2); const a = Math.atan2(p.y - y, p.x - x);
    p.kvx += Math.cos(a) * 380 * (1 - d / rr2); p.kvy += Math.sin(a) * 380 * (1 - d / rr2);
    damagePed(p, amt, { kind: 'explosion', owner: isPlayerSrc ? player : src, x, y });
  }
  const rv = r * 1.7;
  for (const v of vehicles) {
    if (v === srcVeh || v.wreck) continue;
    const d = dist(v.x, v.y, x, y); if (d > rv) continue;
    const a = Math.atan2(v.y - y, v.x - x), f = 1 - d / rv;
    v.vx += Math.cos(a) * 260 * f / v.def.mass; v.vy += Math.sin(a) * 260 * f / v.def.mass;
    damageVeh(v, dmg * 2.4 * f, isPlayerSrc ? player : src);
  }
  if (isPlayerSrc && srcVeh == null) crime('explode', x, y);
}

// ---------------------------------------------------------------- pickups
function dropPickup(type, x, y, amt, wk) { pickups.push({ type, x, y, amt, wk, t: 0, life: 70 }); }
function collectPickup(k) {
  const pk = pickups[k];
  switch (pk.type) {
    case 'cash': G.cash += pk.amt; Snd.cash(); popup('+' + fmtMoney(pk.amt), pk.x, pk.y, '#7CFC8A'); break;
    case 'health': if (player.hp >= player.maxhp) return; player.hp = Math.min(player.maxhp, player.hp + pk.amt); Snd.pickup(); popup('+' + pk.amt + ' HP', pk.x, pk.y, '#ff8a80'); break;
    case 'armor': if (player.armor >= 100) return; player.armor = Math.min(100, player.armor + pk.amt); Snd.pickup(); popup('ARMOUR', pk.x, pk.y, '#82b1ff'); break;
    case 'ammo': { const w = WEAPONS[pk.wk]; if (!player.owned[pk.wk]) return; player.ammo[pk.wk] = Math.min(w.maxAmmo, (player.ammo[pk.wk] || 0) + pk.amt); Snd.pickup(); popup('+' + pk.amt + ' ' + w.name, pk.x, pk.y, '#ffe082'); break; }
    case 'weapon': { const w = WEAPONS[pk.wk]; player.owned[pk.wk] = true; player.ammo[pk.wk] = Math.min(w.maxAmmo, (player.ammo[pk.wk] || 0) + pk.amt); Snd.pickup(); popup(w.name, pk.x, pk.y, '#ffe082'); if (player.weapon === 'fist') player.weapon = pk.wk; break; }
  }
  if (pk.respawn) { pk.hidden = pk.respawn; return; }
  pickups.splice(k, 1);
}
function updatePickups(dt) {
  for (let k = pickups.length - 1; k >= 0; k--) {
    const pk = pickups[k]; pk.t += dt;
    if (pk.hidden) { pk.hidden -= dt; if (pk.hidden <= 0) pk.hidden = 0; continue; }
    if (!pk.respawn && pk.t > pk.life) { pickups.splice(k, 1); continue; }
    if (player.dead || player.veh && pk.type !== 'cash') continue;
    if (dist(pk.x, pk.y, player.x, player.y) < (player.veh ? 40 : 24)) collectPickup(k);
  }
}

// ---------------------------------------------------------------- weapons
function ammoOf(p, wk) { return p === player ? (player.ammo[wk] || 0) : 999; }
function fireWeapon(p, ang, wk) {
  const w = WEAPONS[wk]; if (!w) return false;
  if (w.melee) return meleeAttack(p, ang, w);
  if (p === player) { if (!(player.ammo[wk] > 0)) { Snd.tone(300, .05, 'square', .1); player.cd = .2; return false; } player.ammo[wk]--; }
  const sx = (p.veh ? p.veh.x : p.x), sy = (p.veh ? p.veh.y : p.y);
  if (w.thrown) { throwBomb(p, sx, sy, ang); p.cd = w.cd; p.swing = 0.25; return true; }
  const mx = sx + Math.cos(ang) * (p.veh ? 30 : 14), my = sy + Math.sin(ang) * (p.veh ? 30 : 14);
  for (let i = 0; i < w.pel; i++) {
    const a = ang + rand(-w.spread, w.spread) * (p.kind === 'cop' || p.kind === 'enemy' ? 2.2 : 1);
    bullets.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: w.life, dmg: w.dmg * (p === player ? 1 : 0.45), owner: p, kind: p.kind });
  }
  part('flash', mx, my, 0, 0, 0.06, 9, '#ffe9a0', { drag: 1 });
  part('spark', mx, my, Math.cos(ang) * 120, Math.sin(ang) * 120, 0.15, 1.4, '#ffd54a');
  const d0 = dist(mx, my, cam.x, cam.y); Snd.shot(w.snd, clamp(1.1 - d0 / 1500, 0, 1));
  p.cd = w.cd; p.swing = 0.1;
  if (p === player) { crime('shoot', player.x, player.y); alertNoise(sx, sy, 520, p); G.shake = Math.max(G.shake, wk === 'shotgun' ? 4 : 1.2); }
  return true;
}
function meleeAttack(p, ang, w) {
  p.cd = w.cd; p.swing = 0.22; let hit = false, hits = 0;
  const sx = p.x, sy = p.y;
  pgrid.query(sx, sy, w.range + 20, _q3);
  const list = _q3.slice(); if (p !== player) list.push(player);
  for (const t of list) {
    if (t === p || t.dead || t.veh) continue;
    if (p.kind === t.kind && p.kind !== 'civ') continue;
    if ((p.kind === 'cop' && t.kind === 'enemy') || (p.kind === 'enemy' && t.kind === 'cop')) continue;
    const d = dist(sx, sy, t.x, t.y); if (d > w.range + t.r) continue;
    if (Math.abs(angDiff(ang, Math.atan2(t.y - sy, t.x - sx))) > 1.0) continue;
    hit = true; hits++;
    t.kvx += Math.cos(ang) * 190; t.kvy += Math.sin(ang) * 190;
    damagePed(t, w.dmg * (p === player ? 1 : 0.6), { kind: 'melee', owner: p, x: sx, y: sy });
    part('spark', t.x, t.y, rand(-60, 60), rand(-60, 60), .2, 1.6, '#fff3b0');
    if (hits >= (w.name === 'Fists' ? 1 : 2)) break;
  }
  const d0 = dist(sx, sy, cam.x, cam.y); Snd.punch(hit ? clamp(1.1 - d0 / 900, 0, 1) : 0.15);
  if (p === player && hit) { G.stats.hits++; }
  return true;
}
const bombs = [];
function throwBomb(p, sx, sy, ang) {
  const d = p === player ? clamp(dist(sx, sy, Input.worldX, Input.worldY), 70, 420) : 260;
  bombs.push({ x: sx, y: sy, sx, sy, tx: sx + Math.cos(ang) * d, ty: sy + Math.sin(ang) * d, t: 0, fly: 0.55, fuse: 1.7, owner: p });
}
function updateBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i]; b.t += dt;
    if (b.t < b.fly) { const f = b.t / b.fly; b.x = lerp(b.sx, b.tx, f); b.y = lerp(b.sy, b.ty, f); b.h = Math.sin(f * Math.PI) * 30; }
    else b.h = 0;
    if (b.t < b.fly && tileAtPx(b.x, b.y) === T.BUILDING) { b.tx = b.sx; b.ty = b.sy; b.sx = b.x; b.sy = b.y; b.t = 0; b.fly = 0.2; }
    if (Math.random() < dt * 40) part('spark', b.x, b.y - (b.h || 0), rand(-30, 30), rand(-30, 30), .2, 1.3, '#ffcc33');
    if (b.t >= b.fuse) { explode(b.x, b.y, 85, 130, b.owner); bombs.splice(i, 1); }
  }
}
function alertNoise(x, y, r, src) {
  for (const p of peds) {
    if (p.dead) continue;
    const d = dist(p.x, p.y, x, y); if (d > r) continue;
    if (p.kind === 'civ' && p.state !== 'flee') { setFlee(p, x, y, rand(5, 9)); if (Math.random() < 0.5) say(p, pick(FLAVOUR.scared)); }
    else if (p.kind === 'enemy' && src === player && d < r * 0.8) p.alert = true;
  }
}
function ptSegDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy; let t = l2 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}
function hostileTo(k1, k2) {
  if (k1 === k2) return false;
  if ((k1 === 'cop' && k2 === 'enemy') || (k1 === 'enemy' && k2 === 'cop')) return false;
  return true;
}
const _vc = [];
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) { // walls
      const n = Math.ceil(Math.hypot(b.x - b.px, b.y - b.py) / 14);
      for (let k = 1; k <= n; k++) {
        const t = tileAtPx(b.px + (b.x - b.px) * k / n, b.py + (b.y - b.py) * k / n);
        if (t === T.BUILDING || t === T.WALL || t === T.TREE) { dead = true; b.x = b.px + (b.x - b.px) * k / n; b.y = b.py + (b.y - b.py) * k / n; part('spark', b.x, b.y, rand(-60, 60), rand(-60, 60), .2, 1.4, '#ffe082'); break; }
      }
    }
    if (!dead) {
      pgrid.query((b.x + b.px) / 2, (b.y + b.py) / 2, Math.hypot(b.x - b.px, b.y - b.py) / 2 + 14, _q2);
      const cands = _q2.slice(); if (b.owner !== player) cands.push(player);
      for (const p of cands) {
        if (p === b.owner || p.dead || p.veh || !hostileTo(b.kind, p.kind)) continue;
        if (ptSegDist(p.x, p.y, b.px, b.py, b.x, b.y) <= p.r + 2.5) {
          p.kvx += b.vx * 0.04; p.kvy += b.vy * 0.04;
          damagePed(p, b.dmg, { kind: 'bullet', owner: b.owner, x: b.px, y: b.py });
          part('spark', p.x, p.y, rand(-70, 70), rand(-70, 70), .25, 1.8, '#ff9e80'); if (b.owner === player) G.stats.hits++;
          dead = true; break;
        }
      }
    }
    if (!dead) {
      vgrid.query((b.x + b.px) / 2, (b.y + b.py) / 2, Math.hypot(b.x - b.px, b.y - b.py) / 2 + 80, _q);
      for (const v of _q) {
        if (v.wreck || (b.owner && b.owner.veh === v)) continue;
        for (const c of vehCircles(v, _vc)) {
          if (ptSegDist(c.x, c.y, b.px, b.py, b.x, b.y) <= c.r) {
            damageVeh(v, b.dmg * 0.7, b.owner);
            part('spark', b.x, b.y, rand(-80, 80), rand(-80, 80), .2, 1.5, '#fff59d');
            if (v.driver === player && b.owner !== player) hurtPlayer(b.dmg * 0.25, { kind: 'bullet' });
            else if (v.driver && v.driver !== player && v.ai) { v.ai.angry = 5; if (v.ai.mode === 'traffic') v.ai.speedMul = Math.min(1, v.ai.speedMul * 1.4); }
            dead = true; break;
          }
        }
        if (dead) break;
      }
    }
    if (dead) { bullets[i] = bullets[bullets.length - 1]; bullets.pop(); }
  }
}

// ---------------------------------------------------------------- ped movement
function pedCollide(p, solidFn) {
  const r = p.r; const tx0 = Math.floor((p.x - r) / TS), tx1 = Math.floor((p.x + r) / TS), ty0 = Math.floor((p.y - r) / TS), ty1 = Math.floor((p.y + r) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!PED_SOLID[tileAt(tx, ty)]) continue;
    const nx = clamp(p.x, tx * TS, (tx + 1) * TS), ny = clamp(p.y, ty * TS, (ty + 1) * TS);
    let dx = p.x - nx, dy = p.y - ny; const d2 = dx * dx + dy * dy; if (d2 >= r * r) continue;
    let d = Math.sqrt(d2);
    if (d < 1e-3) { dx = p.x - (tx + .5) * TS; dy = p.y - (ty + .5) * TS; d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; p.x += dx * (r + 2); p.y += dy * (r + 2); }
    else { p.x += dx / d * (r - d); p.y += dy / d * (r - d); }
  }
  // push out of vehicles
  vgrid.query(p.x, p.y, 90, _q);
  for (const v of _q) {
    if (p.veh === v) continue;
    for (const c of vehCircles(v, _vc)) {
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), m = c.r + r - 1;
      if (d < m && d > 0.001) { p.x += dx / d * (m - d); p.y += dy / d * (m - d); }
    }
  }
}
function moveActor(p, dt, vx, vy) {
  p.lx = p.x; p.ly = p.y;
  p.x += (vx + p.kvx) * dt; p.y += (vy + p.kvy) * dt;
  const kd = Math.exp(-6 * dt); p.kvx *= kd; p.kvy *= kd;
  pedCollide(p);
  p.moving = Math.hypot(p.x - p.lx, p.y - p.ly) > 4 * dt;
  if (p.moving) p.animT += Math.hypot(vx, vy) * dt * 0.11;
}
function probeBad(x, y, crossing) {
  const t = tileAtPx(x, y);
  if (PED_SOLID[t] || t === T.WATER || t === T.SHALLOW || t === T.BRIDGE || t === T.RAIL) return true;
  if (!crossing && t === T.ROAD) return true;
  return false;
}
function pursueGround(p, tx, ty, speed, dt) {
  // head for (tx,ty); sidestep around solids by trying fanned headings
  const want = Math.atan2(ty - p.y, tx - p.x);
  let ang = p.detT > 0 ? p.detA : want;
  if (p.detT > 0) p.detT -= dt;
  if (probeBad(p.x + Math.cos(ang) * 16, p.y + Math.sin(ang) * 16, true) || p.detT > 0 && false) {
    for (const off of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6]) {
      const a = want + off * (p.detSign || 1);
      if (!probeBad(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, true)) { ang = a; p.detA = a; p.detT = 0.45; break; }
    }
    p.detSign = Math.random() < 0.5 ? 1 : -1;
  }
  moveActor(p, dt, Math.cos(ang) * speed, Math.sin(ang) * speed);
  return want;
}

// ---------------------------------------------------------------- civilian AI
function updateCiv(p, dt) {
  p.bubbleCd -= dt;
  if (p.state === 'idle') {
    moveActor(p, dt, 0, 0); p.stT -= dt;
    if (p.bubbleCd < 0 && Math.random() < 0.4) { say(p, pick(FLAVOUR.idle)); p.bubbleCd = rand(8, 20); }
    if (p.stT <= 0) { p.state = 'walk'; p.stT = rand(8, 24); }
    return;
  }
  if (p.state === 'flee') {
    p.stT -= dt;
    let a = Math.atan2(p.y - p.threat.y, p.x - p.threat.x);
    let tries = 0;
    while (tries < 8 && probeBad(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, true)) { a += (tries % 2 ? 1 : -1) * 0.6 * (1 + (tries >> 1)); tries++; }
    p.a = a; moveActor(p, dt, Math.cos(a) * p.speed * 2.3, Math.sin(a) * p.speed * 2.3);
    if (p.stT <= 0) { p.state = 'walk'; p.stT = rand(8, 20); p.crossing = false; }
    return;
  }
  // walk
  p.stT -= dt;
  const hx = Math.cos(p.hd), hy = Math.sin(p.hd);
  const tt = tileAtPx(p.x + hx * 15, p.y + hy * 15);
  let bad = probeBad(p.x + hx * 15, p.y + hy * 15, p.crossing);
  if (bad && !p.crossing && tt === T.ROAD && Math.random() < 0.012 + 0.0 && !probeBad(p.x + hx * 60, p.y + hy * 60, true)) { p.crossing = true; bad = false; }
  const here = tileAtPx(p.x, p.y);
  if (p.crossing) { if (here === T.ROAD) p.onRoadT = 0.4; else { p.onRoadT -= dt; if (p.onRoadT < -0.3) p.crossing = false; } }
  if (bad || p.stuck > 1.1) {
    const base = p.hd; let done = false;
    for (const off of (Math.random() < 0.5 ? [Math.PI / 2, -Math.PI / 2, Math.PI] : [-Math.PI / 2, Math.PI / 2, Math.PI])) {
      const a = base + off; if (!probeBad(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, false)) { p.hd = a; done = true; break; }
    }
    if (!done) p.hd = base + Math.PI;
    p.stuck = 0;
  } else if (Math.random() < dt * 0.12 && !p.crossing) {
    const a = p.hd + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    if (!probeBad(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, false)) p.hd = a;
  }
  // smooth heading
  p.a += angDiff(p.a, p.hd) * Math.min(1, dt * 8);
  moveActor(p, dt, Math.cos(p.hd) * p.speed, Math.sin(p.hd) * p.speed);
  if (Math.hypot(p.x - p.lx, p.y - p.ly) < p.speed * dt * 0.3) p.stuck += dt; else p.stuck = Math.max(0, p.stuck - dt);
  if (p.stT <= 0 && Math.random() < 0.5 && !p.crossing) { p.state = 'idle'; p.stT = rand(2, 7); }
  else if (p.stT <= 0) p.stT = rand(5, 12);
  // dodge oncoming cars
  vgrid.query(p.x, p.y, 120, _q);
  for (const v of _q) { const sp = Math.hypot(v.vx, v.vy); if (sp > 120 && dist(v.x, v.y, p.x, p.y) < 90 + sp * 0.25) { setFlee(p, v.x, v.y, 3); say(p, pick(FLAVOUR.scared)); if (v.driver === player) { p.kvx += v.vx * 0.0; } break; } }
}

// ---------------------------------------------------------------- police on foot
function updateCop(p, dt) {
  p.cd -= dt; p.bubbleCd -= dt; p.memT = Math.max(0, (p.memT || 0) - dt);
  const tgt = player.veh || player;
  const d = dist(p.x, p.y, tgt.x, tgt.y);
  const sees = !player.dead && d < 650 && lineClear(p.x, p.y, tgt.x, tgt.y);
  if (sees && G.wanted > 0) { G.copSeen = true; p.memT = 7; }
  if (G.wanted > 0 && !player.dead && (p.memT > 0 || d < 500)) {
    const armed = G.wanted >= 2; const stop = armed ? 170 : 12;
    p.a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
    if (d > stop) pursueGround(p, tgt.x, tgt.y, p.speed * (1 + 0.08 * G.wanted), dt); else moveActor(p, dt, 0, 0);
    if (armed && sees && d < 440 && p.cd <= 0) { fireWeapon(p, p.a + rand(-0.06, 0.06) * (6 - G.wanted) / 3, G.wanted >= 4 ? 'smg' : 'pistol'); p.cd = G.wanted >= 4 ? 0.14 : rand(0.55, 0.9); if (G.wanted >= 4) p.cd = 0.16; }
    if (!armed && d < 30 && !player.veh) { p.swing = 0.1; }
    return;
  }
  // idle patrol like a slow civilian
  if (p.state !== 'idle' && p.state !== 'walk') p.state = 'walk';
  updateCiv(p, dt);
}

// ---------------------------------------------------------------- gang members
function updateEnemy(p, dt) {
  p.cd -= dt;
  const d = dist(p.x, p.y, player.x, player.y);
  const sees = !player.dead && d < p.aggro && lineClear(p.x, p.y, player.x, player.y);
  if (sees && !p.alert && d < p.aggro * 0.8) p.alert = true;
  if (!p.alert || player.dead) { p.a += Math.sin(G.t * 0.5 + p.id) * dt * 0.4; moveActor(p, dt, 0, 0); return; }
  const w = WEAPONS[p.weapon]; p.a = Math.atan2(player.y - p.y, player.x - p.x);
  if (w.melee) {
    if (d > w.range * 0.7) pursueGround(p, player.x, player.y, p.speed * 1.1, dt); else moveActor(p, dt, 0, 0);
    if (d < w.range + 8 && p.cd <= 0) { meleeAttack(p, p.a, w); p.cd = w.cd + 0.4; }
  } else {
    const want = p.weapon === 'shotgun' ? 150 : 230;
    if (d > want + 40 || !sees) pursueGround(p, player.x, player.y, p.speed, dt);
    else if (d < want - 60) moveActor(p, dt, -Math.cos(p.a) * p.speed * 0.7, -Math.sin(p.a) * p.speed * 0.7);
    else { const s = Math.sin(G.t * 1.3 + p.id * 2) > 0 ? 1 : -1; moveActor(p, dt, -Math.sin(p.a) * p.speed * 0.6 * s, Math.cos(p.a) * p.speed * 0.6 * s); }
    if (sees && p.cd <= 0 && d < 520) { fireWeapon(p, p.a + rand(-0.05, 0.05), p.weapon); p.cd = w.cd * rand(1.6, 2.6) + 0.15; }
  }
}

// ---------------------------------------------------------------- the player
function enterVehicle(v) {
  if (!v || v.wreck || player.veh) return;
  if (v.driver && v.driver !== player) {
    const prevCop = v.type === 'police';
    const side = v.a + Math.PI / 2;
    const n = makePed(v.type === 'police' ? 'cop' : 'civ', v.x + Math.cos(side) * (v.w / 2 + 12), v.y + Math.sin(side) * (v.w / 2 + 12), {});
    if (n.kind === 'civ') { setFlee(n, v.x, v.y, 8); say(n, pick(FLAVOUR.angry)); } else { n.alert = true; n.memT = 8; }
    crime(prevCop ? 'copcar' : 'carjack', v.x, v.y);
  }
  player.veh = v; v.driver = player; v.ai = null; v.free = false; v.boost = 1; v.siren = false;
  player.x = v.x; player.y = v.y; Sub.clear();
  if (typeof Missions !== 'undefined') Missions.vehEntered(v);
}
function exitVehicle() {
  const v = player.veh; if (!v) return;
  const c = Math.cos(v.a), s = Math.sin(v.a);
  const spots = [[-s, c], [s, -c], [c, s], [-c, -s]];
  let placed = false;
  for (const [nx, ny] of spots) {
    const dd = v.w / 2 + 14, x = v.x + nx * dd, y = v.y + ny * dd;
    if (!PED_SOLID[tileAtPx(x, y)] && tileAtPx(x, y) !== T.WATER) { player.x = x; player.y = y; placed = true; break; }
  }
  if (!placed) { player.x = v.x; player.y = v.y; }
  v.driver = null; v.throttle = 0; v.steer = 0; v.free = true; player.veh = null; player.enterCd = 0.4; player.kvx = v.vx * 0.2; player.kvy = v.vy * 0.2;
  player.a = v.a;
}
function ejectPlayer(dmg) {
  if (!player.veh) { return; }
  const v = player.veh; exitVehicle(); player.kvx = v.vx * 0.5; player.kvy = v.vy * 0.5;
  if (dmg > 0) hurtPlayer(dmg, { kind: 'fall' });
}

function aimAngle(p) {
  const y = cam.yaw, w = WEAPONS[p.weapon]; if (!w || w.melee || w.thrown) return y;
  const ox = p.veh ? p.veh.x : p.x, oy = p.veh ? p.veh.y : p.y; let best = null, bd = 0.3;
  for (const e of peds) {
    if (e.dead || !(e.kind === 'enemy' || (e.kind === 'cop' && G.wanted > 0))) continue;
    const dx = e.x - ox, dy = e.y - oy, d = Math.hypot(dx, dy); if (d > 650 || d < 20) continue;
    const a = Math.atan2(dy, dx), diff = Math.abs(angDiff(y, a)); if (diff < bd) { bd = diff; best = a; }
  }
  return best === null ? y : best;
}
function updatePlayer(dt) {
  const p = player; p.hitT = Math.max(0, p.hitT - dt); p.cd -= dt; p.swing = Math.max(0, p.swing - dt); p.enterCd = Math.max(0, p.enterCd - dt);
  if (p.dead) { p.kvx *= .9; p.kvy *= .9; return; }
  const aim = aimAngle(p);
  const w = WEAPONS[p.weapon];
  if (p.veh) {
    const v = p.veh;
    v.throttle = (Input.up ? 1 : 0) - (Input.down ? 1 : 0); v.steer = (Input.right ? 1 : 0) - (Input.left ? 1 : 0); v.hb = Input.space;
    if (Input.horn) hornVeh(v);
    if (Input.hornPress) { if (v.type === 'police') v.siren = !v.siren; Input.hornPress = false; }
    p.x = v.x; p.y = v.y; p.a = aim;
    if (Input.fire && p.cd <= 0 && !w.melee && p.weapon !== 'nattu') { fireWeapon(p, aim, p.weapon); }
    if (Input.fire && p.cd <= 0 && p.weapon === 'nattu') fireWeapon(p, aim, 'nattu');
    return;
  }
  // on foot: camera-relative movement, face where you aim when armed & shooting
  const swim = tileAtPx(p.x, p.y) === T.WATER || tileAtPx(p.x, p.y) === T.SHALLOW; p.swim = swim;
  const f = (Input.up ? 1 : 0) - (Input.down ? 1 : 0), sd = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
  let mx = Math.cos(cam.yaw) * f - Math.sin(cam.yaw) * sd, my = Math.sin(cam.yaw) * f + Math.cos(cam.yaw) * sd;
  const m = Math.hypot(mx, my); if (m > 0) { mx /= m; my /= m; }
  const sp = (Input.run ? 188 : 122) * (swim ? 0.5 : 1) * (G.rain > 0.5 ? 0.95 : 1);
  p.vx = mx * sp; p.vy = my * sp;
  moveActor(p, dt, mx * sp, my * sp);
  const combat = Input.rmb || Input.fire || (p.cd > 0.05 && !w.melee);
  if (combat) p.a += angDiff(p.a, aim) * Math.min(1, dt * 18);
  else if (m > 0) p.a += angDiff(p.a, Math.atan2(my, mx)) * Math.min(1, dt * 11);
  if (swim && Math.random() < dt * 5) part('ring', p.x, p.y, 0, 0, 0.7, 4, '#fff', { grow: 18, drag: 1 });
  if (Input.fire && p.cd <= 0) fireWeapon(p, aim, p.weapon);
}

// ---------------------------------------------------------------- generic ped update
function updatePeds(dt) {
  for (const p of peds) {
    if (p.dead) { p.deadT += dt; p.kvx *= 0.9; p.kvy *= 0.9; p.x += p.kvx * dt; p.y += p.kvy * dt; pedCollide(p); if (p.deadT > 13) p.remove = true; continue; }
    p.hitT = Math.max(0, p.hitT - dt); p.swing = Math.max(0, p.swing - dt);
    if (p.bubble) { p.bubble.t -= dt; if (p.bubble.t <= 0) p.bubble = null; }
    if (p.kind === 'civ') updateCiv(p, dt);
    else if (p.kind === 'cop') updateCop(p, dt);
    else if (p.kind === 'enemy') updateEnemy(p, dt);
    if (p.kind === 'civ' && p.state !== 'idle' && p.state !== 'flee') p.a = p.hd;
    else if (p.kind === 'civ' && p.state === 'flee') p.a = Math.atan2(p.y - p.threat.y, p.x - p.threat.x);
    if (p.kind === 'cop' && !(G.wanted > 0) ) p.a = p.hd;
    if (p.y < 0 || p.x < 0) p.remove = true;
  }
  // soft separation
  for (const p of peds) {
    if (p.dead) continue;
    pgrid.query(p.x, p.y, 14, _q);
    for (const o of _q) { if (o === p || o.dead) continue; const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy); if (d < 12 && d > 0.01) { const push = (12 - d) * 0.25; p.x += dx / d * push; p.y += dy / d * push; } }
  }
  // player vs peds separation too
  if (!player.veh && !player.dead) {
    pgrid.query(player.x, player.y, 16, _q);
    for (const o of _q) { if (o.dead) continue; const dx = player.x - o.x, dy = player.y - o.y, d = Math.hypot(dx, dy); if (d < 12 && d > 0.01) { const push = (12 - d) * 0.3; player.x += dx / d * push; player.y += dy / d * push; o.x -= dx / d * push * 0.5; o.y -= dy / d * push * 0.5; } }
  }
}

// ---------------------------------------------------------------- vehicles hitting people
function vehHitPeds(v) {
  const sp = Math.hypot(v.vx, v.vy); if (sp < 45 || v.wreck) return;
  pgrid.query(v.x, v.y, v.l / 2 + 24, _q);
  const list = _q.slice(); if (v.driver !== player && !player.veh) list.push(player);
  const c = Math.cos(v.a), s = Math.sin(v.a);
  for (const p of list) {
    if (p.dead || p.veh || v.driver === p) continue;
    const dx = p.x - v.x, dy = p.y - v.y, f = dx * c + dy * s, l = -dx * s + dy * c;
    if (Math.abs(f) < v.l / 2 + p.r && Math.abs(l) < v.w / 2 + p.r) {
      let dmg = (sp - 35) * 0.5 * (v.def.mass > 2 ? 1.8 : v.def.mass < .5 ? 0.6 : 1);
      if (p === player && v.ai && v.driver !== player) dmg *= 0.3;   // AI drivers brake late but are not out to kill
      p.kvx += v.vx * 0.9 + (-s * l) * 0.4; p.kvy += v.vy * 0.9 + (c * l) * 0.4;
      const src = { kind: 'veh', veh: v, x: v.x, y: v.y, owner: v.driver === player ? player : null };
      if (p === player) { hurtPlayer(dmg, src); } else {
        damagePed(p, dmg, src);
        if (p.kind === 'civ' && p.hp > 0 && v.driver === player) crime('assault', p.x, p.y);
      }
      v.vx *= 0.97; v.vy *= 0.97;
      if (dist(p.x, p.y, cam.x, cam.y) < 800) Snd.punch(0.8);
      if (v.driver === player) { G.stats.hits++; G.shake = Math.max(G.shake, 2); }
    }
  }
}

// ---------------------------------------------------------------- police (cars + response)
let policeTimer = 0;
function policeCars() { return vehicles.filter(v => v.type === 'police' && v.ai && v.ai.mode === 'pursuit' && !v.wreck); }
function updatePolice(dt) {
  // decay of heat when out of sight
  if (G.wanted > 0) {
    if (G.copSeen) G.unseenT = 0; else G.unseenT += dt;
    if (G.unseenT > 9) { const before = G.wanted; G.heat = Math.max(0, G.heat - dt * 0.55); updateWantedLevel(); if (before > 0 && G.wanted === 0) { Banner.show('WANTED LEVEL CLEARED', 'You lost them', '#8bc34a', 2.4); } }
  }
  G.copSeen = false;
  const desired = [0, 2, 3, 4, 6, 7][G.wanted];
  policeTimer -= dt;
  const cars = policeCars();
  if (G.wanted > 0 && cars.length < desired && policeTimer <= 0 && !player.dead) {
    policeTimer = 3.2 - G.wanted * 0.35;
    for (let t = 0; t < 12; t++) {
      const ang = rand(0, TAU), r = rand(850, 1500);
      const n = nearestNode(player.x + Math.cos(ang) * r, player.y + Math.sin(ang) * r), d = randi(0, 3);
      const v = spawnTrafficAt(n, d, rand(.2, .8), 'police');
      if (v && !onScreen(v.x, v.y, 120)) { v.ai = { mode: 'pursuit' }; v.siren = true; v.driver = { npc: true, cop: true }; v.vx = v.vy = 0; break; }
      else if (v) { v.remove = true; }
    }
  }
  if (G.wanted === 0) for (const v of vehicles) if (v.ai && v.ai.mode === 'pursuit') { v.ai = { mode: 'leave', far: (Math.random() * (NI * NJ)) | 0 }; v.siren = false; }
  // arrest
  if (!player.dead && G.wanted > 0) {
    let n = 0;
    for (const p of peds) if (p.kind === 'cop' && !p.dead && dist(p.x, p.y, player.x, player.y) < 30) n++;
    const slow = !player.veh || Math.hypot(player.veh.vx, player.veh.vy) < 45;
    if (n > 0 && slow && G.wanted <= 3) player.arrestT += dt * (n >= 2 ? 1.5 : 1); else player.arrestT = Math.max(0, player.arrestT - dt * 1.5);
    if (player.arrestT > 1.9) busted();
  } else player.arrestT = 0;
}
function policeCarAI(v, dt) {
  const ai = v.ai, tgt = player.veh || player;
  if (player.dead) { v.throttle = 0; v.hb = true; return; }
  const d = dist(v.x, v.y, tgt.x, tgt.y), los = lineClear(v.x, v.y, tgt.x, tgt.y);
  if (d < 650 && los) { G.copSeen = true; ai.mem = 6; }
  ai.mem = Math.max(0, (ai.mem || 0) - dt);
  // dismount when the criminal is on foot and close
  if (!player.veh && d < 260 && los && !ai.dismounted) {
    ai.dismounted = true; v.driver = null; v.siren = true; v.ai = { mode: 'parked' }; v.hb = true; v.throttle = 0;
    for (let k = 0; k < 2; k++) { const s = v.a + (k ? -1 : 1) * Math.PI / 2; const c = makePed('cop', v.x + Math.cos(s) * 30, v.y + Math.sin(s) * 30, {}); c.alert = true; c.memT = 10; }
    return;
  }
  if (d < 380 && los) chargeAt(v, dt, tgt.x, tgt.y, 0.97);
  else graphDrive(v, dt, ai, nearestNode(tgt.x, tgt.y), { speed: 0.95, ram: true });
  if (G.wanted >= 3 && los && d < 340 && (ai.shoot = (ai.shoot || 0) - dt) <= 0) {
    ai.shoot = 0.5; const a = Math.atan2(tgt.y - v.y, tgt.x - v.x) + rand(-.12, .12);
    const fake = { kind: 'cop', x: v.x, y: v.y, cd: 0, veh: v, a };
    fireWeapon(fake, a, 'pistol');
  }
}
function leaveAI(v, dt) {
  const ai = v.ai; graphDrive(v, dt, ai, ai.far, { speed: 0.7 });
  if (dist(v.x, v.y, player.x, player.y) > 1400 && !onScreen(v.x, v.y, 200)) v.remove = true;
}
function busted() {
  if (G.mode !== 'play') return;
  G.mode = 'busted'; G.wastedT = 0; Snd.fail();
  Banner.show('BUSTED', 'கைது', '#5c8dff', 3.2);
  if (typeof Missions !== 'undefined') Missions.playerDied();
}

// ---------------------------------------------------------------- population manager
G.popT = 0;
function walkableSpawn(x, y) {
  const t = tileAtPx(x, y);
  return t === T.SIDEWALK || t === T.PLAZA || t === T.DIRT || t === T.GRASS || (t === T.SAND && x < 144 * TS);
}
function updatePopulation(dt, fill) {
  G.popT -= dt; if (G.popT > 0 && !fill) return; G.popT = 0.2;
  const px = player.x, py = player.y;
  for (const v of vehicles) {
    const d = dist(v.x, v.y, px, py);
    if (v.mission || v.keep) continue;
    if (v.driver === player) continue;
    if (v.wreck) { if (d > 1600 || v.age > 90) v.remove = true; continue; }
    if (d > (v.free ? 1500 : 1900) && !onScreen(v.x, v.y, 200)) v.remove = true;
  }
  for (const p of peds) if (!p.keep && !p.mission && dist(p.x, p.y, px, py) > 1700 && !onScreen(p.x, p.y, 150)) p.remove = true;
  const tcount = vehicles.filter(v => v.ai && v.ai.mode === 'traffic').length;
  const ptarget = Math.round(34 * (1 - G.rain * 0.25));
  let spawned = 0;
  for (let k = 0; k < (fill ? ptarget : 1) && tcount + spawned < ptarget; k++) {
    for (let t = 0; t < 14; t++) {
      const ang = rand(0, TAU), r = fill ? rand(100, 1500) : rand(700, 1500);
      const n = nearestNode(px + Math.cos(ang) * r, py + Math.sin(ang) * r), d = randi(0, 3);
      const v = spawnTrafficAt(n, d, rand(.15, .85));
      if (!v) continue;
      if (dist(v.x, v.y, px, py) < (fill ? 160 : 600) || (!fill && onScreen(v.x, v.y, 80))) { v.remove = true; continue; }
      spawned++; break;
    }
  }
  const civs = peds.reduce((a, p) => a + (p.kind === 'civ' && !p.dead ? 1 : 0), 0);
  const target = Math.round(80 * (1 - G.rain * 0.4));
  for (let k = 0; k < (fill ? target : 3) && civs + k < target; k++) {
    for (let t = 0; t < 18; t++) {
      const ang = rand(0, TAU), r = fill ? rand(80, 1400) : rand(650, 1400);
      const x = px + Math.cos(ang) * r, y = py + Math.sin(ang) * r;
      if (!walkableSpawn(x, y)) continue;
      if (!fill && onScreen(x, y, 60)) continue;
      const dens = pedDensityAt(Math.floor(x / TS), Math.floor(y / TS));
      if (Math.random() > dens / 2.6) continue;
      const p = makePed('civ', x, y, {}); p.hd = Math.floor(Math.random() * 4) * Math.PI / 2; p.a = p.hd;
      if (pedSolidAt(x, y)) p.remove = true;
      break;
    }
  }
  // ambient foot cops near stations (a few)
  const cops = peds.reduce((a, p) => a + (p.kind === 'cop' && !p.dead && !p.mission ? 1 : 0), 0);
  if (G.wanted === 0 && cops < 4 && Math.random() < 0.05) {
    for (const m of world.markers) if (m.id === 'police' && dist(m.x, m.y, px, py) < 1200 && !onScreen(m.x, m.y, 40)) { const c = makePed('cop', m.x + rand(-60, 60), m.y + rand(-30, 30), {}); c.speed = 50; break; }
  }
  // clean up removed
  for (let i = vehicles.length - 1; i >= 0; i--) if (vehicles[i].remove) vehicles.splice(i, 1);
  for (let i = peds.length - 1; i >= 0; i--) if (peds[i].remove) peds.splice(i, 1);
}

// ---------------------------------------------------------------- drawing a person
function drawPed(c, p) {
  c.save(); c.translate(p.x, p.y);
  if (p.dead) {
    c.rotate(p.deadA); c.globalAlpha = clamp(1 - Math.max(0, p.deadT - 9) / 4, 0, 1);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1, 2, 10, 7, 0, 0, TAU); c.fill();
    c.fillStyle = p.pants || '#333'; c.beginPath(); c.ellipse(-6, 0, 5, 3, 0, 0, TAU); c.fill();
    c.fillStyle = shade(p.shirt, -25); c.beginPath(); c.ellipse(0, 0, 5, 8, 0, 0, TAU); c.fill();
    c.fillStyle = p.skin; c.beginPath(); c.arc(7, 0, 4.2, 0, TAU); c.fill();
    c.fillStyle = p.hair; c.beginPath(); c.arc(5.6, 0, 4.3, Math.PI * 0.5, Math.PI * 1.5); c.fill();
    c.restore(); return;
  }
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(2, 3, 8.5, 6.5, 0, 0, TAU); c.fill();
  c.rotate(p.a);
  const sw = p.moving ? Math.sin(p.animT) * 4.5 : 0;
  c.fillStyle = p.female ? shade(p.shirt, -30) : (p.pants || '#2a2a2e');
  c.beginPath(); c.ellipse(sw, -3, 3.8, 2.4, 0, 0, TAU); c.ellipse(-sw, 3, 3.8, 2.4, 0, 0, TAU); c.fill();
  const flash = p.hitT > 0;
  c.fillStyle = flash ? '#ffffff' : p.shirt; c.beginPath(); c.ellipse(0, 0, 4.9, 8.2, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke();
  if (p.kind === 'enemy') { c.fillStyle = '#e65100'; c.fillRect(-2, -8, 4, 16); }
  if (p.kind === 'cop') { c.fillStyle = '#6d5b2a'; c.fillRect(-4.8, -1, 9.6, 2); }
  // arms
  c.fillStyle = p.skin;
  const w = WEAPONS[p.kind === 'player' ? p.weapon : p.weapon]; const armed = (p.kind === 'player' || p.kind === 'cop' || p.kind === 'enemy') && w;
  const swing = p.swing > 0 ? 1 : 0;
  if (armed && !w.melee) { c.beginPath(); c.arc(6, 4.8, 2.3, 0, TAU); c.arc(5, -4.5, 2.3, 0, TAU); c.fill(); }
  else if (armed && w.melee && (swing || p.kind === 'player')) { c.beginPath(); c.arc(swing ? 11 : sw * 0.4 + 1, swing ? 3 : 8, 2.4, 0, TAU); c.arc(-sw * 0.4 + 1, -8, 2.4, 0, TAU); c.fill(); }
  else { c.beginPath(); c.arc(sw * 0.6, 8.6, 2.3, 0, TAU); c.arc(-sw * 0.6, -8.6, 2.3, 0, TAU); c.fill(); }
  // weapon in hand
  if (armed) {
    if (p.weapon === 'pistol') { c.fillStyle = '#1a1a1a'; c.fillRect(7, 3.6, 9, 2.6); }
    else if (p.weapon === 'smg') { c.fillStyle = '#1a1a1a'; c.fillRect(6, 3.2, 14, 3.2); c.fillRect(9, 5, 3, 4); }
    else if (p.weapon === 'shotgun') { c.fillStyle = '#4e342e'; c.fillRect(4, 3.4, 8, 3); c.fillStyle = '#1a1a1a'; c.fillRect(12, 3.6, 12, 2.4); }
    else if (p.weapon === 'bat') { c.save(); c.translate(8, 5); c.rotate(swing ? 0.9 : -0.2); c.fillStyle = '#d9b36b'; rrect(c, 0, -1.8, 24, 3.6, 1.5); c.fill(); c.restore(); }
    else if (p.weapon === 'nattu') { c.fillStyle = '#222'; c.beginPath(); c.arc(9, 4, 3, 0, TAU); c.fill(); }
  }
  // head
  c.fillStyle = flash ? '#fff' : p.skin; c.beginPath(); c.arc(1, 0, 4.9, 0, TAU); c.fill();
  c.fillStyle = p.hair; c.beginPath(); c.arc(0.4, 0, 5.1, Math.PI * 0.52, Math.PI * 1.48); c.fill();
  if (p.female) { c.beginPath(); c.arc(-5.2, 0, 2.7, 0, TAU); c.fill(); c.fillStyle = '#fff'; for (let k = -1; k <= 1; k++) { c.beginPath(); c.arc(-6.2, k * 1.7, 0.9, 0, TAU); c.fill(); } }
  if (p.kind === 'cop') { c.fillStyle = '#7a6a38'; c.beginPath(); c.arc(0.6, 0, 5.4, 0, TAU); c.fill(); c.fillStyle = '#4e4220'; c.fillRect(3, -3.5, 4, 7); }
  if (p.kind === 'player') { c.fillStyle = '#111'; c.fillRect(2.8, -3.6, 2.2, 7.2); c.fillStyle = '#e8e8e8'; c.fillRect(-4.8, -1, 9.6, 2); }
  if (p.kind === 'enemy') { c.fillStyle = '#e65100'; c.fillRect(-1, -5, 2.6, 10); }
  c.restore();
}
